/**
 * 「用量状态条」的纯计算与纯格式化工具。
 *
 * 只做三件事，全部无副作用、可单独测试：
 *   1. 把宿主的 `tokenUsage` 投影换算成「已消耗 token」；
 *   2. 从 Chat 快照的助手节点与轮次时间表推导**本阶段**指标（速度、首字、耗时）；
 *   3. 把数字格式化成界面上的紧凑文本。
 *
 * 边界：不订阅任何服务、不读写 localStorage、不碰 DOM；组件与自检脚本共用。
 */

/** 宿主 `tokenUsage` 投影里本功能读取的四个互不重叠计费桶。 */
export interface TokenUsageView {
  /** 未命中缓存的输入 token。 */
  readonly uncachedInputTokens: number
  /** 输出（含推理）token。 */
  readonly outputTokens: number
  /** 命中缓存的输入 token。 */
  readonly cacheReadTokens: number
  /** 写入缓存的输入 token。 */
  readonly cacheWriteTokens: number
}

/** 宿主 `contextPressure` 投影里本功能读取的字段。 */
export interface PressureView {
  /** 投影后的已用 token（优先于 `pressureTokens`）。 */
  readonly projectedTokens?: number
  /** 最近一次请求的估算压力 token。 */
  readonly pressureTokens?: number
  /** 当前路由的上下文窗口容量。 */
  readonly contextWindow?: number
}

/** 宿主 `sessionStats` 投影里本功能用到的字段（作为 Chat 数据的兜底）。 */
export interface SessionStatsView {
  /** 解码墙钟时间之和（毫秒）。 */
  readonly decodeMs: number
  /** 与 `decodeMs` 同时上报的输出 token 之和。 */
  readonly decodeTokens: number
  /** 首 token 延迟之和（毫秒）。 */
  readonly ttftMs: number
  /** 上报过首 token 的步数。 */
  readonly ttftSteps: number
}

/** 一个助手节点的计时事实（与宿主 `AssistantTiming` 同形）。 */
export interface TimingView {
  /** 本步 `step/start` 时间；窗口截断时可能为 null。 */
  readonly stepStartTime: number | null
  /** 首个非空增量时间；没有记录时为 null。 */
  readonly firstTokenTime: number | null
  /** 最终助手消息时间。 */
  readonly completedTime: number
}

/** Chat 节点里本功能读取的最小形状。 */
export interface ChatNodeView {
  /** 节点类别；只关心 `assistant`。 */
  readonly kind: string
  /** 所属轮次（助手节点才有）。 */
  readonly turn?: number
  /** 节点时间戳（毫秒）。 */
  readonly time: number
  /** 计时事实。 */
  readonly timing?: TimingView
  /** 提供方用量原始值。 */
  readonly usage?: unknown
}

/** 一轮的起止时间（与宿主 `turnTimings` 同形）。 */
export interface TurnTimingView {
  /** `turn/start` 时间。 */
  readonly startTime: number
  /** `turn/end` 时间；仍在执行时缺失。 */
  readonly endTime?: number
}

/** 本阶段指标：任一字段为 null 表示宿主没有给出可展示的值。 */
export interface StageReading {
  /** 解码速度（token/秒）。 */
  readonly speedTps: number | null
  /** 平均首 token 延迟（毫秒）。 */
  readonly ttftMs: number | null
  /** 该轮耗时（毫秒）；执行中按 `now` 估算。 */
  readonly elapsedMs: number | null
  /** 指标所属轮次；没有可用轮次时为 null。 */
  readonly turn: number | null
}

/** 什么都推不出来的空读数。 */
const EMPTY_STAGE: StageReading = { speedTps: null, ttftMs: null, elapsedMs: null, turn: null }

/**
 * 会话累计消耗的 token：三个提示词桶加输出桶。
 * @param usage `tokenUsage` 投影值。
 * @returns 非负整数 token 数。
 */
export function billedTokens(usage: TokenUsageView): number {
  const total =
    usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens
  return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0
}

/**
 * 从助手节点的 `usage` 里读输出 token。
 * @param usage 原始用量对象（形状由提供方决定）。
 * @returns 合法非负数；不是数字时返回 null。
 */
