/**
 * 本插件的「设置 → 功能集」页面壳（总控的渲染端）。
 *
 * 这里**不包含任何功能的偏好或控件**：每个功能在自己的
 * `features/<id>/settings.ts` 里提供面板组件与文案，`main.ts` 通过
 * `SETTINGS` 清单收集、排序后注入本页；页面壳只负责卡片框架、
 * 统一的 `.fh-set-*` 样式契约与页脚。
 *
 * 加一个功能的设置 = 在该功能目录写 `settings.ts` + 在 `main.ts` 的
 * `SETTINGS` 里加一行；停用功能时整块卡片随之消失。
 */

import type { ReactElement } from 'react'

/** 设置页的字典命名空间（只放页面级文案）。 */
export const SETTINGS_NS = 'feature-hub.settings'

/** 页面壳从 `main.ts` 拿到的面板条目。 */
interface SettingsPanelItem {
  /** 面板 id，用作 React key 与排序去重。 */
  readonly id: string
  /** 卡片顺序（升序）。 */
  readonly order: number
  /** 功能自己的面板组件，只渲染设置行。 */
  readonly component: (props: FeatureSettingsProps) => unknown
  /** 与该功能命名空间相同的翻译函数。 */
  readonly t: Translate
}

/** 页面壳收到的 props。 */
interface FeatureHubSettingsProps extends SettingsSectionProps {
  /** 各功能贡献的面板；缺省时只渲染页脚。 */
  readonly panels?: readonly SettingsPanelItem[]
}

/**
 * 设置入口的导航图标：与侧边栏「最近任务」同款的时钟，方便和它配置的功能对上。
 * @param props 外壳给的尺寸。
 * @returns 内联 SVG。
 */
export function FeatureHubSettingsIcon(props: { size?: number }): ReactElement {
  const size = Number(props.size) || 16
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
    },
    h('path', { d: 'M13.2 8 A5.2 5.2 0 1 1 11.6 4.3' }),
    h('path', { d: 'M8 5.2 V8 L10 9.1' }),
  )
}

/**
 * 功能集设置页：把各功能的面板排成卡片。
 * @param props 页面壳 props（本页翻译函数 + 注入的功能面板）。
 * @returns 设置页元素。
 */
export function FeatureHubSettings(props: FeatureHubSettingsProps): ReactElement {
  const { t, panels } = props
  const ordered = (panels ?? [])
    .filter((panel) => panel !== undefined && panel !== null)
    .slice()
    .sort((left, right) => (left.order || 0) - (right.order || 0))
  return h(
    'section',
    { className: 'fh-set' },
    ordered.map((panel) =>
      h(
        'div',
        { key: panel.id, className: 'fh-set-card' },
        h(
          'div',
          { className: 'fh-set-card-head' },
          h('h3', { className: 'fh-set-card-title' }, panel.t('settings.title')),
          h('p', { className: 'fh-set-card-desc' }, panel.t('settings.description')),
        ),
        h(panel.component as (props: FeatureSettingsProps) => ReactElement | null, { t: panel.t }),
      ),
    ),
    h('p', { className: 'fh-set-foot' }, t('saved.auto')),
  )
}

/** 中文文案。 */
import { styles } from './styles'
import { en, zh } from './locale'

export const featureHubSettings = {
  id: 'feature-hub',
  order: 60,
  locale: { ns: SETTINGS_NS, dicts: { zh, en } },
  styles,
  component: FeatureHubSettings,
  icon: FeatureHubSettingsIcon,
}
