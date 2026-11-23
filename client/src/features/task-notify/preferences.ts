/**
 * 「任务提醒」的偏好：窗口内提醒与系统通知的开关，以及本地持久化与跨窗口同步。
 *
 * 只属于本功能：提醒引擎与它自己的设置面板读同一份值，所以放在功能目录里，
 * 不再放进 `lib/`。
 *
 * 存储失败（隐私模式、localStorage 被禁用）只影响记忆，不影响本次会话内生效；
 * 读取时逐字段校验，坏值回退到默认值，避免一条脏数据把提醒整体关掉。
 *
 * 为什么还要和 Host 对一份：同一个应用可能同时开着多个渲染进程（主窗口、
 * 浏览器镜像页、远程访问的客户端），它们的 localStorage 按 origin 分开，
 * 互不可见。Host 上那份 `notify-prefs.json` 是全局真相，`POST /feature-hub/notify`
 * 会按它拒绝对任何客户端弹通知；这里只做「拉一份、推一份」的同步，
 * localStorage 继续当本地缓存用（Host 不可达时提醒仍然可用）。
 */

import type { NotifyPrefs, NotifyPrefsPayload } from '../../../../types/wire'

/** 任务提醒的全部偏好。 */
export interface NotifyPreferences {
  /** 总开关；关闭后完成、失败、询问都不再提醒。 */
  readonly enabled: boolean
  /** 一轮回答正常结束时提醒。 */
  readonly completed: boolean
  /** 回答过程中出现错误时提醒。 */
  readonly failed: boolean
  /** 等待用户批准或回答时提醒。 */
  readonly asked: boolean
  /** 用 Windows 系统通知；关闭时只保留窗口内提醒。 */
  readonly system: boolean
}

/** 默认全部开启：功能装好后立即可见，用户再按需要关掉。 */
export const DEFAULT_NOTIFY_PREFERENCES: NotifyPreferences = {
  enabled: true,
  completed: true,
  failed: true,
  asked: true,
  system: true,
}

/** 偏好所在的 localStorage 键。 */
const STORAGE_KEY = 'dsh-feature-hub.task-notify'

/** 偏好变化订阅者（设置面板与引擎各订阅一份）。 */
const listeners = new Set<() => void>()

/** 当前还在监听 `storage` 事件的订阅者数量，归零时摘掉监听。 */
let storageSubscribers = 0

/**
 * 通知所有订阅者偏好可能变了。
 * 订阅方自己重新读一遍存储，避免这里维护一份可能与存储不一致的副本。
 */
function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * 把一个候选值收敛成布尔；不是布尔时用默认值。
 * @param value 存储里读到的原始值。
 * @param fallback 默认值。
 * @returns 布尔值。
 */
function booleanOf(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 把任意对象收敛成一份完整偏好。
 * @param value 可能来自 localStorage，也可能来自 Host。
 * @returns 逐字段校验后的偏好；字段缺失时用默认值。
 */
function preferencesOf(value: unknown): NotifyPreferences {
  if (value === null || typeof value !== 'object') return DEFAULT_NOTIFY_PREFERENCES
  const record = value as Record<string, unknown>
  return {
    enabled: booleanOf(record.enabled, DEFAULT_NOTIFY_PREFERENCES.enabled),
    completed: booleanOf(record.completed, DEFAULT_NOTIFY_PREFERENCES.completed),
    failed: booleanOf(record.failed, DEFAULT_NOTIFY_PREFERENCES.failed),
    asked: booleanOf(record.asked, DEFAULT_NOTIFY_PREFERENCES.asked),
    system: booleanOf(record.system, DEFAULT_NOTIFY_PREFERENCES.system),
  }
}

/**
 * 比较两份偏好是否完全一致。
 * @param left 偏好甲。
 * @param right 偏好乙。
 * @returns 五个字段都相同返回 true。
 */
export function sameNotifyPreferences(left: NotifyPreferences, right: NotifyPreferences): boolean {
  return (
    left.enabled === right.enabled &&
    left.completed === right.completed &&
    left.failed === right.failed &&
    left.asked === right.asked &&
    left.system === right.system
  )
}

/**
 * 读取任务提醒偏好。
 * @returns 合法偏好；未设置、解析失败或字段缺失时对应字段回退默认值。
 */
export function readNotifyPreferences(): NotifyPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return DEFAULT_NOTIFY_PREFERENCES
    const parsed: unknown = JSON.parse(raw)
    return preferencesOf(parsed)
  } catch (_error) {
    return DEFAULT_NOTIFY_PREFERENCES
  }
}

