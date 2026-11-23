/**
 * 本文件是插件的 Host 半边。
 *
 * 浏览器端拿不到文件系统、git 与 Windows 通知平台，这几类能力必须由 Host 提供：
 * 这里注册一条本插件自己的前缀路由，按子路径分发。
 *
 *   GET  /feature-hub/git?cwd=<绝对目录>        读取分支状态
 *   POST /feature-hub/git  { cwd, action, ... }  读取、切换或创建分支
 *   GET  /feature-hub/notify/prefs               读取「任务提醒」偏好
 *   POST /feature-hub/notify/prefs { enabled, … } 保存「任务提醒」偏好
 *   POST /feature-hub/notify { title, body, tag } 弹一条 Windows 系统通知
 *
 * 通知为什么要绕到 Host：渲染进程的 `Notification` 在 `dsh-app://` 页面上
 * 能构造、权限也显示 granted，但不会进入 Windows 通知中心；而 Host 用
 * PowerShell 调 WinRT（AUMID 用 Electron 默认的 `electron.app.<应用名>`，
 * 与安装器的开始菜单快捷方式一致）可以正常投递，并且窗口最小化 / 关闭到
 * 托盘时 Host 仍在运行。
 *
 * 提醒偏好也放在 Host：同一个应用可能同时有多个渲染进程（主窗口、浏览器
 * 镜像页、远程访问的客户端），各自的 localStorage 互不相通；把偏好落到
 * `$DSH_HOME/feature-hub/notify-prefs.json` 后，`/notify` 自己就能按总开关
 * 拒绝对任何客户端弹通知，「关掉开关」才是全局生效的。
 *
 * 安全边界：
 *   - 路由先做认证检查，未认证请求拿不到任何能力；
 *   - 只接受「绝对路径 + 真实存在的目录 + 确实是 git 工作树」；
 *   - git 一律通过 `execFile` 传参数组执行，绝不拼接 shell 字符串；
 *   - 分支名在服务端再次校验（字母数字与 `._/-`，长度不超过 120）；
 *   - 通知文案通过环境变量传给 PowerShell（`-EncodedCommand` + 固定脚本），
 *     不拼接命令，标题/正文都有长度上限。
 */

import { execFile, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

import type { GitActionInput, NotifyPrefs, RepoState } from './types/wire'

const runFile = promisify(execFile)

/** 本插件占用的路由前缀。 */
export const ROUTE_PREFIX = '/feature-hub'

/** git 命令的硬超时：一条卡住的命令不能把 HTTP 请求一直挂住。 */
const GIT_TIMEOUT_MS = 10_000

/** 允许创建的分支名：与 git 的 ref 规则大致对齐，同时挡住注入字符。 */
const BRANCH_NAME = /^[A-Za-z0-9._/-]{1,120}$/

/** 通知标题/正文/分组标识的长度上限，避免一次请求把环境变量撑爆。 */
const NOTIFY_TITLE_MAX = 120
const NOTIFY_BODY_MAX = 300
const NOTIFY_TAG_MAX = 200

/** 同一 tag 的重复投递合并窗口：多个窗口对同一事件各发一次时只弹一条。 */
const NOTIFY_DEDUPE_MS = 2_000

/** PowerShell 弹 toast 的超时：脚本起不来时别把 HTTP 请求挂死。 */
const TOAST_TIMEOUT_MS = 15_000

/** 没有存过偏好时的默认值：全部开启，功能装好即可见。 */
const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  enabled: true,
  completed: true,
  failed: true,
  asked: true,
  system: true,
}

/** 最近弹过的通知 tag → 时间戳；只在 Host 进程内存在，用来合并多窗口的重复投递。 */
const recentNotifyTags = new Map<string, number>()

/**
 * 在 Windows 上弹一条原生通知的 PowerShell 脚本（固定内容）。
 *
 * 文案只通过 `FH_TITLE` / `FH_BODY` 环境变量传入，脚本本身不含任何调用方
 * 数据，因此不存在命令注入；`launch` 指向应用已注册的 `dsh://open`，
 * 点击通知会把窗口从最小化/托盘里拉回来。
 */
