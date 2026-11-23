import type * as ReactTypes from 'react'
/**
 * 侧边栏浏览区：`sidebar.workspaces` 单占位槽的占用者。
 *
 * 定位与边界：这里**取代**原生 `dsh-client-ui-workspace` 的浏览器外观，
 * 所以必须自己把原生的交互补齐——区头（标题 / 搜索 / 视图菜单 / 添加工作区）、
 * 分组树或扁平列表、行悬停动作与菜单、悬停卡片、拖拽排序、归档过滤、
 * 搜索结果与「显示更多」、折叠 rail 态、对话框。行为语义与原生逐条对齐
 * （投影规则见 `tree.ts`），数据一律来自插槽标准 hooks，动作来自注入面。
 *
 * 与原生的一处结构差异：原生把行动作、目录选择流注册成自己声明的子槽；
 * 本注册不声明那些子槽（原生还装着，重复声明会让整个注册失败），
 * 因此这些 UI 在本文件里直接渲染。
 *
 * 菜单分两类：会话行沿用宿主原生右键菜单（菜单项与对话框都由原生插件贡献，
 * 弹层与键盘导航也由宿主负责）；工作区行改用本插件自绘的 `PointMenu`——
 * 原生工作区菜单的「重命名 / 删除工作区」只往它自己注入面的 store 里写请求，
 * 对话框由原生浏览区渲染，接管后那条请求没人消费（表现为点了没反应），
 * 所以必须由本插件的菜单 + 对话框接手。
 */

import { Menu, PointMenu } from './menu'
import type { MenuItem } from './menu'
import { ProjectRow, SearchResultRow, SessionRow } from './rows'
import type { RowMenuRequest } from './rows'
import { DirectoryDialog, WorkspaceDialogs } from './dialogs'
import type { WorkspaceActionRequest } from './dialogs'
import {
  IconArchiveCheck,
  IconArchiveOff,
  IconChevronsUpDown,
  IconClock,
  IconClose,
  IconEdit,
  IconFlatList,
  IconFolderClose,
  IconFolderOpen,
  IconProjectAdd,
  IconQueue,
  IconSearch,
  IconSliders,
  IconTrash,
  IconWorkspaceTree,
} from './icons'
import { useViewState } from './view-state'
import type { ViewStore } from './view-state'
import {
  FLAT_SESSION_ORDER_KEY,
  UNGROUPED_KEY,
  deriveFlat,
  deriveGroups,
  deriveSearchResults,
  mainSessionId,
  orderByRecency,
  owningParentFolder,
  pinCurrentBlank,
  reconcileManualOrder,
  sessionMemberIds,
  visibleSessionIds,
} from './tree'
import type { GroupNode, SessionGroupBy, SessionNode, SessionOrderBy, SessionRowState } from './tree'

/** 每次「显示更多」增加的会话行数。 */
const SESSION_WATERMARK_BASE = 5

/** 有动静的会话最多自动展开到这么多行。 */
const SESSION_WATERMARK_AUTO_MAX = 50

/** 搜索输入的防抖时间。 */
const SEARCH_DEBOUNCE_MS = 250

/** 搜索关键词的最大长度（与宿主 `session.search` 的口径一致）。 */
const SEARCH_QUERY_MAX_CODE_UNITS = 500

/**
 * 系统目录对话框的超时时间。
 *
 * 对话框由宿主进程弹在**操作系统的桌面上**，浏览器这边只是等一个 Promise。
 * 一旦对话框没弹出来（远程会话、无显示器、窗口被吞），这个 Promise 永远不会
 * 结算，加号按钮就会一直禁用——用户看到的就是「点了没反应」。所以给一个
 * 足够长的上限（够慢慢翻目录），到点无条件解锁并提示。
 */
const PICK_TIMEOUT_MS = 180_000

/** 浏览区注入面：宿主动作与视图状态容器（由 `main.ts` 绑定）。 */
export interface WorkspaceBrowserFace {
  /** 打开会话。 */
  openSession(sessionId: string): void
  /** 在指定工作区新建会话（缺省沿用当前工作区）。 */
  startSession(workspaceId?: string): void
  /** 搜索会话（本地元数据 + 宿主内容检索）。 */
  searchSessions(
    query: string,
    signal: AbortSignal,
  ): Promise<{ readonly items: readonly SessionSearchResultItem[]; readonly hasMore: boolean }>
  /** 宿主规定的搜索结果上限。 */
  searchResultLimit: number
  /** 请求重命名会话（原生对话框负责执行）。 */
  requestSessionRename(sessionId: string, currentTitle: string): void
  /** 真正执行会话重命名（由对话框确认后调用）。 */
  renameSession(sessionId: string, title: string): Promise<void>
  /** 提示「归档会话不可打开」。 */
  notifyArchivedNotOpenable(): void
  /** 重命名工作区。 */
  renameWorkspace(workspaceId: string, title: string): Promise<void>
  /** 删除工作区登记。 */
  deleteWorkspace(workspaceId: string): Promise<void>
  /**
   * 在系统文件管理器里显示工作区目录。
   *
   * 打开文件管理器的能力由原生插件贡献在右键菜单里，插件拿不到服务，
   * 所以这里借菜单服务的 resolve/select 触发同一条原生动作。
   *
   * @param workspaceId 工作区 id。
   * @param path 工作区目录。
   * @returns 是否真的触发了；宿主缺少该动作时返回 false。
   */
  revealWorkspace(workspaceId: string, path: string): Promise<boolean>
  /** 把工作区移动到另一个之前（缺省移到末尾）。 */
  insertWorkspaceBefore(workspaceId: string, beforeWorkspaceId?: string): Promise<void>
  /** 归档会话（运行中的会话由宿主拒绝，错误会提示）。 */
  archiveSession(sessionId: string): void
  /** 取消归档。 */
  unarchiveSession(sessionId: string): Promise<void>
  /** 置顶会话。 */
  pinSession(sessionId: string): void
  /** 取消置顶。 */
  unpinSession(sessionId: string): void
  /** 把目录登记成工作区。 */
  createWorkspace(input: { readonly path: string }): Promise<WorkspaceView>
  /** 打开系统目录对话框。 */
  pickDirectory(): Promise<string | null>
  /** 读取一层目录。 */
  listDirectory(path?: string): Promise<DirectoryListing>
  /** 新建子目录。 */
  createDirectory(path: string, name: string): Promise<string>
  /**
   * 宿主是否支持「列目录」能力。
   *
   * 组合进来的目录选择后端有两种：native（只有系统对话框 `pick()`）与 browse
   * （可列目录、可建目录）。只有后者才能撑起内置浏览对话框。
   */
  readonly canBrowseDirectories: boolean
  /** 打开宿主的原生右键菜单。 */
  openContextMenu(target: RowMenuRequest, point: { readonly x: number; readonly y: number }): void
  /** 顶部提示（成功/失败都走它）。 */
  notify(message: string, tone: 'info' | 'warn'): void
  /** 视图状态容器。 */
  readonly viewStore: ViewStore
}