/**
 * 保存任务提醒偏好并通知订阅者。
 * @param preferences 完整偏好；调用方负责合并出完整对象。
 * @returns 实际写入的偏好（与入参相同，便于调用方直接作为新状态）。
 */
export function writeNotifyPreferences(preferences: NotifyPreferences): NotifyPreferences {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (_error) {
    // 存储被禁用只影响持久化，不影响本次生效。
  }
  emit()
  return preferences
}

/**
 * 订阅偏好变化。
 *
 * 同一个页面里的写入走 `listeners`；别的窗口 / 标签页写同一个键时浏览器只会
 * 触发 `storage` 事件，所以这里同时挂一份窗口级监听，并在最后一个订阅者
 * 退订时摘掉，避免页面级资源泄漏。
 *
 * @param listener 每次写入后调用。
 * @returns 取消订阅。
 */
export function subscribeNotifyPreferences(listener: () => void): () => void {
  listeners.add(listener)
  storageSubscribers += 1
  if (storageSubscribers === 1) bindStorageListener()
  return () => {
    listeners.delete(listener)
    storageSubscribers -= 1
    if (storageSubscribers === 0) unbindStorageListener()
  }
}

/**
 * 挂上窗口级 `storage` 监听。
 * 自检脚本用 Node 跑客户端产物，那里的 `window` 是只带 localStorage 的替身，
 * 没有事件接口，所以能力要现查而不是假定存在。
 */
function bindStorageListener(): void {
  if (typeof window === 'undefined') return
  if (typeof window.addEventListener !== 'function') return
  window.addEventListener('storage', onStorage)
}

/** 摘掉窗口级 `storage` 监听；没有对应能力时什么也不做。 */
function unbindStorageListener(): void {
  if (typeof window === 'undefined') return
  if (typeof window.removeEventListener !== 'function') return
  window.removeEventListener('storage', onStorage)
}

/**
 * `storage` 事件入口：只有本功能那个键（或整库清空）才当作偏好变化。
 * @param event 浏览器派发的存储事件。
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  emit()
}

/**
 * 从 Host 读取全局偏好。
 * @returns Host 上的偏好与「是否已经存过」；Host 不可达或返回异常时返回 null。
 */
export async function pullNotifyPreferences(): Promise<{
  readonly stored: boolean
  readonly prefs: NotifyPreferences
} | null> {
  try {
    const response = await fetch(notifyPrefsUrl(), {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as NotifyPrefsPayload
    if (payload.ok !== true) return null
    return { stored: payload.stored === true, prefs: preferencesOf(payload.prefs) }
  } catch (_error) {
    return null
  }
}

/**
 * 把偏好推到 Host，让所有窗口与镜像页面看到同一份开关。
 * @param preferences 完整偏好。
 * @returns 是否成功写入 Host；失败只意味着别的窗口暂时不同步。
 */
export async function pushNotifyPreferences(preferences: NotifyPreferences): Promise<boolean> {
  try {
    const response = await fetch(notifyPrefsUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(preferences satisfies NotifyPrefs),
    })
    if (!response.ok) return false
    const payload = (await response.json()) as NotifyPrefsPayload
    return payload.ok === true
  } catch (_error) {
    return false
  }
}

/**
 * 偏好路由的绝对地址（相对当前页面解析，网页版与桌面版都能用）。
 * @returns 完整 URL。
 */
function notifyPrefsUrl(): string {
  const base = typeof document === 'undefined' ? 'http://dsh.internal/' : document.baseURI
  return new URL('feature-hub/notify/prefs', base).href
}
