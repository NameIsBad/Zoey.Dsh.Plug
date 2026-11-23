import type * as ReactTypes from 'react'
/**
 * 侧边栏浏览区用到的图标。
 *
 * 统一采用 **Lucide** 的几何（24×24 网格、圆头圆角、均匀 1.8 描边），
 * 这样侧边栏里的放大镜、滑杆、文件夹、消息、归档、垃圾桶等图标观感一致，
 * 也和页面里原生控件的现代线性风格接近。全部是内联 SVG，颜色走
 * `currentColor`，跟随主题文字色，不需要为浅色/深色各写一套。
 *
 * 为什么不能直接依赖图标包：客户端模块表只给 React，运行时 import 任何 npm 包
 * 都会在浏览器里失败；所以这里按 Lucide（ISC 许可）的形状手写路径，
 * 保持 24 网格后由调用方用 `size` 缩到 12/14/16/18。
 */

/** 图标公共入参。 */
export interface IconProps {
  /** 边长（像素）；缺省 16。 */
  readonly size?: number
  /** 额外类名。 */
  readonly className?: string
}

/** 描边图标的公共外壳；`viewBox` 固定 24，保证所有图标几何一致。 */
function Stroke(props: IconProps & { readonly children: ReactTypes.ReactNode }): ReactTypes.JSX.Element {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      className={props.className}
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

/** 实心图标的公共外壳（图钉、省略号这类小记号）。 */
function Solid(props: IconProps & { readonly children: ReactTypes.ReactNode }): ReactTypes.JSX.Element {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      className={props.className}
      aria-hidden
      focusable={false}
      fill="currentColor"
    >
      {props.children}
    </svg>
  )
}

/** 放大镜：打开/表示搜索。 */
export function IconSearch(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <circle cx={11} cy={11} r={7.2} />
      <path d="m20.5 20.5-3.9-3.9" />
    </Stroke>
  )
}

/** 叉号：清除搜索、关闭弹层。 */
export function IconClose(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Stroke>
  )
}

/** 滑杆：视图选项（分组/排序/归档过滤）。 */
export function IconSliders(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <path d="M14 2v4" />
      <path d="M8 10v4" />
      <path d="M16 18v4" />
    </Stroke>
  )
}

/**
 * 展开的文件夹：正面敞开、能看到内层，和合起的文件夹一眼可分。
 *
 * 这是「展开态」的左图标；收起态用 {@link IconFolderClose}。
 */
export function IconFolderOpen(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </Stroke>
  )
}

/** 合起的文件夹。 */
export function IconFolderClose(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Stroke>
  )
}

/** 会话气泡加号：在某个工作区里新建会话。 */
export function IconNewChat(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v6" />
      <path d="M9 10h6" />
    </Stroke>
  )
}

/** 项目加号：添加工作区。 */
export function IconProjectAdd(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </Stroke>
  )
}

/** 归档箱：把会话归档。 */
export function IconArchive(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <rect x={2} y={3} width={20} height={5} rx={1} />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </Stroke>
  )
}

/** 取消归档：归档箱里的内容回到列表。 */
export function IconUnarchive(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <rect x={2} y={3} width={20} height={5} rx={1} />
      <path d="M4 8v11a2 2 0 0 0 2 2h2" />
      <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
      <path d="m9 15 3-3 3 3" />
      <path d="M12 12v9" />
    </Stroke>
  )
}

/** 置顶图钉（实心）。 */
export function IconPinFill(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Solid {...props}>
      <path d="M12 17v5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </Solid>
  )
}

/** 时钟：按最近活动排序。 */
export function IconClock(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3.2 1.9" />
    </Stroke>
  )
}

/** 上下箭头：手动排序。 */
export function IconChevronsUpDown(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </Stroke>
  )
}

/** 行列表：一张扁平列表。 */
export function IconFlatList(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M9 6h12" />
      <path d="M9 12h12" />
      <path d="M9 18h12" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </Stroke>
  )
}

/** 目录树：按目录嵌套。 */
export function IconWorkspaceTree(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M21 12h-9" />
      <path d="M21 6H9" />
      <path d="M21 18h-9" />
      <path d="M3 6v4c0 1.1.9 2 2 2h4" />
      <path d="M3 10v6c0 1.1.9 2 2 2h4" />
    </Stroke>
  )
}

/** 归档可见性：隐藏归档。 */
export function IconArchiveOff(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <rect x={2} y={3} width={20} height={5} rx={1} />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="m9.5 17 5-5" />
      <path d="m9.5 12 5 5" />
    </Stroke>
  )
}

/** 归档可见性：显示全部（含归档）。 */
export function IconQueue(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <rect x={2} y={3} width={20} height={5} rx={1} />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </Stroke>
  )
}

/** 归档可见性：只看归档。 */
export function IconArchiveCheck(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <rect x={2} y={3} width={20} height={5} rx={1} />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="m9 13.5 2 2 4-4" />
    </Stroke>
  )
}

/** 铅笔：重命名工作区。 */
export function IconEdit(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M21.2 6.8a2 2 0 0 0-2.8-2.8L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.3a.5.5 0 0 0 .6.6l4.3-1.3a2 2 0 0 0 .8-.5z" />
      <path d="m15 5 4 4" />
    </Stroke>
  )
}

/** 垃圾桶：删除工作区。 */
export function IconTrash(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Stroke>
  )
}

/** 向上的箭头：目录选择器里回上一层。 */
export function IconArrowUp(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Stroke>
  )
}
