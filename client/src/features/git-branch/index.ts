/**
 * 功能组件：输入框工具行的「当前分支」胶囊（`git-branch`）。
 *
 * 解决的问题：开发时常常切了分支却忘记切回来，等到提交才发现整段改动长在
 * 错误的分支上。因此这里始终显示会话工作目录当前所在的分支，并且可以直接切换。
 *
 * 组成：
 *   - 项目胶囊：显示会话所属项目名（文件夹图标），悬停显示完整目录；
 *   - 分支胶囊：显示当前分支，未提交改动时带一个小黄点；
 *   - 向上弹出的面板：搜索本地分支、点选切换、创建并切换。
 *
 * 数据来自本插件自己的 Host 路由 `/feature-hub/git`，浏览器端不执行 git，
 * 也不写任何会话数据。切换是纯粹的 git 操作，作用在会话的工作目录上。
 *
 * 刷新时机（刻意不轮询）：会话切换（cwd 变化）时读一次、点击胶囊时读一次、
 * 切换/创建分支后用响应里的新状态覆盖。用户若在终端里手动换了分支，胶囊会
 * 滞后到下次点击才更新——这是与「不要每 10 秒打一次请求」之间的取舍。
 *
 * 为什么用顶层 `popover` 而不是绝对定位：
 * 输入框所在的卡片会裁剪子元素，普通弹层会被压到输入框下面（曾经就是这个
 * bug）。`popover` 会进入浏览器顶层，不需要 react-dom 的 portal（本插件的
 * 模块表里没有 react-dom）。
 *
 * 两条容易踩的样式规则：
 *   - `display` 只能写在 `:popover-open` 上。给裸 `[popover]` 写 `display:flex`
 *     会盖掉浏览器默认的 `display:none`，关闭状态会以普通元素渲染在输入框下；
 *   - 位置在视口坐标系里，必须等面板显示后测量高度才能向上摆放。
 *
 * 目录约定：本功能独占一个文件夹——`index.ts`（组件与描述对象）、`locale.ts`（中英文字典）、`styles.ts`（样式）。
 */

import { BRANCH_NAME_MAX, BRANCH_NAME_PATTERN } from './branch-name'
import type { GitPayload, RepoState } from '../../types'
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

const { useCallback, useEffect, useRef, useState } = React

/** 本功能的字典命名空间。 */
export const BRANCH_NS = 'feature-hub.branch'

/** 页面可见时重新读取分支的间隔（毫秒）。 */
/** 面板与胶囊之间的间距（像素）。 */
const GAP = 8

/**
 * 把一个本插件的路由解析成绝对地址。
 *
 * 路径刻意保持「相对」：带前导斜杠会被钉在源站根目录，反向代理挂在子路径下
 * 时请求会打到错误的位置。
 *
 * @param subpath 插件前缀之后的路径，例如 `git`。
 * @param params 查询参数。
 * @returns 可直接 fetch 的绝对地址。
 */
function routeUrl(subpath: string, params?: Record<string, string>): string {
  const base = typeof document === 'undefined' ? 'http://dsh.internal/' : document.baseURI
  const url = new URL(`feature-hub/${subpath}`, base)
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)
  return url.href
}

/**
 * 调用 Host 的 git 路由。
 * @param cwd 会话工作目录（绝对路径）。
 * @param request 省略时执行只读查询；给出时按动作切换或创建分支。
 * @returns 统一的 `{ ok, state?, error? }` 结果。
 */
async function callGit(
  cwd: string,
  request?: { action: 'checkout' | 'create'; branch: string },
): Promise<GitPayload> {
  const response = await fetch(
    routeUrl('git', { cwd }),
    request === undefined
      ? { method: 'GET', headers: { accept: 'application/json' } }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ cwd, ...request }),
        },
  )
  return (await response.json()) as GitPayload
}

/**
 * 取路径最后一段，用作没有标题的项目兜底名称。
 * @param path 目录路径。
 * @returns 最后一段；空路径返回空串。
 */
function basename(path: string | undefined): string {
  const parts = String(path ?? '')
    .split(/[\\/]+/)
    .filter((part) => part !== '')
  return parts.length === 0 ? '' : String(parts[parts.length - 1])
}

/** 项目胶囊里的文件夹图标。 */
function FolderGlyph(): ReturnType<typeof h> {
  return h(
    'svg',
    {
      width: 13,
      height: 13,
      viewBox: '0 0 16 16',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinejoin: 'round',
    },
    h('path', {
      d: 'M1.8 4.2 A1 1 0 0 1 2.8 3.2 H6 L7.4 4.6 H13.2 A1 1 0 0 1 14.2 5.6 V11.4 A1 1 0 0 1 13.2 12.4 H2.8 A1 1 0 0 1 1.8 11.4 Z',
    }),
  )
}

