/**
 * 功能组件：侧边栏里的「最近任务」分组（`recent-tasks`）。
 *
 * 位置：由侧边栏外壳渲染在项目分组之上，外观与工作区分组一致（可折叠、
 * 行高 32px、左侧状态位）。数据是「跨项目摘要」而不是某个项目：
 * 取全部项目里按活动时间倒序的前 N 条会话，N 可在「设置 → 功能集」里改。
 *
 * 两条重要规则：
 *   1. 运行中 / 待确认的会话永远不被条数裁掉——先取 N 条，再把超出 N 的
 *      进行中会话按时间补进来，因此实际条数可能大于 N，徽标显示真实条数；
 *   2. 本轮会话所在的行要显示选中态，和它在所属项目里的高亮一致。
 *
 * 数据来源：外壳从插槽标准 hooks 取得快照后传入（`rows` 为全部可见会话），
 * 本功能只做投影与渲染，不查询 Host、不写会话数据。
 *
 * 目录约定：本功能独占一个文件夹——`index.ts`（组件与描述对象）、`locale.ts`（中英文字典）、`styles.ts`（样式）。
 */

import { readRecentLimit, subscribeRecentLimit } from './preferences'
import { statusIcon } from '../../lib/status'
import type { StatusMeta } from '../../types'
import type { ReactElement } from 'react'

const { useEffect, useMemo, useState } = React

/** 本功能的标识，同时是分组 id。 */
export const RECENT_TASKS_ID = 'recent-tasks'

/** 折叠状态在 localStorage 里的键。 */
const COLLAPSE_STORAGE_KEY = 'dsh-feature-hub.recent-tasks.collapsed'

/**
 * 读取一个可选的条数上限；缺省或非法时视为「不限制」。
 * @param value 调用方给的上限。
 * @returns 正整数或 Infinity。
 */
function limitOf(value: unknown): number {
  const count = Number(value)
  return Number.isFinite(count) && count >= 1 ? Math.floor(count) : Number.POSITIVE_INFINITY
}

/**
 * 把会话列表投影成摘要行。
 *
 * 纯函数且导出：Node 自检直接断言它，不需要渲染器。
 *
 * @param rows 全部可见会话（已由外壳过滤掉草稿、子代理与归档）。
 * @param limit 需要保留的条数（默认不限）。
 * @param activeIds 进行中的会话 id 集合；这些行不会被条数裁掉。
 * @returns 按活动时间倒序的行。
 */
export function recentAcrossProjects(
  rows: readonly SessionSummary[],
  limit?: number,
  activeIds?: ReadonlySet<string>,
): SessionSummary[] {
  const sorted = [...rows]
    .filter((session): session is SessionSummary => session !== undefined && session !== null)
    .sort((left, right) => {
      const delta = (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0)
      if (delta !== 0) return delta
      return String(left.id).localeCompare(String(right.id))
    })
  const cap = limitOf(limit)
  const picked = Number.isFinite(cap) ? sorted.slice(0, cap) : sorted
  if (activeIds === undefined || activeIds.size === 0) return picked
  // 进行中的会话永远显示：宁可让列表长过配置值，也不能把正在跑的任务藏起来。
  const seen = new Set(picked.map((session) => session.id))
  for (const session of sorted) {
    if (seen.has(session.id) || !activeIds.has(session.id)) continue
    seen.add(session.id)
    picked.push(session)
  }
  return picked.sort((left, right) => {
    const delta = (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0)
    if (delta !== 0) return delta
    return String(left.id).localeCompare(String(right.id))
  })
}

/** 读取折叠状态；存储不可用时默认展开。 */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  } catch (_error) {
    return false
  }
}

/**
 * 写入折叠状态。
 * @param value 是否折叠。
 */
function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? '1' : '0')
  } catch (_error) {
    // 存储失败只影响记忆，不影响本次交互。
  }
}

/**
 * 生成 `<time dateTime>` 需要的 ISO 字符串。
 * @param instant 毫秒时间戳。
 * @returns ISO 字符串；非法值返回 undefined。
 */
function isoOf(instant: number): string | undefined {
  const value = Number(instant)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return new Date(value).toISOString()
}

/**
 * 生成相对时间文案。
 * @param instant 毫秒时间戳。
 * @param now 外壳的时钟。
 * @param t 本功能的翻译函数。
 * @returns 例如「刚刚」「3 分钟前」。
 */
function relativeLabel(instant: number, now: number, t: Translate): string {
  const value = Number(instant)
  if (!Number.isFinite(value) || value <= 0) return t('time.unknown')
  const age = Math.max(0, now - value)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (age < minute) return t('time.justNow')
  if (age < hour) return t('time.minutes', { count: Math.floor(age / minute) })
  if (age < day) return t('time.hours', { count: Math.floor(age / hour) })
  return t('time.days', { count: Math.floor(age / day) })
}

/**
 * 读取一个会话的状态描述。
 *
 * 状态快照可能是 Map，也可能是普通对象（取决于装载方式），两种都兼容。
 *
 * @param statuses 状态快照。
 * @param sessionId 会话 id。
 * @returns 状态描述；空闲或没有数据时返回 null。
 */