const TOAST_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
  '$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
  "$texts = $xml.GetElementsByTagName('text')",
  '$texts.Item(0).AppendChild($xml.CreateTextNode($env:FH_TITLE)) | Out-Null',
  '$texts.Item(1).AppendChild($xml.CreateTextNode($env:FH_BODY)) | Out-Null',
  "$xml.DocumentElement.SetAttribute('launch', 'dsh://open')",
  "$xml.DocumentElement.SetAttribute('activationType', 'protocol')",
  '$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)',
  '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:FH_AUMID).Show($toast)',
].join('; ')

/** 预先编码成 PowerShell `-EncodedCommand` 需要的 UTF-16LE Base64。 */
const TOAST_COMMAND = Buffer.from(TOAST_SCRIPT, 'utf16le').toString('base64')

/**
 * 本应用在 Windows 通知平台里的 AUMID。
 *
 * Electron 打包应用默认使用 `electron.app.<应用名>`；安装器写进开始菜单
 * 快捷方式的正是这个值（实测与 `Get-StartApps` 一致）。
 * @returns AUMID 字符串。
 */
function toastAppId(): string {
  const exe = process.execPath
  return `electron.app.${basename(exe, extname(exe))}`
}

/**
 * 启动 PowerShell 弹 toast 的子进程。
 * @param title 通知标题。
 * @param body 通知正文。
 * @returns 子进程；spawn 同步失败时返回 undefined。
 */
function spawnToastProcess(title: string, body: string): ReturnType<typeof spawn> | undefined {
  try {
    return spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        TOAST_COMMAND,
      ],
      {
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, FH_TITLE: title, FH_BODY: body, FH_AUMID: toastAppId() },
      },
    )
  } catch (_error) {
    return undefined
  }
}

/**
 * 用 PowerShell + WinRT 投递一条 Windows 系统通知。
 * @param title 通知标题（已裁剪）。
 * @param body 通知正文（已裁剪）。
 * @returns 是否成功投递；非 Windows 或 PowerShell 失败时返回 false。
 */
function showWindowsToast(title: string, body: string): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    /** 只结算一次，避免 exit 与 timeout 双触发。 */
    const finish = (shown: boolean): void => {
      if (settled) return
      settled = true
      resolve(shown)
    }
    const child = spawnToastProcess(title, body)
    if (child === undefined) {
      finish(false)
      return
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch (_error) {
        // 已经退出时 kill 会抛错，忽略即可。
      }
      finish(false)
    }, TOAST_TIMEOUT_MS)
    child.once('error', () => {
      clearTimeout(timer)
      finish(false)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      finish(code === 0)
    })
    child.unref()
  })
}

/**
 * 「任务提醒」偏好文件的位置。
 *
 * 放在 `$DSH_HOME/feature-hub/` 下（默认 `~/.dsh`），与 profile 无关：
 * 同一台机器上的所有渲染进程、所有 profile 共享同一份开关，才符合「总开关」
 * 的语义。DSH 没给环境变量时退回用户目录，避免写到相对路径上。
 * @returns 偏好文件的绝对路径。
 */
function notifyPrefsFile(): string {
  const home =
    process.env.DSH_HOME === undefined || process.env.DSH_HOME === ''
      ? join(homedir(), '.dsh')
      : process.env.DSH_HOME
  return join(home, 'feature-hub', 'notify-prefs.json')
}

/** 把一个未知值收敛成布尔；不是布尔时用回退值。 */
function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 读取 Host 上保存的提醒偏好。
 * @returns `stored` 表示文件是否真的存在（false 时调用方可以把自己那份推上来做初始值）；
 *   `prefs` 是逐字段校验后的偏好，文件缺失或损坏时全是默认值。
 */
