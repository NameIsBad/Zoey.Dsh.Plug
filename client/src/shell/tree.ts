/**
 * 侧边栏浏览区的投影层：把「工作区快照 + 会话列表 + 行状态」算成可渲染的
 * 分组行、扁平行与搜索结果。
 *
 * 这里逐条对应原生 `dsh-client-ui-workspace/src/tree.ts` 的规则，保持与原生
 * 一致的行为语义：
 *   - 一个会话归属于「第一个记账它的工作区」，没被记账的落到末尾「未分组」；
 *   - 草稿只有「当前选中的那一个」可见，子代理会话一律不渲染；
 *   - 归档行的可见性由 `archivedFilter` 决定（隐藏 / 混入 / 只看归档）；
 *   - 置顶行领先所在分区，且只在同一（置顶/非置顶）块内排序；
 *   - 手动顺序缺失的成员按「置顶 → 最近活动 → 归档」补到已保存序列之后；
 *   - 工作区树模式下按目录包含关系嵌套（最近注册祖先）。
 *
 * 本文件是纯函数（不碰 React、不发 RPC），因此 Node 自检可以直接驱动它。
 */

/** 未归属任何工作区的分组的 key。 */
export const UNGROUPED_KEY = ''

/** 扁平列表自己的顺序账本 key（不属于任何工作区）。 */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** 会话排序：手动保存的位置，或按最近活动时间。 */
export type SessionOrderBy = 'manual' | 'updated'

/** 归档行可见性：默认隐藏、混入列表、只看归档。 */
export type ArchivedFilter = 'default' | 'show' | 'only'

/** 分组方式：按工作区并列、按目录树嵌套、或一张扁平列表。 */
export type SessionGroupBy = 'workspace' | 'workspace-tree' | 'flat'

/** 等待用户回答的交互种类（原生只为这三种画专属状态）。 */
export type SessionPendingInteractionStatus = 'approval' | 'plan-review' | 'question'

/** 一条会话行的投影。 */
export interface SessionNode {
  /** 会话 id。 */
  readonly id: string
  /** 持久化标题；草稿与无标题会话为空串，由渲染层本地化。 */
  readonly title: string
  /** 是否是还没发过消息的草稿。 */
  readonly blank: boolean
  /** 是否有等待用户的交互。 */
  readonly pendingInteraction?: SessionPendingInteractionStatus
  /** 是否正在执行。 */
  readonly running: boolean
  /** 正在运行的直接子代理数量。 */
  readonly runningSubagentCount: number
  /** 跑完但还没被打开过（完成未读）。 */
  readonly completed: boolean
  /** 是否置顶（归档行不参与置顶块）。 */
  readonly pinned: boolean
  /** 是否归档。 */
  readonly archived: boolean
  /** 最近活动时间（毫秒）。 */
  readonly updatedAt: number
  /** 会话工作目录；宿主没报或为空时缺省。 */
  readonly cwd?: string
}

/** 一个工作区分组的投影。 */
export interface GroupNode {
  /** 分组 key：工作区 id，或 {@link UNGROUPED_KEY}。 */
  readonly key: string
  /** 对应的工作区 id；未分组桶没有。 */
  readonly workspaceId: string | undefined
  /** 工作区目录；未分组桶没有。 */
  readonly cwd: string | undefined
  /** 工作区创建时间（毫秒）；未分组桶没有。 */
  readonly createdAt: number | undefined
  /** 分组标题（工作区标题；未分组桶为空串，由渲染层本地化）。 */
  readonly label: string
  /** 该分组可见会话总数（折叠时也统计）。 */
  readonly sessionCount: number
  /** 是否展开。 */
  readonly expanded: boolean
  /** 当前会话是否落在本分组（用于文件夹高亮）。 */
  readonly containsCurrent: boolean
  /** 可见的会话行；折叠时为空。 */
  readonly sessions: readonly SessionNode[]
}

