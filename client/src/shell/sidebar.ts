/**
 * 本文件是插件接管左侧边栏后使用的「浏览区外壳」。
 *
 * 为什么要接管：DSH 的工作区列表没有"往里加一个分组"的扩展点。
 * `sidebar.workspaces` 是单占位槽，想让功能分组出现在这个列表里，只能连列表
 * 一起渲染。因此本文件负责重建原生浏览区在静止状态下的那部分：
 *
 *   - 区头（标题、搜索、添加工作区）；
 *   - 绑定到侧边栏视口的滚动列表；
 *   - 工作区分组及其会话行；
 *   - 悬停动作位、右键菜单目标、分组头上的「+」。
 *
 * 功能分组通过 inject 的 `sections` 传入（每项 `{ id, order, component, t }`），
 * 外壳把它们渲染在项目分组之上，搜索时隐藏。
 *
 * 本版刻意未移植：视图选项菜单（分组方式 / 排序 / 归档过滤）、拖动排序、
 * 悬停卡片、远程内容搜索、行尾可见的「…」按钮。会话行的右键 / Shift+F10
 * 仍然是原生菜单，重命名、分支、复制 ID、归档、置顶、工作区操作都在。
 */

import { formatAbsolute, formatRelative, toIso } from '../lib/time'
import { statusIcon, statusMeta } from '../lib/status'
import type { DragEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react'
import type { SidebarGroup, SidebarModel } from '../types'

const { useEffect, useMemo, useState } = React

/** 外壳自身的字典命名空间。 */
export const SIDEBAR_NS = 'feature-hub.sidebar'

/** 工作区分组折叠状态在 localStorage 里的键。 */
const EXPANDED_STORAGE_KEY = 'dsh-feature-hub.sidebar.expanded'

/** 原生浏览区声明的子槽；第三方往会话行里加的内容落在这里。 */
export const SIDEBAR_CHILDREN = {
  'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
  'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
  'sidebar.session.row.leading': { kind: 'list', scope: 'root', inline: true },
  'sidebar.session.row.trailing': { kind: 'list', scope: 'root', inline: true },
  'sidebar.session.row.hover': { kind: 'list', scope: 'root' },
}

const selectItems = (state: WorkspaceSnapshot): readonly WorkspaceView[] => state.items
const selectArchived = (state: WorkspaceSnapshot): readonly string[] => state.archivedSessionIds
const selectPinned = (state: WorkspaceSnapshot): readonly string[] => state.pinnedSessionIds
const selectList = (state: SessionListState): SessionListState => state
const selectStatuses = (state: SessionStatusSnapshot): SessionStatusSnapshot => state
const selectPanelActive = (info: { readonly activePanelId: string | null }): boolean =>
  info.activePanelId !== null

/** {@link buildSidebarGroups} 的入参。 */
export interface SidebarGroupsInput {
  readonly items: readonly WorkspaceView[]
  readonly byId: Readonly<Record<string, SessionSummary>>
  readonly ids: readonly string[]
  readonly archivedSessionIds: readonly string[]
  readonly pinnedSessionIds: readonly string[]
  readonly currentSessionId: string | null
}

/**
 * 给一个分组内的会话排序：置顶的按置顶顺序在前，其余按最近活动时间倒序。
 * @param sessions 该分组的成员会话。
 * @param pinned 全局置顶集合（最近置顶的在前）。
 * @returns 排好序的会话数组。
 */
function orderMembers(sessions: readonly SessionSummary[], pinned: readonly string[]): SessionSummary[] {
  const pinRank = new Map<string, number>(pinned.map((id, index) => [id, index]))
  return [...sessions].sort((left, right) => {
    const leftPinned = pinRank.has(left.id)
    const rightPinned = pinRank.has(right.id)
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
    if (leftPinned && rightPinned) return (pinRank.get(left.id) ?? 0) - (pinRank.get(right.id) ?? 0)
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt
    return String(left.id).localeCompare(String(right.id))
  })
}

/**
 * 把快照投影成可见的分组。
 *
 * 规则：一个会话归属于「第一个记账它的工作区」；没有被任何工作区记账的会话
 * 落到末尾的「未分组」。子代理行、已归档行，以及除当前草稿之外的所有草稿都
 * 不显示。
 *
 * @param input 快照与当前会话 id。
 * @returns 分组列表，以及扁平化的可见会话行。
 */
export function buildSidebarGroups(input: SidebarGroupsInput): SidebarModel {
  const byId = input.byId
  const archived = new Set<string>(input.archivedSessionIds)
  const pinned = input.pinnedSessionIds
  const accounted = new Set<string>()
  const rows: SessionSummary[] = []
  const groups: SidebarGroup[] = []
  const visible = (session: SessionSummary | undefined): session is SessionSummary =>
    session !== undefined &&
    session.origin !== 'subagent' &&
    (session.blank !== true || session.id === input.currentSessionId)
  for (const workspace of input.items) {
    const members: SessionSummary[] = []
    for (const sessionId of workspace.sessionIds) {
      accounted.add(sessionId)
      const session = byId[sessionId]
      if (!visible(session)) continue
      if (archived.has(sessionId)) continue
      members.push(session)
    }
    if (members.length === 0) continue
    const ordered = orderMembers(members, pinned)
    for (const session of ordered) rows.push(session)
    groups.push({
      key: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      project: workspace.title || basename(workspace.path),
      path: workspace.path,
      sessions: ordered,
    })
  }
  const ungrouped = []
  for (const sessionId of input.ids) {
    if (accounted.has(sessionId)) continue
    const session = byId[sessionId]
    if (!visible(session)) continue
    if (archived.has(sessionId)) continue
    ungrouped.push(session)
  }
  if (ungrouped.length > 0) {
    const ordered = orderMembers(ungrouped, pinned)
    for (const session of ordered) rows.push(session)
    groups.push({ key: '', workspaceId: '', project: '', path: '', sessions: ordered, ungrouped: true })
  }
  return { groups, rows }
}

/**
 * 取路径最后一段，用于工作区没有标题时的兜底名称。
 * @param path 工作区目录。
 * @returns 最后一段；空路径返回空串。
 */
function basename(path: string): string {
  const parts = String(path || '')
    .split(/[\\/]+/)
    .filter((part) => part !== '')
  return parts.length === 0 ? '' : String(parts[parts.length - 1])
}

/** 读取折叠状态；存储不可用时默认展开。 */
function readExpanded(): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed : null
  } catch (_error) {
    return null
  }
}