/** 浏览区完整入参：插槽标准 props + 注入面。 */
export type WorkspaceBrowserProps = SidebarWorkspacesProps & WorkspaceBrowserFace

/**
 * 把搜索关键词收进宿主的线上约束里。
 * @param value 输入框的原始值。
 * @returns 去掉 NUL、超长时按代理对边界截断后的文本。
 */
function sanitizeQuery(value: string): string {
  const withoutNul = value.replaceAll('\u0000', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end--
  return withoutNul.slice(0, end)
}

/**
 * 取路径最后一段作为工作区标题兜底。
 * @param path 目录路径。
 * @returns 最后一段；没有则返回原路径。
 */
function basename(path: string): string {
  const parts = String(path || '')
    .split(/[\\/]+/)
    .filter((part) => part !== '')
  return parts.length === 0 ? String(path || '') : String(parts[parts.length - 1])
}

/**
 * 只显示草稿行与前 `watermark` 个普通行。
 * @param sessions 分组内会话。
 * @param watermark 允许的普通行数。
 * @returns 可见行与隐藏行数。
 */
function watermarkRows(
  sessions: readonly SessionNode[],
  watermark: number,
): { readonly rows: readonly SessionNode[]; readonly hiddenCount: number } {
  let count = 0
  const rows = sessions.filter((session) => {
    if (session.blank) return true
    count += 1
    return count <= watermark
  })
  return { rows, hiddenCount: sessions.length - rows.length }
}

/**
 * 有动静的会话要求的最小水位（运行中 / 待交互 / 完成未读 / 当前会话）。
 * @param sessions 分组内会话。
 * @param current 当前会话 id。
 * @param reveal 搜索选中需要露出来的会话 id。
 * @returns 需要的水位。
 */
function requiredWatermark(
  sessions: readonly SessionNode[],
  current: string | undefined,
  reveal: string | undefined,
): number {
  let index = 0
  let required = 0
  for (const session of sessions) {
    if (session.blank) continue
    index += 1
    const attention =
      index <= SESSION_WATERMARK_AUTO_MAX &&
      (session.running ||
        session.runningSubagentCount > 0 ||
        session.pendingInteraction !== undefined ||
        session.completed ||
        session.id === current)
    if (attention || session.id === reveal) required = index
  }
  return required
}

/**
 * 把拖动落点换算成新的账本顺序（不移动被隐藏的成员）。
 * @param order 账本完整成员顺序。
 * @param rows 当前渲染出的行。
 * @param drag 拖动源。
 * @param over 落点。
 * @returns 新顺序；不可移动时 undefined。
 */
function sessionDragOrder(
  order: readonly string[],
  rows: readonly SessionNode[],
  drag: { readonly sessionId: string; readonly pinned: boolean },
  over: { readonly id: string; readonly half: 'before' | 'after' },
): string[] | undefined {
  const source = rows.find((row) => row.id === drag.sessionId)
  const target = rows.find((row) => row.id === over.id)
  if (
    source === undefined ||
    target === undefined ||
    source.blank ||
    source.pinned !== drag.pinned ||
    target.pinned !== drag.pinned ||
    source.id === target.id ||
    !order.includes(source.id)
  ) {
    return undefined
  }
  const next = order.filter((id) => id !== source.id)
  const targetIndex = next.indexOf(target.id)
  if (targetIndex === -1) return undefined
  next.splice(targetIndex + (over.half === 'after' ? 1 : 0), 0, source.id)
  const blank = rows.find((row) => row.blank)?.id
  return blank === undefined ? next : [blank, ...next.filter((id) => id !== blank)]
}

/**
 * 侧边栏浏览区组件。
 * @param props 插槽标准 props 与注入面。
 * @returns 浏览区元素；侧边栏收成图标栏时渲染 rail 控件。
 */
export function WorkspaceBrowser(props: WorkspaceBrowserProps): ReactTypes.JSX.Element | null {
  const t = props.t
  const wide = props.wide !== false
  const list = props.useSessions((state) => state)
  const items = props.useWorkspaces((state) => state.items)
  const phase = props.useWorkspaces((state) => state.phase)
  const streamState = props.useWorkspaces((state) => state.state)
  const archivedSessionIds = props.useWorkspaces((state) => state.archivedSessionIds)
  const pinnedSessionIds = props.useWorkspaces((state) => state.pinnedSessionIds)
  const statuses = props.useSessionStatus((state) => state)
  const panelActive = props.usePanelInfo((info) => info.activePanelId !== null)
  const view = useViewState(props.viewStore)
  const scroller = typeof props.useSectionScroller === 'function' ? props.useSectionScroller() : undefined
  const sections = Array.isArray(props.sections) ? props.sections : []

  // 工作区标题为空时用目录名兜底（原生同样回落到目录名）。
  const workspaces = React.useMemo(
    () => items.map((workspace) => ({ ...workspace, title: workspace.title || basename(workspace.path) })),
    [items],
  )
  const workspaceReady = phase === 'ready' && streamState !== 'loading'
  void workspaceReady
  const current = panelActive ? undefined : mainSessionId(list)
  const currentBlank = current !== undefined && list.byId[current]?.blank === true ? current : undefined

  const orderState = React.useMemo(
    () => ({ pinnedSessionIds, archivedSessionIds }),
    [pinnedSessionIds, archivedSessionIds],
  )
  const rowState = React.useMemo<SessionRowState>(
    () => ({ ...orderState, archivedFilter: view.archivedFilter }),
    [orderState, view.archivedFilter],
  )

  const ungroupedMemberIds = React.useMemo(() => {
    const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds))
    return list.ids.filter((id) => list.byId[id] !== undefined && !accounted.has(id))
  }, [list, workspaces])
  const flatMemberIds = React.useMemo(() => sessionMemberIds(list), [list])

  /**
   * 按当前排序方式投影一个账本的成员顺序。
   * @param members 权威成员。
   * @param accountKey 账本 key。
   * @returns 投影后的顺序。
   */
  const projectOrder = (members: readonly string[], accountKey: string): string[] => {
    const base =
      view.orderBy === 'updated'
        ? orderByRecency(members, list.byId)
        : reconcileManualOrder(members, view.sessionOrderByAccount[accountKey], list.byId, orderState)
    return pinCurrentBlank(
      base,
      currentBlank !== undefined && members.includes(currentBlank) ? currentBlank : undefined,
    )
  }

  const orderedWorkspaces = React.useMemo(
    () =>
      workspaces.map((workspace) => ({
        ...workspace,
        sessionIds: projectOrder(workspace.sessionIds, workspace.workspaceId),
      })),
    [workspaces, view.orderBy, view.sessionOrderByAccount, list.byId, orderState, currentBlank],
  )
  const orderedUngrouped = React.useMemo(
    () => projectOrder(ungroupedMemberIds, UNGROUPED_KEY),
    [ungroupedMemberIds, view.orderBy, view.sessionOrderByAccount, list.byId, orderState, currentBlank],
  )
  const orderedFlat = React.useMemo(
    () => projectOrder(flatMemberIds, FLAT_SESSION_ORDER_KEY),
    [flatMemberIds, view.orderBy, view.sessionOrderByAccount, list.byId, orderState, currentBlank],
  )
  const activeSessionOrders = React.useMemo<Readonly<Record<string, readonly string[]>>>(
    () =>
      Object.fromEntries([
        ...orderedWorkspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds] as const),
        [UNGROUPED_KEY, orderedUngrouped] as const,
        [FLAT_SESSION_ORDER_KEY, orderedFlat] as const,
      ]),
    [orderedWorkspaces, orderedUngrouped, orderedFlat],
  )

  // 工作区清册变化后丢掉已经不存在的工作区账本。
  React.useEffect(() => {
    if (phase !== 'ready') return
    props.viewStore.actions.retainAccountKeys([
      UNGROUPED_KEY,
      FLAT_SESSION_ORDER_KEY,
      ...workspaces.map((workspace) => workspace.workspaceId),
    ])
  }, [props.viewStore, phase, workspaces])

  // 树模式：算出每个工作区的最近祖先。
  const parents = React.useMemo(() => {
    if (view.groupBy !== 'workspace-tree') return new Map<string, string | undefined>()
    const keysByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace.workspaceId]))
    const paths = [...keysByPath.keys()]
    return new Map<string, string | undefined>(
      workspaces.map((workspace) => {
        const path = owningParentFolder(workspace.path, paths)
        return [workspace.workspaceId, path === undefined ? undefined : keysByPath.get(path)]
      }),
    )
  }, [view.groupBy, workspaces])

  const expandedGroups = React.useMemo(() => {
    const ancestorKeys = new Set<string | undefined>(parents.values())
    return [...workspaces.map((workspace) => workspace.workspaceId), UNGROUPED_KEY].filter(
      (key) => view.groupExpansion[key] ?? (ancestorKeys.has(key) || parents.size === 0),
    )
  }, [view.groupExpansion, parents, workspaces])

  const groups = React.useMemo(
    () =>
      deriveGroups(list, orderedWorkspaces, rowState, statuses, {
        expandedGroups,
        ungroupedOrder: orderedUngrouped,
      }),
    [list, orderedWorkspaces, rowState, statuses, expandedGroups, orderedUngrouped],
  )

  // 分组之外的功能（例如「最近任务」）要的是「全部可见会话」，不能从 groups 里取：
  // 折叠的分组不带行，那样折叠项目会把它的任务从摘要里一起隐掉——折叠只是导航状态，
  // 不该改变跨项目的最近任务列表。可见性口径与列表一致（草稿 / 子代理 / 归档）。
  const sectionRows = React.useMemo(
    () =>
      visibleSessionIds(list, archivedSessionIds, view.archivedFilter)
        .map((id) => list.byId[id])
        .filter((session): session is SessionSummary => session !== undefined),
    [list, archivedSessionIds, view.archivedFilter],
  )

  // 当前会话所在分组默认展开（原生同样在首次出现时自动展开）。
  const currentGroup =
    current === undefined
      ? undefined
      : (orderedWorkspaces.find((workspace) => workspace.sessionIds.includes(current))?.workspaceId ??
        UNGROUPED_KEY)
  React.useEffect(() => {
    if (!wide || currentGroup === undefined) return
    if (Object.hasOwn(view.groupExpansion, currentGroup)) return
    props.viewStore.actions.setGroupExpanded(currentGroup, true)
  }, [wide, currentGroup, view.groupExpansion, props.viewStore])

  // 相对时间要随停留推进：最近有活动的分组按秒刷新，其余按分钟。
  const [now, setNow] = React.useState(() => Date.now())
  const freshestAge = React.useMemo(() => {
    let freshest = Number.POSITIVE_INFINITY
    for (const group of groups) {
      for (const session of group.sessions) {
        const age = Date.now() - session.updatedAt
        if (age >= 0 && age < freshest) freshest = age
      }
    }
    return freshest
  }, [groups])
  React.useEffect(() => {
    const timer = window.setInterval(
      () => {
        setNow(Date.now())
      },
      freshestAge < 3_600_000 ? 1000 : 60_000,
    )
    return () => {
      window.clearInterval(timer)
    }
  }, [freshestAge])

  // ---- 搜索 ----
  const [query, setQuery] = React.useState('')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchOnExpand, setSearchOnExpand] = React.useState(false)
  const [remote, setRemote] = React.useState<{
    readonly query: string
    readonly status: 'idle' | 'loading' | 'ready' | 'error'
    readonly items: readonly SessionSearchResultItem[]
    readonly hasMore: boolean
  }>({ query: '', status: 'idle', items: [], hasMore: false })
  const normalizedQuery = sanitizeQuery(query).trim()
  const searchBox = React.useRef<HTMLDivElement | null>(null)
  /** 最近一次展开搜索的时间戳（`performance.now()`），用于排除开搜索那一下的点击。 */
  const searchOpenedAt = React.useRef(0)
  const searchInput = React.useRef<HTMLInputElement | null>(null)
  const [revealSessionId, setRevealSessionId] = React.useState<string | undefined>(undefined)

  /** 聚焦搜索框（不滚动）。 */
  const focusSearch = (): void => {
    searchInput.current?.focus({ preventScroll: true })
  }

  /**
   * 展开搜索框并记下时间戳。
   *
   * 时间戳供「点外部收起」的监听器排除掉展开手势本身：展开会把按钮换成
   * input，那次点击的 target 会脱离 DOM，看起来就像点在了外面。
   */
  const openSearch = (): void => {
    searchOpenedAt.current = performance.now()
    setSearchOpen(true)
  }

  React.useEffect(() => {
    if (!searchOpen) return
    const timer = window.setTimeout(focusSearch, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [searchOpen])

  // 点外部：清空则收起输入框；有查询时只失焦，不丢结果。
  //
  // 这里必须防住「开搜索的那一下自己把自己关掉」：点击搜索按钮会让按钮立刻
  // 被 input 替换，事件冒泡到 document 时 `event.target` 已经脱离 DOM，
  // `searchBox.contains(target)` 于是返回 false，看起来就像点了外部。
  // 用「最近一次展开的时间戳」把这一次点击排除掉，比依赖 DOM 包含关系可靠。
  React.useEffect(() => {
    if (!wide || !searchOpen) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) return
      // 刚展开的那一下：无论目标是否还在树里，都认为是展开手势本身。
      if (performance.now() - searchOpenedAt.current < 400) return
      if (searchBox.current?.contains(event.target) === true) return
      if (normalizedQuery !== '') return
      setSearchOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
    }
  }, [normalizedQuery, wide, searchOpen])

  // 宿主内容搜索：防抖 + 可取消；查询清空时回到 idle。
  React.useEffect(() => {
    if (normalizedQuery === '') {
      setRemote({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemote({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
    const timer = window.setTimeout(() => {
      props
        .searchSessions(normalizedQuery, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          setRemote({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setRemote({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, props])

  const searchCurrent =
    remote.query === normalizedQuery
      ? remote
      : { query: normalizedQuery, status: 'loading' as const, items: [], hasMore: false }
  const searchResults = React.useMemo(
    () =>
      normalizedQuery === ''
        ? { items: [], hasMore: false }
        : deriveSearchResults(
            list,
            orderedWorkspaces,
            normalizedQuery,
            archivedSessionIds,
            view.archivedFilter,
            statuses,
            searchCurrent,
            props.searchResultLimit,
          ),
    [
      list,
      orderedWorkspaces,
      normalizedQuery,
      archivedSessionIds,
      view.archivedFilter,
      statuses,
      searchCurrent,
      props.searchResultLimit,
    ],
  )

  // ---- 水位（显示更多） ----
  const [watermarks, setWatermarks] = React.useState<Readonly<Record<string, number>>>({})
  const required = new Map<string, number>()
  for (const group of groups) {
    required.set(
      group.key,
      Math.max(
        SESSION_WATERMARK_BASE,
        requiredWatermark(group.sessions, current, group.key === currentGroup ? revealSessionId : undefined),
      ),
    )
  }
  let raised = watermarks
  for (const [key, value] of required) {
    if (value > (raised[key] ?? SESSION_WATERMARK_BASE)) {
      raised = { ...raised, [key]: value }
    }
  }
  if (raised !== watermarks) setWatermarks(raised)

  // ---- 拖拽 ----
  const [sessionDrag, setSessionDrag] = React.useState<{
    readonly accountKey: string
    readonly sessionId: string
    readonly pinned: boolean
    readonly over: { readonly id: string; readonly half: 'before' | 'after' } | null
  } | null>(null)
  const [workspaceDrag, setWorkspaceDrag] = React.useState<{
    readonly workspaceId: string
    readonly over: { readonly id: string; readonly half: 'before' | 'after' } | null
  } | null>(null)
  const sessionCommitted = React.useRef(false)
  const workspaceCommitted = React.useRef(false)

  /**
   * 提交一次会话拖动。
   * @param active 拖动源。
   * @param over 落点。
   */
  const commitSessionDrag = (
    active: NonNullable<typeof sessionDrag>,
    over: NonNullable<NonNullable<typeof sessionDrag>['over']>,
  ): void => {
    if (sessionCommitted.current) return
    sessionCommitted.current = true
    setSessionDrag(null)
    const group = groups.find((candidate) => candidate.key === active.accountKey)
    if (group === undefined || over.id === active.sessionId) return
    const accountSessionIds =
      active.accountKey === UNGROUPED_KEY
        ? ungroupedMemberIds
        : workspaces.find((workspace) => workspace.workspaceId === active.accountKey)?.sessionIds
    if (accountSessionIds === undefined) return
    const rendered = watermarkRows(group.sessions, watermarks[group.key] ?? SESSION_WATERMARK_BASE).rows
    const nextOrder = sessionDragOrder(accountSessionIds, rendered, active, over)
    if (nextOrder !== undefined) {
      props.viewStore.actions.setSessionOrder(active.accountKey, nextOrder, activeSessionOrders)
    }
  }

  /**
   * 提交一次工作区拖动（同层移动，落点缺省追加到末尾）。
   * @param active 拖动源。
   * @param over 落点。
   */
  const commitWorkspaceDrag = (
    active: NonNullable<typeof workspaceDrag>,
    over: NonNullable<NonNullable<typeof workspaceDrag>['over']>,
  ): void => {
    if (workspaceCommitted.current) return
    workspaceCommitted.current = true
    setWorkspaceDrag(null)
    const owner = parents.get(active.workspaceId)
    const siblings = workspaces.filter((workspace) => parents.get(workspace.workspaceId) === owner)
    const index = siblings.findIndex((workspace) => workspace.workspaceId === over.id)
    if (index === -1) return
    const anchor = over.half === 'before' ? over.id : siblings[index + 1]?.workspaceId
    if (anchor === active.workspaceId) return
    props.insertWorkspaceBefore(active.workspaceId, anchor).catch((reason: unknown) => {
      console.warn('feature-hub: workspace reorder failed', reason)
    })
  }

  // ---- 动作 ----
  /** 打开会话：归档行不打开，改为提示。 */
  const guardedOpen = (sessionId: string): void => {
    if (archivedSessionIds.includes(sessionId)) {
      props.notifyArchivedNotOpenable()
      return
    }
    props.openSession(sessionId)
  }

  /** 打开搜索结果：清空查询、收起搜索、打开会话。 */
  const openSearchResult = (sessionId: string): void => {
    if (archivedSessionIds.includes(sessionId)) {
      props.notifyArchivedNotOpenable()
      return
    }
    setRevealSessionId(sessionId)
    setQuery('')
    setSearchOpen(false)
    props.openSession(sessionId)
  }

  /** 归档一条会话；失败时提示（运行中的会话由宿主拒绝）。 */
  const archive = (sessionId: string): void => {
    props.archiveSession(sessionId)
  }
  /** 取消归档并用提示确认。 */
  const unarchive = (sessionId: string): void => {
    props.unarchiveSession(sessionId).catch((reason: unknown) => {
      props.notify(
        t('toast.addFailed', { message: reason instanceof Error ? reason.message : String(reason) }),
        'warn',
      )
    })
  }

  // 原生右键菜单的「重命名 / 删除工作区」只往宿主的 action-request store 里写一条请求，
  // 对话框由 `sidebar.workspaces` 的占用者渲染；而那个 store 只在原生注入面里（本插件
  // 拿不到）。所以工作区行改用自绘菜单，请求直接落在本地，由本插件的对话框执行。
  const [workspaceAction, setWorkspaceAction] = React.useState<WorkspaceActionRequest | null>(null)
  // 工作区行的自绘右键菜单：目标分组 + 弹出点（原生菜单里的重命名/删除在本插件里没有消费者）。
  const [workspaceMenu, setWorkspaceMenu] = React.useState<{
    readonly group: GroupNode
    readonly point: { readonly x: number; readonly y: number }
  } | null>(null)
  // 内置目录浏览对话框只在宿主支持「列目录」能力时可用。当前 profile 组合的是
  // native 后端（只有 pick()），所以默认直接走系统对话框；列目录能力缺失时
  // 不要弹出一个读不到内容的空对话框。
  const canBrowse = props.canBrowseDirectories
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  // 系统对话框可能被窗口管理器吞掉、或在远程/无显示器环境里根本不弹：
  // 那样 `pick()` 会一直挂着，按钮就永久禁用——这正是「点了没反应」的形态。
  // 用一代号标记当前这次请求，超时后无条件解锁并提示，保证按钮不会变死。
  const pickTicket = React.useRef(0)

  /**
   * 调宿主目录对话框并处理结果。
   *
   * @param then 拿到绝对路径后的后续动作；取消时不会被调用。
   */
  const requestDirectory = (then: (path: string) => void): void => {
    if (adding) return
    const ticket = ++pickTicket.current
    setAdding(true)
    /** 只有这次请求仍然有效时才解锁（用户可能已经关掉并重开）。 */
    const settle = (): void => {
      if (pickTicket.current === ticket) setAdding(false)
    }
    const timer = window.setTimeout(() => {
      if (pickTicket.current !== ticket) return
      setAdding(false)
      props.notify(t('toast.pickTimeout'), 'warn')
    }, PICK_TIMEOUT_MS)
    props
      .pickDirectory()
      .then((path) => {
        window.clearTimeout(timer)
        settle()
        if (path === null || path === '') return
        then(path)
      })
      .catch((reason: unknown) => {
        window.clearTimeout(timer)
        settle()
        props.notify(
          t('toast.addFailed', { message: reason instanceof Error ? reason.message : String(reason) }),
          'warn',
        )
      })
  }

  /** 选好目录后登记工作区，并直接在其中新建会话。 */
  const adoptDirectory = (path: string): void => {
    if (adding) return
    setAdding(true)
    props
      .createWorkspace({ path })
      .then((workspace) => {
        setAdding(false)
        setPickerOpen(false)
        props.startSession(workspace.workspaceId)
      })
      .catch((reason: unknown) => {
        setAdding(false)
        props.notify(
          t('toast.addFailed', { message: reason instanceof Error ? reason.message : String(reason) }),
          'warn',
        )
      })
  }

  /**
   * 打开「添加工作区」流程。
   *
   * 原生把这一步交给组合进来的目录选择包（native 用系统对话框、browse 用内置
   * 浏览对话框）。本插件不声明那个子槽，所以按宿主能力二选一：
   * 能列目录就用内置对话框，否则直接调系统对话框——绝不给用户一个读不到
   * 内容的空对话框。
   */
  const openAddWorkspace = (): void => {
    if (adding) return
    if (canBrowse) {
      setPickerOpen(true)
      return
    }
    requestDirectory(adoptDirectory)
  }

  // 快捷键：Ctrl/Cmd+K 搜索、Ctrl/Cmd+O 添加工作区（原生命令在宿主侧注册，
  // 但它们只驱动原生浏览区；接管期间由这里接管这两个手势）。
  React.useEffect(() => {
    if (!wide) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
        return
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault()
        openAddWorkspace()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [wide, adding, canBrowse])

  // ---- 视图菜单 ----
  const viewItems: readonly MenuItem[] = [
    { kind: 'label', id: 'group-by', text: t('groupBy.label') },
    {
      kind: 'item',
      id: 'workspace',
      label: t('groupBy.workspace'),
      selected: view.groupBy === 'workspace',
      icon: <IconFolderClose size={14} />,
    },
    {
      kind: 'item',
      id: 'workspace-tree',
      label: t('groupBy.workspaceTree'),
      selected: view.groupBy === 'workspace-tree',
      icon: <IconWorkspaceTree size={14} />,
    },
    {
      kind: 'item',
      id: 'flat',
      label: t('groupBy.flat'),
      selected: view.groupBy === 'flat',
      icon: <IconFlatList size={14} />,
    },
    { kind: 'separator', id: 'order-sep' },
    { kind: 'label', id: 'order-by', text: t('orderBy.label') },
    {
      kind: 'item',
      id: 'manual',
      label: t('orderBy.manual'),
      selected: view.orderBy === 'manual',
      icon: <IconChevronsUpDown size={14} />,
    },
    {
      kind: 'item',
      id: 'updated',
      label: t('orderBy.updated'),
      selected: view.orderBy === 'updated',
      icon: <IconClock size={14} />,
    },
    { kind: 'separator', id: 'archived-sep' },
    { kind: 'label', id: 'filter-by', text: t('filterBy.label') },
    {
      kind: 'item',
      id: 'hide-archived',
      label: t('viewOptions.hideArchived'),
      selected: view.archivedFilter === 'default',
      icon: <IconArchiveOff size={14} />,
    },
    {
      kind: 'item',
      id: 'show-archived',
      label: t('viewOptions.showArchived'),
      selected: view.archivedFilter === 'show',
      icon: <IconQueue size={14} />,
    },
    {
      kind: 'item',
      id: 'only-archived',
      label: t('viewOptions.onlyArchived'),
      selected: view.archivedFilter === 'only',
      icon: <IconArchiveCheck size={14} />,
    },
  ]

  /** 处理视图菜单选择。 */
  const onViewSelect = (id: string): void => {
    if (id === 'workspace' || id === 'workspace-tree' || id === 'flat') {
      props.viewStore.actions.setGroupBy(id as SessionGroupBy)
      return
    }
    if (id === 'manual' || id === 'updated') {
      props.viewStore.actions.setOrderBy(id as SessionOrderBy, activeSessionOrders)
      return
    }
    if (id === 'hide-archived') props.viewStore.actions.setArchivedFilter('default')
    else if (id === 'show-archived') props.viewStore.actions.setArchivedFilter('show')
    else if (id === 'only-archived') props.viewStore.actions.setArchivedFilter('only')
  }

  /**
   * 在指定坐标打开某条会话的原生右键菜单。
   *
   * 这是分组与行共用的唯一入口：菜单项（重命名、分叉、复制 ID、归档、置顶）
   * 由宿主插件贡献，外壳只交出「哪条会话 + 弹在哪里」。
   * @param sessionId 会话 id。
   * @param displayTitle 行上显示的标题（重命名对话框的初值）。
   * @param point 视口坐标。
   */
  const openSessionMenuAt = (
    sessionId: string,
    displayTitle: string,
    point: { readonly x: number; readonly y: number },
  ): void => {
    props.openContextMenu({ kind: 'session', sessionId, displayTitle, point }, point)
  }

  /**
   * 打开一条会话的原生右键菜单。
   * @param node 会话行。
   * @param point 视口坐标。
   */
  const openSessionMenu = (node: SessionNode, point: { readonly x: number; readonly y: number }): void => {
    openSessionMenuAt(node.id, node.title, point)
  }

  /**
   * 打开一个工作区的自绘右键菜单。
   *
   * 为什么不用宿主的原生菜单：`ui-workspace` 的「重命名 / 删除工作区」只往它自己
   * 注入面的 store 里写一条请求，对话框由原生浏览区渲染；本插件取代原生浏览区后
   * 没人消费这条请求，点下去等于没点（删除工作区后列表里还在）。
   * 自绘菜单把请求落在本插件里，由本插件的对话框执行；「在文件夹显示」仍借原生
   * 动作（见 {@link WorkspaceBrowserFace.revealWorkspace}）。
   *
   * @param group 分组。
   * @param point 视口坐标。
   */
  const openWorkspaceMenu = (group: GroupNode, point: { readonly x: number; readonly y: number }): void => {
    if (group.workspaceId === undefined) return
    setWorkspaceMenu({ group, point })
  }

  /**
   * 把分组摊成一次工作区动作请求。
   * @param group 分组。
   * @param action 动作类型。
   * @returns 请求；未分组桶没有工作区 id，返回 null。
   */
  const workspaceRequest = (group: GroupNode, action: 'rename' | 'delete'): WorkspaceActionRequest | null => {
    if (group.workspaceId === undefined) return null
    // 重命名对话框要区分「没改动」与「改成目录名」：这里给宿主里存的原始标题。
    const stored = items.find((workspace) => workspace.workspaceId === group.workspaceId)?.title ?? ''
    return {
      action,
      workspaceId: group.workspaceId,
      displayTitle: group.label,
      storedTitle: stored,
    }
  }

  /** 工作区菜单项：顺序与原生一致（重命名 → 在文件夹显示 → 删除工作区）。 */
  const workspaceMenuItems: readonly MenuItem[] = [
    { kind: 'item', id: 'rename', label: t('rename'), icon: <IconEdit size={14} /> },
    { kind: 'item', id: 'reveal', label: t('workspace.reveal'), icon: <IconFolderOpen size={14} /> },
    { kind: 'separator', id: 'workspace-delete-sep' },
    { kind: 'item', id: 'delete', label: t('delete.workspace'), icon: <IconTrash size={14} />, danger: true },
  ]

  /**
   * 处理工作区菜单的选择。
   *
   * 菜单先关闭再执行：重命名/删除要弹模态对话框，留着弹层会抢焦点。
   *
   * @param id 菜单项 id。
   */
  const onWorkspaceMenuSelect = (id: string): void => {
    const current = workspaceMenu
    setWorkspaceMenu(null)
    if (current === null) return
    const group = current.group
    if (id === 'reveal') {
      props
        .revealWorkspace(group.workspaceId ?? '', group.cwd ?? '')
        .then((opened) => {
          if (!opened) props.notify(t('toast.revealUnavailable'), 'warn')
        })
        .catch(() => {
          props.notify(t('toast.revealUnavailable'), 'warn')
        })
      return
    }
    if (id !== 'rename' && id !== 'delete') return
    const request = workspaceRequest(group, id)
    if (request !== null) setWorkspaceAction(request)
  }

  /** rail 态点击搜索：展开侧边栏并准备聚焦。 */
  const railSearch = (): void => {
    setSearchOnExpand(true)
    openSearch()
    props.expandSidebar()
  }
  React.useEffect(() => {
    if (!wide || !searchOnExpand) return
    const timer = window.setTimeout(() => {
      focusSearch()
      setSearchOnExpand(false)
    }, 320)
    return () => {
      window.clearTimeout(timer)
    }
  }, [wide, searchOnExpand])

  // ---- 渲染 ----
  /** 一条会话行（含动作与拖动接线）。 */
  const renderSession = (
    node: SessionNode,
    group: GroupNode,
    options: { readonly flat?: boolean } = {},
  ): ReactTypes.JSX.Element => {
    const sameGroupDrag = sessionDrag !== null && sessionDrag.accountKey === group.key
    const compatible = sameGroupDrag && sessionDrag.pinned === node.pinned
    const normalize = (half: 'before' | 'after'): 'before' | 'after' => (node.blank ? 'after' : half)
    return (
      <SessionRow
        key={node.id}
        node={node}
        selected={node.id === current}
        now={now}
        t={t}
        onOpen={guardedOpen}
        onRenameRequest={props.requestSessionRename}
        onMenu={(point) => {
          openSessionMenu(node, point)
        }}
        onArchive={() => {
          archive(node.id)
        }}
        onUnarchive={() => {
          unarchive(node.id)
        }}
        onPin={
          node.pinned
            ? () => {
                props.unpinSession(node.id)
              }
            : () => {
                props.pinSession(node.id)
              }
        }
        pinned={node.pinned}
        reveal={node.id === revealSessionId}
        onRevealed={() => {
          setRevealSessionId((existing) => (existing === node.id ? undefined : existing))
        }}
        drag={
          options.flat === true || node.blank || node.archived
            ? {
                enabled: false,
                active: false,
                marker: null,
                start: () => {},
                end: () => {},
                hover: () => {},
                drop: () => {},
              }
            : {
                enabled: true,
                active: compatible,
                marker: sameGroupDrag && sessionDrag.over?.id === node.id ? sessionDrag.over.half : null,
                start: () => {
                  sessionCommitted.current = false
                  setSessionDrag({
                    accountKey: group.key,
                    sessionId: node.id,
                    pinned: node.pinned,
                    over: null,
                  })
                },
                end: () => {
                  if (sessionDrag?.over !== null && sessionDrag?.over !== undefined) {
                    commitSessionDrag(sessionDrag, sessionDrag.over)
                  } else {
                    setSessionDrag(null)
                  }
                  sessionCommitted.current = false
                },
                hover: (half) => {
                  setSessionDrag((active) =>
                    active === null ? active : { ...active, over: { id: node.id, half: normalize(half) } },
                  )
                },
                drop: (half) => {
                  if (sessionDrag === null) return
                  commitSessionDrag(sessionDrag, { id: node.id, half: normalize(half) })
                },
              }
        }
      />
    )
  }

  /** 渲染一个分组（含树形子分组）。 */
  const renderGroup = (group: GroupNode, depth: number): ReactTypes.ReactNode => {
    const workspaceId = group.workspaceId
    const marker =
      workspaceDrag?.over !== null &&
      workspaceDrag?.over !== undefined &&
      workspaceDrag.over.id === workspaceId
        ? workspaceDrag.over.half
        : null
    const compatibleWorkspaceDrag =
      workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key)
    const watermark = watermarks[group.key] ?? SESSION_WATERMARK_BASE
    const visible = watermarkRows(group.sessions, watermark)
    const sessionsExpanded = visible.hiddenCount === 0
    const children = groups.filter((candidate) => parents.get(candidate.key) === group.key)
    return (
      <div key={group.key} className="fh-group">
        <ProjectRow
          group={group}
          active={group.containsCurrent}
          indent={depth * 12}
          t={t}
          onToggle={() => {
            props.viewStore.actions.setGroupExpanded(group.key, !group.expanded)
          }}
          onCreate={
            workspaceId === undefined
              ? undefined
              : () => {
                  props.viewStore.actions.setGroupExpanded(group.key, true)
                  props.startSession(workspaceId)
                }
          }
          onMenu={
            workspaceId === undefined
              ? undefined
              : (point) => {
                  openWorkspaceMenu(group, point)
                }
          }
          drag={
            workspaceId === undefined
              ? undefined
              : {
                  enabled: true,
                  active: compatibleWorkspaceDrag,
                  marker,
                  start: () => {
                    workspaceCommitted.current = false
                    setWorkspaceDrag({ workspaceId, over: null })
                  },
                  end: () => {
                    if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) {
                      commitWorkspaceDrag(workspaceDrag, workspaceDrag.over)
                    } else {
                      setWorkspaceDrag(null)
                    }
                    workspaceCommitted.current = false
                  },
                  hover: (half) => {
                    setWorkspaceDrag((active) =>
                      active === null ? active : { ...active, over: { id: workspaceId, half } },
                    )
                  },
                  drop: (half) => {
                    if (workspaceDrag === null) return
                    commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half })
                  },
                }
          }
        />
        {group.expanded && children.length > 0 ? (
          <div role="group">{children.map((child) => renderGroup(child, depth + 1))}</div>
        ) : null}
        {group.expanded ? (
          <div className="fh-group-body">
            {visible.rows.map((node) => renderSession(node, group))}
            {visible.hiddenCount > 0 ? (
              <button
                type="button"
                className="fh-show-more"
                aria-expanded={sessionsExpanded}
                onClick={() => {
                  if (sessionsExpanded) {
                    setWatermarks((marks) => {
                      const next = { ...marks }
                      delete next[group.key]
                      return next
                    })
                    return
                  }
                  setWatermarks((marks) => ({
                    ...marks,
                    [group.key]:
                      visible.hiddenCount <= SESSION_WATERMARK_BASE
                        ? Number.POSITIVE_INFINITY
                        : watermark + SESSION_WATERMARK_BASE,
                  }))
                }}
              >
                {sessionsExpanded ? t('sessions.collapse') : t('sessions.expand', { n: visible.hiddenCount })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  /** 一张列表模式。 */
  const renderFlat = (): ReactTypes.ReactNode => {
    const rows = deriveFlat(list, orderedFlat, rowState, statuses)
    const fakeGroup: GroupNode = {
      key: FLAT_SESSION_ORDER_KEY,
      workspaceId: undefined,
      cwd: undefined,
      createdAt: undefined,
      label: '',
      sessionCount: rows.length,
      expanded: true,
      containsCurrent: false,
      sessions: rows,
    }
    if (rows.length === 0) return renderEmpty()
    return (
      <div className="fh-group-body">
        {rows.map((node) => renderSession(node, fakeGroup, { flat: true }))}
      </div>
    )
  }

  /** 空状态：归档视图给出「看其他会话」的回路。 */
  function renderEmpty(): ReactTypes.JSX.Element {
    const archivedOnly = view.archivedFilter === 'only'
    return (
      <div className="fh-empty">
        <span className="fh-empty-icon">
          {archivedOnly ? <IconQueue size={20} /> : <IconArchiveCheck size={20} />}
        </span>
        <div>{archivedOnly ? t('empty.noneArchived') : t('empty.none')}</div>
        {archivedOnly ? (
          <button
            type="button"
            className="fh-button"
            onClick={() => {
              props.viewStore.actions.setArchivedFilter('default')
            }}
          >
            {t('empty.viewOthers')}
          </button>
        ) : null}
      </div>
    )
  }

  /** 搜索结果主体。 */
  const renderSearch = (): ReactTypes.ReactNode => {
    const pending = searchCurrent.status === 'loading'
    return (
      <div className="fh-search-body">
        {searchResults.items.length === 0 && !pending ? (
          <div className="fh-empty">{t('search.noMatches')}</div>
        ) : null}
        {searchResults.items.map((result) => (
          <SearchResultRow
            key={result.id}
            result={result}
            selected={result.id === current}
            t={t}
            onOpen={() => {
              openSearchResult(result.id)
            }}
            onUnarchive={
              result.archived
                ? () => {
                    unarchive(result.id)
                  }
                : undefined
            }
          />
        ))}
        {pending ? (
          <div className="fh-search-status" role="status" aria-label={t('search.pending')}>
            {t('search.pending')}
          </div>
        ) : null}
        {searchResults.hasMore ? (
          <div className="fh-search-status">{t('search.hasMore', { n: props.searchResultLimit })}</div>
        ) : null}
      </div>
    )
  }

  // 图标栏（rail）：搜索与添加工作区各一个 36px 控件，与原生一致。
  if (!wide) {
    return (
      <div className="fh-rail">
        <button
          type="button"
          className="fh-rail-button"
          title={t('search')}
          aria-label={t('search.aria')}
          onClick={railSearch}
        >
          <IconSearch size={18} />
        </button>
        <button
          type="button"
          className="fh-rail-button"
          title={t('workspace.add')}
          aria-label={t('workspace.add')}
          onClick={openAddWorkspace}
        >
          <IconProjectAdd size={18} />
        </button>
      </div>
    )
  }

  const rootGroups =
    parents.size === 0 ? groups : groups.filter((group) => parents.get(group.key) === undefined)
  const listRef = scroller?.bindScrollerRef

  return (
    <div className="fh-ws">
      <div className={`fh-ws-head${searchOpen ? ' fh-ws-head-open' : ''}`}>
        {searchOpen || normalizedQuery !== '' ? null : (
          <span className="fh-ws-label">
            {view.groupBy === 'flat' ? t('section.sessions') : t('section.workspaces')}
          </span>
        )}
        {/* 收起态只留一个图标按钮，紧挨右侧动作（所以天然右对齐）；展开后换成占满整行的输入框。 */}
        {searchOpen ? (
          <div
            ref={searchBox}
            className="fh-ws-search"
            onClick={() => {
              focusSearch()
            }}
          >
            <IconSearch size={14} />
            <input
              ref={searchInput}
              className="fh-ws-search-input"
              type="text"
              value={query}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
              onChange={(event) => {
                setQuery(sanitizeQuery(event.currentTarget.value))
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                setQuery('')
                setSearchOpen(false)
              }}
            />
            <button
              type="button"
              className="fh-icon-button"
              title={t('search.clear')}
              aria-label={t('search.clear')}
              onClick={(event) => {
                // 清除按钮在输入框容器内：别让冒泡把焦点又抢回已经要卸载的 input。
                event.stopPropagation()
                setQuery('')
                setSearchOpen(false)
              }}
            >
              <IconClose size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="fh-icon-button"
            title={t('search')}
            aria-label={t('search.aria')}
            aria-expanded={false}
            onClick={openSearch}
          >
            <IconSearch size={14} />
          </button>
        )}
        <div className="fh-ws-head-actions">
          <Menu
            label={t('viewOptions.label')}
            icon={<IconSliders size={16} />}
            className="fh-icon-button"
            items={viewItems}
            onSelect={onViewSelect}
            align="end"
          />
          <button
            type="button"
            className="fh-icon-button"
            title={t('workspace.add')}
            aria-label={t('workspace.add')}
            disabled={adding}
            onClick={openAddWorkspace}
          >
            <IconProjectAdd size={16} />
          </button>
        </div>
      </div>
      <div className="fh-ws-list" ref={listRef} data-sidebar-list-area="">
        {normalizedQuery !== '' ? (
          renderSearch()
        ) : (
          <>
            {sections
              .filter((section) => section !== undefined && section !== null)
              .slice()
              .sort((left, right) => (left.order || 0) - (right.order || 0))
              .map((section) =>
                React.createElement(section.component, {
                  key: section.id,
                  t: section.t === undefined ? t : section.t,
                  now,
                  model: { groups, rows: sectionRows },
                  rows: sectionRows,
                  currentSessionId: current ?? null,
                  snapshot: {
                    items,
                    byId: list.byId,
                    ids: list.ids,
                    archivedSessionIds,
                    pinnedSessionIds,
                    statuses,
                  },
                  openSession: guardedOpen,
                  openSessionMenu: openSessionMenuAt,
                }),
              )}
            {view.groupBy === 'flat'
              ? renderFlat()
              : groups.length === 0
                ? renderEmpty()
                : rootGroups.map((group) => renderGroup(group, 0))}
          </>
        )}
      </div>
      <PointMenu
        open={workspaceMenu !== null}
        point={workspaceMenu === null ? null : workspaceMenu.point}
        label={t('actions.workspace.aria', { name: workspaceMenu === null ? '' : workspaceMenu.group.label })}
        items={workspaceMenuItems}
        onSelect={onWorkspaceMenuSelect}
        onClose={() => {
          setWorkspaceMenu(null)
        }}
      />
      <WorkspaceDialogs
        request={workspaceAction}
        workspaces={workspaces}
        renameWorkspace={props.renameWorkspace}
        deleteWorkspace={props.deleteWorkspace}
        settle={() => {
          setWorkspaceAction(null)
        }}
        t={t}
        closeLabel={t('close')}
        cancelLabel={t('cancel')}
      />
      <DirectoryDialog
        open={pickerOpen}
        onClose={() => {
          if (adding) return
          setPickerOpen(false)
        }}
        onPicked={adoptDirectory}
        t={t}
        closeLabel={t('close')}
        listDirectory={props.listDirectory}
        createDirectory={props.createDirectory}
        pickDirectory={props.pickDirectory}
        onUnsupported={() => {
          // 后端的列目录能力不可用：收起内置对话框，改走系统对话框。
          setPickerOpen(false)
          requestDirectory(adoptDirectory)
        }}
      />
    </div>
  )
}
