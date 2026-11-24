/**
 * 「功能集」设置页壳。
 *
 * 这里**不包含任何功能的偏好或控件**：每个功能在自己的
 * `features/<id>/settings.ts` 里提供面板组件与文案，`main.ts` 通过
 * `SETTINGS` 清单收集、排序后注入本页；页面壳只负责页头、标签页（一个功能
 * 一个标签）、卡片框架、统一的 `.fh-set-*` 样式契约与页脚。
 *
 * 为什么用标签页而不是把四张卡片一路排下去：四个功能的设置加起来有二十来行，
 * 竖着排要滚很久，标签页让「一次只看一个功能」，页头与页脚始终可见；标签本身
 * 带彩色图标，四类功能一眼可辨。功能数只有一个时不渲染标签栏，直接显示卡片标题。
 *
 * 卡片外观的分工：
 *   - 页面壳给出标签、图标底座、标题层级与强调色（`data-tone` → `--fh-set-accent`）；
 *   - 功能描述对象只交出 `icon`、`tone` 与面板组件，不写样式；
 *   - 控件（开关/步进器/滑杆/按钮）由 `lib/settings-controls.tsx` 统一渲染。
 *
 * 加一个功能的设置 = 在该功能目录写 `settings.ts` + 在 `main.ts` 的
 * `SETTINGS` 里加一行；停用功能时整个标签一起消失。
 */

import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react'
import type { FeatureTone } from '../../types'

const { useRef, useState } = React

/** 设置页的字典命名空间（只放页面级文案）。 */
export const SETTINGS_NS = 'feature-hub.settings'

/**
 * 上次停留的标签在 localStorage 里的键。
 *
 * 这是纯 UI 记忆（下次打开设置回到同一页），不属于任何功能偏好，
 * 所以留在设置页壳里，不写进功能的 `preferences.ts`。
 */
const ACTIVE_TAB_KEY = 'dsh-feature-hub.settings.active-tab'

/** 页面壳从 `main.ts` 拿到的面板条目。 */
interface SettingsPanelItem {
  /** 面板 id，用作 React key、标签 id 与排序去重。 */
  readonly id: string
  /** 卡片顺序（升序）。 */
  readonly order: number
  /** 功能自己的面板组件，只渲染设置行。 */
  readonly component: (props: FeatureSettingsProps) => unknown
  /** 与该功能命名空间相同的翻译函数。 */
  readonly t: Translate
  /** 标签与图标的图标；缺省时标签只有文字。 */
  readonly icon?: (props: { readonly size?: number }) => unknown
  /** 该功能的强调色。 */
  readonly tone?: FeatureTone
}

/** 页面壳收到的 props。 */
interface FeatureHubSettingsProps extends SettingsSectionProps {
  /** 各功能贡献的面板；缺省时只渲染页脚。 */
  readonly panels?: readonly SettingsPanelItem[]
}

/**
 * 读取上次停留的标签 id。
 * @returns 标签 id；没存过、存的是空串或存储不可用时返回 null（回到第一个标签）。
 */
function readActiveTab(): string | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_TAB_KEY)
    return raw === null || raw === '' ? null : raw
  } catch (_error) {
    return null
  }
}

/**
 * 记住当前标签，下次打开设置页回到同一页。
 * @param id 标签 id。
 */
function writeActiveTab(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_TAB_KEY, id)
  } catch (_error) {
    // 存储失败只影响下次打开时的记忆，不影响本次切换。
  }
}

/**
 * 设置入口与页头的图标：四枚圆角色块排成方阵，取「功能集」之意。
 *
 * 四个颜色分别对应四个功能（藤黄 / 朱砂 / 竹青 / 石青）。刻意做成彩色：
 * 设置导航里其余图标都是单色线稿，这一枚让「功能集」一眼可辨。
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
      viewBox: '0 0 24 24',
      'aria-hidden': true,
      focusable: false,
      fill: 'none',
    },
    h('rect', { x: 3, y: 3, width: 8.2, height: 8.2, rx: 2.4, fill: 'var(--fh-tone-gold)' }),
    h('rect', { x: 12.8, y: 3, width: 8.2, height: 8.2, rx: 2.4, fill: 'var(--fh-tone-red)' }),
    h('rect', { x: 3, y: 12.8, width: 8.2, height: 8.2, rx: 2.4, fill: 'var(--fh-tone-green)' }),
    h('rect', { x: 12.8, y: 12.8, width: 8.2, height: 8.2, rx: 2.4, fill: 'var(--fh-tone-blue)' }),
  )
}

/**
 * 功能集设置页：页头 + 标签栏 + 当前功能的卡片 + 页脚。
 * @param props 页面壳 props（本页翻译函数 + 注入的功能面板）。
 * @returns 设置页元素。
 */