/** 一条搜索结果的投影（本地元数据匹配 + 可选的内容命中片段）。 */
export interface SearchResultNode {
  /** 会话 id。 */
  readonly id: string
  /** 标题；空白草稿为空串。 */
  readonly title: string
  /** 所属工作区标题（未归属时用目录名）。 */
  readonly workspace: string
  /** 是否有等待用户的交互。 */
  readonly pendingInteraction?: SessionPendingInteractionStatus
  /** 是否正在执行。 */
  readonly running: boolean
  /** 正在运行的直接子代理数量。 */
  readonly runningSubagentCount: number
  /** 完成未读。 */
  readonly completed: boolean
  /** 是否归档。 */
  readonly archived: boolean
  /** 内容命中片段。 */
  readonly snippet?: string
}

/** 一次搜索的合并结果。 */
export interface SearchResultSet {
  /** 合并后的结果行（已按上限截断）。 */
  readonly items: readonly SearchResultNode[]
  /** 结果被截断或宿主还有更多（提示用户继续缩小关键词）。 */
  readonly hasMore: boolean
}

/** 派生所需的视图状态。 */
export interface TreeView {
  /** 已展开的分组 key 列表。 */
  readonly expandedGroups: readonly string[]
  /** 未分组桶的浏览器本地顺序。 */
  readonly ungroupedOrder?: readonly string[] | undefined
}

/** 派生所需的全局行状态（置顶/归档集合 + 归档可见性）。 */
export interface SessionRowState {
  /** 置顶会话 id，最近置顶的在前。 */
  readonly pinnedSessionIds: readonly string[]
  /** 归档会话 id。 */
  readonly archivedSessionIds: readonly string[]
  /** 归档行可见性选择。 */
  readonly archivedFilter: ArchivedFilter
}

/** 一次分组的中间形态。 */
interface GroupDraft {
  readonly key: string
  readonly workspaceId: string | undefined
  readonly cwd: string | undefined
  readonly createdAt: number | undefined
  readonly label: string
  readonly sessions: SessionSummary[]
}

/**
 * 读出当前主视图持有的会话 id。
 * @param list 会话列表快照。
 * @returns 被主视图持有的会话 id；没有则 undefined。
 */
export function mainSessionId(list: SessionListState): string | undefined {
  for (const session of Object.values(list.byId)) {
    if (((session.retainedBy as Record<string, number> | undefined)?.mainView ?? 0) > 0) return session.id
  }
  return undefined
}

/**
 * 一条会话属于哪个工作区分组。
 * @param workspaces 权威工作区成员表。
 * @param sessionId 会话 id。
 * @returns 工作区 id，或 {@link UNGROUPED_KEY}。
 */
export function owningGroupKey(workspaces: readonly WorkspaceView[], sessionId: string): string {
  const owner = workspaces.find((workspace) => workspace.sessionIds.includes(sessionId))
  return owner === undefined ? UNGROUPED_KEY : owner.workspaceId
}

/**
 * 目录显示名：取路径最后一段（两种分隔符都认）。
 * @param cwd 目录路径，或 undefined。
 * @returns 最后一段；没有最后一段时返回原路径；undefined 返回空串。
 */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return ''
  const parts = cwd.split(/[\\/]+/).filter((part) => part !== '')
  return parts.length === 0 ? cwd : String(parts[parts.length - 1])
}

/**
 * 把已知成员按最近活动时间倒序排列。
 * @param sessionIds 权威成员 id。
 * @param summaries 当前会话摘要；没有摘要的成员先跳过（等它到达）。
 * @returns 新到旧排列的成员 id，id 作为稳定的并列判定。
 */
export function orderByRecency(
  sessionIds: readonly string[],
  summaries: Readonly<Record<string, SessionSummary>>,
): string[] {
  return sessionIds
    .flatMap((id) => {
      const summary = summaries[id]
      if (summary === undefined) return []
      return [{ id, rank: Number(summary.updatedAt) || 0 }]
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return b.rank - a.rank
      return a.id < b.id ? -1 : 1
    })
    .map((member) => member.id)
}

/**
 * 把浏览器本地保存的手动顺序与当前成员对账。
 * @param memberIds 权威成员 id。
 * @param savedOrder 上次保存的顺序。
 * @param summaries 当前会话摘要。
 * @param rowState 置顶/归档集合（可选）。
 * @returns 已保存的相对位置 + 补齐的成员（置顶 → 普通 → 归档）。
 */