/** 分支胶囊与面板里的分支图标。 */
function BranchGlyph(props: { size?: number }): ReturnType<typeof h> {
  const size = props.size ?? 14
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    h('circle', { cx: 4.4, cy: 3.6, r: 1.7 }),
    h('circle', { cx: 4.4, cy: 12.4, r: 1.7 }),
    h('circle', { cx: 11.6, cy: 6.4, r: 1.7 }),
    h('path', { d: 'M4.4 5.3 V10.7' }),
    h('path', { d: 'M11.6 8.1 C11.6 10.6 8.6 10.9 6.1 11.6' }),
  )
}

/**
 * 「当前分支」胶囊与切换面板。
 * @param props 插槽标准 props：`sessionId`、`useSessions`、`useWorkspaces` 与本功能字典。
 * @returns 控件元素；会话没有工作目录、或目录不是 git 仓库时不渲染任何东西。
 */
export function BranchChip(props: ComposerLeftProps): ReturnType<typeof h> | null {
  const { t, sessionId } = props
  // 会话所属项目：优先用工作区标题，没有标题时退回目录名。
  const projectTitle = props.useWorkspaces((snapshot: WorkspaceSnapshot): string => {
    for (const item of snapshot.items) {
      if (item.sessionIds.includes(sessionId)) return item.title === '' ? basename(item.path) : item.title
    }
    return ''
  })
  const cwd = props.useSessions((snapshot: SessionListState): string | undefined => {
    const row = snapshot.byId[sessionId]
    return row === undefined ? undefined : row.cwd
  })
  // 是否正在执行：决定切换分支的警告语气。
  const running = props.useSessions((snapshot: SessionListState): boolean => {
    const row = snapshot.byId[sessionId]
    return row === undefined ? false : row.running === true
  })
  // 是否还是一个没跑过的新会话：没跑过就没有代码可丢，切换无需确认。
  const blank = props.useSessions((snapshot: SessionListState): boolean => {
    const row = snapshot.byId[sessionId]
    return row === undefined ? true : row.blank === true
  })
  const [state, setState] = useState<RepoState | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  /** 重新读取仓库状态；目录缺失或不是仓库时隐藏控件而不是报错。 */
  const load = useCallback(async (): Promise<void> => {
    if (typeof cwd !== 'string' || cwd === '') return
    try {
      const payload = await callGit(cwd)
      if (payload.ok && payload.state !== undefined) {
        setState(payload.state)
        setError('')
      } else {
        setState(null)
        setError('')
      }
    } catch (_failure) {
      setState(null)
    }
  }, [cwd])

  // 只在会话（cwd）变化时读一次。不设定时器、不听 focus：
  // 切分支是低频人工操作，轮询只会白白打请求。用户手动切过分支后，
  // 再点一次胶囊即可刷新（toggle 里会调 load）。
  useEffect(() => {
    void load()
  }, [load])

  /** 把面板摆到胶囊正上方（视口坐标系，且不超出左右边界）。 */
  const place = useCallback((): void => {
    const panel = panelRef.current
    const chip = chipRef.current
    if (panel === null || chip === null) return
    const chipRect = chip.getBoundingClientRect()
    const top = Math.max(GAP, chipRect.top - panel.offsetHeight - GAP)
    const left = Math.min(
      Math.max(GAP, window.innerWidth - panel.offsetWidth - GAP),
      Math.max(GAP, chipRect.left),
    )
    panel.style.top = `${Math.round(top)}px`
    panel.style.left = `${Math.round(left)}px`
  }, [])

  // 打开/关闭顶层 popover；不支持 Popover API 时退化成普通定位面板。
  useEffect(() => {
    const panel = panelRef.current
    if (panel === null) return
    if (typeof panel.showPopover !== 'function') {
      panel.classList.toggle('fh-br-pop-fallback', open)
      if (open) place()
      return
    }
    if (open && !panel.matches(':popover-open')) {
      panel.showPopover()
      window.requestAnimationFrame(() => {
        place()
        searchRef.current?.focus()
      })
    }
    if (!open && panel.matches(':popover-open')) panel.hidePopover()
  }, [open, state?.branches.length, place])

  // 面板被关闭（点外部、Esc）时同步状态；窗口尺寸变化时重新摆放。
  useEffect(() => {
    const panel = panelRef.current
    if (panel === null) return
    const onToggle = (event: Event): void => {
      const popoverEvent = event as Event & { newState?: string }
      if (popoverEvent.newState === 'closed') {
        setOpen(false)
        setQuery('')
      } else {
        place()
      }
    }
    panel.addEventListener('toggle', onToggle)
    window.addEventListener('resize', place)
    return () => {
      panel.removeEventListener('toggle', onToggle)
      window.removeEventListener('resize', place)
    }
  }, [place])

  if (typeof cwd !== 'string' || cwd === '' || state === null) return null

  const label = state.detached ? t('detached') : state.branch
  const needle = query.trim().toLowerCase()
  const branches = state.branches.filter(
    (name: string) => needle === '' || name.toLowerCase().includes(needle),
  )

  /**
   * 执行一次切换或创建，并把结果写回面板。
   * @param request 动作与分支名。
   */
  const run = async (request: { action: 'checkout' | 'create'; branch: string }): Promise<void> => {
    setBusy(true)
    try {
      const payload = await callGit(cwd, request)
      if (payload.ok && payload.state !== undefined) {
        setState(payload.state)
        setError('')
        setOpen(false)
      } else {
        setError(payload.error?.message ?? t('error.generic'))
      }
    } catch (_failure) {
      setError(t('error.unreachable'))
    } finally {
      setBusy(false)
    }
  }

  /** 校验新分支名并创建；名字不合法时直接在面板里提示。 */
  const create = (): void => {
    const name = draft.trim()
    if (name === '' || name.length > BRANCH_NAME_MAX || !BRANCH_NAME_PATTERN.test(name)) {
      setError(t('error.branchName'))
      return
    }
    void run({ action: 'create', branch: name })
    setDraft('')
  }

  return h(
    'span',
    { className: 'fh-br' },
    h(
      'span',
      { className: 'fh-br-project', title: cwd },
      h(FolderGlyph),
      h(
        'span',
        { className: 'fh-br-project-name' },
        projectTitle === '' ? t('project.unknown') : projectTitle,
      ),
    ),
    h(
      'button',
      {
        ref: chipRef,
        type: 'button',
        className: 'fh-br-chip',
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-label': t('chip.label', { branch: label }),
        title: state.root,
        onClick: () => {
          setError('')
          setOpen((current) => !current)
          void load()
        },
      },
      h(BranchGlyph, { size: 14 }),
      h('span', { className: 'fh-br-name' }, label),
      state.dirty > 0
        ? h('span', { className: 'fh-br-dirty', title: t('dirty', { count: state.dirty }) })
        : null,
    ),
    h(
      'div',
      {
        ref: panelRef,
        popover: 'auto',
        className: 'fh-br-pop',
        role: 'dialog',
        'aria-label': t('popover.label'),
      },
      // 已开始工作的会话才需要确认：切分支可能让未提交的改动没地方放。
      pending === null
        ? null
        : h(
            'div',
            { className: 'fh-br-warn', role: 'alertdialog' },
            h(
              'div',
              { className: 'fh-br-warn-text' },
              t(running ? 'warn.running' : 'warn.text', { branch: pending, count: state.dirty }),
            ),
            h(
              'div',
              { className: 'fh-br-warn-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'fh-br-warn-cancel',
                  onClick: () => {
                    setPending(null)
                  },
                },
                t('warn.cancel'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'fh-br-warn-confirm',
                  disabled: busy,
                  onClick: () => {
                    const branch = pending
                    setPending(null)
                    if (branch !== null) void run({ action: 'checkout', branch })
                  },
                },
                t('warn.confirm'),
              ),
            ),
          ),
      h(
        'div',
        { className: 'fh-br-pop-head' },
        h('span', { className: 'fh-br-pop-title' }, t('popover.title')),
        h('span', { className: 'fh-br-pop-current' }, label),
      ),
      h('input', {
        ref: searchRef,
        className: 'fh-br-search',
        type: 'text',
        value: query,
        placeholder: t('popover.search'),
        'aria-label': t('popover.search'),
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          setQuery(event.currentTarget.value)
        },
      }),
      h(
        'div',
        { className: 'fh-br-list' },
        branches.length === 0
          ? h(
              'div',
              { className: 'fh-br-empty' },
              t(state.unborn ? 'popover.unborn' : 'popover.empty', { branch: label }),
            )
          : branches.map((name: string) =>
              h(
                'button',
                {
                  key: name,
                  type: 'button',
                  className: name === state.branch ? 'fh-br-item fh-br-item-current' : 'fh-br-item',
                  disabled: busy,
                  onClick: () => {
                    // 新会话没有东西可丢，直接切；跑过或正在跑的会话先确认。
                    if (!blank || running) setPending(name)
                    else void run({ action: 'checkout', branch: name })
                  },
                },
                h('span', { className: 'fh-br-item-name' }, name),
                name === state.branch ? h('span', { className: 'fh-br-check' }, t('popover.current')) : null,
              ),
            ),
      ),
      h(
        'div',
        { className: 'fh-br-create' },
        h('input', {
          className: 'fh-br-search',
          type: 'text',
          value: draft,
          placeholder: t('popover.createPlaceholder'),
          'aria-label': t('popover.createPlaceholder'),
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            setDraft(event.currentTarget.value)
          },
          onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            create()
          },
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'fh-br-create-button',
            disabled: busy || draft.trim() === '',
            onClick: create,
          },
          t('popover.create'),
        ),
      ),
      error === '' ? null : h('div', { className: 'fh-br-error', role: 'alert' }, error),
    ),
  )
}

/** 中文文案。 */
import { styles } from './styles'
import { en, zh } from './locale'

export const gitBranchFeature = {
  id: 'git-branch',
  order: 5,
  locale: { ns: BRANCH_NS, dicts: { zh, en } },
  styles,
  component: BranchChip,
}
