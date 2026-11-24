/**
 * 「任务提醒」的设置面板：总开关、三类提醒开关、系统通知开关与测试按钮。
 *
 * 面板按「提醒时机 / 投递方式」分组：总开关是强调行，关闭后其余开关统一置灰；
 * 测试按钮放在投递方式组里，按完把结果直接写在旁边。
 * 卡片框架与 `.fh-set-*` 样式由「功能集」页壳提供。
 */

import {
  desktopNotifyPermission,
  postDesktopNotice,
  requestDesktopNotifyPermission,
  type DesktopNotifyPermission,
} from './desktop-notify'
import {
  pushNotifyPreferences,
  readNotifyPreferences,
  subscribeNotifyPreferences,
  writeNotifyPreferences,
  type NotifyPreferences,
} from './preferences'
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSwitch } from '../../lib/settings-controls'
import { SettingsBellIcon } from '../../lib/settings-icons'
import { TASK_NOTIFY_NS } from './index'
import { en, zh } from './locale'
import type { SettingsItemDescriptor } from '../../types'
import type { ReactElement } from 'react'

const { useEffect, useState } = React

/** 一行开关的文案键与偏好字段。 */
interface ToggleSpec {
  /** 偏好字段。 */
  readonly key: keyof NotifyPreferences
  /** 主文案键。 */
  readonly label: string
  /** 说明文案键。 */
  readonly hint: string
}

/** 「提醒时机」组的开关。 */
const WHEN_ROWS: readonly ToggleSpec[] = [
  { key: 'completed', label: 'notify.completed', hint: 'notify.completedHint' },
  { key: 'failed', label: 'notify.failed', hint: 'notify.failedHint' },
  { key: 'asked', label: 'notify.asked', hint: 'notify.askedHint' },
]

/**
 * 任务提醒的设置行。
 * @param props 本功能的翻译函数。
 * @returns 总开关 + 两类分组 + 测试按钮。
 */
export function TaskNotifySettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  const [notify, setNotify] = useState<NotifyPreferences>(readNotifyPreferences)
  const [permission, setPermission] = useState<DesktopNotifyPermission>(desktopNotifyPermission)
  const [tested, setTested] = useState(false)

  // 别的窗口（或浏览器镜像页）改了开关时，这块面板要跟着变，否则会显示旧状态。
  useEffect(() => subscribeNotifyPreferences(() => setNotify(readNotifyPreferences())), [])

  /** 改写一个提醒开关：本地立即生效并持久化，同时推给 Host 让所有窗口同步。 */
  const setNotifyPref = (key: keyof NotifyPreferences, value: boolean): void => {
    const next: NotifyPreferences = { ...notify, [key]: value }
    setNotify(writeNotifyPreferences(next))
    void pushNotifyPreferences(next)
  }

  /** 在用户手势里申请系统通知授权，并经 Host 发送一条测试通知。 */
  const sendTest = (): void => {
    void (async () => {
      const result = await requestDesktopNotifyPermission()
      setPermission(result)
      if (result !== 'granted') {
        setTested(false)
        return
      }
      const sent = await postDesktopNotice({
        title: t('notify.testTitle'),
        body: t('notify.testBody'),
        tag: 'feature-hub:test',
      })
      setTested(sent.delivered)
    })()
  }

  /** 总开关关闭时子项全部禁用，避免用户以为它们还在生效。 */
  const disabled = !notify.enabled

  return h(
    React.Fragment,
    null,
    h(
      SettingsRow,
      { hero: true, label: t('notify.enabled'), hint: t('notify.enabledHint') },
      h(SettingsSwitch, {
        label: t('notify.enabled'),
        checked: notify.enabled,
        onChange: (value: boolean) => {
          setNotifyPref('enabled', value)
        },
      }),
    ),
    h(
      SettingsGroup,
      { title: t('group.when') },
      WHEN_ROWS.map((row) =>
        h(
          SettingsRow,
          { key: row.key, label: t(row.label), hint: t(row.hint) },
          h(SettingsSwitch, {
            label: t(row.label),
            checked: notify[row.key],
            disabled,
            onChange: (value: boolean) => {
              setNotifyPref(row.key, value)
            },
          }),
        ),
      ),
    ),
    h(
      SettingsGroup,
      { title: t('group.how') },
      h(
        SettingsRow,
        { label: t('notify.system'), hint: t('notify.systemHint') },
        h(SettingsSwitch, {
          label: t('notify.system'),
          checked: notify.system,
          disabled,
          onChange: (value: boolean) => {
            setNotifyPref('system', value)
          },
        }),
      ),
      h(
        SettingsRow,
        { label: t('notify.test'), hint: t(`notify.permission.${permission}`) },
        h(SettingsButton, { variant: 'soft', onClick: sendTest, disabled }, t('notify.testAction')),
        tested ? h('span', { className: 'fh-set-note fh-set-note-ok' }, t('notify.testSent')) : null,
      ),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const taskNotifySettings: SettingsItemDescriptor = {
  id: 'task-notify',
  order: 30,
  locale: { ns: TASK_NOTIFY_NS, dicts: { zh, en } },
  component: TaskNotifySettings,
  icon: SettingsBellIcon,
  tone: 'red',
}
