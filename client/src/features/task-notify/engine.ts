/**
 * 任务提醒引擎：把 DSH 的会话状态翻译成「Windows 系统通知」。
 *
 * 触发点只有三个：
 *   1. `api-session/error`：一轮回答因错误结束 → 失败提醒（带错误摘要）；
 *   2. 会话状态 `running: true → false`：一轮回答结束 → 完成提醒；
 *   3. 会话出现 `pendingInteraction`：等待用户批准/回答 → 询问提醒。
 *
 * 通知走渲染进程的 Web Notification（Electron 把它显示为 Windows 通知中心
 * 的 toast）：窗口最小化、或关闭到系统托盘时渲染进程仍在运行，所以仍然收得到；
 * 从托盘彻底退出应用后才停止。窗口内右下角的 toast 只在系统通知发不出去时
 * （没有 Notification、权限被拒、或用户关掉系统通知开关）作为兜底出现。
 *
 * 数据全部只读：远程事件、`uiSession.sessionStatus` 快照与会话列表快照；
 * 不扫会话日志、不改会话数据。子代理会话、草稿会话、已归档会话不提醒。
 *
 * 重要取舍：
 *   - 首次快照只用来建立基线，避免刷新页面时把「当前正在运行/等待」当成新事件；
 *   - 失败提醒之后 5 秒内同一会话的「完成」不再提醒，否则一次报错会弹两条；
 *   - 同一会话同一类事件 2 秒内只提醒一次，挡住错误事件的连发。
 */

import { closeDesktopNotices, postDesktopNotice, requestDesktopNotifyPermission } from './desktop-notify'
import { readNotifyPreferences, subscribeNotifyPreferences, type NotifyPreferences } from './preferences'
import type { ClientContext } from '../../types'

/** 一条提醒属于哪一类事件。 */
export type TaskNoticeKind = 'completed' | 'failed' | 'asked'

/** 询问类提醒的细分：批准、回答、其它交互。 */
export type TaskAskKind = 'approval' | 'question' | 'other'

/** 引擎交给界面渲染的一条提醒（不可变快照元素）。 */
export interface TaskNotice {
  /** 本次提醒的唯一 id，用于 React key 与关闭。 */
  readonly id: string
  /** 提醒类别，决定标题文案与图标。 */
  readonly kind: TaskNoticeKind
  /** 关联会话，点击提醒时打开它。 */
  readonly sessionId: string
  /** 会话标题；会话行还没到时用兜底文案。 */
  readonly title: string
  /** 失败摘要；完成/询问为 null。 */
  readonly detail: string | null
  /** 询问类提醒的具体原因；非询问为 null。 */
  readonly ask: TaskAskKind | null
  /** 产生提醒的时间（毫秒时间戳）。 */
  readonly createdAt: number
}

/** 界面可从引擎读到的能力（通过插槽注入，不直接持有引擎）。 */
export interface TaskNotifyFace {
  /** 当前提醒快照；每次变化都返回新数组，便于 React 比较。 */
  toasts(): readonly TaskNotice[]
  /** 订阅提醒快照变化。 */
  subscribe(listener: () => void): () => void
  /** 关闭一条提醒。 */
  dismiss(id: string): void
  /** 打开提醒关联的会话。 */
  open(sessionId: string): void
}

/** 引擎句柄：`face` 交给浮动层组件，`dispose` 由插件卸载时调用。 */
export interface TaskNotifyEngine {
  /** 注入给 `shell.overlay` 组件的能力。 */
  readonly face: TaskNotifyFace
  /** 退订全部事件、清掉定时器并关闭已打开的系统通知。 */
  dispose(): void
}

/** 窗口内提醒的停留时间。 */
const TOAST_LIFETIME_MS = 8_000

/** 最多同时显示几条，超出的挤掉最旧的。 */
const MAX_TOASTS = 4

/** 同一会话同类提醒的合并窗口，挡住错误事件连发。 */
const DEDUPE_MS = 2_000

/** 失败提醒之后多久内结束，不再重复提醒「完成」。 */
const FAILURE_SUPPRESS_MS = 5_000

/** 错误摘要的最大字符数（系统通知与 toast 都只展示一行摘要）。 */
const DETAIL_MAX_CHARS = 180

/** 会话列表服务里本引擎用到的一小部分。 */
interface SessionsFace {
  readonly list: {
    getSnapshot(): SessionListState
  }
}

/** 会话状态源（`uiSession.sessionStatus`）。 */
interface StatusFace {
  getSnapshot(): SessionStatusSnapshot
  subscribe(listener: () => void): () => void
}

