/**
 * 「压缩上下文」按钮的出现阈值偏好。
 *
 * 只属于本功能：输入框右侧按钮与它自己的设置面板读同一份值，所以放在功能
 * 目录里，不再放进 `lib/`。存储用 localStorage，范围 20–100，写入后通知
 * 已挂载的按钮即时刷新。
 */

/** 默认阈值：上下文占到 50% 就显示按钮。 */
export const DEFAULT_COMPACT_THRESHOLD = 50

/** 允许的最小阈值：低于 20% 时压缩收益太小，按钮会变得吵。 */
export const MIN_COMPACT_THRESHOLD = 20

/** 允许的最大阈值（百分比上限）。 */
export const MAX_COMPACT_THRESHOLD = 100

const STORAGE_KEY = 'dsh-feature-hub.compact.threshold'
const listeners = new Set<() => void>()

/**
 * 把候选值夹进合法区间。
 * @param value 候选值（可能是输入框给的字符串）。
 * @param fallback 不是数字时使用的值。
 * @returns 20–100 之间的整数。
 */
export function clampCompactThreshold(value: unknown, fallback = DEFAULT_COMPACT_THRESHOLD): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(MAX_COMPACT_THRESHOLD, Math.max(MIN_COMPACT_THRESHOLD, Math.round(number)))
}

/**
 * 读取当前阈值。
 * @returns 存储值；未设置或非法时返回默认值。
 */
export function readCompactThreshold(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return DEFAULT_COMPACT_THRESHOLD
    return clampCompactThreshold(raw)
  } catch (_error) {
    return DEFAULT_COMPACT_THRESHOLD
  }
}

/**
 * 写入阈值并通知订阅者。
 * @param value 候选值；写入前夹进合法区间。
 * @returns 实际写入的整数。
 */
export function writeCompactThreshold(value: unknown): number {
  const next = clampCompactThreshold(value)
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next))
  } catch (_error) {
    // 存储不可用只影响持久化，不影响本次会话内的生效。
  }
  for (const listener of listeners) listener()
  return next
}

/**
 * 清除用户覆盖值，回到默认阈值。
 * @returns 无返回值。
 */
export function resetCompactThreshold(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (_error) {
    // 没有可清除的值时什么也不做。
  }
  for (const listener of listeners) listener()
}

/**
 * 订阅阈值变化（同页面内）。
 * @param listener 每次写入或重置后调用。
 * @returns 取消订阅函数。
 */
export function subscribeCompactThreshold(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
