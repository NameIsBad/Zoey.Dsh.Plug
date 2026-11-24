/**
 * 功能：会话内容末尾的「用量状态条」（`token-usage`）。
 *
 * 解决的问题：一轮对话跑完，用户想知道这次到底烧了多少 token、模型有多快、
 * 首字等了多久、上下文还剩多少——这些数字分散在三个投影、两个面板里，
 * 而且都藏在展开的对话框后面。这里把它们压成输入框上方的一行实时读数。
 *
 * 展示位置：`conversation.input.dock`（输入框卡片正上方的整行插槽），
 * 也就是「会话内容最后」的位置；todo、goal、queue 之后排，紧贴输入框。
 *
 * 口径（与宿主同源，不自己估）：
 *   - **已消耗**：`tokenUsage` 投影的三个提示词桶 + 输出桶，与会话统计同一口径；
 *   - **速度 / 首字**：取当前对话窗口里**最新一轮**的助手节点计时，速度按
 *     「解码 token ÷ 解码墙钟」算，首字等待不计入吞吐；
 *   - **耗时**：该轮 `turn/start → turn/end`；仍在执行时按当前时间估算；
 *   - **上下文**：`contextPressure` 投影，与输入框下方那圈百分比同源。
 *
 * 没有 `sessionStats` 投影时（当前桌面组合没有挂载它），速度与首字一律从
 * Chat 快照回算；回算不了就整段不显示，绝不拿 0 充当读数。
 *
 * 边界：只读投影与快照，不写任何会话数据、不发请求。
 * 目录约定：本功能独占一个文件夹——`index.ts`（组件与描述对象）、
 * `metrics.ts`（纯计算与格式化）、`preferences.ts`（偏好读写）、
 * `settings.ts`（设置面板）、`locale.ts`（中英文字典）、`styles.ts`（样式）。
 */

import {
  billedTokens,
  contextPercent,
  formatRate,
  formatSeconds,
  formatTokenCount,
  stageReading,
  stageReadingFromStats,
} from './metrics'
import { readUsagePreferences, subscribeUsagePreferences, type UsagePreferences } from './preferences'
import { en, zh } from './locale'
import { styles } from './styles'
import type { FeatureTone } from '../../types'
import type { ReactElement, ReactNode } from 'react'
import type { StageReading } from './metrics'

const { useEffect, useState } = React

/** 本功能的字典命名空间。 */
export const TOKEN_USAGE_NS = 'feature-hub.token-usage'

/** 执行中刷新「耗时」的间隔（毫秒）；与宿主运行的秒级时钟一致。 */
const TICK_MS = 1000

/** 一行里的一个读数：标签、值、可选单位。 */
interface Reading {
  /** 稳定的 React key，同时用于样式钩子。 */
  readonly key: string
  /** 左侧标签文案。 */
  readonly label: string
  /** 等宽数字部分。 */
  readonly value: string
  /** 值后面的单位（tok / tok/s 之类）。 */
  readonly unit?: string
  /** 是否为估算值：为真时前缀 `≈` 并用悬停提示说明。 */
  readonly estimated?: boolean
  /** 前面的小圆点颜色；只做区分，不承担语义。 */
  readonly tone: FeatureTone
}

/**
 * 渲染一个读数（标签 + 值 + 单位）。
 * @param props 读数内容与估算提示文案。
 * @returns 状态条里的一个 `span`。
 */
function ReadingItem(props: { reading: Reading; estimateHint: string }): ReactElement {
  const { reading, estimateHint } = props
  return h(
    'span',
    { className: 'fh-tu-item', 'data-metric': reading.key },
    h('span', { className: 'fh-tu-dot', 'data-tone': reading.tone, 'aria-hidden': true }),
    h('span', { className: 'fh-tu-label' }, reading.label),
    h(
      'span',
      { className: 'fh-tu-value', title: reading.estimated === true ? estimateHint : undefined },
      reading.estimated === true ? h('span', { className: 'fh-tu-mark' }, '≈') : null,
      reading.value,
      reading.unit === undefined ? null : h('span', { className: 'fh-tu-unit' }, reading.unit),
    ),
  )
}

/**
 * 会话用量状态条。
 * @param props 插槽标准 props：本功能字典、会话 id、投影读取器与 Chat/Session 选择器。
 * @returns 一行读数；偏好关闭或完全没有可用数字时不渲染（返回 null）。
 */
