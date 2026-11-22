/**
 * 「最近任务」的偏好读写：显示条数的本地持久化与订阅。
 *
 * 只属于本功能：侧边栏分组与它自己的设置面板读同一份值，所以放在功能目录里，
 * 不再放进 `lib/`。
 *
 * 存储失败（隐私模式、localStorage 被禁用）只影响记忆，不影响本次会话内生效；
 * 读取时校验并夹到合法范围，写回后通知订阅者，已打开的界面无需刷新。
 */

/** 「最近任务」默认显示条数。 */
export const DEFAULT_RECENT_LIMIT = 5

/** 条数上限，设置面板与读取端都用同一个值。 */
export const MAX_RECENT_LIMIT = 50

const LIMIT_KEY = 'dsh-feature-hub.recent-tasks.limit'
const listeners = new Set<() => void>()

/**
 * 把候选值夹到合法范围。
 * @param value 候选条数。
 * @param fallback 候选值不是数字时使用的默认值。
 * @returns 1 到 {@link MAX_RECENT_LIMIT} 之间的整数。
 */
export function clampRecentLimit(value: unknown, fallback: number = DEFAULT_RECENT_LIMIT): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(MAX_RECENT_LIMIT, Math.max(1, Math.floor(number)))
}

/**
 * 读取用户配置的条数。
 * @returns 存储值；未设置或非法时返回默认值。
 */
export function readRecentLimit(): number {
  try {
    const raw = window.localStorage.getItem(LIMIT_KEY)
    if (raw === null || raw === '') return DEFAULT_RECENT_LIMIT
    return clampRecentLimit(raw)
  } catch (_error) {
    return DEFAULT_RECENT_LIMIT
  }
}

/**
 * 保存条数并通知已打开的界面。
 * @param value 候选条数，写入前会被夹到合法范围。
 * @returns 实际写入的值。
 */
export function writeRecentLimit(value: unknown): number {
  const next = clampRecentLimit(value)
  try {
    window.localStorage.setItem(LIMIT_KEY, String(next))
  } catch (_error) {
    // 存储被禁用只影响持久化，不影响本次生效。
  }
  for (const listener of listeners) listener()
  return next
}

/**
 * 清除用户覆盖值，回到默认条数。
 */
export function resetRecentLimit(): void {
  try {
    window.localStorage.removeItem(LIMIT_KEY)
  } catch (_error) {
    // 存储不可用时没有东西可删。
  }
  for (const listener of listeners) listener()
}

/**
 * 订阅条数变化。
 * @param listener 每次写入或重置后调用。
 * @returns 取消订阅。
 */
export function subscribeRecentLimit(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