function outputTokensOf(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null
  const value = (usage as { outputTokens?: unknown }).outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * 取最新一轮的轮次号：节点与轮次时间表里最大的那个。
 * @param nodes 当前 Chat 窗口的节点。
 * @param turnTimings 轮次起止时间表。
 * @returns 最新轮次号；一条都没有时返回 null。
 */
export function latestTurn(
  nodes: readonly ChatNodeView[],
  turnTimings: ReadonlyMap<number, TurnTimingView>,
): number | null {
  let latest: number | null = null
  const consider = (turn: number | undefined): void => {
    if (typeof turn !== 'number' || !Number.isFinite(turn)) return
    if (latest === null || turn > latest) latest = turn
  }
  for (const node of nodes) consider(node.turn)
  for (const turn of turnTimings.keys()) consider(turn)
  return latest
}

/**
 * 推导最新一轮的阶段指标。
 *
 * 速度取「解码 token ÷ 解码墙钟」而不是整轮耗时，避免把首字等待算成吞吐；
 * 首字取本轮各步的平均；耗时优先用 `turn/end`，执行中按 `now` 估算，因此界面上
 * 都带「≈ / 估算」字样。
 * @param nodes 当前 Chat 窗口的节点（只读）。
 * @param turnTimings 轮次起止时间表。
 * @param running 该会话当前是否正在执行（决定耗时是否按 now 估算）。
 * @param now 估算用的当前时间（毫秒）。
 * @returns 阶段读数；没有可用数据时为全 null。
 */
export function stageReading(
  nodes: readonly ChatNodeView[],
  turnTimings: ReadonlyMap<number, TurnTimingView>,
  running: boolean,
  now: number,
): StageReading {
  const turn = latestTurn(nodes, turnTimings)
  if (turn === null) return EMPTY_STAGE
  let decodeMs = 0
  let decodeTokens = 0
  let ttftTotal = 0
  let ttftSteps = 0
  for (const node of nodes) {
    if (node.kind !== 'assistant' || node.turn !== turn) continue
    const timing = node.timing
    if (timing === undefined) continue
    if (timing.stepStartTime !== null && timing.firstTokenTime !== null) {
      ttftTotal += Math.max(0, timing.firstTokenTime - timing.stepStartTime)
      ttftSteps += 1
    }
    if (timing.firstTokenTime === null) continue
    const output = outputTokensOf(node.usage)
    if (output === null) continue
    decodeMs += Math.max(0, timing.completedTime - timing.firstTokenTime)
    decodeTokens += output
  }
  const timing = turnTimings.get(turn)
  const elapsedMs =
    timing === undefined
      ? null
      : Math.max(0, (timing.endTime ?? (running ? now : timing.startTime)) - timing.startTime)
  return {
    speedTps: decodeMs > 0 ? decodeTokens / (decodeMs / 1000) : null,
    ttftMs: ttftSteps > 0 ? ttftTotal / ttftSteps : null,
    elapsedMs,
    turn,
  }
}

/**
 * 没有 Chat 数据时（例如当前视图不渲染对话流）用全会话统计兜底。
 * @param stats `sessionStats` 投影值；缺失时传 undefined。
 * @returns 只填得出来的字段：速度与首字；耗时口径不同，留空。
 */
export function stageReadingFromStats(stats: SessionStatsView | undefined): StageReading {
  if (stats === undefined) return EMPTY_STAGE
  return {
    speedTps: stats.decodeMs > 0 ? stats.decodeTokens / (stats.decodeMs / 1000) : null,
    ttftMs: stats.ttftSteps > 0 ? stats.ttftMs / stats.ttftSteps : null,
    elapsedMs: null,
    turn: null,
  }
}

/**
 * 上下文占用百分比（与输入框下方那个百分比环同源）。
 * @param pressure `contextPressure` 投影值。
 * @returns 0–100 的整数；分子或分母缺失时返回 null。
 */
export function contextPercent(pressure: PressureView | undefined): number | null {
  if (pressure === undefined) return null
  const used = pressure.projectedTokens ?? pressure.pressureTokens
  const capacity = pressure.contextWindow
  if (typeof used !== 'number' || typeof capacity !== 'number' || capacity <= 0) return null
  return Math.min(100, Math.max(0, Math.round((used / capacity) * 100)))
}

/**
 * 紧凑 token 数：999 / 12.3K / 1.2M。
 * @param value 非负 token 数。
 * @param exact true 时使用千分位精确数字，不做 K/M 缩放。
 * @returns 用于界面的文本。
 */
export function formatTokenCount(value: number, exact: boolean): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  if (exact) {
    const digits = String(safe)
    const groups: string[] = []
    for (let end = digits.length; end > 0; end -= 3) {
      groups.unshift(digits.slice(Math.max(0, end - 3), end))
    }
    return groups.join(',')
  }
  const scaled = (candidate: number): string =>
    candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10)
  if (safe < 1_000) return String(safe)
  if (safe < 1_000_000) return `${scaled(safe / 1_000)}K`
  return `${scaled(safe / 1_000_000)}M`
}

/**
 * 解码速度：十以上取整，十以下保留一位小数。
 * @param tps token/秒；非法值按 0 处理。
 * @returns 不带单位的数字文本。
 */
export function formatRate(tps: number): string {
  const safe = Number.isFinite(tps) ? Math.max(0, tps) : 0
  return safe >= 10 ? String(Math.round(safe)) : String(Math.round(safe * 10) / 10)
}

/**
 * 时长文本：十秒内保留一位小数，一分钟内取整，之后写成 `15m45s` / `1h02m`。
 *
 * 一轮跑十几分钟很常见，`945s` 这种纯秒数不好读；但短读数又要保留小数，
 * 所以按量级切换写法。
 * @param ms 毫秒；负数按 0 处理。
 * @returns 自带单位的文本。
 */
export function formatSeconds(ms: number): string {
  const totalMs = Number.isFinite(ms) ? Math.max(0, ms) : 0
  const seconds = totalMs / 1_000
  if (seconds < 60) {
    return `${seconds < 10 ? String(Math.round(seconds * 10) / 10) : String(Math.round(seconds))}s`
  }
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  if (minutes < 60) return `${minutes}m${String(whole % 60).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}m`
}
