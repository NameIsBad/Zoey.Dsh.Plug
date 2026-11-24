import type * as ReactTypes from 'react'
/**
 * 侧边栏的行渲染：工作区行、会话行、搜索结果行，以及它们的悬停卡片。
 *
 * 这些组件是纯展示 + 手势：数据与动作都从浏览区传下来，组件自己不取服务、
 * 不写状态（唯一例外是悬停卡片的显隐计时器，属于纯视觉状态）。
 *
 * 与原生 `Rows.tsx` 对齐的行为：
 *   - 会话行前导 16px 格：有状态时画状态点，空闲时留白（归档行整格留白）；
 *   - 行尾静止态显示相对时间与置顶标记，悬停或键盘聚焦时换成操作按钮
 *     （取消归档/归档、置顶/取消置顶）与「…」菜单触发；
 *   - 双击标题进入重命名（仅在有权限、非草稿时）；
 *   - 点「…」把原生右键菜单开在按钮下方（菜单项由原生插件贡献）。
 */

import {
  IconArchive,
  IconClock,
  IconCopy,
  IconPinFill,
  IconUnarchive,
  IconFolderClose,
  IconFolderOpen,
  IconNewChat,
} from './icons'
import { IconMore } from './menu'
import type { GroupNode, SearchResultNode, SessionNode } from './tree'

/** 一次菜单请求：目标类型、业务对象与视口坐标。 */
export type RowMenuRequest =
  | {
      readonly kind: 'session'
      readonly sessionId: string
      readonly displayTitle: string
      readonly point: { readonly x: number; readonly y: number }
    }
  | {
      readonly kind: 'workspace'
      readonly workspaceId: string
      readonly path: string
      readonly displayTitle: string
      readonly point: { readonly x: number; readonly y: number }
    }

/** 拖动一行的接线（由浏览区提供）。 */
export interface RowDragProps {
  /** 这一行可以开始拖动。 */
  readonly enabled: boolean
  /** 同类拖动正在进行：本行是合法落点。 */
  readonly active: boolean
  /** 落点标记。 */
  readonly marker: 'before' | 'after' | null
  /** 开始拖动本行。 */
  readonly start: () => void
  /** 拖动结束（含取消）。 */
  readonly end: () => void
  /** 指针经过本行的一半。 */
  readonly hover: (half: 'before' | 'after') => void
  /** 在本行放手。 */
  readonly drop: (half: 'before' | 'after') => void
}

/** 会话状态在行上的呈现。 */
interface RowStatus {
  /** 状态点样式。 */
  readonly state: 'idle' | 'ongoing' | 'warning' | 'done'
  /** 无障碍文案。 */
  readonly label: string
  /** 用紧凑文案替代相对时间（例如「待确认」）。 */
  readonly trailingLabel?: string
}

/**
 * 计算相对时间的单位与数量。
 * @param updatedAt 毫秒时间戳。
 * @param now 当前时间。
 * @returns 单位与数量。
 */
function relativeParts(
  updatedAt: number,
  now: number,
): { unit: 'now' | 'minute' | 'hour' | 'day'; n: number } {
  const age = Math.max(0, now - updatedAt)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (age < minute) return { unit: 'now', n: 0 }
  if (age < hour) return { unit: 'minute', n: Math.floor(age / minute) }
  if (age < day) return { unit: 'hour', n: Math.floor(age / hour) }
  return { unit: 'day', n: Math.floor(age / day) }
}

/**
 * 行尾的相对时间文案。
 * @param updatedAt 毫秒时间戳。
 * @param now 当前时间。
 * @param t 翻译函数。
 * @returns 例如「刚刚」「5 分钟」。
 */
function timeLabel(updatedAt: number, now: number, t: Translate): string {
  const { unit, n } = relativeParts(updatedAt, now)
  if (unit === 'now') return t('time.now')
  return t(`time.${unit}`, { n })
}

/**
 * 悬停卡片里的相对时间（「5 分钟前」；「刚刚」不加「前」）。
 * @param updatedAt 毫秒时间戳。
 * @param now 当前时间。
 * @param t 翻译函数。
 * @returns 卡片文案。
 */
