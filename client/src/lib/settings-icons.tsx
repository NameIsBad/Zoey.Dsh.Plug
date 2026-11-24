/**
 * 「功能集」设置页各卡片用的小图标。
 *
 * 统一 24 网格、1.8 描边、圆头圆角（与侧边栏的 Lucide 形制一致），颜色走
 * `currentColor`——卡片上的 `data-tone` 会把 `--fh-set-accent` 设成对应国风色，
 * 图标因此自动带上颜色，不需要每个图标单独传色值。
 *
 * 边界：纯展示 SVG，不读数据、不带状态；只有设置页壳与各功能的设置面板引用。
 */

import type { ReactElement, ReactNode } from 'react'

/** 图标公共入参。 */
export interface SettingsIconProps {
  /** 边长（像素）；缺省 16。 */
  readonly size?: number
}

/** 描边图标的公共外壳。 */
function Glyph(props: SettingsIconProps & { readonly children: ReactNode }): ReactElement {
  const size = props.size ?? 16
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable={false}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  )
}

/** 时钟：最近任务。 */
export function SettingsClockIcon(props: SettingsIconProps): ReactElement {
  return (
    <Glyph {...props}>
      <circle cx={12} cy={12} r={8.4} />
      <path d="M12 7.4v5l3.2 1.9" />
      <path d="M12 3.6v1.2M20.4 12h-1.2M12 20.4v-1.2M3.6 12h1.2" opacity={0.55} />
    </Glyph>
  )
}

/** 相向箭头夹住中线：压缩上下文。 */
export function SettingsCompressIcon(props: SettingsIconProps): ReactElement {
  return (
    <Glyph {...props}>
      <path d="M10.4 12H3.6" />
      <path d="m6.4 8.8-3.2 3.2 3.2 3.2" />
      <path d="M13.6 12h6.8" />
      <path d="m17.6 8.8 3.2 3.2-3.2 3.2" />
      <path d="M12 4.6v3.2M12 16.2v3.2" opacity={0.55} />
    </Glyph>
  )
}

/** 仪表盘：用量状态条。 */
export function SettingsGaugeIcon(props: SettingsIconProps): ReactElement {
  return (
    <Glyph {...props}>
      <path d="M4 17.4a9 9 0 1 1 16 0" />
      <path d="m12 13.4 4.2-4.2" />
      <circle cx={12} cy={14.2} r={1.3} fill="currentColor" stroke="none" />
      <path d="M5.4 20.2h13.2" opacity={0.55} />
    </Glyph>
  )
}

/** 铃铛：任务提醒。 */
export function SettingsBellIcon(props: SettingsIconProps): ReactElement {
  return (
    <Glyph {...props}>
      <path d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0c0 3.4 1.2 4.8 1.8 5.5.4.4.1 1.1-.4 1.1H5c-.5 0-.8-.7-.4-1.1.6-.7 1.8-2.1 1.8-5.5Z" />
      <path d="M10.2 20.1a2 2 0 0 0 3.6 0" />
      <path d="M12 3.2v1" opacity={0.55} />
    </Glyph>
  )
}
