/**
 * 「压缩上下文」的设置面板：按钮出现阈值。
 *
 * 阈值用滑杆 + 常用值胶囊呈现：这是一个 20–100 的百分比，滑杆比数字输入框
 * 更容易凭手感调整；「恢复默认」放在滑杆旁边，随时可以撤回。
 * 卡片框架与 `.fh-set-*` 样式由「功能集」页壳提供。
 */

import {
  DEFAULT_COMPACT_THRESHOLD,
  MAX_COMPACT_THRESHOLD,
  MIN_COMPACT_THRESHOLD,
  readCompactThreshold,
  resetCompactThreshold,
  writeCompactThreshold,
} from './threshold'
import { SettingsButton, SettingsPresets, SettingsRow, SettingsSlider } from '../../lib/settings-controls'
import { SettingsCompressIcon } from '../../lib/settings-icons'
import { COMPACT_NS } from './index'
import { en, zh } from './locale'
import type { SettingsItemDescriptor } from '../../types'
import type { ReactElement } from 'react'

const { useState } = React

/** 滑杆旁边的常用阈值；与默认值 50 一起覆盖「早一点 / 正常 / 晚一点」。 */
const PRESETS: readonly number[] = [30, 50, 70, 85]

/**
 * 压缩按钮阈值的设置行。
 * @param props 本功能的翻译函数。
 * @returns 滑杆行 + 常用阈值行。
 */
export function CompactContextSettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  const [value, setValue] = useState<number>(readCompactThreshold)

  /** 写入阈值并同步本地显示；越界值在写入时夹到合法范围。 */
  const commit = (next: number): void => {
    setValue(writeCompactThreshold(next))
  }
  /** 清除用户覆盖值，回到默认阈值。 */
  const reset = (): void => {
    resetCompactThreshold()
    setValue(DEFAULT_COMPACT_THRESHOLD)
  }

  return h(
    React.Fragment,
    null,
    h(
      SettingsRow,
      {
        label: t('threshold.label'),
        hint: t('threshold.hint', { min: MIN_COMPACT_THRESHOLD }),
      },
      h(SettingsSlider, {
        label: t('threshold.label'),
        value,
        min: MIN_COMPACT_THRESHOLD,
        max: MAX_COMPACT_THRESHOLD,
        step: 5,
        suffix: '%',
        onChange: commit,
      }),
    ),
    h(
      SettingsRow,
      { label: t('threshold.presets'), hint: t('threshold.presetsHint') },
      h(SettingsPresets, {
        label: t('threshold.presets'),
        options: PRESETS,
        value,
        suffix: '%',
        onChange: commit,
      }),
      h(SettingsButton, { onClick: reset }, t('threshold.reset')),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const compactContextSettings: SettingsItemDescriptor = {
  id: 'compact-context',
  order: 20,
  locale: { ns: COMPACT_NS, dicts: { zh, en } },
  component: CompactContextSettings,
  icon: SettingsCompressIcon,
  tone: 'blue',
}
