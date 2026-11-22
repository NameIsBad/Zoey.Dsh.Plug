/**
 * 「压缩上下文」的设置面板：按钮出现阈值。
 *
 * 面板只渲染设置行，卡片框架由「功能集」页壳统一包住；文案、偏好读写与
 * 组件都在本功能目录内，删掉这个功能时整块设置一起消失。
 */

import {
  DEFAULT_COMPACT_THRESHOLD,
  MAX_COMPACT_THRESHOLD,
  MIN_COMPACT_THRESHOLD,
  readCompactThreshold,
  resetCompactThreshold,
  writeCompactThreshold,
} from './threshold'
import { COMPACT_NS } from './index'
import { en, zh } from './locale'
import type { ReactElement } from 'react'

const { useState } = React

/**
 * 压缩按钮阈值的设置行。
 * @param props 本功能的翻译函数。
 * @returns 一条「文案 + 数字输入 + 恢复默认」的设置行。
 */
export function CompactContextSettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  // 输入框只保存「正在输入的文本」：边输边夹紧会把「30」变成「20」再变成「100」，
  // 所以只在失焦/回车时提交，提交后再把显示对齐到实际落盘值。
  const [text, setText] = useState<string>(() => String(readCompactThreshold()))

  /** 提交输入框文本：越界值夹到合法范围并落盘；清空则回到当前生效值。 */
  const commit = (): void => {
    if (text.trim() === '') {
      setText(String(readCompactThreshold()))
      return
    }
    setText(String(writeCompactThreshold(text)))
  }
  /** 清除用户覆盖值，回到默认阈值。 */
  const reset = (): void => {
    resetCompactThreshold()
    setText(String(DEFAULT_COMPACT_THRESHOLD))
  }

  return h(
    'div',
    { className: 'fh-set-row' },
    h(
      'div',
      { className: 'fh-set-text' },
      h('span', { className: 'fh-set-label' }, t('threshold.label')),
      h('span', { className: 'fh-set-help' }, t('threshold.hint', { min: MIN_COMPACT_THRESHOLD })),
    ),
    h(
      'div',
      { className: 'fh-set-control' },
      h('input', {
        className: 'fh-set-input',
        type: 'number',
        min: MIN_COMPACT_THRESHOLD,
        max: MAX_COMPACT_THRESHOLD,
        step: 1,
        value: text,
        'aria-label': t('threshold.label'),
        onChange: (event: { currentTarget: HTMLInputElement }) => {
          setText(event.currentTarget.value)
        },
        onBlur: () => {
          commit()
        },
        onKeyDown: (event: { key: string }) => {
          if (event.key === 'Enter') commit()
        },
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'fh-set-reset',
          onClick: reset,
        },
        t('threshold.reset'),
      ),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const compactContextSettings = {
  id: 'compact-context',
  order: 20,
  locale: { ns: COMPACT_NS, dicts: { zh, en } },
  component: CompactContextSettings,
}
