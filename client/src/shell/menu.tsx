import type * as ReactTypes from 'react'
/**
 * 侧边栏里的下拉菜单：视图选项菜单、工作区行菜单都用它。
 *
 * 为什么用 `popover`：侧边栏区头与列表容器都带 `overflow: hidden`，
 * 普通绝对定位的弹层会被裁掉；`popover` 走浏览器顶层（top layer），
 * 不受祖先裁剪与层叠上下文影响，而且自带「点外部关闭 / Esc 关闭」。
 * 仓库约束也不能用 `react-dom` 的 portal，所以这是唯一干净的做法。
 *
 * 两个入口共享同一套样式与键盘导航：
 *   - `Menu`：按钮 + 弹层，弹层贴在按钮下方（区头用）；
 *   - `PointMenu`：没有触发器，按调用方给的视口坐标弹出（右键 / Shift+F10 用）。
 *
 * 样式约定（踩过的坑）：`display` 只能写在 `:popover-open` 上，
 * 给裸 `[popover]` 写 `display: flex` 会盖掉浏览器给的 `display: none`，
 * 关闭状态下弹层会当成普通元素渲染在页面里。
 */

import { IconClose } from './icons'

/** 菜单项：分组标题、分隔线、或可执行项。 */
export type MenuItem =
  | { readonly kind: 'label'; readonly id: string; readonly text: string }
  | { readonly kind: 'separator'; readonly id: string }
  | {
      readonly kind: 'item'
      readonly id: string
      /** 本地化文案。 */
      readonly label: string
      /** 前置图标。 */
      readonly icon?: ReactTypes.ReactNode
      /** 是否是当前选中项。 */
      readonly selected?: boolean
      /** 危险操作（删除）用警示色。 */
      readonly danger?: boolean
      /** 置灰不可点。 */
      readonly disabled?: boolean
    }

/**
 * 菜单容器的键盘导航：上下移动、Home/End。
 * @param event 菜单容器上的键盘事件。
 */
function moveFocus(event: ReactTypes.KeyboardEvent<HTMLDivElement>): void {
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])'),
  )
  if (buttons.length === 0) return
  const active = document.activeElement
  const index = buttons.findIndex((button) => button === active)
  const focusAt = (next: number): void => {
    const wrapped = ((next % buttons.length) + buttons.length) % buttons.length
    buttons[wrapped]?.focus()
  }
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusAt(index === -1 ? 0 : index + 1)
      return
    case 'ArrowUp':
      event.preventDefault()
      focusAt(index === -1 ? buttons.length - 1 : index - 1)
      return
    case 'Home':
      event.preventDefault()
      focusAt(0)
      return
    case 'End':
      event.preventDefault()
      focusAt(buttons.length - 1)
      return
    default:
      return
  }
}

/**
 * 渲染菜单项列表（两个入口共用）。
 * @param props 菜单项与选中回调。
 * @returns 菜单项节点。
 */
function MenuItems(props: {
  readonly items: readonly MenuItem[]
  readonly onPick: (id: string) => void
}): ReactTypes.JSX.Element {
  return (
    <>
      {props.items.map((item) => {
        if (item.kind === 'separator') return <div key={item.id} className="fh-menu-sep" role="separator" />
        if (item.kind === 'label') {
          return (
            <div key={item.id} className="fh-menu-label" role="presentation">
              {item.text}
            </div>
          )
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={[
              'fh-menu-item',
              item.selected === true ? 'fh-menu-item-selected' : '',
              item.danger === true ? 'fh-menu-item-danger' : '',
            ]
              .filter((part) => part !== '')
              .join(' ')}
            disabled={item.disabled === true}
            onClick={() => {
              props.onPick(item.id)
            }}
          >
            <span className="fh-menu-item-icon">{item.icon ?? null}</span>
            <span className="fh-menu-item-label">{item.label}</span>
          </button>
        )
      })}
    </>
  )
}

/** 菜单组件的入参。 */
export interface MenuProps {
  /** 触发按钮的无障碍标签（同时作为 tooltip）。 */
  readonly label: string
  /** 触发按钮里的图标。 */
  readonly icon: ReactTypes.ReactNode
  /** 触发按钮类名。 */
  readonly className?: string
  /** 菜单项。 */
  readonly items: readonly MenuItem[]
  /** 选中一项后的回调（菜单会自行关闭）。 */
  readonly onSelect: (id: string) => void
  /** 菜单对齐触发按钮的方式。 */
  readonly align?: 'start' | 'end'
}

/**
 * 一个「按钮 + popover 菜单」组合。
 * @param props 触发按钮外观、菜单项与选择回调。
 * @returns 触发按钮与它的弹层。
 */