function readNotifyPrefs(): { stored: boolean; prefs: NotifyPrefs } {
  let raw: string
  try {
    raw = readFileSync(notifyPrefsFile(), 'utf8')
  } catch (_error) {
    return { stored: false, prefs: DEFAULT_NOTIFY_PREFS }
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { stored: true, prefs: DEFAULT_NOTIFY_PREFS }
    const record = parsed as Record<string, unknown>
    return {
      stored: true,
      prefs: {
        enabled: booleanOr(record.enabled, DEFAULT_NOTIFY_PREFS.enabled),
        completed: booleanOr(record.completed, DEFAULT_NOTIFY_PREFS.completed),
        failed: booleanOr(record.failed, DEFAULT_NOTIFY_PREFS.failed),
        asked: booleanOr(record.asked, DEFAULT_NOTIFY_PREFS.asked),
        system: booleanOr(record.system, DEFAULT_NOTIFY_PREFS.system),
      },
    }
  } catch (_error) {
    return { stored: true, prefs: DEFAULT_NOTIFY_PREFS }
  }
}

/**
 * 保存提醒偏好并回读实际内容。
 * @param prefs 完整偏好。
 * @returns 实际生效的偏好（读不出来时返回入参）。
 * @throws 目录或文件无法写入时抛错（调用方会把它折成 JSON 错误）。
 */
