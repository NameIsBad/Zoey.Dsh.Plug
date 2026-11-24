/**
 * 「功能集」设置页的通用控件：开关、步进器、滑杆、按钮、设置行与分组。
 *
 * 为什么放在 `lib/`：最近任务、压缩上下文、用量状态条、任务提醒四个功能的设置
 * 面板都要用同一套控件与交互，写在各自的 `settings.ts` 里会复制四遍，外观也会
 * 慢慢走样。页面壳（`features/settings`）只提供 `.fh-set-*` 样式契约与卡片框架，
 * 控件结构与无障碍语义由这里统一给出。
 *
 * 边界：只依赖 React 全局与 `.fh-set-*` 类名；不读偏好、不写存储。
 * 每个控件都是受控组件：值由功能面板持有，改动通过回调交回去。
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react'

const { useEffect, useState } = React

/** 一行设置：左侧标题与说明，右侧控件。 */
export interface SettingsRowProps {
  /** 主文案。 */
  readonly label: string
  /** 说明文案；缺省时不占第二行。 */
  readonly hint?: string
  /** 右侧控件。 */
  readonly children?: ReactNode
  /** 让整行显得更重要（用于各功能的总开关）。 */
  readonly hero?: boolean
}

/**
 * 渲染一行设置。
 * @param props 文案、说明与右侧控件。
 * @returns 设置行元素。
 */
export function SettingsRow(props: SettingsRowProps): ReactElement {
  return (
    <div className={`fh-set-row${props.hero === true ? ' fh-set-row-hero' : ''}`}>
      <div className="fh-set-text">
        <span className="fh-set-label">{props.label}</span>
        {props.hint === undefined ? null : <span className="fh-set-help">{props.hint}</span>}
      </div>
      {props.children === undefined ? null : <div className="fh-set-control">{props.children}</div>}
    </div>
  )
}

/** 一组设置：一行小标题 + 若干设置行。 */
export interface SettingsGroupProps {
  /** 分组标题（例如「提醒时机」）。 */
  readonly title: string
  /** 组内内容。 */
  readonly children?: ReactNode
}

/**
 * 渲染一组设置。
 * @param props 分组标题与内容。
 * @returns 分组容器。
 */
export function SettingsGroup(props: SettingsGroupProps): ReactElement {
  return (
    <div className="fh-set-group">
      <div className="fh-set-group-title">{props.title}</div>
      {props.children}
    </div>
  )
}

/** 开关入参。 */
export interface SettingsSwitchProps {
  /** 是否打开。 */
  readonly checked: boolean
  /** 无障碍标签（通常就是左侧标题）。 */
  readonly label: string
  /** 总开关关闭时禁用子项。 */
  readonly disabled?: boolean
  /** 用户切换后调用。 */
  readonly onChange: (checked: boolean) => void
}

/**
 * 开关：与宿主设置页同形的 38×22 胶囊，打开时用卡片强调色填充。
 *
 * 用 `role="switch"` 的按钮而不是原生 checkbox：原生复选框在不同平台的
 * 外形差异很大，和设置页的圆角卡片不搭；按钮天然支持空格/回车。
 * @param props 当前值、标签与切换回调。
 * @returns 开关元素。
 */
export function SettingsSwitch(props: SettingsSwitchProps): ReactElement {
  // 禁用只改变可交互性与透明度，仍然显示真实开关状态：
  // 否则「总开关关闭时」子项会看起来全是关的，重新打开会莫名其妙跳成开。
  const checked = props.checked
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={props.label}
      className="fh-set-switch"
      data-on={checked}
      disabled={props.disabled === true}
      onClick={() => {
        props.onChange(!props.checked)
      }}
    >
      <span className="fh-set-switch-thumb" aria-hidden />
    </button>
  )
}

/** 步进器入参。 */
export interface SettingsStepperProps {
  /** 当前值。 */
  readonly value: number
  /** 合法下界。 */
  readonly min: number
  /** 合法上界。 */
  readonly max: number
  /** 步长；缺省 1。 */
  readonly step?: number
  /** 数字后的单位（例如「条」）。 */
  readonly unit?: string
  /** 无障碍标签。 */
  readonly label: string
  /** 值变化后调用；值已被夹进合法区间。 */
  readonly onChange: (value: number) => void
}

/**
 * 把候选值夹进整数区间。
 * @param value 候选值。
 * @param min 下界。
 * @param max 上界。
 * @returns 区间内的整数。
 */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * 数字步进器：减号 / 输入框 / 加号 / 单位。
 *
 * 输入框只在失焦或回车时提交：边输边夹紧会把「3」立刻变成下界，
 * 用户没法输入「30」。加减按钮则立即提交，方便鼠标快速调整。
 * @param props 值、范围、单位与回调。
 * @returns 步进器元素。
 */