function statusOf(statuses: SessionStatusSnapshot | undefined, sessionId: string): StatusMeta | null {
  if (statuses === undefined || statuses === null) return null
  const status =
    typeof (statuses as ReadonlyMap<string, SessionStatus>).get === 'function'
      ? (statuses as ReadonlyMap<string, SessionStatus>).get(sessionId)
      : (statuses as Readonly<Record<string, SessionStatus>>)[sessionId]
  if (status === undefined || status === null) return null
  if (status.pendingInteraction !== undefined) return { tone: 'warn', key: 'status.waiting' }
  if (status.running === true) return { tone: 'live', key: 'status.running' }
  if (status.completionUnread === true) return { tone: 'done', key: 'status.done' }
  return null
}

/**
 * 「最近任务」分组。
 * @param props 外壳传入的 props：本功能字典、全部可见行、时钟、快照与打开会话的回调。
 * @returns 分组元素。
 */
export function RecentTasksSection(props: SidebarSectionProps): ReactElement {
  const { t, now, snapshot, openSession } = props
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  const [limit, setLimit] = useState<number>(readRecentLimit)

  // 设置页改动条数后，已打开的分组即时跟随。
  useEffect(
    () =>
      subscribeRecentLimit(() => {
        setLimit(readRecentLimit())
      }),
    [],
  )

  const statuses = snapshot.statuses
  const activeIds = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>()
    for (const row of props.rows) {
      const status = statusOf(statuses, row.id)
      // 「完成未读」不算进行中，不应该突破条数上限。
      if (status !== null && status.tone !== 'done') ids.add(row.id)
    }
    return ids
  }, [props.rows, statuses])

  const rows = useMemo(
    () => recentAcrossProjects(props.rows, limit, activeIds),
    [props.rows, limit, activeIds],
  )

  /** 切换折叠状态并记住它。 */
  const toggle = (): void => {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }
  /** 打开某条会话。 */
  const open = (sessionId: string): void => {
    if (typeof openSession === 'function') openSession(sessionId)
  }
  /** 行标题：草稿显示「新会话」，无标题显示「未命名会话」。 */
  const titleOf = (session: SessionSummary): string => {
    if (session.blank === true) return t('row.new')
    return session.displayTitle || session.title || t('row.untitled')
  }

  const chevron = h(
    'svg',
    {
      className: collapsed ? 'fh-ws-chevron' : 'fh-ws-chevron fh-ws-chevron-open',
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

  const clock = h(
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
      strokeLinecap: 'round',
    },
    h('path', { d: 'M13.2 8 A5.2 5.2 0 1 1 11.6 4.3' }),
    h('path', { d: 'M8 5.2 V8 L10 9.1' }),
  )

  const header = h(
    'div',
    {
      className: 'fh-ws-group-head',
      id: 'fh-ws-recent-head',
      role: 'treeitem',
      'aria-expanded': !collapsed,
      tabIndex: 0,
      onClick: toggle,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        toggle()
      },
    },
    h('span', { className: 'fh-ws-folder' }, chevron, clock),
    h('span', { className: 'fh-ws-group-title' }, t('title')),
    rows.length === 0 ? null : h('span', { className: 'fh-ws-count' }, String(rows.length)),
  )

  /** 一行会话：状态位 + 标题 + 相对时间，当前会话带选中态。 */
  const rowElement = (session: SessionSummary): ReactElement => {
    const status = statusOf(statuses, session.id)
    const selected = props.currentSessionId !== null && props.currentSessionId === session.id
    return h(
      'div',
      {
        key: session.id,
        className: `fh-ws-row${selected ? ' fh-ws-row-selected' : ''}`,
        role: 'treeitem',
        'aria-selected': selected,
        tabIndex: 0,
        title: titleOf(session),
        onClick: () => {
          open(session.id)
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          open(session.id)
        },
      },
      h(
        'span',
        { className: 'fh-ws-slot' },
        statusIcon(status, t(status === null ? 'status.idle' : status.key)),
      ),
      h('span', { className: 'fh-ws-title' }, titleOf(session)),
      h(
        'span',
        { className: 'fh-ws-rest' },
        h(
          'time',
          {
            className: 'fh-ws-time',
            dateTime: isoOf(session.updatedAt),
            title: Number.isFinite(Number(session.updatedAt))
              ? new Date(Number(session.updatedAt)).toLocaleString()
              : undefined,
          },
          relativeLabel(session.updatedAt, now, t),
        ),
      ),
    )
  }

  const body = collapsed
    ? null
    : h(
        'div',
        { className: 'fh-ws-group-body' },
        rows.length === 0 ? h('div', { className: 'fh-ws-empty' }, t('empty.none')) : rows.map(rowElement),
      )

  return h(
    'section',
    { className: 'fh-ws-group fh-ws-recent', 'aria-labelledby': 'fh-ws-recent-head' },
    header,
    body,
  )
}

/** 本功能的字典命名空间。 */
export const RECENT_TASKS_NS = 'feature-hub.recent-tasks'

/** 中文文案。 */
import { styles } from './styles'
import { en, zh } from './locale'

export const recentTasksSection = {
  id: RECENT_TASKS_ID,
  order: 10,
  locale: { ns: RECENT_TASKS_NS, dicts: { zh, en } },
  styles,
  component: RecentTasksSection,
}