function writeNotifyPrefs(prefs: NotifyPrefs): NotifyPrefs {
  const file = notifyPrefsFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(prefs)}\n`, 'utf8')
  return prefs
}

/**
 * 把请求体里出现的布尔字段合并进当前偏好；没出现的字段保持原值。
 * @param current 当前偏好。
 * @param body 请求体（字段类型未知）。
 * @returns 合并后的完整偏好。
 */
function mergeNotifyPrefs(current: NotifyPrefs, body: Record<string, unknown>): NotifyPrefs {
  return {
    enabled: booleanOr(body.enabled, current.enabled),
    completed: booleanOr(body.completed, current.completed),
    failed: booleanOr(body.failed, current.failed),
    asked: booleanOr(body.asked, current.asked),
    system: booleanOr(body.system, current.system),
  }
}

/**
 * 判断同一个 tag 是否刚刚弹过，并顺手清掉过期记录。
 * @param tag 调用方给的事件分组标识。
 * @param now 当前时间。
 * @returns 命中合并窗口时返回 true。
 */
function isDuplicateTag(tag: string, now: number): boolean {
  if (recentNotifyTags.size > 200) {
    for (const [key, stamp] of recentNotifyTags) {
      if (now - stamp > 60_000) recentNotifyTags.delete(key)
    }
  }
  const previous = recentNotifyTags.get(tag)
  if (previous !== undefined && now - previous < NOTIFY_DEDUPE_MS) return true
  recentNotifyTags.set(tag, now)
  return false
}

/**
 * 处理 `/feature-hub/notify/prefs`：读取或保存提醒偏好。
 * @param req 已通过认证的请求。
 * @param res 响应对象。
 */
async function prefsRoute(req: HostRequest, res: HostResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const { stored, prefs } = readNotifyPrefs()
      json(res, 200, { ok: true, stored, prefs })
      return
    }
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: { code: 'method-not-allowed', message: 'use GET or POST' } })
      return
    }
    const body = await readJson(req)
    const saved = writeNotifyPrefs(mergeNotifyPrefs(readNotifyPrefs().prefs, body))
    json(res, 200, { ok: true, stored: true, prefs: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    json(res, 200, { ok: false, error: { code: 'prefs-failed', message } })
  }
}

/**
 * 处理 `/feature-hub/notify`：按 Host 上的偏好决定是否投递通知。
 *
 * 三道门依次是：总开关（关了就谁也别弹）、分组去重（同一事件的多个客户端
 * 只弹一次）、系统通知开关（关了就不弹 toast，由客户端退回窗口内提醒）。
 *
 * @param req 已通过认证的请求。
 * @param res 响应对象。
 */
async function notifyRoute(req: HostRequest, res: HostResponse): Promise<void> {
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: { code: 'method-not-allowed', message: 'use POST' } })
    return
  }
  try {
    const body = await readJson(req)
    const { prefs } = readNotifyPrefs()
    if (!prefs.enabled) {
      json(res, 200, { ok: true, shown: false, blocked: true })
      return
    }
    const tag = typeof body.tag === 'string' ? body.tag.trim().slice(0, NOTIFY_TAG_MAX) : ''
    if (tag !== '' && isDuplicateTag(tag, Date.now())) {
      json(res, 200, { ok: true, shown: false, duplicate: true })
      return
    }
    if (!prefs.system) {
      json(res, 200, { ok: true, shown: false })
      return
    }
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, NOTIFY_TITLE_MAX) : ''
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, NOTIFY_BODY_MAX) : ''
    if (title === '') throw new Error('title is required')
    const shown = await showWindowsToast(title, text)
    json(res, 200, { ok: true, shown })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    json(res, 200, { ok: false, error: { code: 'notify-failed', message } })
  }
}

/** Host 侧 `connection` 服务里本插件用到的那一小部分。 */
interface ConnectionFace {
  requestRejection?(request: {
    headers: Record<string, string | string[] | undefined>
  }): 401 | 403 | undefined
}

/**
 * 在指定目录里执行一条 git 命令。
 * @param cwd 绝对工作目录（作为 `git -C` 的目标）。
 * @param args `-C cwd` 之后的参数，按数组传递，不经过 shell。
 * @returns 去掉首尾空白的标准输出。
 */
async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await runFile('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  return String(stdout)
}

/**
 * 校验调用方传来的目录参数。
 * @param value 待校验值。
 * @returns 校验通过的绝对路径。
 * @throws 路径缺失、不是绝对路径、不存在或不是目录时抛错。
 */
function directory(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new Error('cwd is required')
  if (!isAbsolute(value)) throw new Error('cwd must be an absolute path')
  const info = statSync(value)
  if (!info.isDirectory()) throw new Error('cwd is not a directory')
  return value
}

/**
 * 读取一个仓库的分支状态。
 * @param cwd 工作树内的绝对目录。
 * @returns `{ root, branch, detached, unborn, branches, dirty }`。
 * @throws 目录不在 git 工作树内时抛错。
 */
async function readState(cwd: string): Promise<RepoState> {
  const inside = (await git(cwd, ['rev-parse', '--is-inside-work-tree'])).trim()
  if (inside !== 'true') throw new Error('not a git work tree')
  const root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim()
  // 还没有任何提交的仓库是「未出生 HEAD」：`symbolic-ref` 仍能给出分支名，
  // 而 `rev-parse HEAD` 会直接失败，所以两条路径要分开走。
  let branch: string
  let unborn = false
  try {
    branch = (await git(cwd, ['symbolic-ref', '--short', 'HEAD'])).trim()
    unborn = await git(cwd, ['rev-parse', '--verify', 'HEAD']).then(
      () => false,
      () => true,
    )
  } catch (_error) {
    branch = (await git(cwd, ['rev-parse', '--short', 'HEAD'])).trim()
  }
  const listed = await git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  const branches: string[] = listed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const status = await git(cwd, ['status', '--porcelain'])
  const dirty = status.split('\n').filter((line) => line.trim() !== '').length
  // 首次提交前分支还没有 ref，`for-each-ref` 会是空的；把当前分支补进列表，
  // 否则全新仓库的分支面板就是一个空框。
  if (branch !== 'HEAD' && !branches.includes(branch)) branches.unshift(branch)
  return { root, branch, detached: branch === 'HEAD', unborn, branches, dirty }
}

/**
 * 以 JSON 形式回写一条响应。
 * @param res 响应对象。
 * @param status HTTP 状态码。
 * @param body 可序列化的响应体。
 */
function json(res: HostResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(text)),
  })
  res.end(text)
}

/**
 * 读取并解析 JSON 请求体（有大小上限）。
 * @param req 请求对象（异步可迭代）。
 * @returns 解析出的对象；空请求体返回空对象。
 * @throws 请求体超过 64 KiB 或不是 JSON 对象时抛错。
 */
async function readJson(req: HostRequest): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes: Buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    size += bytes.length
    if (size > 64 * 1024) throw new Error('request body too large')
    chunks.push(bytes)
  }
  if (size === 0) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (parsed === null || typeof parsed !== 'object') throw new Error('body must be an object')
  return parsed as Record<string, unknown>
}

/**
 * 执行一次 git 操作并返回操作后的最新状态。
 * @param input 调用参数：目录、动作、分支名，创建时可选起点。
 * @returns 操作完成后的仓库状态。
 * @throws 目录非法、分支名非法或 git 命令失败时抛错（错误信息来自 git 原文）。
 */
async function applyAction(input: GitActionInput): Promise<RepoState> {
  const cwd = directory(input.cwd)
  const action = input.action === undefined ? 'read' : input.action
  if (action === 'read' || action === 'branches') return readState(cwd)
  const branch = typeof input.branch === 'string' ? input.branch.trim() : ''
  if (!BRANCH_NAME.test(branch)) throw new Error('invalid branch name')
  if (action === 'checkout') {
    await git(cwd, ['checkout', branch])
    return readState(cwd)
  }
  if (action === 'create') {
    const from = typeof input.from === 'string' && input.from !== '' ? input.from : ''
    // 默认从当前 HEAD 拉新分支；显式给起点时支持「从某个分支切出来」。
    await git(cwd, from === '' ? ['checkout', '-b', branch] : ['checkout', '-b', branch, from])
    return readState(cwd)
  }
  throw new Error(`unknown action: ${String(action)}`)
}

/**
 * 注册本插件的 Host 路由（git 与通知）。
 * @param ctx Host 上下文（需要 `webServer`，可能提供 `connection`）。
 */
export function apply(ctx: HostContext): void {
  const connection = ctx.get('connection') as ConnectionFace | undefined
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req: HostRequest, res: HostResponse) => {
          // 与内置路由一致的准入检查：未认证的请求不允许到达 git。
          if (connection !== undefined && typeof connection.requestRejection === 'function') {
            const rejection = connection.requestRejection(req)
            if (rejection !== undefined) {
              json(res, rejection, {
                ok: false,
                error: { code: 'unauthorized', message: 'authentication required' },
              })
              return
            }
          }
          const url = new URL(req.url === undefined ? '/' : req.url, 'http://dsh.internal')
          if (url.pathname === `${ROUTE_PREFIX}/notify`) {
            await notifyRoute(req, res)
            return
          }
          if (url.pathname === `${ROUTE_PREFIX}/notify/prefs`) {
            await prefsRoute(req, res)
            return
          }
          if (url.pathname !== `${ROUTE_PREFIX}/git`) {
            json(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown route' } })
            return
          }
          try {
            let input: GitActionInput
            if (req.method === 'POST') {
              const body = await readJson(req)
              input = {
                cwd: typeof body.cwd === 'string' ? body.cwd : '',
                action: typeof body.action === 'string' ? (body.action as GitActionInput['action']) : 'read',
                branch: typeof body.branch === 'string' ? body.branch : undefined,
                from: typeof body.from === 'string' ? body.from : undefined,
              }
            } else {
              input = {
                cwd: url.searchParams.get('cwd') ?? '',
                action: (url.searchParams.get('action') ?? 'read') as GitActionInput['action'],
                branch: url.searchParams.get('branch') ?? undefined,
              }
            }
            const state = await applyAction(input)
            json(res, 200, { ok: true, state })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            json(res, 200, { ok: false, error: { code: 'git-failed', message } })
          }
        },
      }),
    'feature-hub:git route',
  )
}

/** Host 半边依赖的服务：只有 web 服务器；`connection` 通过 `ctx.get` 可选获取。 */
export const inject = ['webServer']
