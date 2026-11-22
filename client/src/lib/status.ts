/**
 * 会话状态指示器：把「运行中 / 等待交互 / 有未读结果 / 空闲」翻译成视觉。
 *
 * 边界：纯展示逻辑，不读数据、不发请求。侧边栏会话行与功能分组都调用它，
 * 所以同一条会话在两处的颜色与动效必然一致。
 */

import type { ReactElement } from 'react'
import type { StatusMeta } from '../types'

/**
 * 把一个会话状态描述成「用哪种色调、取哪条文案」。
 * @param status 状态快照里的那一项（结构见 `types/dsh-client.d.ts`）。
 * @returns 状态描述；空闲或没有数据时返回 null。
 */
export function statusMeta(status: SessionStatus | undefined | null): StatusMeta | null {
  if (status === undefined || status === null) return null
  if (status.pendingInteraction !== undefined) return { tone: 'warn', key: 'status.waiting' }
  if (status.running === true) return { tone: 'live', key: 'status.running' }
  if (status.completionUnread === true) return { tone: 'done', key: 'status.done' }
  return null
}

/**
 * 生成一个状态指示器。
 *
 * 运行中用不确定进度环（转圈）而不是圆点，因为「正在跑」本身就该有动感；
 * 其余状态沿用 6px 圆点：等待交互是琥珀色 + 呼吸光晕，有未读结果是绿色实心点。
 * @param meta {@link statusMeta} 的结果。
 * @param label 悬停与无障碍朗读用的本地化文案。
 * @returns 指示器元素；空闲时返回 null（前导格仍占宽，对齐不变）。
 */
export function statusIcon(meta: StatusMeta | null, label: string): ReactElement | null {
  if (meta === null) return null
  if (meta.tone === 'live') {
    return h('span', {
      className: 'fh-ws-spinner',
      title: label,
      'aria-label': label,
      role: 'img',
    })
  }
  return h('span', {
    className: `fh-ws-dot fh-ws-dot-${meta.tone}`,
    title: label,
    'aria-label': label,
    role: 'img',
  })
}