function hoverTimeLabel(updatedAt: number, now: number, t: Translate): string {
  const { unit, n } = relativeParts(updatedAt, now)
  if (unit === 'now') return t('time.now')
  return t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/**
 * 工作区创建时间（按字典模板拼，避免跟随浏览器语言）。
 * @param createdAt 毫秒时间戳。
 * @param t 翻译函数。
 * @returns 例如「创建于 2026/11/22 10:30」。
 */
function createdLabel(createdAt: number, t: Translate): string {
  const date = new Date(createdAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const ymd = t('date.ymd', { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() })
  return t('hover.created', { time: `${ymd} ${pad(date.getHours())}:${pad(date.getMinutes())}` })
}

/**
 * 会话状态的呈现顺序（等待交互 → 子代理 → 运行中 → 完成未读 → 空闲）。
 * @param node 会话行。
 * @param t 翻译函数。
 * @returns 至少一项的状态数组。
 */
export function sessionStatuses(
  node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>,
  t: Translate,
): readonly [RowStatus, ...RowStatus[]] {
  const subagents: RowStatus | undefined =
    node.runningSubagentCount === 0
      ? undefined
      : {
          state: 'ongoing',
          label: t(
            node.runningSubagentCount === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other',
            {
              n: node.runningSubagentCount,
            },
          ),
        }
  let pending: RowStatus | undefined
  switch (node.pendingInteraction) {
    case 'approval':
      pending = {
        state: 'warning',
        label: t('status.waitingApproval'),
        trailingLabel: t('status.compact.approval'),
      }
      break
    case 'plan-review':
      pending = {
        state: 'warning',
        label: t('status.planReview'),
        trailingLabel: t('status.compact.planReview'),
      }
      break
    case 'question':
      pending = {
        state: 'warning',
        label: t('status.waitingAnswer'),
        trailingLabel: t('status.compact.answer'),
      }
      break
    default:
      break
  }
  if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents]
  if (node.running) {
    const primary: RowStatus = { state: 'ongoing', label: t('status.running') }
    return subagents === undefined ? [primary] : [primary, subagents]
  }
  if (subagents !== undefined) return [subagents]
  if (node.completed) return [{ state: 'done', label: t('status.completed') }]
  return [{ state: 'idle', label: t('status.idle') }]
}

/**
 * 状态点：进行中画转圈，其余画实心点。
 * @param props 状态与尺寸。
 * @returns 圆点元素。
 */
function StatusDot(props: { readonly state: RowStatus['state'] }): ReactTypes.JSX.Element {
  if (props.state === 'ongoing') return <span className="fh-dot-spinner" />
  return <span className={`fh-dot fh-dot-${props.state}`} />
}

/**
 * 一行标题的显示文案。
 * @param node 会话行。
 * @param t 翻译函数。
 * @returns 草稿显示「新会话」，无标题显示「未命名会话」。
 */
function displayTitle(node: Pick<SessionNode, 'title' | 'blank'>, t: Translate): string {
  if (node.blank) return t('session.new')
  return node.title === '' ? t('session.untitled') : node.title
}

/**
 * 悬停卡片：延迟出现、离开消失，位置贴在行下方。
 *
 * 用 `position: fixed` 贴视口坐标，避免被侧边栏的滚动容器裁掉。
 *
 * @param props 卡片内容、触发内容与可选的复制按钮文案。
 * @returns 包住触发元素的行内容器。
 */
function HoverCard(props: {
  readonly content: ReactTypes.ReactNode
  readonly children: ReactTypes.ReactNode
  readonly disabled?: boolean
  readonly copyText?: string | undefined
  readonly copyLabel?: string
  readonly copiedLabel?: string
}): ReactTypes.JSX.Element {
  const anchor = React.useRef<HTMLDivElement | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null)
  const [copied, setCopied] = React.useState(false)

  /** 清除延迟计时。 */
  const clear = (): void => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = undefined
  }
  React.useEffect(() => clear, [])

  return (
    <div
      ref={anchor}
      className="fh-row-anchor"
      onPointerEnter={() => {
        if (props.disabled === true) return
        clear()
        timer.current = window.setTimeout(() => {
          const box = anchor.current?.getBoundingClientRect()
          if (box === undefined) return
          const top = Math.min(box.bottom + 6, Math.max(0, window.innerHeight - 200))
          setPosition({ left: Math.max(8, box.left), top })
        }, 800)
      }}
      onPointerLeave={() => {
        clear()
        setPosition(null)
        setCopied(false)
      }}
    >
      {props.children}
      {position === null ? null : (
        <div className="fh-hovercard" role="tooltip" style={{ left: position.left, top: position.top }}>
          {props.content}
          {props.copyText === undefined ? null : (
            <button
              type="button"
              className="fh-hovercard-copy"
              onClick={() => {
                void navigator.clipboard?.writeText(props.copyText ?? '').then(
                  () => {
                    setCopied(true)
                  },
                  () => {
                    setCopied(false)
                  },
                )
              }}
            >
              <IconCopy size={11} />
              {copied ? (props.copiedLabel ?? props.copyLabel ?? '') : (props.copyLabel ?? '')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** 工作区行入参。 */
export interface ProjectRowProps {
  /** 分组投影。 */
  readonly group: GroupNode
  /** 当前会话是否落在这个分支（含祖先）。 */
  readonly active: boolean
  /** 拖动接线；只有真实工作区行才有。 */
  readonly drag?: RowDragProps | undefined
  /** 翻译函数。 */
  readonly t: Translate
  /** 切换展开。 */
  readonly onToggle: () => void
  /** 在该工作区新建会话；未分组桶不传。 */
  readonly onCreate?: (() => void) | undefined
  /**
   * 打开工作区的原生右键菜单（「…」按钮、右键、Shift+F10 共用）。
   *
   * 菜单项由宿主的 ui-workspace 插件贡献（重命名 / 删除工作区），与本插件
   * 自绘的菜单相比：文案与权限判定都跟原生完全一致。未分组桶不传。
   */
  readonly onMenu?: ((point: { readonly x: number; readonly y: number }) => void) | undefined
  /** 树模式下的缩进（像素）。 */
  readonly indent?: number
}

/**
 * 工作区（分组）头行。
 * @param props 分组、动作与拖动接线。
 * @returns 行元素。
 */
export function ProjectRow(props: ProjectRowProps): ReactTypes.JSX.Element {
  const group = props.group
  const drag = props.drag
  const ungrouped = group.workspaceId === undefined
  const label = ungrouped ? props.t('group.ungrouped') : group.label
  const classes = ['fh-row', 'fh-workspace-row']
  if (props.active) classes.push('fh-workspace-active')
  if (drag?.marker === 'before') classes.push('fh-drop-before')
  if (drag?.marker === 'after') classes.push('fh-drop-after')
  return (
    <HoverCard
      disabled={drag?.active === true}
      copyText={group.cwd}
      copyLabel={props.t('copy')}
      copiedLabel={props.t('hover.copied')}
      content={
        <div className="fh-hovercard-body fh-hovercard-workspace">
          <div className="fh-hovercard-head">
            <span className="fh-hovercard-mark">
              <IconFolderOpen size={15} tone="gold" />
            </span>
            <span className="fh-hovercard-title">{label}</span>
          </div>
          {group.cwd === undefined ? null : (
            <div className="fh-hovercard-meta">
              <IconFolderClose size={11} tone="gold" className="fh-hovercard-ico" />
              <span>{group.cwd}</span>
            </div>
          )}
          {group.createdAt === undefined ? null : (
            <div className="fh-hovercard-meta">
              <IconClock size={11} className="fh-hovercard-ico" />
              <span>{createdLabel(group.createdAt, props.t)}</span>
            </div>
          )}
        </div>
      }
    >
      <div
        className={classes.join(' ')}
        role="treeitem"
        aria-expanded={group.expanded}
        tabIndex={0}
        title={group.cwd ?? label}
        style={props.indent === undefined ? undefined : { paddingLeft: 12 + props.indent }}
        draggable={drag?.enabled === true}
        onClick={props.onToggle}
        onKeyDown={(event) => {
          // Shift+F10 / 菜单键：键盘用户的右键等价入口，锚在行的下沿。
          if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault()
            const box = event.currentTarget.getBoundingClientRect()
            props.onMenu?.({ x: box.left, y: box.bottom })
            return
          }
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          props.onToggle()
        }}
        onContextMenu={
          props.onMenu === undefined
            ? undefined
            : (event) => {
                event.preventDefault()
                props.onMenu?.({ x: event.clientX, y: event.clientY })
              }
        }
        onDragStart={
          drag?.enabled === true
            ? (event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', group.key)
                drag?.start()
              }
            : undefined
        }
        onDragEnd={
          drag === undefined
            ? undefined
            : () => {
                drag.end()
              }
        }
        onDragOver={
          drag === undefined
            ? undefined
            : (event) => {
                if (!drag.active) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                const box = event.currentTarget.getBoundingClientRect()
                drag.hover(event.clientY < box.top + box.height / 2 ? 'before' : 'after')
              }
        }
        onDrop={
          drag === undefined
            ? undefined
            : (event) => {
                if (!drag.active) return
                event.preventDefault()
                const box = event.currentTarget.getBoundingClientRect()
                drag.drop(event.clientY < box.top + box.height / 2 ? 'before' : 'after')
              }
        }
      >
        <span className={`fh-row-folder${props.active ? ' fh-row-folder-active' : ''}`}>
          {group.expanded ? (
            <IconFolderOpen size={16} tone="gold" />
          ) : (
            <IconFolderClose size={16} tone="gold" />
          )}
        </span>
        <span className="fh-row-title">{label}</span>
        <span className="fh-row-actions" onClick={(event) => event.stopPropagation()}>
          {props.onMenu === undefined ? null : (
            <button
              type="button"
              className="fh-icon-button"
              title={props.t('actions.workspace.aria', { name: label })}
              aria-label={props.t('actions.workspace.aria', { name: label })}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                props.onMenu?.({ x: box.left, y: box.bottom })
              }}
            >
              <IconMore />
            </button>
          )}
          {props.onCreate === undefined ? null : (
            <button
              type="button"
              className="fh-icon-button"
              title={props.t('actions.newSession')}
              aria-label={props.t('actions.newSession.aria', { name: label })}
              onClick={props.onCreate}
            >
              <IconNewChat size={14} tone="green" />
            </button>
          )}
        </span>
      </div>
    </HoverCard>
  )
}

/** 会话行入参。 */
export interface SessionRowProps {
  /** 会话投影。 */
  readonly node: SessionNode
  /** 是否是当前打开的会话。 */
  readonly selected: boolean
  /** 当前时间（相对时间）。 */
  readonly now: number
  /** 翻译函数。 */
  readonly t: Translate
  /** 打开会话。 */
  readonly onOpen: (sessionId: string) => void
  /** 请求重命名（双击标题）。 */
  readonly onRenameRequest: ((sessionId: string, currentTitle: string) => void) | undefined
  /** 打开原生会话菜单。 */
  readonly onMenu: (point: { readonly x: number; readonly y: number }) => void
  /** 归档。 */
  readonly onArchive: (() => void) | undefined
  /** 取消归档。 */
  readonly onUnarchive: (() => void) | undefined
  /** 置顶/取消置顶。 */
  readonly onPin: (() => void) | undefined
  /** 是否已置顶（决定按钮语义）。 */
  readonly pinned: boolean
  /** 拖动接线。 */
  readonly drag?: RowDragProps | undefined
  /** 搜索命中后需要滚动到可视区。 */
  readonly reveal?: boolean
  /** 完成滚动后回调。 */
  readonly onRevealed?: () => void
}

/**
 * 会话行。
 * @param props 会话、动作与拖动接线。
 * @returns 行元素。
 */
export function SessionRow(props: SessionRowProps): ReactTypes.JSX.Element {
  const node = props.node
  const drag = props.drag
  const title = displayTitle(node, props.t)
  const statuses = sessionStatuses(node, props.t)
  const primary = statuses[0]
  const showStatus = primary.state !== 'idle'
  const classes = ['fh-row', 'fh-session-row']
  if (props.selected) classes.push('fh-row-selected')
  if (node.archived) classes.push('fh-row-archived')
  if (drag?.marker === 'before') classes.push('fh-drop-before')
  if (drag?.marker === 'after') classes.push('fh-drop-after')
  const row = React.useRef<HTMLDivElement | null>(null)
  const armed = React.useRef(false)
  React.useEffect(() => {
    if (props.reveal !== true) return
    row.current?.scrollIntoView({ block: 'nearest' })
    props.onRevealed?.()
  }, [props.reveal, props.onRevealed])

  return (
    <HoverCard
      disabled={drag?.active === true}
      copyText={node.blank || node.title === '' ? undefined : node.title}
      copyLabel={props.t('copy')}
      copiedLabel={props.t('hover.copied')}
      content={
        <div className="fh-hovercard-body fh-hovercard-session">
          <div className="fh-hovercard-head">
            <span className="fh-hovercard-mark">
              <IconNewChat size={15} tone="blue" />
            </span>
            <span className="fh-hovercard-title">{title}</span>
          </div>
          {node.cwd === undefined ? null : (
            <div className="fh-hovercard-meta">
              <IconFolderClose size={11} tone="gold" className="fh-hovercard-ico" />
              <span>{node.cwd}</span>
            </div>
          )}
          {node.blank ? null : (
            <div className="fh-hovercard-meta">
              <IconClock size={11} className="fh-hovercard-ico" />
              <span>{hoverTimeLabel(node.updatedAt, props.now, props.t)}</span>
            </div>
          )}
          {statuses
            .filter((status) => !(node.archived && (status.state === 'done' || status.state === 'idle')))
            .map((status) => (
              <div className="fh-hovercard-status" key={status.label}>
                <StatusDot state={status.state} />
                <span>{status.label}</span>
              </div>
            ))}
          {node.archived ? (
            <div className="fh-hovercard-status fh-hovercard-archived">
              <IconArchive size={14} tone="blue" />
              <span>{props.t('row.archived')}</span>
            </div>
          ) : null}
        </div>
      }
    >
      <div
        ref={row}
        className={classes.join(' ')}
        role="treeitem"
        aria-selected={props.selected}
        tabIndex={0}
        data-archived={node.archived ? 'true' : undefined}
        draggable={drag?.enabled === true}
        onClick={() => {
          props.onOpen(node.id)
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          // Shift+F10 / 菜单键：键盘用户的右键等价入口，锚在行的下沿。
          if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault()
            const box = event.currentTarget.getBoundingClientRect()
            props.onMenu({ x: box.left, y: box.bottom })
            return
          }
          if (event.key !== 'Enter' && event.key !== ' ') return
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
          event.preventDefault()
          props.onOpen(node.id)
        }}
        onContextMenu={(event) => {
          // 右键与行尾「更多」按钮走同一条菜单通道，菜单项由宿主插件贡献。
          event.preventDefault()
          event.stopPropagation()
          props.onMenu({ x: event.clientX, y: event.clientY })
        }}
        onDragStart={
          drag?.enabled === true
            ? (event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', node.id)
                drag?.start()
              }
            : undefined
        }
        onDragEnd={
          drag === undefined
            ? undefined
            : () => {
                drag.end()
              }
        }
        onDragOver={
          drag === undefined
            ? undefined
            : (event) => {
                if (!drag.active) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                const box = event.currentTarget.getBoundingClientRect()
                drag.hover(event.clientY < box.top + box.height / 2 ? 'before' : 'after')
              }
        }
        onDrop={
          drag === undefined
            ? undefined
            : (event) => {
                if (!drag.active) return
                event.preventDefault()
                const box = event.currentTarget.getBoundingClientRect()
                drag.drop(event.clientY < box.top + box.height / 2 ? 'before' : 'after')
              }
        }
      >
        <span className="fh-row-slot">
          {!node.archived && !node.blank && showStatus ? (
            <>
              <StatusDot state={primary.state} />
              {statuses.map((status) => (
                <span className="fh-visually-hidden" key={status.label}>
                  {status.label}
                </span>
              ))}
            </>
          ) : null}
        </span>
        <span
          className="fh-row-title"
          onMouseDown={(event) => {
            if (event.detail !== 1) return
            armed.current = true
            window.addEventListener(
              'blur',
              () => {
                armed.current = false
              },
              { once: true },
            )
          }}
          onDoubleClick={(event) => {
            if (node.blank || props.onRenameRequest === undefined) return
            event.stopPropagation()
            if (!armed.current) return
            armed.current = false
            props.onRenameRequest(node.id, node.title)
          }}
        >
          {title}
        </span>
        {/* 等待交互的胶囊独立成列：悬停让位给操作按钮的是时间与置顶，不是它。 */}
        {primary.trailingLabel === undefined ? null : (
          <span className="fh-row-badge" title={primary.label} role="img" aria-label={primary.label}>
            {primary.trailingLabel}
          </span>
        )}
        {node.blank ? null : (
          <span className="fh-row-rest">
            {primary.trailingLabel === undefined ? (
              <span className="fh-row-time">{timeLabel(node.updatedAt, props.now, props.t)}</span>
            ) : null}
            {node.pinned && !node.archived ? (
              <span
                className="fh-row-pin"
                title={props.t('row.pinned')}
                role="img"
                aria-label={props.t('row.pinned')}
              >
                <IconPinFill size={12} tone="gold" />
              </span>
            ) : null}
          </span>
        )}
        {node.blank ? null : (
          <span className="fh-row-actions" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="fh-icon-button"
              title={props.t('actions.session.aria', { name: title })}
              aria-label={props.t('actions.session.aria', { name: title })}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                props.onMenu({ x: box.left, y: box.bottom })
              }}
            >
              <IconMore />
            </button>
            {node.archived ? (
              props.onUnarchive === undefined ? null : (
                <button
                  type="button"
                  className="fh-icon-button"
                  title={props.t('actions.unarchive')}
                  aria-label={props.t('actions.unarchive')}
                  onClick={props.onUnarchive}
                >
                  <IconUnarchive size={14} tone="green" />
                </button>
              )
            ) : props.pinned ? (
              props.onPin === undefined ? null : (
                <button
                  type="button"
                  className="fh-icon-button"
                  title={props.t('row.pinned')}
                  aria-label={props.t('row.pinned')}
                  onClick={props.onPin}
                >
                  <IconPinFill size={12} tone="gold" />
                </button>
              )
            ) : props.onPin === undefined ? null : (
              <button
                type="button"
                className="fh-icon-button"
                title={props.t('row.pinned')}
                aria-label={props.t('row.pinned')}
                onClick={props.onPin}
              >
                <IconPinFill size={12} tone="gold" />
              </button>
            )}
            {node.archived || props.onArchive === undefined ? null : (
              <button
                type="button"
                className="fh-icon-button"
                title={props.t('row.archived')}
                aria-label={props.t('row.archived')}
                onClick={props.onArchive}
              >
                <IconArchive size={14} tone="blue" />
              </button>
            )}
          </span>
        )}
      </div>
    </HoverCard>
  )
}