export function reconcileManualOrder(
  memberIds: readonly string[],
  savedOrder: readonly string[] | undefined,
  summaries: Readonly<Record<string, SessionSummary>>,
  rowState?: Pick<SessionRowState, 'pinnedSessionIds' | 'archivedSessionIds'>,
): string[] {
  const members = new Set(memberIds)
  const included = new Set<string>()
  const ordered: string[] = []
  for (const key of savedOrder ?? []) {
    if (!members.has(key) || included.has(key)) continue
    ordered.push(key)
    included.add(key)
  }
  const archived = new Set<string>(rowState?.archivedSessionIds)
  const pins: string[] = []
  for (const sessionId of rowState?.pinnedSessionIds ?? []) {
    if (!members.has(sessionId) || included.has(sessionId)) continue
    if (archived.has(sessionId) || summaries[sessionId] === undefined) continue
    pins.push(sessionId)
    included.add(sessionId)
  }
  const ordinary: string[] = []
  const archives: string[] = []
  const rest = orderByRecency(
    [...members].filter((id) => !included.has(id)),
    summaries,
  )
  for (const id of rest) {
    if (archived.has(id)) archives.push(id)
    else ordinary.push(id)
  }
  return [...pins, ...ordered, ...ordinary, ...archives]
}

/**
 * 把当前选中的草稿顶到最前。
 * @param order 基础顺序。
 * @param currentBlank 本账本里被选中的草稿 id。
 * @returns 副本：草稿在前，且不重复。
 */
export function pinCurrentBlank(order: readonly string[], currentBlank: string | undefined): string[] {
  if (currentBlank === undefined) return [...order]
  return [currentBlank, ...order.filter((id) => id !== currentBlank)]
}

/**
 * 会话是否可见。
 * @param session 会话摘要。
 * @param current 当前会话 id。
 * @param archived 归档集合。
 * @param archivedFilter 归档可见性。
 * @returns 是否进入列表。
 */
function sessionVisible(
  session: SessionSummary,
  current: string | undefined,
  archived: ReadonlySet<string>,
  archivedFilter: ArchivedFilter,
): boolean {
  if (session.origin === 'subagent') return false
  if (session.blank === true && session.id !== current) return false
  switch (archivedFilter) {
    case 'default':
      return !archived.has(session.id)
    case 'show':
      return true
    case 'only':
      return archived.has(session.id)
    default:
      return false
  }
}

/**
 * 行标题的规范化：草稿不给标题（由渲染层本地化），其余去掉首尾空白。
 * @param session 会话摘要。
 * @returns 标题或空串。
 */
function sessionTitle(session: SessionSummary): string {
  return session.blank === true ? '' : (session.title ?? '').trim()
}

/**
 * 按「草稿 → 置顶 → 其余」分区，但不改变各分区内的相对顺序。
 * @param members 已按视图顺序排好的成员。
 * @param pinned 置顶集合。
 * @param archived 归档集合。
 * @returns 分区后的成员。
 */
function sectionMembers(
  members: readonly SessionSummary[],
  pinned: ReadonlySet<string>,
  archived: ReadonlySet<string>,
): SessionSummary[] {
  const placeholders: SessionSummary[] = []
  const leading: SessionSummary[] = []
  const rest: SessionSummary[] = []
  for (const member of members) {
    if (member.blank === true) placeholders.push(member)
    else if (!archived.has(member.id) && pinned.has(member.id)) leading.push(member)
    else rest.push(member)
  }
  return [...placeholders, ...leading, ...rest]
}

/**
 * 把等待交互的种类收窄成原生认识的三种。
 * @param kind 状态里报的种类。
 * @returns 认识时返回它，否则 undefined。
 */
function visiblePendingKind(kind: string | undefined): SessionPendingInteractionStatus | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

/**
 * 统计一个会话正在运行的直接子代理数量。
 * @param list 会话列表快照。
 * @param parentId 父会话 id。
 * @param statuses 统一状态快照。
 * @returns 运行中的子代理数量。
 */
function runningChildCount(
  list: SessionListState,
  parentId: string,
  statuses: SessionStatusSnapshot,
): number {
  const catalog = list.projectionsBySession?.[parentId]?.values?.subagentCatalog
  if (catalog === undefined) return 0
  return catalog.reduce((count, child) => {
    const childStatus = statusesOf(statuses, child.id)
    const running = childStatus?.running ?? list.byId[child.id]?.running ?? false
    return count + (running ? 1 : 0)
  }, 0)
}

