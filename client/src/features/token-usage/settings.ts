/**
 * 「用量状态条」的设置面板：总开关、各项指标开关、精确数字与实时刷新。
 *
 * 面板按「显示内容 / 速度与耗时 / 运行行为」分三组：八行开关平铺会很难扫读，
 * 分组之后每组只回答一件事。总开关单独做成强调行，关闭时子项统一置灰。
 * 卡片框架与 `.fh-set-*` 样式由「功能集」页壳提供。
 */

import {
  DEFAULT_USAGE_PREFERENCES,
  readUsagePreferences,
  resetUsagePreferences,
  writeUsagePreferences,
  type UsagePreferences,
} from './preferences'
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSwitch } from '../../lib/settings-controls'
import { SettingsGaugeIcon } from '../../lib/settings-icons'
import { TOKEN_USAGE_NS } from './index'
import { en, zh } from './locale'
import type { SettingsItemDescriptor } from '../../types'
import type { ReactElement } from 'react'

const { useState } = React

/** 一行开关的文案键与偏好字段。 */
interface ToggleSpec {
  /** 偏好字段。 */
  readonly key: keyof UsagePreferences
  /** 主文案键。 */
  readonly label: string
  /** 说明文案键。 */
  readonly hint: string
}

/** 「显示内容」组的开关。 */
const DISPLAY_ROWS: readonly ToggleSpec[] = [
  { key: 'showTokens', label: 'settings.tokens', hint: 'settings.tokensHint' },
  { key: 'exactTokens', label: 'settings.exact', hint: 'settings.exactHint' },
  { key: 'showContext', label: 'settings.context', hint: 'settings.contextHint' },
]

/** 「速度与耗时」组的开关。 */
const TIMING_ROWS: readonly ToggleSpec[] = [
  { key: 'showSpeed', label: 'settings.speed', hint: 'settings.speedHint' },
  { key: 'showTtft', label: 'settings.ttft', hint: 'settings.ttftHint' },
  { key: 'showElapsed', label: 'settings.elapsed', hint: 'settings.elapsedHint' },
]

/** 「运行行为」组的开关。 */
const BEHAVIOR_ROWS: readonly ToggleSpec[] = [
  { key: 'liveElapsed', label: 'settings.live', hint: 'settings.liveHint' },
]

/**
 * 用量状态条的设置面板。
 * @param props 本功能的翻译函数。
 * @returns 总开关 + 三组开关 + 恢复默认。
 */
export function TokenUsageSettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  const [prefs, setPrefs] = useState<UsagePreferences>(readUsagePreferences)

  /** 改写一个偏好并整体写回，保证存储里是一份完整偏好。 */
  const update = (key: keyof UsagePreferences, value: boolean): void => {
    setPrefs(writeUsagePreferences({ ...prefs, [key]: value }))
  }

  /** 清除用户覆盖值，回到「全部展示」。 */
  const reset = (): void => {
    setPrefs(resetUsagePreferences())
  }

  /** 总开关关闭时子项全部禁用，避免用户以为它们还在生效。 */
  const disabled = !prefs.enabled

  /** 渲染一组开关行。 */
  const renderRows = (rows: readonly ToggleSpec[]): ReactElement[] =>
    rows.map((row) =>
      h(
        SettingsRow,
        { key: row.key, label: t(row.label), hint: t(row.hint) },
        h(SettingsSwitch, {
          label: t(row.label),
          checked: prefs[row.key],
          disabled,
          onChange: (value: boolean) => {
            update(row.key, value)
          },
        }),
      ),
    )

  /** 与默认值完全一致时禁用「恢复默认」，避免一个按了没反应的按钮。 */
  const isDefault =
    prefs.enabled === DEFAULT_USAGE_PREFERENCES.enabled &&
    (Object.keys(DEFAULT_USAGE_PREFERENCES) as (keyof UsagePreferences)[]).every(
      (key) => prefs[key] === DEFAULT_USAGE_PREFERENCES[key],
    )

  return h(
    React.Fragment,
    null,
    h(
      SettingsRow,
      { hero: true, label: t('settings.enabled'), hint: t('settings.enabledHint') },
      h(SettingsSwitch, {
        label: t('settings.enabled'),
        checked: prefs.enabled,
        onChange: (value: boolean) => {
          update('enabled', value)
        },
      }),
    ),
    h(SettingsGroup, { title: t('group.display') }, renderRows(DISPLAY_ROWS)),
    h(SettingsGroup, { title: t('group.timing') }, renderRows(TIMING_ROWS)),
    h(SettingsGroup, { title: t('group.behavior') }, renderRows(BEHAVIOR_ROWS)),
    h(
      SettingsRow,
      { label: t('settings.resetLabel'), hint: t('settings.resetHint') },
      h(SettingsButton, { onClick: reset, disabled: isDefault }, t('settings.reset')),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const tokenUsageSettings: SettingsItemDescriptor = {
  id: 'token-usage',
  order: 25,
  locale: { ns: TOKEN_USAGE_NS, dicts: { zh, en } },
  component: TokenUsageSettings,
  icon: SettingsGaugeIcon,
  tone: 'green',
}