/** `uiSession` 服务里本引擎用到的一小部分。 */
interface UiSessionFace {
  readonly sessionStatus?: StatusFace
}

/** 远程事件服务里本引擎用到的一小部分。 */
interface RemoteFace {
  $on(event: string, listener: (...args: readonly unknown[]) => void): () => void
}

/** 待交互值的宽松视图：只有 key/kind 是稳定字段。 */
interface InteractionView {
  readonly key?: unknown
  readonly kind?: unknown
}

/**
 * 把错误信息压成一行摘要。
 * @param text 原始错误文本（可能含换行与堆栈）。
 * @returns 折叠空白后的短文本。
 */
function summarize(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= DETAIL_MAX_CHARS) return flat
  return `${flat.slice(0, DETAIL_MAX_CHARS - 1)}…`
}

/**
 * 把待交互的 `kind` 归成三种文案类别。
 * @param value 域自己声明的 kind。
 * @returns 批准、回答或其它。
 */
function askKindOf(value: unknown): TaskAskKind {
  if (value === 'approval') return 'approval'
  if (value === 'question' || value === 'plan-review') return 'question'
  return 'other'
}

/**
 * 把状态快照摊平成 `[会话 id, 状态]` 列表。
 * @param snapshot 可能是 Map，也可能是普通对象（装载方式不同）。
 * @returns 与快照内容一致的条目。
 */
function entriesOf(snapshot: SessionStatusSnapshot): Array<[string, SessionStatus]> {
  const out: Array<[string, SessionStatus]> = []
  const map = snapshot as ReadonlyMap<string, SessionStatus>
  if (map !== null && map !== undefined && typeof map.forEach === 'function') {
    map.forEach((status, sessionId) => {
      out.push([String(sessionId), status])
    })
    return out
  }
  return Object.entries(snapshot as Readonly<Record<string, SessionStatus>>)
}

/**
 * 一条提醒的补充文案：失败给错误摘要，询问给具体原因，完成没有补充。
 * @param notice 提醒。
 * @param t 本功能的翻译函数。
 * @returns 用于 toast 第二/三行与系统通知正文的补充文本；没有时返回空串。
 */
export function noticeDetailText(notice: TaskNotice, t: Translate): string {
  if (notice.kind === 'asked') return t(`asked.${notice.ask ?? 'other'}`)
  return notice.detail ?? ''
}

/**
 * 组装系统通知正文：会话标题 + 补充说明。
 * @param notice 提醒。
 * @param t 本功能的翻译函数。
 * @returns 一行正文。
 */
function bodyOf(notice: TaskNotice, t: Translate): string {
  const extra = noticeDetailText(notice, t)
  return extra === '' ? notice.title : `${notice.title} — ${extra}`
}

/**
 * 创建任务提醒引擎。所有订阅立即生效，卸载时必须调用 {@link TaskNotifyEngine.dispose}。
 * @param ctx 客户端上下文（用 `get` 取可选服务，用 `uiWorkspace` 打开会话）。
 * @param t 本功能命名空间的翻译函数。
 * @returns 引擎句柄。
 */