export function Menu(props: MenuProps): ReactTypes.JSX.Element {
  const id = `fh-menu-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null)

  /**
   * 弹层打开时按触发按钮的包围盒定位（右下或左下角）。
   * 用 `position: fixed` + 视口坐标，滚动时菜单会留在原地——这正是
   * 原生下拉的行为（点外部即关）。
   */
  const place = (): void => {
    const box = trigger.current?.getBoundingClientRect()
    if (box === undefined) return
    setPosition({
      left: props.align === 'end' ? box.right : box.left,
      top: box.bottom + 4,
    })
  }

  /** 选中一项：先收起弹层再交给调用方。 */
  const pick = (itemId: string): void => {
    const popover = document.getElementById(id)
    if (popover instanceof HTMLElement && popover.matches(':popover-open')) popover.hidePopover()
    props.onSelect(itemId)
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={props.className}
        title={props.label}
        aria-label={props.label}
        aria-haspopup="menu"
        popoverTarget={id}
        onClick={() => {
          place()
        }}
      >
        {props.icon}
      </button>
      <div
        id={id}
        popover="auto"
        role="menu"
        aria-label={props.label}
        className="fh-menu"
        style={position === null ? undefined : { left: position.left, top: position.top }}
        onToggle={(event) => {
          // 浏览器处理打开/关闭；打开时再按当前包围盒校正一次位置。
          if ((event.nativeEvent as ToggleEvent).newState === 'open') place()
        }}
        onKeyDown={moveFocus}
      >
        <MenuItems items={props.items} onPick={pick} />
      </div>
    </>
  )
}

/** 按视口坐标弹出的菜单入参。 */
export interface PointMenuProps {
  /** 是否打开。 */
  readonly open: boolean
  /** 打开位置（视口坐标）；`open` 为 true 时不能是 null。 */
  readonly point: { readonly x: number; readonly y: number } | null
  /** 无障碍标签。 */
  readonly label: string
  /** 菜单项。 */
  readonly items: readonly MenuItem[]
  /** 选中一项后的回调（菜单会自行关闭）。 */
  readonly onSelect: (id: string) => void
  /** 关闭回调：点外部、Esc、选中一项都会走到这里。 */
  readonly onClose: () => void
}

/**
 * 按视口坐标弹出的菜单（右键、Shift+F10 的入口）。
 *
 * 触发器不是按钮，所以定位完全由 `point` 决定：先把左上角摆在点上，
 * 再夹进视口。打开/关闭都由 `popover` 负责，`onToggle` 把关闭事件回传给
 * 调用方，保证「点外部 / Esc」也能同步状态。
 *
 * @param props 开关、坐标、菜单项与回调。
 * @returns 常驻挂载的弹层元素。
 */
export function PointMenu(props: PointMenuProps): ReactTypes.JSX.Element {
  const id = `fh-menu-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const panel = React.useRef<HTMLDivElement | null>(null)
  const returnFocus = React.useRef<HTMLElement | null>(null)

  /** 选中一项：收起弹层并把选择交出去。 */
  const pick = (itemId: string): void => {
    const element = panel.current
    if (element !== null && element.matches(':popover-open')) element.hidePopover()
    props.onSelect(itemId)
  }

  React.useEffect(() => {
    const element = panel.current
    if (element === null) return
    const isOpen = element.matches(':popover-open')
    const point = props.point
    if (!props.open || point === null) {
      if (isOpen) element.hidePopover()
      return
    }
    if (!isOpen) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      // 先按原点显示，量到真实尺寸后再夹进视口：同一帧内完成，不会闪。
      element.style.left = '0px'
      element.style.top = '0px'
      element.showPopover()
    }
    const box = element.getBoundingClientRect()
    const left = Math.max(8, Math.min(point.x, window.innerWidth - box.width - 8))
    const top = Math.max(8, Math.min(point.y, window.innerHeight - box.height - 8))
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    const first = element.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    first?.focus({ preventScroll: true })
  }, [props.open, props.point])

  return (
    <div
      ref={panel}
      id={id}
      popover="auto"
      role="menu"
      aria-label={props.label}
      className="fh-menu"
      onToggle={(event) => {
        if ((event.nativeEvent as ToggleEvent).newState !== 'closed') return
        // 关闭后把焦点还给打开菜单的那一行，键盘用户不丢位置。
        returnFocus.current?.focus({ preventScroll: true })
        props.onClose()
      }}
      onKeyDown={moveFocus}
    >
      <MenuItems items={props.items} onPick={pick} />
    </div>
  )
}

/** 行尾「…」按钮里用的省略号图标（与图标集同一套 Lucide 几何）。 */
export function IconMore(): ReactTypes.JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden focusable={false} fill="currentColor">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}

/** 目录选择对话框里用的关闭图标（复用通用叉号，单独导出便于按语义引用）。 */
export const CloseGlyph = IconClose
