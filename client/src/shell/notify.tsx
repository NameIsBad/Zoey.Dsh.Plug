import type * as ReactTypes from 'react'
/**
 * 外壳自己的轻量提示（右下角浮动条）：添加工作区失败、归档失败、置顶失败等。
 *
 * 为什么单独做一条通道：这些失败发生在侧边栏动作里，用户看不到控制台；
 * 静默失败会被读成「按钮没反应」。提示挂在 `shell.overlay` 上，因此不会
 * 被侧边栏的裁剪影响，也不需要用户在设置里开启（任务提醒那套是可选通知，
 * 这里的失败反馈必须始终可见）。
 *
 * 状态用模块级快照 + 订阅集合实现（React 之外的极简 store），
 * 组件通过 `React.useState` 订阅；卸载时退订。
 */

/** 一条提示。 */
export interface ShellNotice {
  /** 自增 id，用于 key 与关闭。 */
  readonly id: number
  /** 文案（已本地化）。 */
  readonly text: string
  /** 语气：普通/失败。 */
  readonly tone: 'info' | 'warn'
}

let notices: readonly ShellNotice[] = []
let sequence = 0
const listeners = new Set<() => void>()

/** 通知所有订阅者。 */
function emit(): void {
  for (const listener of [...listeners]) listener()
}

/**
 * 推一条提示；4 秒后自动消失。
 * @param text 已本地化的文案。
 * @param tone 语气。
 */
export function pushNotice(text: string, tone: 'info' | 'warn' = 'info'): void {
  const id = ++sequence
  notices = [...notices, { id, text, tone }]
  emit()
  window.setTimeout(() => {
    dismissNotice(id)
  }, 4000)
}

/**
 * 关掉一条提示。
 * @param id 提示 id。
 */
export function dismissNotice(id: number): void {
  const next = notices.filter((notice) => notice.id !== id)
  if (next.length === notices.length) return
  notices = next
  emit()
}

/**
 * 读当前提示列表。
 * @returns 提示快照。
 */
export function getNotices(): readonly ShellNotice[] {
  return notices
}

/**
 * 订阅提示变化。
 * @param listener 变化回调。
 * @returns 退订函数。
 */
export function subscribeNotices(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 提示浮层：右下角堆叠，点击关闭。
 * @returns 浮层元素；没有提示时什么都不渲染。
 */
export function NoticesOverlay(): ReactTypes.JSX.Element | null {
  const [items, setItems] = React.useState<readonly ShellNotice[]>(() => getNotices())
  React.useEffect(() => {
    setItems(getNotices())
    return subscribeNotices(() => {
      setItems(getNotices())
    })
  }, [])
  if (items.length === 0) return null
  return (
    <div className="fh-notices" role="status" aria-live="polite">
      {items.map((notice) => (
        <button
          key={notice.id}
          type="button"
          className={`fh-notice${notice.tone === 'warn' ? ' fh-notice-warn' : ''}`}
          onClick={() => {
            dismissNotice(notice.id)
          }}
        >
          {notice.text}
        </button>
      ))}
    </div>
  )
}
