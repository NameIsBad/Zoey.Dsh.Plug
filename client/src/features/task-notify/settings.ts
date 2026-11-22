/**
 * 「任务提醒」的设置面板：总开关、三类提醒开关、系统通知开关与测试按钮。
 *
 * 面板只渲染设置行，卡片框架由「功能集」页壳统一包住；偏好、投递封装与
 * 文案都在本功能目录内，删掉这个功能时整块设置一起消失。
 */

import {
  desktopNotifyPermission,
  postDesktopNotice,
  requestDesktopNotifyPermission,
  type DesktopNotifyPermission,
} from './desktop-notify'
import { readNotifyPreferences, writeNotifyPreferences, type NotifyPreferences } from './preferences'
import { TASK_NOTIFY_NS } from './index'
import { en, zh } from './locale'
import type { ReactElement } from 'react'

const { useState } = React

/** 一行「文案在左、开关在右」的偏好行。 */
interface NotifyToggleRowProps {
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
function NotifyToggleRow(props: NotifyToggleRowProps): ReactElement {
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

/**
 * 任务提醒的设置行。
 * @param props 本功能的翻译函数。
 * @returns 总开关 + 三类提醒 + 系统通知 + 测试按钮。
 */
export function TaskNotifySettings(props: FeatureSettingsProps): ReactElement {
  const { t } = props
  const [notify, setNotify] = useState<NotifyPreferences>(readNotifyPreferences)
  const [permission, setPermission] = useState<DesktopNotifyPermission>(desktopNotifyPermission)
  const [tested, setTested] = useState(false)

  /** 改写一个提醒开关；整体写回，保证存储里是一份完整偏好。 */
  const setNotifyPref = (key: keyof NotifyPreferences, value: boolean): void => {
    const next: NotifyPreferences = { ...notify, [key]: value }
    setNotify(writeNotifyPreferences(next))
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
      setTested(
        await postDesktopNotice({
          title: t('notify.testTitle'),
          body: t('notify.testBody'),
          tag: 'feature-hub:test',
        }),
      )
    })()
  }

  return h(
    React.Fragment,
    null,
    h(NotifyToggleRow, {
      key: 'notify.enabled',
      label: t('notify.enabled'),
      hint: t('notify.enabledHint'),
      checked: notify.enabled,
      onChange: (value: boolean) => {
        setNotifyPref('enabled', value)
      },
    }),
    h(NotifyToggleRow, {
      key: 'notify.completed',
      label: t('notify.completed'),
      hint: t('notify.completedHint'),
      checked: notify.completed,
      disabled: !notify.enabled,
      onChange: (value: boolean) => {
        setNotifyPref('completed', value)
      },
    }),
    h(NotifyToggleRow, {
      key: 'notify.failed',
      label: t('notify.failed'),
      hint: t('notify.failedHint'),
      checked: notify.failed,
      disabled: !notify.enabled,
      onChange: (value: boolean) => {
        setNotifyPref('failed', value)
      },
    }),
    h(NotifyToggleRow, {
      key: 'notify.asked',
      label: t('notify.asked'),
      hint: t('notify.askedHint'),
      checked: notify.asked,
      disabled: !notify.enabled,
      onChange: (value: boolean) => {
        setNotifyPref('asked', value)
      },
    }),
    h(NotifyToggleRow, {
      key: 'notify.system',
      label: t('notify.system'),
      hint: t('notify.systemHint'),
      checked: notify.system,
      disabled: !notify.enabled,
      onChange: (value: boolean) => {
        setNotifyPref('system', value)
      },
    }),
    h(
      'div',
      { className: 'fh-set-row' },
      h(
        'div',
        { className: 'fh-set-text' },
        h('span', { className: 'fh-set-label' }, t('notify.test')),
        h('span', { className: 'fh-set-help' }, t(`notify.permission.${permission}`)),
      ),
      h(
        'div',
        { className: 'fh-set-control' },
        h(
          'button',
          { type: 'button', className: 'fh-set-button', onClick: sendTest },
          t('notify.testAction'),
        ),
        tested ? h('span', { className: 'fh-set-help' }, t('notify.testSent')) : null,
      ),
    ),
  )
}

/** 供 `main.ts` 的 SETTINGS 清单登记。 */
export const taskNotifySettings = {
  id: 'task-notify',
  order: 30,
  locale: { ns: TASK_NOTIFY_NS, dicts: { zh, en } },
  component: TaskNotifySettings,
}
