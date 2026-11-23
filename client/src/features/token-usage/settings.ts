/**
 * 「用量状态条」的设置面板：总开关、各项指标开关、精确数字与实时刷新。
 *
 * 面板只渲染设置行，卡片框架由「功能集」页壳统一包住；偏好、文案与控件都在
 * 本功能目录内，删掉这个功能时整块设置一起消失。
 */

import {
  DEFAULT_USAGE_PREFERENCES,
  readUsagePreferences,
  resetUsagePreferences,
  writeUsagePreferences,
  type UsagePreferences,
} from './preferences'
import { TOKEN_USAGE_NS } from './index'
import { en, zh } from './locale'
import type { ReactElement } from 'react'

const { useState } = React

/** 一行「文案在左、开关在右」的偏好行。 */
interface ToggleRowProps {
  /** 左侧主文案。 */
  readonly label: string
  /** 左侧说明。 */
  readonly hint: string
  /** 开关是否打开。 */
  readonly checked: boolean
  /** 总开关关闭时禁掉子项，避免用户以为它们还在生效。 */
  readonly disabled?: boolean
  /** 用户切换开关后调用。 */
  readonly onChange: (checked: boolean) => void
}

/**
 * 渲染一行复选框偏好。
 * @param props 文案、当前值与切换回调。
 * @returns 设置行元素。
 */
function ToggleRow(props: ToggleRowProps): ReactElement {
  return h(
    'div',
    { className: 'fh-set-row' },
    h(
      'div',
      { className: 'fh-set-text' },
      h('span', { className: 'fh-set-label' }, props.label),
      h('span', { className: 'fh-set-help' }, props.hint),
    ),
    h(
      'div',
      { className: 'fh-set-control' },
      h('input', {
        className: 'fh-set-checkbox',
        type: 'checkbox',
        checked: props.checked,
        disabled: props.disabled === true,
        'aria-label': props.label,
        onChange: (event: { currentTarget: HTMLInputElement }) => {
          props.onChange(event.currentTarget.checked)
        },
      }),
    ),
  )
}

/** 设置行清单：顺序、偏好字段与文案键一一对应，避免手写六份重复结构。 */
const ROWS: readonly {
  readonly key: keyof UsagePreferences
  readonly label: string
  readonly hint: string
  /** 总开关关闭时是否跟着禁用。 */
  readonly nested: boolean
}[] = [
  { key: 'showTokens', label: 'settings.tokens', hint: 'settings.tokensHint', nested: true },
  { key: 'exactTokens', label: 'settings.exact', hint: 'settings.exactHint', nested: true },
  { key: 'showSpeed', label: 'settings.speed', hint: 'settings.speedHint', nested: true },
  { key: 'showTtft', label: 'settings.ttft', hint: 'settings.ttftHint', nested: true },
  { key: 'showElapsed', label: 'settings.elapsed', hint: 'settings.elapsedHint', nested: true },
  { key: 'liveElapsed', label: 'settings.live', hint: 'settings.liveHint', nested: true },
  { key: 'showContext', label: 'settings.context', hint: 'settings.contextHint', nested: true },
]

/**
 * 用量状态条的设置行。
 * @param props 本功能的翻译函数。
 * @returns 总开关 + 各指标开关 + 恢复默认。
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

  const rows: ReactElement[] = ROWS.map((row) =>
    h(ToggleRow, {
      key: row.key,
      label: t(row.label),
      hint: t(row.hint),
      checked: prefs[row.key],
      disabled: row.nested && !prefs.enabled,
      onChange: (value: boolean) => {
        update(row.key, value)
      },
    }),
  )

  return h(
    React.Fragment,
    null,
    h(ToggleRow, {
      key: 'enabled',
      label: t('settings.enabled'),
      hint: t('settings.enabledHint'),
      checked: prefs.enabled,
      onChange: (value: boolean) => {
        update('enabled', value)
      },
    }),
    rows,
    h(
      'div',
      { className: 'fh-set-row' },
      h(
        'div',
        { className: 'fh-set-text' },
        h('span', { className: 'fh-set-label' }, t('settings.resetLabel')),
        h('span', { className: 'fh-set-help' }, t('settings.resetHint')),
      ),
      h(
        'div',
        { className: 'fh-set-control' },
        h(
          'button',
          {
            type: 'button',
            className: 'fh-set-button',
            disabled:
              prefs.enabled === DEFAULT_USAGE_PREFERENCES.enabled &&
              ROWS.every((row) => prefs[row.key] === DEFAULT_USAGE_PREFERENCES[row.key]),
            onClick: reset,
          },
          t('settings.reset'),
        ),
      ),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const tokenUsageSettings = {
  id: 'token-usage',
  order: 25,
  locale: { ns: TOKEN_USAGE_NS, dicts: { zh, en } },
  component: TokenUsageSettings,
}