export function FeatureHubSettings(props: FeatureHubSettingsProps): ReactElement {
  const { t, panels } = props
  const ordered = (panels ?? [])
    .filter((panel) => panel !== undefined && panel !== null)
    .slice()
    .sort((left, right) => (left.order || 0) - (right.order || 0))
  const [activeId, setActiveId] = useState<string | null>(readActiveTab)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  // 只有一个功能时没有「切换」可言，标签栏直接不渲染，标题退回卡片里。
  const showTabs = ordered.length > 1
  // 记住的标签可能已随功能停用而消失，这时退回第一个，不做额外写入。
  const activePanel = ordered.find((panel) => panel.id === activeId) ?? ordered[0]

  /**
   * 选中一个标签：立即生效并记住，下次打开设置页回到同一页。
   * @param id 标签 id。
   */
  const selectTab = (id: string): void => {
    setActiveId(id)
    writeActiveTab(id)
  }

  /**
   * 标签的键盘导航：左右箭头循环切换、Home / End 跳到首尾，选中即跟随焦点。
   * @param event 键盘事件。
   * @param index 触发事件的那个标签的下标。
   */
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex = -1
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % ordered.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + ordered.length) % ordered.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = ordered.length - 1
    if (nextIndex < 0) return
    event.preventDefault()
    const next = ordered[nextIndex]
    if (next === undefined) return
    selectTab(next.id)
    const element = tabRefs.current[nextIndex]
    if (element !== undefined && element !== null) element.focus()
  }

  return h(
    'section',
    { className: 'fh-set' },
    h(
      'header',
      { className: 'fh-set-hero' },
      h('span', { className: 'fh-set-hero-mark' }, h(FeatureHubSettingsIcon, { size: 22 })),
      h(
        'div',
        { className: 'fh-set-hero-text' },
        h('h2', { className: 'fh-set-hero-title' }, t('title')),
        h('p', { className: 'fh-set-hero-desc' }, t('subtitle')),
      ),
      h('span', { className: 'fh-set-hero-count' }, t('count', { n: String(ordered.length) })),
    ),
    showTabs
      ? h(
          'div',
          { className: 'fh-set-tabs', role: 'tablist', 'aria-label': t('tabs.label') },
          ordered.map((panel, index) => {
            const selected = panel === activePanel
            return h(
              'button',
              {
                key: panel.id,
                ref: (element: HTMLButtonElement | null) => {
                  tabRefs.current[index] = element
                },
                type: 'button',
                role: 'tab',
                id: `fh-set-tab-${panel.id}`,
                className: 'fh-set-tab',
                title: panel.t('settings.title'),
                'data-tone': panel.tone ?? 'blue',
                'data-active': selected ? 'true' : 'false',
                'aria-selected': selected,
                'aria-controls': `fh-set-panel-${panel.id}`,
                tabIndex: selected ? 0 : -1,
                onClick: () => {
                  selectTab(panel.id)
                },
                onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  onTabKeyDown(event, index)
                },
              },
              panel.icon === undefined
                ? null
                : h(
                    'span',
                    { className: 'fh-set-tab-icon' },
                    h(panel.icon as (props: { size?: number }) => ReactElement, { size: 16 }),
                  ),
              h('span', { className: 'fh-set-tab-label' }, panel.t('settings.title')),
            )
          }),
        )
      : null,
    h(
      'div',
      { className: 'fh-set-panels' },
      ordered.map((panel) => {
        const selected = panel === activePanel
        return h(
          'div',
          {
            key: panel.id,
            className: 'fh-set-panel',
            role: showTabs ? 'tabpanel' : 'region',
            id: `fh-set-panel-${panel.id}`,
            'aria-labelledby': showTabs ? `fh-set-tab-${panel.id}` : undefined,
            'aria-label': showTabs ? undefined : panel.t('settings.title'),
            hidden: !selected,
          },
          h(
            'article',
            { className: 'fh-set-card', 'data-tone': panel.tone ?? 'blue' },
            h(
              'div',
              { className: 'fh-set-card-head' },
              showTabs ? null : h('h3', { className: 'fh-set-card-title' }, panel.t('settings.title')),
              h('p', { className: 'fh-set-card-desc' }, panel.t('settings.description')),
            ),
            h(
              'div',
              { className: 'fh-set-card-body' },
              h(panel.component as (props: FeatureSettingsProps) => ReactElement | null, { t: panel.t }),
            ),
          ),
        )
      }),
    ),
    h(
      'p',
      { className: 'fh-set-foot' },
      h('span', { className: 'fh-set-foot-dot', 'aria-hidden': true }),
      t('saved.auto'),
    ),
  )
}

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
