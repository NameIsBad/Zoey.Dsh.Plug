/**
 * 框架级浮层：会话重命名对话框 + 失败提示条。
 *
 * 为什么放在 `shell.overlay` 而不是侧边栏里：对话框与提示要能盖住正文，
 * 也不能因为侧边栏折叠/重渲染而消失。`shell.overlay` 是框架给的顶层浮层槽，
 * 天然满足这两点。
 *
 * 重命名请求是一份模块级快照（`renameState` + 订阅集合），因为发起方是
 * 侧边栏里的一个注入回调，接收方是这个浮层组件，两者没有父子关系。
 */

import type * as ReactTypes from 'react'
import { SessionRenameDialog } from './dialogs'
import { NoticesOverlay } from './notify'

/** 一次会话重命名请求。 */
export interface SessionRenameRequest {
  /** 目标会话。 */
  readonly sessionId: string
  /** 当前标题（草稿初值）。 */
  readonly currentTitle: string
}

let renameState: SessionRenameRequest | null = null
const renameListeners = new Set<() => void>()

/** 会话重命名的执行器；由总控在 apply 时绑定会话控制器，卸载时解绑。 */
let renameExecutor: ((sessionId: string, title: string) => Promise<void>) | null = null

/**
 * 绑定/解绑重命名执行器。
 * @param executor 执行器；null 表示解绑。
 */
export function bindSessionRename(
  executor: ((sessionId: string, title: string) => Promise<void>) | null,
): void {
  renameExecutor = executor
}

/**
 * 执行一次会话重命名。
 * @param _ctx 客户端上下文（保留给调用方一致的签名，执行器已绑定）。
 * @param sessionId 目标会话。
 * @param title 新标题。
 * @returns 完成后 resolve；失败时抛出可直接展示的错误。
 */
export async function confirmSessionRename(_ctx: unknown, sessionId: string, title: string): Promise<void> {
  if (renameExecutor === null) throw new Error('session rename is unavailable')
  await renameExecutor(sessionId, title)
}

/** 通知订阅者重命名请求变化。 */
function emitRename(): void {
  for (const listener of [...renameListeners]) listener()
}

/**
 * 发起一次重命名请求。
 * @param request 目标会话与当前标题；null 表示收起对话框。
 */
export function setSessionRename(request: SessionRenameRequest | null): void {
  renameState = request
  emitRename()
}

/**
 * 读当前重命名请求。
 * @returns 请求快照。
 */
export function getSessionRename(): SessionRenameRequest | null {
  return renameState
}

/**
 * 订阅重命名请求变化。
 * @param listener 变化回调。
 * @returns 退订函数。
 */
export function subscribeRename(listener: () => void): () => void {
  renameListeners.add(listener)
  return () => {
    renameListeners.delete(listener)
  }
}

/** 浮层组件收到的注入面。 */
export interface ShellOverlaysFace {
  /** 读当前重命名请求。 */
  readonly state: () => SessionRenameRequest | null
  /** 订阅重命名请求变化。 */
  readonly subscribe: (listener: () => void) => () => void
  /** 收起对话框。 */
  readonly close: () => void
  /** 确认重命名（失败时抛错，由对话框就地显示）。 */
  readonly confirm: (sessionId: string, title: string) => Promise<void>
  /** 翻译函数。 */
  readonly t: Translate
}

/** 浮层组件 props：注入面 + 字典。 */
export type ShellOverlaysProps = ShellOverlaysFace

/**
 * 框架级浮层：重命名对话框与提示条。
 * @param props 重命名请求源、确认回调与翻译函数。
 * @returns 浮层元素。
 */
export function ShellOverlays(props: ShellOverlaysProps): ReactTypes.JSX.Element {
  const [request, setRequest] = React.useState<SessionRenameRequest | null>(() => props.state())
  React.useEffect(() => {
    setRequest(props.state())
    return props.subscribe(() => {
      setRequest(props.state())
    })
  }, [props])
  return (
    <>
      <SessionRenameDialog
        open={request !== null}
        sessionId={request === null ? null : request.sessionId}
        currentTitle={request === null ? '' : request.currentTitle}
        onConfirm={props.confirm}
        onClose={props.close}
        t={props.t}
        closeLabel={props.t('close')}
        cancelLabel={props.t('cancel')}
      />
      <NoticesOverlay />
    </>
  )
}
