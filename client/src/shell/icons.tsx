import type * as ReactTypes from 'react'
/**
 * 侧边栏浏览区用到的图标。
 *
 * 全部是内联 SVG，`stroke`/`fill` 用 `currentColor`，因此跟随主题文字色，
 * 不需要为浅色/深色各写一套。尺寸默认 14px（行内按钮）或 16px（区头），
 * 调用方可以覆盖。原生用的是 primitives 包的图标组件；这里不能引用那个包，
 * 所以按同样的观感重画，几何尺寸对齐原生（14/16/24px）。
 */

/** 图标公共入参。 */
export interface IconProps {
  /** 边长（像素）；缺省按各自默认值。 */
  readonly size?: number
  /** 额外类名。 */
  readonly className?: string
}

/**
 * 画一个 16 宫格描边图标的公共外壳。
 * @param props 尺寸与类名。
 * @param children 路径节点。
 * @returns 图标元素。
 */
function Stroke(
  props: IconProps & { readonly children: ReactTypes.ReactNode; readonly size?: number },
): ReactTypes.JSX.Element {
  const size = props.size ?? 16
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={props.className}
      aria-hidden
      focusable={false}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  )
}

/** 放大镜：打开/表示搜索。 */
export function IconSearch(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <circle cx={7} cy={7} r={4.2} />
      <path d="M10.2 10.2 L13.4 13.4" />
    </Stroke>
  )
}

/** 叉号：清除搜索、关闭弹层。 */
export function IconClose(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M4 4 L12 12 M12 4 L4 12" />
    </Stroke>
  )
}

/** 两根滑杆：视图选项（分组/排序/归档过滤）。 */
export function IconSliders(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M2.5 5 H13.5 M2.5 11 H13.5" />
      <circle cx={6} cy={5} r={1.6} fill="currentColor" stroke="none" />
      <circle cx={10} cy={11} r={1.6} fill="currentColor" stroke="none" />
    </Stroke>
  )
}

/** 打开的文件夹。 */
export function IconFolderOpen(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 12.2 V4.4 A1 1 0 0 1 2.8 3.4 H6.2 L7.6 4.8 H13.2 A1 1 0 0 1 14.2 5.8 V6.6" />
      <path d="M1.8 12.2 L3.4 7.2 A1 1 0 0 1 4.4 6.5 H14.4 L12.8 12.2 Z" />
    </Stroke>
  )
}

/** 合起的文件夹。 */
export function IconFolderClose(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 4.4 A1 1 0 0 1 2.8 3.4 H6.2 L7.6 4.8 H13.2 A1 1 0 0 1 14.2 5.8 V11.4 A1 1 0 0 1 13.2 12.4 H2.8 A1 1 0 0 1 1.8 11.4 Z" />
    </Stroke>
  )
}

/** 右向三角：分组折叠指示（展开时转 90°）。 */
export function IconTriangleRight(props: IconProps): ReactTypes.JSX.Element {
  return (
    <svg
      width={props.size ?? 8}
      height={props.size ?? 8}
      viewBox="0 0 8 8"
      className={props.className}
      aria-hidden
      focusable={false}
    >
      <path d="M2.2 1 L6 4 L2.2 7 Z" fill="currentColor" />
    </svg>
  )
}

/** 会话气泡加号：在某个工作区里新建会话。 */
export function IconNewChat(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M13.6 9.2 A1.6 1.6 0 0 1 12 10.8 H5.2 L2.4 13 V3 A1.6 1.6 0 0 1 4 1.4 H8" />
      <path d="M11.6 2.2 V6.2 M9.6 4.2 H13.6" />
    </Stroke>
  )
}

/** 项目加号：添加工作区。 */
export function IconProjectAdd(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 12.2 V4.4 A1 1 0 0 1 2.8 3.4 H6.2 L7.6 4.8 H13.2 A1 1 0 0 1 14.2 5.8 V7.4" />
      <path d="M1.8 12.2 H8.6" />
      <path d="M11.8 8.2 V13.4 M9.2 10.8 H14.4" />
    </Stroke>
  )
}

