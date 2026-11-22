/**
 * 共享词汇表：本插件自己定义的类型都集中在这里。
 *
 * DSH 宿主提供的数据形状统一声明在 `types/dsh-client.d.ts`（环境声明）；
 * 本文件只放"属于我们"的东西——仓库状态、状态色调、功能描述对象等，
 * 让功能组件与外壳使用同一套定义。
 */

/** 与 Host 半边共享的线上形状（两边同一份声明）。 */
export type { GitActionInput, GitPayload, RepoState } from '../../types/wire'

/** 进行中的会话在行上如何显示。 */
export type StatusTone = 'live' | 'warn' | 'done'

/** 状态描述：用哪种色调，以及取哪条字典文案。 */
export interface StatusMeta {
  readonly tone: StatusTone
  readonly key: string
}

/** 每个功能都自带中英两份字典。 */
export interface LocaleDicts {
  readonly zh: Readonly<Record<string, string>>
  readonly en: Readonly<Record<string, string>>
}

/** 一个功能的字典声明。 */
export interface LocaleSpec {
  readonly ns: string
  readonly dicts: LocaleDicts
}

/** 侧边栏分组的功能描述对象（main.ts 的 SECTIONS 清单元素）。 */
export interface SectionDescriptor {
  readonly id: string
  readonly order: number
  readonly locale: LocaleSpec
  readonly styles?: string
  readonly component: (props: SidebarSectionProps) => unknown
  readonly enabled?: boolean
}

/** 输入框工具行控件的功能描述对象（main.ts 的 CONTROLS 清单元素）。 */
export interface ControlDescriptor {
  readonly id: string
  readonly order: number
  readonly locale: LocaleSpec
  readonly styles?: string
  readonly component: (props: ComposerLeftProps) => unknown
  readonly enabled?: boolean
}

/** 输入框工具行右侧控件的功能描述对象（main.ts 的 RIGHT_CONTROLS 清单元素）。 */
export interface RightControlDescriptor {
  readonly id: string
  readonly order: number
  readonly locale: LocaleSpec
  readonly styles?: string
  readonly component: (props: ComposerRightProps) => unknown
  readonly enabled?: boolean
}

/** 设置页的功能描述对象。 */
export interface SettingsDescriptor {
  readonly id: string
  readonly order: number
  readonly locale: LocaleSpec
  readonly styles: string
  readonly component: (props: SettingsSectionProps) => unknown
  readonly icon: (props: { size?: number }) => unknown
}

/**
 * 「功能集」设置页里由一个功能贡献的面板（main.ts 的 SETTINGS 清单元素）。
 *
 * 功能自己提供卡片内容与文案；页面壳只负责卡片框架、排序与统一布局，
 * 所以加/删功能的设置 = 在 SETTINGS 清单里加/删一行。
 */
export interface SettingsItemDescriptor {
  /** 面板 id；同时作为 React key 与样式去重键。 */
  readonly id: string
  /** 卡片在页面里的顺序（升序）。 */
  readonly order: number
  /** 该功能自己的字典命名空间与文案。 */
  readonly locale: LocaleSpec
  /** 面板额外样式；一般不用，公共骨架由设置页壳提供。 */
  readonly styles?: string
  /** 面板组件；只渲染设置行，卡片框架由设置页壳包住。 */
  readonly component: (props: FeatureSettingsProps) => unknown
  /** 置 false 时整个面板不安装。 */
  readonly enabled?: boolean
}

/** 侧边栏里的一个工作区分组。 */
export interface SidebarGroup {
  readonly key: string
  readonly workspaceId: string
  readonly project: string
  readonly path: string
  readonly sessions: readonly SessionSummary[]
  readonly ungrouped?: true
}

/** 侧边栏分组结果。 */
export interface SidebarModel {
  readonly groups: readonly SidebarGroup[]
  readonly rows: readonly SessionSummary[]
}

/** 本插件用到的客户端上下文（Cordis 服务的结构化子集）。 */
export interface ClientContext {
  /** 注册一个随卸载回收的副作用。 */
  effect(factory: () => () => void, label?: string): void
  /**
   * 读取一个可选服务；不存在时返回 undefined。
   *
   * 任务提醒用它取 `sessions`（标题）、`uiSession`（状态快照）与 `remote`
   * （`api-session/error` 等远程事件）。写成可选是为了在宿主精简了某个服务时
   * 只少一类提醒，而不是整个插件加载失败。
   */
  get?(service: string): unknown
  /** 插槽服务：`inject` 等待声明，`register` 返回卸载函数。 */
  slots: {
    inject(key: string, callback: () => () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  /** 字典服务：注册命名空间，并把命名空间绑定成翻译函数。 */
  locale: {
    register(ns: string, dicts: LocaleDicts): () => void
    bind(ns: string): Translate
  }
  /** 会话与工作区动作（由宿主提供）。 */
  uiWorkspace: {
    openSession(sessionId: string): void
    startSession(workspaceId?: string): void
    pickDirectory(): Promise<string | null>
  }
  workspaces: {
    create(input: { readonly path: string }): Promise<{ readonly workspaceId: string } | undefined>
    /** 把某个工作区移动到另一个工作区之前；缺省锚点表示移到末尾。 */
    insertBefore(workspaceId: string, beforeWorkspaceId?: string): Promise<unknown>
  }
}