/**
 * 保存折叠状态。
 * @param value 以分组 key 为索引的展开映射。
 */
function writeExpanded(value: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(value))
  } catch (_error) {
    // 存储失败只影响记忆，不影响导航。
  }
}

/** 折叠/展开用的小三角。 */
function Chevron(open: boolean): ReactElement {
  return h(
    'svg',
    {
      className: open ? 'fh-ws-chevron fh-ws-chevron-open' : 'fh-ws-chevron',
      width: 10,
      height: 10,
      viewBox: '0 0 10 10',
      'aria-hidden': true,
      focusable: false,
    },
    h('path', {
      d: 'M3.4 1.8 L7 5 L3.4 8.2',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  )
}

/** 文件夹图标。 */
function Folder(): ReactElement {
  return h(
    'svg',
    {
      width: 16,
      height: 16,
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

/** 置顶图标。 */
function Pin(): ReactElement {
  return h(
    'svg',
    {
      className: 'fh-ws-pin',
      width: 11,
      height: 11,
      viewBox: '0 0 12 12',
      'aria-hidden': true,
      focusable: false,
      fill: 'currentColor',
    },
    h('path', { d: 'M7.6 1.2 10.8 4.4 9.4 5 8.8 7.6 5.6 8.2 3.4 10.4 2.8 9.8 5 7.6 5.6 4.4 8.2 3.8 Z' }),
  )
}

/** 加号图标。 */
function Plus(): ReactElement {
  return h(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 14 14',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    },
    h('path', { d: 'M7 2.6 V11.4 M2.6 7 H11.4' }),
  )
}

/** 放大镜图标。 */
function SearchGlyph(): ReactElement {
  return h(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 16 16',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    },
    h('circle', { cx: 7, cy: 7, r: 4.2 }),
    h('path', { d: 'M10.2 10.2 L13 13' }),
  )
}

/**
 * 侧边栏浏览区外壳组件。
 * @param props 插槽 props：外壳给的 `wide`、注入的功能清单与动作、滚动绑定钩子，
 * 以及标准数据 hooks（会话、工作区、状态、面板信息、右键菜单）。
 * @returns 浏览区元素；侧边栏收成图标栏时不渲染内容。
 */
export function SidebarBrowser(props: SidebarWorkspacesProps): ReactElement | null {
  const t = props.t
  const wide = props.wide !== false
  const items = props.useWorkspaces(selectItems)
  const archivedSessionIds = props.useWorkspaces(selectArchived)
  const pinnedSessionIds = props.useWorkspaces(selectPinned)
  const list = props.useSessions(selectList)
  const statuses = props.useSessionStatus(selectStatuses)
  const panelActive = props.usePanelInfo(selectPanelActive)
  const menu = typeof props.useContextMenu === 'function' ? props.useContextMenu() : undefined
  const getTriggerProps =
    menu !== undefined && typeof menu.getTriggerProps === 'function' ? menu.getTriggerProps : () => ({})
  const scroller = typeof props.useSectionScroller === 'function' ? props.useSectionScroller() : undefined
  const bindScrollerRef = scroller === undefined ? undefined : scroller.bindScrollerRef
  const sections = Array.isArray(props.sections) ? props.sections : []
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean> | null>(() => readExpanded())
  // 工作区分组拖拽排序：正在拖的 id，以及当前落点在哪个分组的前/后。
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ workspaceId: string; before: boolean } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const byId: Readonly<Record<string, SessionSummary>> = list.byId
  const currentSessionId = useMemo<string | null>(() => {
    if (panelActive) return null
    for (const sessionId of list.ids || []) {
      const row = byId[sessionId]
      if (row !== undefined && row.retainedBy !== undefined && row.retainedBy.mainView > 0) return sessionId
    }
    return null
  }, [list, byId, panelActive])

  const model = useMemo<SidebarModel>(
    () =>
      buildSidebarGroups({
        items,
        byId,
        ids: list.ids,
        archivedSessionIds,
        pinnedSessionIds,
        currentSessionId,
      }),
    [items, byId, list.ids, archivedSessionIds, pinnedSessionIds, currentSessionId],
  )

  // 相对时间要随停留时间推进。时钟节奏跟着"最新的一条可见会话"走：
  // 一小时内有过活动就每秒刷一次，否则每分钟一次，避免闲置时每秒重渲染。
  const freshestAge = useMemo(() => {
    let freshest = Number.POSITIVE_INFINITY
    for (const row of model.rows) {
      const stamp = Number(row.updatedAt) || 0
      if (stamp <= 0) continue
      const age = Date.now() - stamp
      if (age >= 0 && age < freshest) freshest = age
    }
    return freshest
  }, [model.rows])
  useEffect(() => {
    const interval = freshestAge < 3_600_000 ? 1_000 : 60_000
    const timer = setInterval(() => {
      setNow(Date.now())
    }, interval)
    return () => {
      clearInterval(timer)
    }
  }, [freshestAge])

  const needle = query.trim().toLowerCase()
  const searching = needle !== ''
  const matches = useMemo<readonly SessionSummary[] | null>(() => {
    if (!searching) return null
    return model.rows.filter((session) =>
      String(session.displayTitle || session.title || '')
        .toLowerCase()
        .includes(needle),
    )
  }, [model, needle, searching])

  const isExpanded = (key: string): boolean => expanded === null || expanded[key] !== false
  const toggle = (key: string): void => {
    const next = { ...(expanded || {}) }
    next[key] = !(next[key] !== false)
    setExpanded(next)
    writeExpanded(next)
  }
  const open = (sessionId: string): void => {
    if (typeof props.openSession === 'function') props.openSession(sessionId)
  }
  const newSession = (workspaceId: string): void => {
    if (typeof props.startSession === 'function') props.startSession(workspaceId)
  }
  const addWorkspace = (): void => {
    if (typeof props.addWorkspace === 'function') void props.addWorkspace()
  }
  /**
   * 把工作区分组移动到目标分组的前面或后面。
   *
   * `insertBefore` 只在组内移动时给出锚点；落到末尾时锚点缺省，Host 会追加。
   * @param workspaceId 被拖动的分组 id。
   * @param targetId 落点分组 id。
   * @param before true 表示插到落点之前。
   * @returns 无返回值；动作失败时由 Host 层报错，界面保持原序。
   */
  const moveGroup = (workspaceId: string, targetId: string, before: boolean): void => {
    if (typeof props.reorderWorkspace !== 'function') return
    if (workspaceId === targetId) return
    const real = model.groups.filter((group) => group.workspaceId !== '')
    const index = real.findIndex((group) => group.workspaceId === targetId)
    if (index === -1) return
    // 落到目标之后 = 落到它的下一个分组之前；没有下一个就追加到末尾。
    const next = real[index + 1]
    const anchor = before ? targetId : next === undefined ? undefined : next.workspaceId
    if (anchor === workspaceId) return
    void props.reorderWorkspace(workspaceId, anchor)
  }

  /**
   * 开始拖动一个工作区分组；空字符串 id 的「未分组」不参与排序。
   * @param event 原生拖拽事件。
   * @param workspaceId 被拖动的分组 id。
   */
  const onGroupDragStart = (event: DragEvent<HTMLElement>, workspaceId: string): void => {
    if (workspaceId === '') return
    event.dataTransfer.effectAllowed = 'move'
    // 某些浏览器要求必须写 data 才会开始拖动。
    event.dataTransfer.setData('text/plain', workspaceId)
    setDragging(workspaceId)
  }

  /**
   * 拖动经过某个分组时记录落点（以该分组的中线判断落在前面还是后面）。
   * @param event 原生拖拽事件。
   * @param workspaceId 经过的分组 id。
   */
  const onGroupDragOver = (event: DragEvent<HTMLElement>, workspaceId: string): void => {
    if (dragging === null || workspaceId === '' || workspaceId === dragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    setDropTarget((current) =>
      current !== null && current.workspaceId === workspaceId && current.before === before
        ? current
        : { workspaceId, before },
    )
  }

  /**
   * 放下分组：执行排序并清理拖拽态。
   * @param event 原生拖拽事件。
   * @param workspaceId 落点分组 id。
   */
  const onGroupDrop = (event: DragEvent<HTMLElement>, workspaceId: string): void => {
    event.preventDefault()
    if (dragging === null) return
    const before = dropTarget !== null && dropTarget.workspaceId === workspaceId ? dropTarget.before : true
    moveGroup(dragging, workspaceId, before)
    setDragging(null)
    setDropTarget(null)
  }

  /** 拖动结束（含取消）时清理拖拽态。 */
  const onGroupDragEnd = (): void => {
    setDragging(null)
    setDropTarget(null)
  }

  const titleOf = (session: SessionSummary): string => {
    if (session.blank === true) return t('session.new')
    return session.displayTitle || session.title || t('session.untitled')
  }
  const statusOf = (sessionId: string): SessionStatus | undefined =>
    statuses !== undefined && statuses !== null && typeof statuses.get === 'function'
      ? statuses.get(sessionId)
      : undefined
  const groupsByKey = useMemo(() => {
    const map = new Map<string, SidebarGroup>()
    for (const group of model.groups) map.set(group.key, group)
    return map
  }, [model])

  const renderSession = (session: SessionSummary, group: SidebarGroup): ReactElement => {
    const selected = session.id === currentSessionId
    const archived = archivedSessionIds.includes(session.id)
    const pinned = pinnedSessionIds.includes(session.id)
    const title = titleOf(session)
    const menuTarget: SessionMenuTarget = {
      kind: 'session',
      value: { sessionId: session.id, displayTitle: title },
    }
    const statusInfo = statusMeta(statusOf(session.id))
    const statusElement = statusIcon(statusInfo, statusInfo === null ? t('status.idle') : t(statusInfo.key))
    // 原生浏览区还声明着这些子槽；本注册没有声明它们，渲染会抛错，
    // 所以外壳干脆不渲染（悬停的归档/置顶按钮因此不出现，右键菜单不受影响）。
    const leading = null
    const trailing = null
    const quick = null
    return h(
      'div',
      {
        key: session.id,
        className: `fh-ws-row${selected ? ' fh-ws-row-selected' : ''}${archived ? ' fh-ws-row-archived' : ''}${session.blank === true ? ' fh-ws-row-blank' : ''}`,
        role: 'treeitem',
        'aria-selected': selected,
        tabIndex: 0,
        title: `${title}\n${group !== undefined && group.path !== '' ? group.path : ''}`.trim(),
        ...getTriggerProps(menuTarget),
        onClick: () => {
          if (archived) {
            if (typeof props.notifyArchivedNotOpenable === 'function') props.notifyArchivedNotOpenable()
            return
          }
          open(session.id)
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          open(session.id)
        },
      },
      h('span', { className: 'fh-ws-slot' }, statusElement || leading),
      h('span', { className: 'fh-ws-title' }, title),
      h(
        'span',
        { className: 'fh-ws-rest' },
        h(
          'time',
          {
            className: 'fh-ws-time',
            dateTime: toIso(session.updatedAt),
            title: formatAbsolute(session.updatedAt),
          },
          formatRelative(session.updatedAt, t, now),
        ),
        trailing,
        pinned ? h(Pin) : null,
      ),
      h(
        'span',
        {
          className: 'fh-ws-actions',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
          },
        },
        h('span', { className: 'fh-ws-quick' }, quick),
      ),
    )
  }

  const renderGroupHeader = (group: SidebarGroup): ReactElement => {
    const openGroup = searching || isExpanded(group.key)
    const label = group.ungrouped === true ? t('group.ungrouped') : group.project
    const draggable = group.workspaceId !== '' && !searching
    const drop = dropTarget !== null && dropTarget.workspaceId === group.workspaceId
    const classNames = ['fh-ws-group-head']
    if (dragging === group.workspaceId) classNames.push('fh-ws-group-dragging')
    if (drop && dropTarget !== null)
      classNames.push(dropTarget.before ? 'fh-ws-drop-before' : 'fh-ws-drop-after')
    return h(
      'div',
      {
        key: `head:${group.key}`,
        className: classNames.join(' '),
        role: 'treeitem',
        'aria-expanded': openGroup,
        tabIndex: 0,
        title: group.path,
        draggable,
        onDragStart: (event: DragEvent<HTMLElement>) => {
          onGroupDragStart(event, group.workspaceId)
        },
        onDragOver: (event: DragEvent<HTMLElement>) => {
          onGroupDragOver(event, group.workspaceId)
        },
        onDragLeave: () => {
          if (drop) setDropTarget(null)
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          onGroupDrop(event, group.workspaceId)
        },
        onDragEnd: onGroupDragEnd,
        onClick: () => {
          toggle(group.key)
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle(group.key)
        },
      },
      h('span', { className: 'fh-ws-folder' }, Chevron(openGroup), Folder()),
      h('span', { className: 'fh-ws-group-title' }, label),
      group.workspaceId === ''
        ? null
        : h(
            'button',
            {
              type: 'button',
              className: 'fh-ws-icon-button',
              title: t('actions.newSession'),
              'aria-label': `${t('actions.newSession')}: ${label}`,
              onClick: (event: MouseEvent) => {
                event.stopPropagation()
                newSession(group.workspaceId)
              },
            },
            Plus(),
          ),
    )
  }

  const renderGroup = (group: SidebarGroup): ReactElement | null => {
    const openGroup = searching || isExpanded(group.key)
    const sessions = searching
      ? group.sessions.filter((session) => matches !== null && matches.includes(session))
      : group.sessions
    if (searching && sessions.length === 0) return null
    return h(
      'section',
      { key: `group:${group.key}`, className: 'fh-ws-group' },
      renderGroupHeader(group),
      openGroup
        ? h(
            'div',
            { className: 'fh-ws-group-body' },
            sessions.map((session) => renderSession(session, group)),
          )
        : null,
    )
  }

  // 侧边栏收成图标栏时不渲染这块内容，与原生浏览区「只显示宽态」的行为一致。
  if (!wide) return null

  return h(
    'div',
    { className: 'fh-ws', 'data-wide': 'true' },
    h(
      'div',
      { className: 'fh-ws-head' },
      h('span', { className: 'fh-ws-section-label' }, t('section.workspaces')),
      searchOpen || searching
        ? h(
            'span',
            { className: 'fh-ws-search' },
            h('input', {
              className: 'fh-ws-search-input',
              type: 'text',
              autoFocus: true,
              value: query,
              placeholder: t('search.placeholder'),
              'aria-label': t('search.placeholder'),
              onChange: (event) => {
                setQuery(event.currentTarget.value)
              },
              onKeyDown: (event) => {
                if (event.key !== 'Escape') return
                setQuery('')
                setSearchOpen(false)
              },
            }),
          )
        : h(
            'button',
            {
              type: 'button',
              className: 'fh-ws-icon-button',
              title: t('search.open'),
              'aria-label': t('search.open'),
              onClick: () => {
                setSearchOpen(true)
              },
            },
            SearchGlyph(),
          ),
      h(
        'button',
        {
          type: 'button',
          className: 'fh-ws-icon-button',
          title: t('actions.addWorkspace'),
          'aria-label': t('actions.addWorkspace'),
          onClick: addWorkspace,
        },
        Plus(),
      ),
    ),
    h(
      'div',
      {
        className: 'fh-ws-list',
        ref: wide ? bindScrollerRef : undefined,
        'data-sidebar-list-area': '',
      },
      searching
        ? matches === null || matches.length === 0
          ? h('div', { className: 'fh-ws-empty' }, t('search.empty'))
          : h(
              'div',
              { className: 'fh-ws-group' },
              h(
                'div',
                { className: 'fh-ws-group-head', role: 'treeitem', 'aria-expanded': true },
                h('span', { className: 'fh-ws-folder' }, Folder()),
                h('span', { className: 'fh-ws-group-title' }, t('search.results')),
              ),
              h(
                'div',
                { className: 'fh-ws-group-body' },
                (matches === null ? [] : matches).map((session) =>
                  renderSession(
                    session,
                    groupsByKey.get(workspaceOfSession(session, model)) ?? UNGROUPED_GROUP,
                  ),
                ),
              ),
            )
        : h(
            React.Fragment,
            null,
            sections
              .filter((section) => section !== undefined && section !== null)
              .slice()
              .sort((left, right) => (left.order || 0) - (right.order || 0))
              .map((section) =>
                h(section.component, {
                  key: section.id,
                  t: section.t === undefined ? t : section.t,
                  now,
                  model,
                  rows: model.rows,
                  currentSessionId,
                  snapshot: { items, byId, ids: list.ids, archivedSessionIds, pinnedSessionIds, statuses },
                  openSession: open,
                }),
              ),
            model.groups.map(renderGroup),
            model.groups.length === 0 ? h('div', { className: 'fh-ws-empty' }, t('empty.none')) : null,
          ),
    ),
  )
}

/**
 * 找出一条会话属于哪个工作区分组。
 * @param session 会话摘要。
 * @param model {@link buildSidebarGroups} 的结果。
 * @returns 工作区 id；未分组返回空串。
 */
function workspaceOfSession(session: SessionSummary, model: SidebarModel): string {
  for (const group of model.groups) {
    if (group.sessions.some((candidate) => candidate.id === session.id)) return group.key
  }
  return ''
}

/** 项目不在模型里的行使用的占位分组。 */
const UNGROUPED_GROUP: SidebarGroup = {
  key: '',
  workspaceId: '',
  project: '',
  path: '',
  sessions: [],
  ungrouped: true,
}

/** 外壳字典，由 main.ts 注册到 {@link SIDEBAR_NS}。 */
export const SIDEBAR_DICT = {
  zh: {
    'section.workspaces': '工作区',
    'group.ungrouped': '未分组',
    'actions.newSession': '新建会话',
    'actions.addWorkspace': '添加工作区',
    'search.open': '搜索会话',
    'search.placeholder': '搜索会话…',
    'search.empty': '没有匹配的会话',
    'search.results': '搜索结果',
    'session.new': '新会话',
    'session.untitled': '未命名会话',
    'empty.none': '还没有会话',
    'time.justNow': '刚刚',
    'time.minutes': '{count} 分钟前',
    'time.hours': '{count} 小时前',
    'time.days': '{count} 天前',
    'time.unknown': '—',
    'status.running': '运行中',
    'status.waiting': '待确认',
    'status.done': '有新结果',
    'status.idle': '空闲',
    'shell.fallback': '侧边栏加载异常，已切换为简版列表；重开或刷新可恢复。',
  },
  en: {
    'section.workspaces': 'Workspaces',
    'group.ungrouped': 'Ungrouped',
    'actions.newSession': 'New session',
    'actions.addWorkspace': 'Add workspace',
    'search.open': 'Search sessions',
    'search.placeholder': 'Search sessions…',
    'search.empty': 'No session matches',
    'search.results': 'Results',
    'session.new': 'New session',
    'session.untitled': 'Untitled session',
    'empty.none': 'No sessions yet',
    'time.justNow': 'Just now',
    'time.minutes': '{count} min ago',
    'time.hours': '{count} hr ago',
    'time.days': '{count} d ago',
    'time.unknown': '—',
    'status.running': 'Running',
    'status.waiting': 'Waiting for you',
    'status.done': 'New result',
    'status.idle': 'Idle',
    'shell.fallback':
      'The full sidebar failed to render; showing a simplified list. Reopen or refresh to recover.',
  },
}

/**
 * 外壳样式表。尺寸对齐原生浏览区：36px 区头、32px 行、16px 前导格、10px 时间。
 * 颜色只用主题 token；更淡的层次用 color-mix 从主文字色派生，
 * 这样浅色和深色主题下悬停、选中都看得出来。
 */
export const SIDEBAR_STYLES = `
.fh-ws, .fh-ws *, .fh-ws *::before, .fh-ws *::after { box-sizing: border-box; }
.fh-ws {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100cqh;
  color: var(--dsw-alias-label-primary);
}
.fh-ws-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 4px 0 12px;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-section-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 20px;
}
.fh-ws-icon-button {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.fh-ws-icon-button:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }
.fh-ws-icon-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.fh-ws-search { flex: 1 1 auto; min-width: 0; display: flex; }
.fh-ws-search-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.fh-ws-search-input::placeholder { color: var(--dsw-alias-label-secondary); }
.fh-ws-search-input:focus-visible { border-color: var(--dsw-alias-brand-primary); }
.fh-ws-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px 16px 0;
  scrollbar-width: thin;
}
.fh-ws-group + .fh-ws-group { margin-top: 4px; }
.fh-ws-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 6px 0 12px;
  border-radius: 8px;
  cursor: pointer;
}
.fh-ws-group-head[draggable='true'] { cursor: grab; }
.fh-ws-group-head[draggable='true']:active { cursor: grabbing; }
.fh-ws-group-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.fh-ws-group-dragging { opacity: 0.45; }
/* 拖拽落点：用上下两条 2px 的主题色线表示插在前/后。 */
.fh-ws-drop-before { position: relative; }
.fh-ws-drop-after { position: relative; }
.fh-ws-drop-before::before,
.fh-ws-drop-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--dsw-alias-state-business-primary);
  pointer-events: none;
}
.fh-ws-drop-before::before { top: -2px; }
.fh-ws-drop-after::after { bottom: -2px; }
.fh-ws-group-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.fh-ws-folder {
  position: relative;
  flex: none;
  width: 16px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-folder > svg { position: absolute; }
/* 折叠指示器常驻：原生只在悬停时用箭头临时替换文件夹图标，静止状态下开、合
   两态长得一模一样。这里让它一直画在分组头的左侧留白里（不占布局、不挪标题），
   向右 = 已收起，向下 = 已展开；文件夹/时钟图标始终保留。 */
.fh-ws-chevron { top: 5px; left: -10px; transition: transform 120ms ease; }
.fh-ws-chevron-open { transform: rotate(90deg); }
.fh-ws-group-head:hover .fh-ws-chevron { color: var(--dsw-alias-label-primary); }
.fh-ws-group-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
}
.fh-ws-group-head > .fh-ws-icon-button { opacity: 0; }
.fh-ws-group-head:hover > .fh-ws-icon-button { opacity: 1; }
.fh-ws-group-body { display: flex; flex-direction: column; gap: 2px; }
.fh-ws-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  /* 12px + 16px 状态位 + 6px 间距 = 34px，与分组标题同一列（对齐原生浏览区：
     会话标题和项目标题左对齐，缩进只由前导格体现，而不是再往里推一截）。 */
  padding: 0 8px 0 12px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
}
.fh-ws-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.fh-ws-row-selected { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.fh-ws-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.fh-ws-slot {
  flex: none;
  width: 16px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
}
.fh-ws-rest { flex: none; display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); }
.fh-ws-time { font-size: 10px; line-height: 16px; font-variant-numeric: tabular-nums; }
.fh-ws-actions { display: none; flex: none; align-items: center; gap: 4px; }
.fh-ws-quick { display: contents; }
.fh-ws-row:hover .fh-ws-rest { display: none; }
.fh-ws-row:hover .fh-ws-actions { display: inline-flex; }
.fh-ws-row-archived .fh-ws-title { color: var(--dsw-alias-label-secondary); }
.fh-ws-row-blank .fh-ws-title { color: var(--dsw-alias-label-secondary); }
.fh-ws-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex: none;
}

.fh-ws-spinner {
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  flex: none;
  border-radius: 50%;
  border: 1.6px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent);
  border-top-color: var(--dsw-alias-state-business-primary);
  animation: fh-ws-spin 0.8s linear infinite;
}
@keyframes fh-ws-spin {
  to { transform: rotate(360deg); }
}
.fh-ws-dot-warn { background: var(--dsw-alias-state-warn-primary); }
.fh-ws-dot-warn::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
  animation: fh-ws-dot-pulse 1.6s ease-in-out infinite;
}
.fh-ws-dot-done { background: var(--dsw-alias-state-success-primary); }

@keyframes fh-ws-dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.25; }
  50% { transform: scale(1.7); opacity: 0.55; }
}
.fh-ws-pin { color: var(--dsw-alias-label-secondary); }
.fh-ws-empty { padding: 40px 12px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); }
@media (hover: none) {
  .fh-ws-rest { display: none; }
  .fh-ws-actions { display: inline-flex; }
}
@media (prefers-reduced-motion: reduce) {
  .fh-ws-chevron { transition: none; }
  .fh-ws-dot-warn::after, .fh-ws-spinner { animation: none; }
}
`

/**
 * 外壳的渲染错误边界。
 *
 * 插槽里的组件一旦抛错，整块区域会变成空白，用户就没有任何导航了。
 * 这里退化成一份"低假设"的简版列表：工作区标题 + 会话标题，仍然可点击，
 * 并显示一行说明，避免整块区域消失。
 */
interface ShellBoundaryProps {
  readonly fallback: () => ReactElement | null
  readonly children?: ReactElement | null
}

interface ShellBoundaryState {
  readonly failed: boolean
}

export class ShellBoundary extends React.Component<ShellBoundaryProps, ShellBoundaryState> {
  constructor(props: ShellBoundaryProps) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError(): ShellBoundaryState {
    return { failed: true }
  }

  override render(): ReactElement | null {
    if (this.state.failed) return this.props.fallback()
    return this.props.children ?? null
  }
}

/**
 * 外壳无法渲染时使用的简版导航。
 * @param props 与外壳相同的插槽 props。
 * @returns 平铺的工作区 + 会话列表。
 */
export function FallbackList(props: SidebarWorkspacesProps): ReactElement {
  const t = props.t
  const items = props.useWorkspaces(selectItems)
  const list = props.useSessions(selectList)
  const byId: Readonly<Record<string, SessionSummary>> = list.byId
  const open = (sessionId: string): void => {
    if (typeof props.openSession === 'function') props.openSession(sessionId)
  }
  return h(
    'div',
    { className: 'fh-ws' },
    h(
      'div',
      { className: 'fh-ws-head' },
      h('span', { className: 'fh-ws-section-label' }, t('section.workspaces')),
    ),
    h(
      'div',
      { className: 'fh-ws-list' },
      h('div', { className: 'fh-ws-empty' }, t('shell.fallback')),
      items.map((workspace) =>
        h(
          'section',
          { key: workspace.workspaceId, className: 'fh-ws-group' },
          h(
            'div',
            { className: 'fh-ws-group-head' },
            h('span', { className: 'fh-ws-group-title' }, workspace.title || ''),
            h('span', { className: 'fh-ws-count' }, String((workspace.sessionIds || []).length)),
          ),
          h(
            'div',
            { className: 'fh-ws-group-body' },
            (workspace.sessionIds || []).map((sessionId) => {
              const session = byId[sessionId]
              if (session === undefined) return null
              return h(
                'div',
                {
                  key: sessionId,
                  className: 'fh-ws-row',
                  onClick: () => {
                    open(sessionId)
                  },
                },
                h('span', { className: 'fh-ws-title' }, session.displayTitle || session.title || sessionId),
              )
            }),
          ),
        ),
      ),
    ),
  )
}

/**
 * 真正注册到插槽里的入口：外壳包在错误边界里，渲染失败时降级为
 * {@link FallbackList}，而不是留下一块空白。
 * @param props 与外壳相同的插槽 props。
 * @returns 错误边界元素。
 */
export function SidebarEntry(props: SidebarWorkspacesProps): ReactElement {
  return h(ShellBoundary, { fallback: () => h(FallbackList, props) }, h(SidebarBrowser, props))
}
