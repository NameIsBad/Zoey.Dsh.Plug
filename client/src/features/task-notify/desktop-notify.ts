/**
 * 「任务提醒」的系统通知投递封装。
 *
 * 为什么优先走 Host：渲染进程的 `Notification` 在 `dsh-app://` 页面上能构造、
 * 权限也显示 granted，但不会进入 Windows 通知中心（实测通知数据库里没有记录）；
 * 因此优先让 Host 路由用 PowerShell + WinRT 投递（AUMID 与安装器快捷方式一致），
 * 失败时再退回渲染进程通知。两条都不行时，调用方显示窗口内提醒。
 *
 * 只被本功能的引擎与设置面板使用，所以放在功能目录里，不再放进 `lib/`。
 */

import type { NotifyPayload } from '../../../../types/wire'

/** 系统通知的可用状态。 */
export type DesktopNotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied'

/** 本模块已经打开、尚未关闭的系统通知，卸载时统一关掉。 */
const openNotices = new Set<Notification>()

/**
 * 读取当前环境的系统通知授权状态。
 * @returns `unsupported` 表示没有 Notification 接口；其余与浏览器一致。
 */
export function desktopNotifyPermission(): DesktopNotifyPermission {
  if (typeof window === 'undefined') return 'unsupported'
  const constructor = window.Notification
  if (typeof constructor !== 'function') return 'unsupported'
  const state = constructor.permission
  if (state === 'granted' || state === 'denied') return state
  return 'default'
}

/**
 * 申请系统通知授权。必须在用户手势里调用，浏览器才会弹授权框。
 * @returns 申请后的状态；已经授权/拒绝或不支持时直接返回现状。
 */
export async function requestDesktopNotifyPermission(): Promise<DesktopNotifyPermission> {
  const current = desktopNotifyPermission()
  if (current !== 'default') return current
  try {
    const granted = await window.Notification.requestPermission()
    return granted === 'granted' || granted === 'denied' ? granted : 'default'
  } catch (_error) {
    // 某些嵌入式环境没有 requestPermission；保持未授权即可。
    return 'default'
  }
}

/** 一条系统通知的内容与点击行为。 */
export interface DesktopNoticeInput {
  /** 通知标题（粗体一行）。 */
  readonly title: string
  /** 通知正文。 */
  readonly body: string
  /** 同一 tag 的新通知会替换旧通知，避免重复结束时堆一串。 */
  readonly tag?: string
  /** 点击通知后的动作（通常是聚焦窗口并打开会话）。 */
  readonly onClick?: () => void
}

/**
 * 发一条渲染进程通知（Host 不可达时的兜底）。
 * @param input 标题、正文、分组 tag 与点击回调。
 * @returns 是否真的发出了通知；未授权或构造失败时返回 false。
 */
export function showDesktopNotice(input: DesktopNoticeInput): boolean {
  if (desktopNotifyPermission() !== 'granted') return false
  try {
    const constructor = window.Notification
    const options: NotificationOptions = { body: input.body }
    if (input.tag !== undefined) options.tag = input.tag
    const notice = new constructor(input.title, options)
    openNotices.add(notice)
    notice.onclick = () => {
      openNotices.delete(notice)
      try {
        window.focus()
      } catch (_error) {
        // 焦点由宿主窗口决定，拿不到也不影响打开会话。
      }
      input.onClick?.()
    }
    notice.onclose = () => {
      openNotices.delete(notice)
    }
    notice.onerror = () => {
      openNotices.delete(notice)
    }
    return true
  } catch (_error) {
    return false
  }
}

/**
 * 优先通过 Host 路由投递一条 Windows 原生通知，失败时退回渲染进程通知。
 *
 * Host 侧用 PowerShell + WinRT 投递，AUMID 与本应用开始菜单快捷方式一致，
 * 所以能真正进入 Windows 通知中心；窗口最小化或关闭到托盘时 Host 仍在运行。
 *
 * @param input 标题、正文与点击动作。
 * @returns 是否成功投递；Host 与渲染进程都失败时返回 false。
 */
export async function postDesktopNotice(input: DesktopNoticeInput): Promise<boolean> {
  try {
    const base = typeof document === 'undefined' ? 'http://dsh.internal/' : document.baseURI
    const url = new URL('feature-hub/notify', base).href
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ title: input.title, body: input.body }),
    })
    if (response.ok) {
      const payload = (await response.json()) as NotifyPayload
      if (payload.ok === true && payload.shown === true) return true
    }
  } catch (_error) {
    // Host 不可达（例如纯网页部署）：继续用渲染进程通知兜底。
  }
  return showDesktopNotice(input)
}

/**
 * 关闭本模块打开过的全部系统通知。
 * 插件卸载或引擎重建时调用，避免通知中心残留点击后无目标的条目。
 */
export function closeDesktopNotices(): void {
  for (const notice of openNotices) {
    try {
      notice.close()
    } catch (_error) {
      // 已经关闭的通知再关会抛错，忽略即可。
    }
  }
  openNotices.clear()
}
