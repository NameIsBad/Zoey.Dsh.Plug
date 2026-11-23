import type * as ReactTypes from 'react'
/**
 * 侧边栏入口：把浏览区包进错误边界，并提供渲染失败时的降级列表。
 *
 * 为什么要有边界：插槽里的组件一旦抛错，整块区域会变成空白，用户连导航都没了。
 * 这里的降级是「低假设」的：只用最少的字段（工作区标题 + 会话标题），
 * 仍然可点，并显示一行说明。
 *
 * 本文件只做装配，不实现浏览区本身（见 `browser.tsx`）。
 */

import { WorkspaceBrowser } from './browser'
import type { WorkspaceBrowserProps } from './browser'
import { SIDEBAR_STYLES as STYLES } from './styles'
import { en, zh } from './locale'

/** 外壳字典的命名空间。 */
export const SIDEBAR_NS = 'feature-hub.sidebar'

/** 外壳字典（中英两份）。 */
export const SIDEBAR_DICT = { zh, en }

/** 外壳样式表（由总控按 id 安装）。 */
export const SIDEBAR_STYLES = STYLES

/** 错误边界的 props。 */
interface ShellBoundaryProps {
  /** 渲染失败时的替代内容。 */
  readonly fallback: () => ReactTypes.JSX.Element | null
  /** 正常内容。 */
  readonly children?: ReactTypes.ReactNode
}

/** 错误边界状态。 */
interface ShellBoundaryState {
  /** 是否已经捕获到错误。 */
  readonly failed: boolean
}

/**
 * 渲染错误边界：捕获子树异常后切换到降级列表。
 */
export class ShellBoundary extends React.Component<ShellBoundaryProps, ShellBoundaryState> {
  constructor(props: ShellBoundaryProps) {
    super(props)
    this.state = { failed: false }
  }

  /** 捕获到异常时置位，后续渲染走 fallback。 */
  static getDerivedStateFromError(): ShellBoundaryState {
    return { failed: true }
  }

  override render(): ReactTypes.JSX.Element | null {
    if (this.state.failed) return this.props.fallback()
    return (this.props.children as ReactTypes.JSX.Element | null | undefined) ?? null
  }
}

/**
 * 降级导航：平铺「工作区标题 + 会话行」，仍然可点。
 * @param props 与浏览区相同的插槽 props（只用其中极少字段）。
 * @returns 简版列表。
 */
export function FallbackList(props: SidebarWorkspacesProps): ReactTypes.JSX.Element {
  const t = props.t
  const items = props.useWorkspaces((state) => state.items)
  const list = props.useSessions((state) => state)
  const byId = list.byId
  return (
    <div className="fh-ws">
      <div className="fh-ws-head">
        <span className="fh-ws-label">{t('section.workspaces')}</span>
      </div>
      <div className="fh-ws-list">
        <div className="fh-ws-empty">{t('shell.fallback')}</div>
        {items.map((workspace) => (
          <div key={workspace.workspaceId} className="fh-group">
            <div className="fh-ws-group-head">
              <span className="fh-ws-group-title">
                {workspace.title === '' ? workspace.path : workspace.title}
              </span>
              <span className="fh-ws-count">{String(workspace.sessionIds.length)}</span>
            </div>
            <div className="fh-ws-group-body">
              {workspace.sessionIds.map((sessionId) => {
                const session = byId[sessionId]
                if (session === undefined) return null
                return (
                  <div
                    key={sessionId}
                    className="fh-ws-row"
                    onClick={() => {
                      if (typeof props.openSession === 'function') props.openSession(sessionId)
                    }}
                  >
                    <span className="fh-ws-title">{session.displayTitle || session.title || sessionId}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 真正注册进插槽的入口：浏览区包在错误边界里。
 * @param props 浏览区完整 props。
 * @returns 错误边界元素。
 */
export function SidebarEntry(props: WorkspaceBrowserProps): ReactTypes.JSX.Element {
  return (
    <ShellBoundary fallback={() => <FallbackList {...props} />}>
      <WorkspaceBrowser {...props} />
    </ShellBoundary>
  )
}