/** 归档箱。 */
export function IconArchive(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 3.6 H14.2 V5.6 H1.8 Z" />
      <path d="M2.6 5.6 V12.4 A0.8 0.8 0 0 0 3.4 13.2 H12.6 A0.8 0.8 0 0 0 13.4 12.4 V5.6" />
      <path d="M6.2 8.2 H9.8" />
    </Stroke>
  )
}

/** 取消归档。 */
export function IconUnarchive(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 3.6 H14.2 V5.6 H1.8 Z" />
      <path d="M2.6 5.6 V12.4 A0.8 0.8 0 0 0 3.4 13.2 H12.6 A0.8 0.8 0 0 0 13.4 12.4 V5.6" />
      <path d="M8 12 V7.2 M6 9.2 L8 7.2 L10 9.2" />
    </Stroke>
  )
}

/** 置顶图钉（实心）。 */
export function IconPinFill(props: IconProps): ReactTypes.JSX.Element {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 16 16"
      className={props.className}
      aria-hidden
      focusable={false}
      fill="currentColor"
    >
      <path d="M10.2 1.6 14.4 5.8 12.6 6.6 12 10 7.8 10.8 4.8 13.8 4 13 7 10 7.8 5.8 11 5 Z" />
    </svg>
  )
}

/** 时钟：按最近活动排序。 */
export function IconClock(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <circle cx={8} cy={8} r={5.6} />
      <path d="M8 4.8 V8 L10.2 9.4" />
    </Stroke>
  )
}

/** 上下箭头：手动排序。 */
export function IconChevronsUpDown(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M4.6 6 L8 2.8 L11.4 6" />
      <path d="M4.6 10 L8 13.2 L11.4 10" />
    </Stroke>
  )
}

/** 行列表：一张扁平列表。 */
export function IconFlatList(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M2.4 4 H13.6 M2.4 8 H13.6 M2.4 12 H13.6" />
    </Stroke>
  )
}

/** 目录树：按目录嵌套。 */
export function IconWorkspaceTree(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M2.6 3.4 H13.4 M5.6 8 H13.4 M5.6 12.6 H13.4" />
      <path d="M2.6 8 V12.6" />
      <circle cx={2.6} cy={3.4} r={0.9} fill="currentColor" stroke="none" />
    </Stroke>
  )
}

/** 归档可见性：隐藏归档。 */
export function IconArchiveOff(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 3.6 H11.4 M14.2 3.6 H14.2" />
      <path d="M2.6 5.6 V12.4 A0.8 0.8 0 0 0 3.4 13.2 H12.6 A0.8 0.8 0 0 0 13.4 12.4 V5.6" />
      <path d="M2 2 L14 14" />
    </Stroke>
  )
}

/** 归档可见性：显示全部（含归档）。 */
export function IconQueue(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M2.4 3.6 H13.6 M2.4 7 H13.6 M2.4 10.4 H9.6" />
      <path d="M10.4 13 H14.4" />
    </Stroke>
  )
}

/** 归档可见性：只看归档。 */
export function IconArchiveCheck(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M1.8 3.6 H14.2 V5.6 H1.8 Z" />
      <path d="M2.6 5.6 V12.4 A0.8 0.8 0 0 0 3.4 13.2 H12.6 A0.8 0.8 0 0 0 13.4 12.4 V5.6" />
      <path d="M6.2 8.6 L7.6 10 L10 7.4" />
    </Stroke>
  )
}

/** 铅笔：重命名工作区。 */
export function IconEdit(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M9.6 2.8 L13.2 6.4 L6 13.6 H2.4 V10 Z" />
      <path d="M8.4 4 L12 7.6" />
    </Stroke>
  )
}

/** 垃圾桶：删除工作区。 */
export function IconTrash(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M2.6 4.4 H13.4" />
      <path d="M5.4 4.4 V2.8 H10.6 V4.4" />
      <path d="M4 4.4 L4.8 13.2 H11.2 L12 4.4" />
    </Stroke>
  )
}

/** 向上的箭头：目录选择器里回上一层。 */
export function IconArrowUp(props: IconProps): ReactTypes.JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M8 13 V3.4 M4.4 7 L8 3.4 L11.6 7" />
    </Stroke>
  )
}