/**
 * 读出某个会话的状态（快照可能是 Map，也可能是普通对象）。
 * @param statuses 状态快照。
 * @param sessionId 会话 id。
 * @returns 状态或 undefined。
 */
export function statusesOf(
  statuses: SessionStatusSnapshot | undefined,
  sessionId: string,
): SessionStatus | undefined {
  if (statuses === undefined || statuses === null) return undefined
  const asMap = statuses as ReadonlyMap<string, SessionStatus>
  if (typeof asMap.get === 'function') return asMap.get(sessionId)
  return (statuses as Readonly<Record<string, SessionStatus>>)[sessionId]
}

/**
 * 把一个会话摘要投影成渲染行。
 * @param session 会话摘要。
 * @param list 会话列表快照（子代理目录）。
 * @param statuses 统一状态快照。
 * @param pinned 置顶集合。
 * @param archived 归档集合。
 * @returns 会话行。
 */
function sessionNode(
  session: SessionSummary,
  list: SessionListState,
  statuses: SessionStatusSnapshot,
  pinned: ReadonlySet<string>,
  archived: ReadonlySet<string>,
): SessionNode {
  const status = statusesOf(statuses, session.id)
  const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind)
  const cwd = session.cwd
  return {
    id: session.id,
    title: sessionTitle(session),
    blank: session.blank === true,
    running: status?.running ?? session.running,
    runningSubagentCount: runningChildCount(list, session.id, statuses),
    completed: status?.completionUnread === true,
    pinned: !archived.has(session.id) && pinned.has(session.id),
    archived: archived.has(session.id),
    updatedAt: Number(session.updatedAt) || 0,
    ...(cwd === undefined || cwd === '' ? {} : { cwd }),
    ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
  }
}

/**
 * 按工作区把会话分桶。
 * @param list 会话列表快照。
 * @param workspaces 工作区（成员顺序已由调用方投影好）。
 * @param archived 归档集合。
 * @param archivedFilter 归档可见性。
 * @param ungroupedOrder 未分组桶的本地顺序。
 * @returns 中间分组（未做标题与展开处理）。
 */
function groupByWorkspace(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archived: ReadonlySet<string>,
  archivedFilter: ArchivedFilter,
  ungroupedOrder: readonly string[] | undefined,
): GroupDraft[] {
  const current = mainSessionId(list)
  const groups: GroupDraft[] = []
  const accounted = new Set<string>()
  for (const workspace of workspaces) {
    const members: SessionSummary[] = []
    for (const id of workspace.sessionIds) {
      const summary = list.byId[id]
      if (summary === undefined) continue
      accounted.add(id)
      if (!sessionVisible(summary, current, archived, archivedFilter)) continue
      members.push(summary)
    }
    // 「只看归档」列的是归档，不是工作区清册：没有归档成员的工作区不出组。
    if (archivedFilter === 'only' && members.length === 0) continue
    groups.push({
      key: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      cwd: workspace.path,
      createdAt: parseTime(workspace.createdAt),
      label: workspace.title,
      sessions: members,
    })
  }
  const stray = list.ids
    .map((id) => list.byId[id])
    .filter(
      (session): session is SessionSummary =>
        session !== undefined &&
        !accounted.has(session.id) &&
        sessionVisible(session, current, archived, archivedFilter),
    )
  if (stray.length > 0) {
    groups.push({
      key: UNGROUPED_KEY,
      workspaceId: undefined,
      cwd: undefined,
      createdAt: undefined,
      label: '',
      sessions: orderedUngrouped(stray, ungroupedOrder, list.byId),
    })
  }
  return groups
}

/**
 * 应用未分组桶的保存顺序，新出现的松散会话按时间附在末尾。
 * @param members 未分组会话。
 * @param stored 保存的顺序。
 * @param summaries 会话摘要表。
 * @returns 排好序的成员。
 */
function orderedUngrouped(
  members: readonly SessionSummary[],
  stored: readonly string[] | undefined,
  summaries: Readonly<Record<string, SessionSummary>>,
): SessionSummary[] {
  const byId = new Map(members.map((session) => [session.id, session]))
  const ids =
    stored === undefined
      ? orderByRecency(
          members.map((session) => session.id),
          summaries,
        )
      : reconcileManualOrder(
          members.map((session) => session.id),
          stored,
          summaries,
        )
  return ids.flatMap((id) => {
    const session = byId.get(id)
    return session === undefined ? [] : [session]
  })
}