/** 搜索结果行入参。 */
export interface SearchResultRowProps {
  /** 结果投影。 */
  readonly result: SearchResultNode
  /** 是否是当前会话。 */
  readonly selected: boolean
  /** 翻译函数。 */
  readonly t: Translate
  /** 打开会话。 */
  readonly onOpen: () => void
  /** 取消归档（仅归档行、且有权限时提供）。 */
  readonly onUnarchive?: (() => void) | undefined
}

/**
 * 一条搜索结果：标题 + 工作区名 + 内容片段；归档行带取消归档按钮。
 * @param props 结果与动作。
 * @returns 结果行。
 */
export function SearchResultRow(props: SearchResultRowProps): ReactTypes.JSX.Element {
  const result = props.result
  const statuses = sessionStatuses(result, props.t)
  const primary = statuses[0]
  const classes = ['fh-search-row']
  if (props.selected) classes.push('fh-row-selected')
  if (result.archived) classes.push('fh-row-archived')
  return (
    <div
      className={classes.join(' ')}
      role="treeitem"
      aria-selected={props.selected}
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        props.onOpen()
      }}
      tabIndex={0}
    >
      <span className="fh-search-heading">
        <span className="fh-row-slot">
          {result.archived ? null : primary.state === 'idle' ? null : <StatusDot state={primary.state} />}
        </span>
        <span className="fh-row-title">
          {result.title === '' ? props.t('session.untitled') : result.title}
        </span>
        {result.archived && props.onUnarchive !== undefined ? (
          <span className="fh-row-actions" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="fh-icon-button"
              title={props.t('actions.unarchive')}
              aria-label={props.t('actions.unarchive')}
              onClick={props.onUnarchive}
            >
              <IconUnarchive size={14} tone="green" />
            </button>
          </span>
        ) : null}
      </span>
      <span className="fh-search-meta">
        <span className="fh-search-workspace">
          {result.workspace === '' ? props.t('group.ungrouped') : result.workspace}
        </span>
        {result.snippet === undefined ? null : <span className="fh-search-snippet">{result.snippet}</span>}
      </span>
    </div>
  )
}
