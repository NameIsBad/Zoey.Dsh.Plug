/**
 * 时间文案工具。
 *
 * 不依赖 React、也不依赖任何 DSH 服务：组件渲染时可直接调用，
 * Node 自检也能直接断言。
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * 生成"多久以前"的本地化文案。
 * @param instant 要描述的时刻（毫秒时间戳）。
 * @param t 本命名空间的翻译函数。
 * @param now 参考时刻，缺省为当前时间。
 * @returns 例如「刚刚」「3 分钟前」；非法时间返回占位符。
 */
export function formatRelative(instant: number, t: Translate, now?: number): string {
  const reference = typeof now === 'number' ? now : Date.now()
  const value = Number(instant)
  if (!Number.isFinite(value) || value <= 0) return t('time.unknown')
  const age = Math.max(0, reference - value)
  if (age < MINUTE) return t('time.justNow')
  if (age < HOUR) return t('time.minutes', { count: Math.floor(age / MINUTE) })
  if (age < DAY) return t('time.hours', { count: Math.floor(age / HOUR) })
  if (age < WEEK) return t('time.days', { count: Math.floor(age / DAY) })
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/**
 * 生成悬停提示 / 无障碍标签用的本地绝对时间。
 * @param instant 毫秒时间戳。
 * @returns 本地化的日期时间；非法值返回空串。
 */
export function formatAbsolute(instant: number): string {
  const value = Number(instant)
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 生成 `<time dateTime>` 需要的 ISO 字符串。
 * @param instant 毫秒时间戳。
 * @returns ISO 字符串；非法值返回 undefined。
 */
export function toIso(instant: number): string | undefined {
  const value = Number(instant)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return new Date(value).toISOString()
}