/**
 * 解析宿主给的 ISO 时间。
 * @param value ISO 字符串。
 * @returns 毫秒时间戳；非法值返回 undefined。
 */
function parseTime(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * 派生按工作区分组的树。
 *
 * 折叠的分组不产生会话行（但总数仍然统计），「只看归档」会丢掉没有可见成员的组。
 *
 * @param list 会话列表快照。
 * @param workspaces 工作区（成员顺序已投影）。
 * @param rowState 置顶/归档集合与归档可见性。
 * @param statuses 统一状态快照。
 * @param view 展开状态与未分组顺序。
 * @returns 渲染顺序的分组。
 */
export function deriveGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  rowState: SessionRowState,
  statuses: SessionStatusSnapshot,
  view: TreeView,
): GroupNode[] {
  const archived = new Set<string>(rowState.archivedSessionIds)
  const pinned = new Set<string>(rowState.pinnedSessionIds)
  const expandedGroups = new Set<string>(view.expandedGroups)
  const current = mainSessionId(list)
  const currentGroup = current === undefined ? undefined : owningGroupKey(workspaces, current)
  const groups: GroupNode[] = []
  for (const draft of groupByWorkspace(
    list,
    workspaces,
    archived,
    rowState.archivedFilter,
    view.ungroupedOrder,
  )) {
    const expanded = expandedGroups.has(draft.key)
    groups.push({
      key: draft.key,
      workspaceId: draft.workspaceId,
      cwd: draft.cwd,
      createdAt: draft.createdAt,
      label: draft.label,
      sessionCount: draft.sessions.length,
      expanded,
      containsCurrent: draft.key === currentGroup,
      sessions: expanded
        ? sectionMembers(draft.sessions, pinned, archived).map((session) =>
            sessionNode(session, list, statuses, pinned, archived),
          )
        : [],
    })
  }
  return groups
}

/**
 * 选出扁平列表的完整成员（与归档可见性无关）。
 * @param list 会话列表快照。
 * @returns 已知的普通会话 id（含归档，草稿只含当前那个）。
 */
export function sessionMemberIds(list: SessionListState): string[] {
  return visibleSessionIds(list, [], 'show')
}

/**
 * 按可见性选出会话 id（不做排序与投影）。
 * @param list 会话列表快照。
 * @param archivedSessionIds 归档集合。
 * @param archivedFilter 归档可见性。
 * @returns 列表顺序的可见 id。
 */
export function visibleSessionIds(
  list: SessionListState,
  archivedSessionIds: readonly string[],
  archivedFilter: ArchivedFilter,
): string[] {
  const archived = new Set<string>(archivedSessionIds)
  const current = mainSessionId(list)
  return list.ids.filter((id) => {
    const session = list.byId[id]
    return session !== undefined && sessionVisible(session, current, archived, archivedFilter)
  })
}

/**
 * 派生扁平列表行。
 * @param list 会话列表快照。
 * @param sessionIds 完整成员（已按所选顺序排好）。
 * @param rowState 置顶/归档集合与归档可见性。
 * @param statuses 统一状态快照。
 * @returns 分区的扁平行。
 */
export function deriveFlat(
  list: SessionListState,
  sessionIds: readonly string[],
  rowState: SessionRowState,
  statuses: SessionStatusSnapshot,
): SessionNode[] {
  const archived = new Set<string>(rowState.archivedSessionIds)
  const pinned = new Set<string>(rowState.pinnedSessionIds)
  const current = mainSessionId(list)
  const members = sessionIds.flatMap((id) => {
    const session = list.byId[id]
    return session !== undefined && sessionVisible(session, current, archived, rowState.archivedFilter)
      ? [session]
      : []
  })
  return sectionMembers(members, pinned, archived).map((session) =>
    sessionNode(session, list, statuses, pinned, archived),
  )
}

