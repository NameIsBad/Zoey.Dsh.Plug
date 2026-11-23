/**
 * 「用量状态条」的偏好：哪些指标显示、token 是否用精确数字、是否实时刷新耗时。
 *
 * 只属于本功能：状态条与它自己的设置面板读同一份值，所以放在功能目录里。
 * 默认全部展示（用户要求「当前都是可以配置的，默认全部展示」）。
 *
 * 存储失败（隐私模式、localStorage 被禁用）只影响记忆，不影响本次会话内生效；
 * 读取时逐字段校验，坏值回退默认值，避免一条脏数据把整条状态条关掉。
 */

/** 状态条的全部偏好。 */
export interface UsagePreferences {
  /** 总开关；关闭后整条状态条不渲染。 */
  readonly enabled: boolean
  /** 展示「已消耗」token 总量。 */
  readonly showTokens: boolean
  /** 展示本阶段解码速度（tok/s）。 */
  readonly showSpeed: boolean
  /** 展示本阶段首字延迟。 */
  readonly showTtft: boolean
  /** 展示本轮耗时。 */
  readonly showElapsed: boolean
  /** 展示上下文占用百分比。 */
  readonly showContext: boolean
  /** token 数用千分位精确值（关掉则用 12.3K / 1.2M 紧凑写法）。 */
  readonly exactTokens: boolean
  /** 执行中每秒刷新耗时；关掉后耗时只随事件更新。 */
  readonly liveElapsed: boolean
}

/** 默认全部展示。 */
export const DEFAULT_USAGE_PREFERENCES: UsagePreferences = {
  enabled: true,
  showTokens: true,
  showSpeed: true,
  showTtft: true,
  showElapsed: true,
  showContext: true,
  exactTokens: false,
  liveElapsed: true,
}

/** 偏好所在的 localStorage 键。 */
const STORAGE_KEY = 'dsh-feature-hub.token-usage'

/** 偏好变化订阅者（状态条与设置面板各订阅一份）。 */
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
 * 读取用量状态条偏好。
 * @returns 合法偏好；未设置、解析失败或字段缺失时对应字段回退默认值。
 */
export function readUsagePreferences(): UsagePreferences {
  let parsed: unknown
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return DEFAULT_USAGE_PREFERENCES
    parsed = JSON.parse(raw)
  } catch (_error) {
    return DEFAULT_USAGE_PREFERENCES
  }
  if (parsed === null || typeof parsed !== 'object') return DEFAULT_USAGE_PREFERENCES
  const record = parsed as Record<string, unknown>
  const defaults = DEFAULT_USAGE_PREFERENCES
  return {
    enabled: booleanOf(record.enabled, defaults.enabled),
    showTokens: booleanOf(record.showTokens, defaults.showTokens),
    showSpeed: booleanOf(record.showSpeed, defaults.showSpeed),
    showTtft: booleanOf(record.showTtft, defaults.showTtft),
    showElapsed: booleanOf(record.showElapsed, defaults.showElapsed),
    showContext: booleanOf(record.showContext, defaults.showContext),
    exactTokens: booleanOf(record.exactTokens, defaults.exactTokens),
    liveElapsed: booleanOf(record.liveElapsed, defaults.liveElapsed),
  }
}

/**
 * 保存偏好并通知订阅者。
 * @param preferences 完整偏好；调用方负责合并出完整对象。
 * @returns 实际写入的偏好（与入参相同，调用方可直接作为新状态）。
 */
export function writeUsagePreferences(preferences: UsagePreferences): UsagePreferences {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (_error) {
    // 存储被禁用只影响持久化，不影响本次生效。
  }
  for (const listener of listeners) listener()
  return preferences
}

/**
 * 清除用户覆盖值，回到默认（全部展示）。
 * @returns 默认偏好。
 */
export function resetUsagePreferences(): UsagePreferences {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (_error) {
    // 没有可清除的值时什么也不做。
  }
  for (const listener of listeners) listener()
  return DEFAULT_USAGE_PREFERENCES
}

/**
 * 订阅偏好变化。
 * @param listener 每次写入或重置后调用。
 * @returns 取消订阅。
 */
export function subscribeUsagePreferences(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
