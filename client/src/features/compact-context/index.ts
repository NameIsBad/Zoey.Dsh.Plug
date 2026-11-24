/**
 * 功能：输入框工具行的「压缩上下文」按钮（`compact-context`）。
 *
 * 解决的问题：压缩上下文原本只能手敲 `/compact`，而「上下文已用 xx%」的提示
 * 恰恰出现在最需要一键处理它的位置。这里把它变成一个图标按钮。
 *
 * 展示条件：**只在上下文占用达到配置阈值时出现**（默认 50%，最小 20%，可在设置页调整）。
 * 低于阈值时不渲染，避免占用工具行空间；占比来自宿主的 `contextPressure`
 * 投影（已用 token / 上下文窗口），和输入框下方那个百分比环同源。
 *
 * 实现方式：调 `runner.ts` 的 `runCompact`，也就是 Client Remote 的
 * `commands.execute('/compact')`——和 `/` 命令面板同一条 RPC。**不经过输入框**：
 * 不写草稿、不提交、不动附件，所以不需要"会替换草稿"的确认框；压缩结果由宿主
 * 写进会话日志，和手敲 `/compact` 一样以命令节点出现在对话里。
 *
 * 边界：只读当前会话的投影与输入框状态；不读会话日志、不写会话数据。
 * 限制：agent 正在执行轮次、或命令执行通道没有挂载时按钮禁用并说明原因。
 *
 * 目录约定：本功能独占一个文件夹——`index.ts`（组件与描述对象）、`runner.ts`
 * （宿主命令执行通道）、`threshold.ts`（阈值偏好）、`settings.ts`（设置面板）、
 * `locale.ts`（中英文字典）、`styles.ts`（样式）。
 */

import { isCompactAvailable, runCompact } from './runner'
import { readCompactThreshold, subscribeCompactThreshold } from './threshold'
import { en, zh } from './locale'
import { styles } from './styles'
import type { ReactElement } from 'react'

const { useEffect, useRef, useState } = React

/** 本功能的语言命名空间。 */
export const COMPACT_NS = 'feature-hub.compact'

/** 失败提示的停留时间（毫秒）。命令结果会留在会话里，提示只是即时反馈。 */
const NOTE_VISIBLE_MS = 9000

/**
 * 「压缩」图标：实心圆徽标 + 相向箭头 + 中线，表示「把长历史往中间收」。
 *
 * 用彩色而不是单色：这是唯一一个主动改上下文的动作，值得在工具行里更醒目。
 * 颜色只用主题 token——常规是业务蓝，占用超过 80% 换成警示琥珀；
 * 圆内箭头用页面底色，深浅主题下都形成镂空对比。
 * @param props percent 当前占用百分比，用于选择色调。
 * @returns 内联 SVG 元素。
 */
function CompactGlyph(props: { percent: number }): ReactElement {
  const severe = props.percent >= 80
  const fill = severe ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-business-primary)'
  const ink = 'var(--dsw-alias-bg-base)'
  return h(
    'svg',
    { width: 18, height: 18, viewBox: '0 0 20 20', 'aria-hidden': true, focusable: false },
    h('circle', {
      cx: 10,
      cy: 10,
      r: 9,
      fill,
      stroke: 'color-mix(in srgb, #000 12%, transparent)',
      strokeWidth: 0.6,
    }),
    // 左上角的一小块高光：让实心圆看起来像有厚度的小按钮，而不是平涂色块。
    h('circle', { cx: 7, cy: 6.2, r: 3.4, fill: '#fff', opacity: 0.22 }),
    h('path', { d: 'M10 5.6 V14.4', stroke: ink, strokeWidth: 1.7, strokeLinecap: 'round' }),
    h('path', {
      d: 'M6 7.4 L8.5 10 L6 12.6',
      fill: 'none',
      stroke: ink,
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    h('path', {
      d: 'M14 7.4 L11.5 10 L14 12.6',
      fill: 'none',
      stroke: ink,
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  )
}

/**
 * 压缩上下文按钮。
 * @param props 输入框工具行右侧的 props：会话 id、字典、输入状态与投影读取器。
 * @returns 按钮元素；上下文占用不足、或会话没有输入能力时不渲染（返回 null）。
 */
export function CompactButton(props: ComposerRightProps): ReactElement | null {
  const { t, sessionId, inputActions } = props
  const pressure = props.useProjection('contextPressure')
  const phase = props.useInput((state) => state.phase)
  const running = props.useSessions((state) => {
    const row = state.byId[sessionId]
    return row === undefined ? false : row.running === true
  })
  const [threshold, setThreshold] = useState<number>(readCompactThreshold)
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const alive = useRef(true)

  // 卸载后不再写状态：命令是异步的，回调可能在组件消失之后才回来。
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 设置页改阈值后（同一页面内）即时生效，不需要刷新。
  useEffect(
    () =>
      subscribeCompactThreshold(() => {
        setThreshold(readCompactThreshold())
      }),
    [],
  )

  // 失败提示自动收起；连续失败会重置计时器。
  useEffect(() => {
    if (note === null) return
    const timer = window.setTimeout(() => {
      if (alive.current) setNote(null)
    }, NOTE_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  // 与宿主同源：`projectedTokens` 优先、`pressureTokens` 兜底，再除以窗口容量。
  // 判定的也是**显示出来的整数百分比**，避免出现「显示 60% 但按钮不出现」。
  const used = pressure === undefined ? undefined : (pressure.projectedTokens ?? pressure.pressureTokens)
  const capacity = pressure === undefined ? undefined : pressure.contextWindow
  if (typeof used !== 'number' || typeof capacity !== 'number' || capacity <= 0) return null
  const percent = Math.min(100, Math.round((used / capacity) * 100))
  if (percent < threshold) return null
  // 只读会话（没有输入能力）不提供压缩：压缩会改会话历史，不是纯查看动作。
  if (typeof inputActions === 'undefined') return null
  const available = isCompactAvailable()
  // 轮次进行中、命令还未送达、或提交事务尚未结算时都不适合再发起压缩。
  const busy = phase !== 'plain'
  const disabled = running || pending || busy || !available
  const hint = t('tooltip', { percent: String(percent) })
  const reason = !available
    ? t('unavailable')
    : running
      ? t('disabled.running')
      : pending
        ? t('running')
        : busy
          ? t('disabled.busy')
          : hint

  /** 点击按钮：直接走命令执行通道，不碰输入框里的草稿。 */
  const trigger = (): void => {
    if (disabled) return
    setNote(null)
    setPending(true)
    void runCompact(sessionId).then((result) => {
      if (!alive.current) return
      setPending(false)
      if (result.ok) return
      if (result.reason === 'unavailable') {
        setNote(t('unavailable'))
        return
      }
      setNote(
        result.detail === undefined || result.detail === ''
          ? t('failed.plain')
          : t('failed', { detail: result.detail }),
      )
    })
  }

  return h(
    'span',
    { className: 'fh-cx' },
    h(
      'button',
      {
        type: 'button',
        className: disabled ? 'fh-cx-button fh-cx-button-disabled' : 'fh-cx-button',
        title: reason,
        'aria-label': hint,
        'aria-busy': pending,
        disabled,
        onClick: trigger,
      },
      h(CompactGlyph, { percent }),
    ),
    note === null ? null : h('div', { className: 'fh-cx-note', role: 'status' }, note),
  )
}

/** 供 hub 注册的输入框右侧控件描述。 */
export const compactContextFeature = {
  id: 'compact-context',
  order: 20,
  locale: { ns: COMPACT_NS, dicts: { zh, en } },
  styles,
  component: CompactButton,
}