/**
 * 合并「本地元数据命中」与「宿主内容命中」，得到扁平搜索结果。
 * @param list 会话元数据。
 * @param workspaces 工作区成员与显示标题。
 * @param query 查询文本（首尾空白忽略）。
 * @param archivedSessionIds 归档集合。
 * @param archivedFilter 归档可见性（搜索跟随列表）。
 * @param statuses 统一状态快照。
 * @param content 宿主内容搜索当前页。
 * @param limit 协议规定的合并行上限。
 * @returns 去重截断后的结果与「还有更多」标记。
 */
export function deriveSearchResults(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  query: string,
  archivedSessionIds: readonly string[],
  archivedFilter: ArchivedFilter,
  statuses: SessionStatusSnapshot,
  content: { readonly items: readonly SessionSearchResultItem[]; readonly hasMore: boolean },
  limit: number,
): SearchResultSet {
  const needle = query.trim().toLowerCase()
  if (needle === '') return { items: [], hasMore: false }
  const archived = new Set<string>(archivedSessionIds)
  const current = mainSessionId(list)

  const workspaceBySession = new Map<string, string>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title)
    }
  }
  const labelOf = (summary: SessionSummary): string =>
    workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd)
  const contentBySession = new Map<string, SessionSearchResultItem>()
  for (const item of content.items) {
    if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item)
  }

  const local: SessionSummary[] = []
  for (const id of list.ids) {
    const summary = list.byId[id]
    // 草稿永远不参与查询（它的标题是本地化的，匹配它会把搜索绑到一种语言上）。
    if (
      summary === undefined ||
      summary.blank === true ||
      !sessionVisible(summary, current, archived, archivedFilter)
    ) {
      continue
    }
    if (
      sessionTitle(summary).toLowerCase().includes(needle) ||
      labelOf(summary).toLowerCase().includes(needle) ||
      summary.id.toLowerCase().includes(needle)
    ) {
      local.push(summary)
    }
  }
  const localById = new Map(local.map((summary) => [summary.id, summary]))
  const orderedLocal = orderByRecency(
    local.map((summary) => summary.id),
    list.byId,
  ).flatMap((id) => {
    const summary = localById.get(id)
    return summary === undefined ? [] : [summary]
  })

  const ordered: SessionSummary[] = []
  const included = new Set<string>()
  const include = (summary: SessionSummary): void => {
    if (included.has(summary.id)) return
    included.add(summary.id)
    ordered.push(summary)
  }
  for (const summary of orderedLocal) include(summary)
  for (const item of content.items) {
    const summary = list.byId[item.sessionId]
    if (
      summary !== undefined &&
      summary.blank !== true &&
      sessionVisible(summary, current, archived, archivedFilter)
    ) {
      include(summary)
    }
  }

  return {
    items: ordered.slice(0, limit).map((summary) => {
      const match = contentBySession.get(summary.id)
      const status = statusesOf(statuses, summary.id)
      const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind)
      const snippet = match?.snippet
      return {
        id: summary.id,
        title: sessionTitle(summary),
        workspace: labelOf(summary),
        running: status?.running ?? summary.running,
        runningSubagentCount: runningChildCount(list, summary.id, statuses),
        ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
        completed: status?.completionUnread === true,
        archived: archived.has(summary.id),
        ...(snippet === undefined ? {} : { snippet }),
      }
    }),
    hasMore: content.hasMore || ordered.length > limit,
  }
}

/**
 * 规范化比较用的目录写法（只对 Windows 盘符/UNC 把反斜杠当分隔符）。
 * @param path 目录路径。
 * @returns 去掉尾部分隔符的写法。
 */
function folderPath(path: string): string {
  const windows = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\')
  return (windows ? path.replaceAll('\\', '/') : path).replace(/\/+$/, '')
}

/**
 * 找最近的已注册祖先目录（不包含自身）。
 * @param path 工作区目录。
 * @param parents 已注册的工作区目录。
 * @returns 包含它的父目录路径，或 undefined。
 */
export function owningParentFolder(path: string, parents: readonly string[]): string | undefined {
  const child = folderPath(path)
  let owner: string | undefined
  let length = -1
  for (const parent of parents) {
    const root = folderPath(parent)
    if (root.length > length && child !== root && child.startsWith(`${root}/`)) {
      owner = parent
      length = root.length
    }
  }
  return owner
}