export function TokenUsageBar(props: ComposerDockProps): ReactElement | null {
  const { t, sessionId } = props
  // 投影必须先读：它们决定这一帧有没有东西可画，且 hook 顺序不能随偏好变化。
  const usage = props.useProjection('tokenUsage')
  const pressure = props.useProjection('contextPressure')
  const stats = props.useProjection('sessionStats')
  const running = props.useSessions((state: SessionListState): boolean => {
    const row = state.byId[sessionId]
    return row === undefined ? false : row.running === true
  })
  const windowNodes = props.useChat((snapshot: ChatSnapshotView) => snapshot.legacy.nodes)
  const turnTimings = props.useChat((snapshot: ChatSnapshotView) => snapshot.legacy.turnTimings)

  const [prefs, setPrefs] = useState<UsagePreferences>(readUsagePreferences)
  const [now, setNow] = useState<number>(() => Date.now())

  // 设置页改动即时生效：状态条与设置面板读同一份偏好。
  useEffect(() => subscribeUsagePreferences(() => setPrefs(readUsagePreferences())), [])

  // 执行中按秒推进「耗时」（估算值）。关掉实时刷新或没有在跑时不装定时器。
  useEffect(() => {
    if (!running || !prefs.liveElapsed) return
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [running, prefs.liveElapsed])

  if (!prefs.enabled) return null

  // Chat 快照是首选口径（它就是屏幕上这一轮）；快照给不出来时退回全会话统计。
  const stage: StageReading = stageReading(windowNodes, turnTimings, running, now)
  const fallback = stageReadingFromStats(stats)
  const speedTps = stage.speedTps ?? fallback.speedTps
  const ttftMs = stage.ttftMs ?? fallback.ttftMs
  const elapsedMs = stage.elapsedMs ?? fallback.elapsedMs
  const percent = contextPercent(pressure)
  const total = usage === undefined ? null : billedTokens(usage)

  const readings: Reading[] = []
  if (prefs.showTokens && total !== null) {
    readings.push({
      key: 'tokens',
      tone: 'blue',
      label: t('consumed.label'),
      value: formatTokenCount(total, prefs.exactTokens),
      unit: t('consumed.unit'),
    })
  }
  if (prefs.showSpeed && speedTps !== null && speedTps > 0) {
    readings.push({
      key: 'speed',
      tone: 'green',
      label: t('speed.label'),
      value: formatRate(speedTps),
      unit: t('speed.unit'),
      estimated: true,
    })
  }
  if (prefs.showTtft && ttftMs !== null && ttftMs > 0) {
    readings.push({
      key: 'ttft',
      tone: 'gold',
      label: t('ttft.label'),
      value: formatSeconds(ttftMs),
      estimated: true,
    })
  }
  if (prefs.showElapsed && elapsedMs !== null && elapsedMs > 0) {
    readings.push({
      key: 'elapsed',
      tone: 'red',
      label: t('elapsed.label'),
      value: formatSeconds(elapsedMs),
      estimated: true,
    })
  }
  if (prefs.showContext && percent !== null) {
    readings.push({ key: 'context', tone: 'violet', label: t('context.label'), value: `${percent}%` })
  }
  if (readings.length === 0) return null

  const estimateHint = t('estimate.hint')
  const summary = t('aria.summary', {
    tokens: total === null ? '—' : formatTokenCount(total, true),
    speed: speedTps === null ? '—' : formatRate(speedTps),
    ttft: ttftMs === null ? '—' : formatSeconds(ttftMs),
    elapsed: elapsedMs === null ? '—' : formatSeconds(elapsedMs),
    percent: percent === null ? '—' : String(percent),
  })

  const children: ReactNode[] = []
  readings.forEach((reading, index) => {
    if (index > 0) {
      children.push(
        h('span', { key: `sep-${reading.key}`, className: 'fh-tu-sep', 'aria-hidden': true }, '·'),
      )
    }
    children.push(h(ReadingItem, { key: reading.key, reading, estimateHint }))
  })

  return h(
    'div',
    {
      className: 'fh-tu',
      role: 'status',
      'aria-live': 'off',
      'aria-label': summary,
      'data-running': running,
    },
    ...children,
  )
}

/** 供 hub 注册的输入框上方插槽描述。 */
export const tokenUsageFeature = {
  id: 'token-usage',
  order: 30,
  locale: { ns: TOKEN_USAGE_NS, dicts: { zh, en } },
  styles,
  component: TokenUsageBar,
}