export function SettingsStepper(props: SettingsStepperProps): ReactElement {
  const step = props.step ?? 1
  const [text, setText] = useState(String(props.value))

  // 外部值（恢复默认、滑杆联动）变化时把输入框对齐过去。
  useEffect(() => {
    setText(String(props.value))
  }, [props.value])

  /** 把输入框文本解析并提交；空值或非法值回到当前生效值。 */
  const commit = (): void => {
    const parsed = Number(text.trim())
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setText(String(props.value))
      return
    }
    const next = clampInt(parsed, props.min, props.max)
    setText(String(next))
    if (next !== props.value) props.onChange(next)
  }

  /** 按步长调整并立即提交。 */
  const nudge = (delta: number): void => {
    const next = clampInt(props.value + delta, props.min, props.max)
    if (next === props.value) return
    setText(String(next))
    props.onChange(next)
  }

  return (
    <div className="fh-set-stepper" role="group" aria-label={props.label}>
      <button
        type="button"
        className="fh-set-stepper-btn"
        aria-label={`${props.label} -`}
        disabled={props.value <= props.min}
        onClick={() => {
          nudge(-step)
        }}
      >
        −
      </button>
      <input
        className="fh-set-stepper-input"
        type="text"
        inputMode="numeric"
        aria-label={props.label}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
            event.currentTarget.blur()
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            nudge(step)
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            nudge(-step)
          }
        }}
      />
      {props.unit === undefined ? null : <span className="fh-set-stepper-unit">{props.unit}</span>}
      <button
        type="button"
        className="fh-set-stepper-btn"
        aria-label={`${props.label} +`}
        disabled={props.value >= props.max}
        onClick={() => {
          nudge(step)
        }}
      >
        +
      </button>
    </div>
  )
}

/** 滑杆入参。 */
export interface SettingsSliderProps {
  /** 当前值。 */
  readonly value: number
  /** 合法下界。 */
  readonly min: number
  /** 合法上界。 */
  readonly max: number
  /** 步长；缺省 1。 */
  readonly step?: number
  /** 无障碍标签。 */
  readonly label: string
  /** 值后缀（例如「%」）。 */
  readonly suffix?: string
  /** 拖动时调用。 */
  readonly onChange: (value: number) => void
}

/**
 * 百分比滑杆：彩色已填充轨道 + 右侧数值。
 *
 * 用 `--fh-pct` 把已填充比例交给 CSS 渐变，避免为了进度条再套一层 DOM；
 * 原生 range 的键盘交互（方向键、Home/End）保留。
 * @param props 值、范围、后缀与回调。
 * @returns 滑杆元素。
 */
export function SettingsSlider(props: SettingsSliderProps): ReactElement {
  const span = props.max - props.min
  const percent = span <= 0 ? 0 : Math.min(100, Math.max(0, ((props.value - props.min) / span) * 100))
  const style = { '--fh-pct': `${percent}%` } as CSSProperties
  return (
    <div className="fh-set-slider">
      <input
        className="fh-set-range"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        aria-label={props.label}
        style={style}
        onChange={(event) => {
          props.onChange(Number(event.currentTarget.value))
        }}
      />
      <span className="fh-set-range-value">
        {props.value}
        {props.suffix ?? ''}
      </span>
    </div>
  )
}

/** 预设值小胶囊入参。 */
export interface SettingsPresetsProps {
  /** 候选值。 */
  readonly options: readonly number[]
  /** 当前值；与某个候选相等时该胶囊高亮。 */
  readonly value: number
  /** 无障碍标签前缀。 */
  readonly label: string
  /** 值后缀（例如「%」）。 */
  readonly suffix?: string
  /** 点选后调用。 */
  readonly onChange: (value: number) => void
}

/**
 * 常用值快捷胶囊：滑杆旁边给出 30 / 50 / 70 这类一键选择。
 * @param props 候选值、当前值与回调。
 * @returns 胶囊组。
 */
export function SettingsPresets(props: SettingsPresetsProps): ReactElement {
  return (
    <div className="fh-set-presets" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          className="fh-set-preset"
          data-active={option === props.value}
          aria-pressed={option === props.value}
          onClick={() => {
            props.onChange(option)
          }}
        >
          {option}
          {props.suffix ?? ''}
        </button>
      ))}
    </div>
  )
}

/** 按钮入参。 */
export interface SettingsButtonProps {
  /** 按钮文案。 */
  readonly children?: ReactNode
  /** 点击回调。 */
  readonly onClick: () => void
  /** 视觉变体；缺省 ghost。soft 用强调色淡底，danger 用错误色描边。 */
  readonly variant?: 'ghost' | 'soft' | 'danger'
  /** 是否禁用。 */
  readonly disabled?: boolean
  /** 悬停提示。 */
  readonly title?: string
}

/**
 * 设置页按钮：与宿主的圆角、字号一致，soft 变体取当前卡片的强调色。
 * @param props 文案、回调与变体。
 * @returns 按钮元素。
 */
export function SettingsButton(props: SettingsButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={`fh-set-button${props.variant === undefined || props.variant === 'ghost' ? '' : ` fh-set-button-${props.variant}`}`}
      disabled={props.disabled === true}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}