/**
 * 只保留指定 key 的展开/顺序账本。
 * @param record 原始记录。
 * @param keys 需要保留的 key。
 * @returns 过滤后的新记录。
 */
export function retainKeys<T>(
  record: Readonly<Record<string, T>>,
  keys: readonly string[],
): Record<string, T> {
  const retained = new Set(keys)
  return Object.fromEntries(Object.entries(record).filter(([key]) => retained.has(key)))
}

/**
 * 兼容旧调用方的分组投影：把工作区快照与会话列表折成分组模型。
 *
 * 历史版本的外壳用这个函数（`buildSidebarGroups`）产出「项目分组 + 最近任务」，
 * 现在的浏览区改用 {@link deriveGroups} / {@link deriveFlat}；这里保留一层
 * 薄适配，让既有自检与外部调用继续可用。
 *
 * @param input 工作区、会话与置顶/归档信息。
 * @returns 分组与扁平行。
 */
export function buildSidebarGroups(input: {
  readonly items: readonly WorkspaceView[]
  readonly byId: Readonly<Record<string, SessionSummary>>
  readonly ids: readonly string[]
  readonly archivedSessionIds: readonly string[]
  readonly pinnedSessionIds: readonly string[]
  readonly currentSessionId: string | null
}): { readonly groups: readonly GroupNode[]; readonly rows: readonly SessionNode[] } {
  // 当前会话由调用方显式给出，而快照里的 retainedBy 未必已经就绪，
  // 所以这里不使用 deriveGroups（它按主视图持有者判定），而是就地实现
  // 同样的可见性规则：草稿只留当前那一条，子代理与归档一律不显示。
  const current = input.currentSessionId
  const visible = (session: SessionSummary | undefined): session is SessionSummary =>
    session !== undefined &&
    session.origin !== 'subagent' &&
    (session.blank !== true || session.id === current)
  const accounted = new Set<string>()
  const groups: GroupNode[] = []
  const rows: SessionNode[] = []
  const archived = new Set(input.archivedSessionIds)
  const pinned = new Set(input.pinnedSessionIds)
  const nodeOf = (session: SessionSummary): SessionNode => ({
    id: session.id,
    title: session.blank === true ? '' : (session.title ?? '').trim(),
    blank: session.blank === true,
    running: session.running,
    runningSubagentCount: 0,
    completed: false,
    pinned: !archived.has(session.id) && pinned.has(session.id),
    archived: archived.has(session.id),
    updatedAt: Number(session.updatedAt) || 0,
  })
  const order = (members: readonly SessionSummary[]): SessionSummary[] =>
    orderByRecency(
      members.map((session) => session.id),
      input.byId,
    ).flatMap((id) => {
      const session = input.byId[id]
      return session === undefined ? [] : [session]
    })
  for (const workspace of input.items) {
    const members: SessionSummary[] = []
    for (const sessionId of workspace.sessionIds) {
      accounted.add(sessionId)
      const session = input.byId[sessionId]
      if (!visible(session)) continue
      if (archived.has(sessionId)) continue
      members.push(session)
    }
    if (members.length === 0) continue
    const ordered = order(members)
    const nodes = sectionMembers(ordered, pinned, archived).map(nodeOf)
    rows.push(...nodes)
    groups.push({
      key: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      cwd: workspace.path,
      createdAt: parseTime(workspace.createdAt),
      label: workspace.title,
      sessionCount: nodes.length,
      expanded: true,
      containsCurrent: current !== null && members.some((session) => session.id === current),
      sessions: nodes,
    })
  }
  const loose: SessionSummary[] = []
  for (const sessionId of input.ids) {
    if (accounted.has(sessionId)) continue
    const session = input.byId[sessionId]
    if (!visible(session)) continue
    if (archived.has(sessionId)) continue
    loose.push(session)
  }
  if (loose.length > 0) {
    const nodes = sectionMembers(order(loose), pinned, archived).map(nodeOf)
    rows.push(...nodes)
    groups.push({
      key: UNGROUPED_KEY,
      workspaceId: undefined,
      cwd: undefined,
      createdAt: undefined,
      label: '',
      sessionCount: nodes.length,
      expanded: true,
      containsCurrent: current !== null && loose.some((session) => session.id === current),
      sessions: nodes,
    })
  }
  return { groups, rows }
}
