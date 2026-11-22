/**
 * 功能：任务提醒（`task-notify`）。
 *
 * 任务完成、失败、或等待你批准/回答时发 **Windows 系统通知**（通知中心里的
 * toast），窗口最小化或关闭到托盘时也能收到；点击通知会尝试聚焦窗口并打开
 * 对应会话。系统通知发不出去时，右下角还有一条窗口内提醒兜底。
 *
 * 提醒挂在 frame 级 `shell.overlay` 浮动层上，因此与侧边栏是否展开、当前
 * 打开的是哪个会话都无关。数据来源与会话状态判断全部在 `engine.ts`，本文件
 * 只负责渲染与描述对象。
 *
 * 目录约定：本功能独占一个文件夹——`index.ts`（组件与描述对象）、
 * `engine.ts`（事件与提醒状态）、`locale.ts`（中英文字典）、`styles.ts`（样式）。
 */

import { noticeDetailText } from './engine'
import { en, zh } from './locale'
import { styles } from './styles'
import type { TaskNotice, TaskNotifyFace } from './engine'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'

const { useEffect, useState } = React

export { createTaskNotifyEngine } from './engine'
export type { TaskNotice, TaskNoticeKind, TaskNotifyEngine, TaskNotifyFace } from './engine'

/** 本功能的字典命名空间，也是浮动层注册里的 locale。 */
export const TASK_NOTIFY_NS = 'feature-hub.task-notify'

/** 本功能在插槽里的 id，与描述对象的 id 相同。 */
export const TASK_NOTIFY_ID = 'task-notify'

/** 浮动层组件接收到的 props：本功能字典 + 引擎能力。 */
interface TaskNotifyProps extends TaskNotifyFace {
  /** 本功能命名空间的翻译函数。 */
  readonly t: Translate
}

/**
 * 一条提醒的类别图标。
 * @param kind 提醒类别。
 * @returns 12px 的内联 SVG；完成是勾，失败是叉，询问是感叹号。
 */
function glyphOf(kind: TaskNotice['kind']): ReactElement {
  const paths: Record<TaskNotice['kind'], string> = {
    completed: 'M2.8 6.2 L5 8.4 L9.2 3.4',
    failed: 'M3.4 3.4 L8.6 8.6 M8.6 3.4 L3.4 8.6',
    asked: 'M6 2.8 V6.6 M6 8.4 V9.2',
  }
  return h(
    'svg',
    {
      width: 12,
      height: 12,
      viewBox: '0 0 12 12',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    h('path', { d: paths[kind] }),
  )
}

/**
 * 右下角的提醒堆栈。
 * @param props 本功能字典、提醒快照与关闭/打开动作。
 * @returns 有提醒时的浮动层；没有提醒时返回 null，不占 DOM。
 */
export function TaskNotifyOverlay(props: TaskNotifyProps): ReactElement | null {
  const { t, subscribe, toasts, dismiss, open } = props
  const [items, setItems] = useState<readonly TaskNotice[]>(() => toasts())
  // 引擎每次变化都换新数组，直接 set 进状态即可让 React 重渲染。
  useEffect(
    () =>
      subscribe(() => {
        setItems(toasts())
      }),
    [subscribe, toasts],
  )
  if (items.length === 0) return null
  return h(
    'div',
    { className: 'fh-tn-stack', role: 'region', 'aria-label': t('region') },
    items.map((notice) => {
      const detail = noticeDetailText(notice, t)
      return h(
        'div',
        { key: notice.id, className: `fh-tn-toast fh-tn-${notice.kind}`, role: 'status' },
        h('span', { className: 'fh-tn-icon', 'aria-hidden': true }, glyphOf(notice.kind)),
        h(
          'div',
          {
            className: 'fh-tn-content',
            role: 'button',
            tabIndex: 0,
            title: t('open'),
            onClick: () => {
              open(notice.sessionId)
              dismiss(notice.id)
            },
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              open(notice.sessionId)
              dismiss(notice.id)
            },
          },
          h('span', { className: 'fh-tn-title' }, t(`toast.${notice.kind}`)),
          h('span', { className: 'fh-tn-session' }, notice.title),
          detail === '' ? null : h('span', { className: 'fh-tn-detail' }, detail),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fh-tn-close',
            title: t('dismiss'),
            'aria-label': t('dismiss'),
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              dismiss(notice.id)
            },
          },
          '×',
        ),
      )
    }),
  )
}

/** 供 `main.ts` 注册到 `shell.overlay` 的功能描述对象。 */
export const taskNotify = {
  id: TASK_NOTIFY_ID,
  order: 900,
  locale: { ns: TASK_NOTIFY_NS, dicts: { zh, en } },
  styles,
  component: TaskNotifyOverlay,
}
