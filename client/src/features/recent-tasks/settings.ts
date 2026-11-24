/**
 * 「最近任务」的设置面板：显示条数。
 *
 * 面板只渲染设置行，卡片标题/描述与卡片框架由「功能集」页壳统一包住；
 * 文案、偏好读写与组件都在本功能目录内，删掉这个功能时整块设置一起消失。
 * 控件本身来自 `lib/settings-controls.tsx`（四个功能共用同一套外观与交互）。
 */

import {
  DEFAULT_RECENT_LIMIT,
  MAX_RECENT_LIMIT,
  readRecentLimit,
  resetRecentLimit,
  writeRecentLimit,
} from './preferences'
import { SettingsButton, SettingsRow, SettingsStepper } from '../../lib/settings-controls'
import { SettingsClockIcon } from '../../lib/settings-icons'
import { RECENT_TASKS_NS } from './index'
import { en, zh } from './locale'
import type { SettingsItemDescriptor } from '../../types'
import type { ReactElement } from 'react'

const { useState } = React

/**
 * 最近任务的设置行。
 * @param props 本功能的翻译函数。
 * @returns 一条「文案 + 条数步进器 + 恢复默认」的设置行。
 */
export function RecentTasksSettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  const [limit, setLimit] = useState<number>(readRecentLimit)

  /** 写入条数并同步本地显示；越界值在写入时被夹到合法范围。 */
  const commit = (value: number): void => {
    setLimit(writeRecentLimit(value))
  }
  /** 清除用户覆盖值，回到默认条数。 */
  const reset = (): void => {
    resetRecentLimit()
    setLimit(DEFAULT_RECENT_LIMIT)
  }

  return h(
    SettingsRow,
    { label: t('limit.label'), hint: t('limit.hint', { max: MAX_RECENT_LIMIT }) },
    h(SettingsStepper, {
      label: t('limit.label'),
      value: limit,
      min: 1,
      max: MAX_RECENT_LIMIT,
      unit: t('limit.unit'),
      onChange: commit,
    }),
    h(SettingsButton, { onClick: reset }, t('limit.reset')),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const recentTasksSettings: SettingsItemDescriptor = {
  id: 'recent-tasks',
  order: 10,
  locale: { ns: RECENT_TASKS_NS, dicts: { zh, en } },
  component: RecentTasksSettings,
  icon: SettingsClockIcon,
  tone: 'gold',
}
