/**
 * 「任务提醒」的偏好：窗口内提醒与系统通知的开关，以及本地持久化。
 *
 * 只属于本功能：提醒引擎与它自己的设置面板读同一份值，所以放在功能目录里，
 * 不再放进 `lib/`。
 *
 * 存储失败（隐私模式、localStorage 被禁用）只影响记忆，不影响本次会话内生效；
 * 读取时逐字段校验，坏值回退到默认值，避免一条脏数据把提醒整体关掉。
 */

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
 * 读取任务提醒偏好。
 * @returns 合法偏好；未设置、解析失败或字段缺失时对应字段回退默认值。
 */
export function readNotifyPreferences(): NotifyPreferences {
  let parsed: unknown
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return DEFAULT_NOTIFY_PREFERENCES
    parsed = JSON.parse(raw)
  } catch (_error) {
    return DEFAULT_NOTIFY_PREFERENCES
  }
  if (parsed === null || typeof parsed !== 'object') return DEFAULT_NOTIFY_PREFERENCES
  const record = parsed as Record<string, unknown>
  return {
    enabled: booleanOf(record.enabled, DEFAULT_NOTIFY_PREFERENCES.enabled),
    completed: booleanOf(record.completed, DEFAULT_NOTIFY_PREFERENCES.completed),
    failed: booleanOf(record.failed, DEFAULT_NOTIFY_PREFERENCES.failed),
    asked: booleanOf(record.asked, DEFAULT_NOTIFY_PREFERENCES.asked),
    system: booleanOf(record.system, DEFAULT_NOTIFY_PREFERENCES.system),
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
  for (const listener of listeners) listener()
  return preferences
}

/**
 * 订阅偏好变化。
 * @param listener 每次写入后调用。
 * @returns 取消订阅。
 */
export function subscribeNotifyPreferences(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