export function createTaskNotifyEngine(ctx: ClientContext, t: Translate): TaskNotifyEngine {
  let preferences: NotifyPreferences = readNotifyPreferences()
  let toasts: TaskNotice[] = []
  let pending = new Map<string, string>()
  let baseline = false
  let sequence = 0
  let disposed = false
  const listeners = new Set<() => void>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const disposers: Array<() => void> = []
  /** 上次观察到的运行状态，用来识别「刚刚结束」。 */
  const running = new Map<string, boolean>()
  /** 会话最近一次失败的时间，用来抑制紧随其后的「完成」提醒。 */
  const failures = new Map<string, number>()
  /** 同类提醒的最近发生时间，用来合并连发事件。 */
  const recent = new Map<string, number>()

  /** 通知所有界面订阅者快照已变化。 */
  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  /**
   * 清掉某条提醒的自动关闭定时器。
   * @param id 提醒 id。
   */
  const clearTimer = (id: string): void => {
    const timer = timers.get(id)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.delete(id)
  }

  /**
   * 关闭一条提醒。
   * @param id 提醒 id；不存在时无操作。
   */
  const dismiss = (id: string): void => {
    clearTimer(id)
    if (!toasts.some((notice) => notice.id === id)) return
    toasts = toasts.filter((notice) => notice.id !== id)
    emit()
  }

  /**
   * 打开提醒关联的会话。
   * @param sessionId 会话 id。
   */
  const open = (sessionId: string): void => {
    try {
      ctx.uiWorkspace.openSession(sessionId)
    } catch (error) {
      console.error('feature-hub: open session from notice failed', error)
    }
  }

  const sessions = ctx.get?.('sessions') as SessionsFace | undefined

  /**
   * 从会话列表快照里取一行摘要（标题、来源、是否草稿）。
   * @param sessionId 会话 id。
   * @returns 摘要；列表还没加载或会话不存在时返回 undefined。
   */
  const rowOf = (sessionId: string): SessionSummary | undefined => {
    try {
      const snapshot = sessions?.list.getSnapshot()
      if (snapshot === undefined || snapshot === null) return undefined
      return snapshot.byId[sessionId]
    } catch (error) {
      console.warn('feature-hub: task notify session lookup failed', error)
      return undefined
    }
  }

  // 种子：插件加载时已经处于运行中的会话，不该在第一次快照时被当成「刚完成」。
  try {
    const seeded = sessions?.list.getSnapshot()
    if (seeded !== undefined && seeded !== null) {
      for (const [sessionId, row] of Object.entries(seeded.byId)) {
        running.set(sessionId, row.running === true)
      }
    }
  } catch (error) {
    console.warn('feature-hub: task notify seeding failed', error)
  }

  /**
   * 清掉过期的去重记录，避免插件长期运行后 Map 无限增长。
   * @param now 当前时间。
   */
  const pruneRecent = (now: number): void => {
    if (recent.size < 200) return
    for (const [key, stamp] of recent) {
      if (now - stamp > 60_000) recent.delete(key)
    }
  }

  /**
   * 推一条窗口内提醒并安排自动关闭。
   * @param notice 完整提醒。
   */
  const pushToast = (notice: TaskNotice): void => {
    toasts = [...toasts, notice]
    if (toasts.length > MAX_TOASTS) {
      for (const dropped of toasts.slice(0, toasts.length - MAX_TOASTS)) clearTimer(dropped.id)
      toasts = toasts.slice(-MAX_TOASTS)
    }
    emit()
    timers.set(
      notice.id,
      setTimeout(() => {
        dismiss(notice.id)
      }, TOAST_LIFETIME_MS),
    )
  }

  /**
   * 决定并发出一次提醒（受偏好、会话类型与去重约束）。
   * @param kind 提醒类别。
   * @param sessionId 会话 id。
   * @param detail 失败摘要；其它类别为 null。
   * @param ask 询问细分；其它类别为 null。
   */
  const deliver = (
    kind: TaskNoticeKind,
    sessionId: string,
    detail: string | null,
    ask: TaskAskKind | null,
  ): void => {
    if (!preferences.enabled) return
    if (kind === 'completed' && !preferences.completed) return
    if (kind === 'failed' && !preferences.failed) return
    if (kind === 'asked' && !preferences.asked) return
    const row = rowOf(sessionId)
    // 子代理是主任务的内部步骤，草稿还没有任何内容：提醒它们只会造成噪音。
    if (row !== undefined) {
      if (row.origin === 'subagent' || row.parentId !== undefined || row.blank === true) return
    }
    const stamp = `${kind}:${sessionId}`
    const now = Date.now()
    if (now - (recent.get(stamp) ?? 0) < DEDUPE_MS) return
    recent.set(stamp, now)
    pruneRecent(now)
    const title =
      row === undefined ? t('session.fallback') : row.displayTitle || row.title || t('session.fallback')
    sequence += 1
    const notice: TaskNotice = {
      id: `fh-notice-${String(sequence)}`,
      kind,
      sessionId,
      title,
      detail,
      ask,
      createdAt: now,
    }
    // 用户要的是 Windows 级别的通知：优先交给 Host 用 PowerShell 投递原生
    // toast；Host 与渲染进程都发不出去时，窗口内提醒是唯一还能看到结果的地方。
    if (preferences.system) {
      void postDesktopNotice({
        title: t(`desktop.${kind}`),
        body: bodyOf(notice, t),
        tag: `feature-hub:${kind}:${sessionId}`,
        onClick: () => {
          open(sessionId)
        },
      }).then((delivered) => {
        if (!delivered && !disposed) pushToast(notice)
      })
    } else {
      pushToast(notice)
    }
  }

  /**
   * 记录一次「运行结束」；刚失败过的会话不再重复提醒完成。
   * @param sessionId 会话 id。
   */
  const complete = (sessionId: string): void => {
    const failedAt = failures.get(sessionId)
    failures.delete(sessionId)
    if (failedAt !== undefined && Date.now() - failedAt < FAILURE_SUPPRESS_MS) return
    deliver('completed', sessionId, null, null)
  }

  /**
   * 处理一条失败事件。
   * @param rawSessionId 事件里的会话 id（类型未知，需要校验）。
   * @param rawMessage 事件里的错误文本（类型未知，需要校验）。
   */
  const fail = (rawSessionId: unknown, rawMessage: unknown): void => {
    if (typeof rawSessionId !== 'string' || rawSessionId === '') return
    failures.set(rawSessionId, Date.now())
    const message = typeof rawMessage === 'string' ? summarize(rawMessage) : ''
    deliver('failed', rawSessionId, message === '' ? null : message, null)
  }

  /**
   * 应用一份会话状态快照：识别新询问与运行结束。
   * @param snapshot 会话状态快照。
   */
  const applyStatus = (snapshot: SessionStatusSnapshot): void => {
    const entries = entriesOf(snapshot)
    const nextRunning = new Map<string, boolean>()
    const nextPending = new Map<string, { key: string; ask: TaskAskKind }>()
    for (const [sessionId, status] of entries) {
      nextRunning.set(sessionId, status.running === true)
      const interaction = status.pendingInteraction as InteractionView | undefined | null
      if (interaction === undefined || interaction === null) continue
      nextPending.set(sessionId, {
        key: typeof interaction.key === 'string' && interaction.key !== '' ? interaction.key : 'pending',
        ask: askKindOf(interaction.kind),
      })
    }
    // 第一次快照只建立基线：刷新页面时正在运行或正在等待的会话不算新事件。
    if (!baseline) {
      baseline = true
      pending = new Map([...nextPending].map(([sessionId, value]) => [sessionId, value.key]))
      for (const [sessionId, value] of nextRunning) running.set(sessionId, value)
      return
    }
    for (const [sessionId, value] of nextRunning) {
      const previous = running.get(sessionId)
      running.set(sessionId, value)
      if (previous === true && !value) complete(sessionId)
    }
    for (const [sessionId, value] of nextPending) {
      // 同一个 key 的重复快照不重复提醒；换成新 key（上一条已处理）才提醒。
      if (pending.get(sessionId) === value.key) continue
      deliver('asked', sessionId, null, value.ask)
    }
    pending = new Map([...nextPending].map(([sessionId, value]) => [sessionId, value.key]))
  }

  const remote = ctx.get?.('remote') as RemoteFace | undefined
  const uiSession = ctx.get?.('uiSession') as UiSessionFace | undefined
  const statusSource = uiSession?.sessionStatus

  if (
    statusSource !== undefined &&
    statusSource !== null &&
    typeof statusSource.getSnapshot === 'function' &&
    typeof statusSource.subscribe === 'function'
  ) {
    try {
      applyStatus(statusSource.getSnapshot())
      disposers.push(
        statusSource.subscribe(() => {
          applyStatus(statusSource.getSnapshot())
        }),
      )
    } catch (error) {
      console.warn('feature-hub: task notify status channel unavailable', error)
    }
  } else if (remote !== undefined && typeof remote.$on === 'function') {
    // 没有状态快照的宿主退回远程状态事件；只有一个数据源，避免重复提醒。
    try {
      disposers.push(
        remote.$on('api-session/status', (...args) => {
          const sessionId = args[0]
          if (typeof sessionId !== 'string') return
          const value = args[1] === true
          const previous = running.get(sessionId)
          running.set(sessionId, value)
          if (previous === true && !value) complete(sessionId)
        }),
      )
    } catch (error) {
      console.warn('feature-hub: task notify status events unavailable', error)
    }
  }

  if (remote !== undefined && typeof remote.$on === 'function') {
    try {
      disposers.push(
        remote.$on('api-session/error', (...args) => {
          fail(args[0], args[1])
        }),
      )
    } catch (error) {
      console.warn('feature-hub: task notify error events unavailable', error)
    }
  }

  disposers.push(
    subscribeNotifyPreferences(() => {
      preferences = readNotifyPreferences()
    }),
  )

  // 桌面端默认允许系统通知；遇到未授权的环境主动申请一次。
  // 申请失败只意味着继续走窗口内兜底，不会影响任务本身。
  if (preferences.system) {
    void requestDesktopNotifyPermission()
  }

  const face: TaskNotifyFace = {
    toasts: () => toasts,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dismiss,
    open,
  }

  return {
    face,
    dispose() {
      if (disposed) return
      disposed = true
      for (const disposer of disposers.splice(0)) {
        try {
          disposer()
        } catch (error) {
          console.warn('feature-hub: task notify cleanup failed', error)
        }
      }
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      listeners.clear()
      toasts = []
      closeDesktopNotices()
    },
  }
}
