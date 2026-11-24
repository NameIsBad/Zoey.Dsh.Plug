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

/**
 * 本插件国风强调色的名称。
 *
 * 只在装饰性位置使用（图标、图标底、开关轨道、进度条），文字仍用主题 token；
 * 对应的 CSS 变量是 `--fh-tone-<name>`，深浅主题各有一套值（见 `lib/palette.ts`）。
 */
export type FeatureTone = 'gold' | 'red' | 'blue' | 'green' | 'violet' | 'pink'

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

/**
 * 输入框上方整行插槽（`conversation.input.dock`）的功能描述对象
 * （main.ts 的 DOCKS 清单元素）。会话内容末尾的读数就挂在这里。
 */
export interface DockDescriptor {
  readonly id: string
  readonly order: number
  readonly locale: LocaleSpec
  readonly styles?: string
  readonly component: (props: ComposerDockProps) => unknown
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
  /** 卡片右上角的图标；缺省时卡片头只显示文字。 */
  readonly icon?: (props: { readonly size?: number }) => unknown
  /** 卡片的强调色；同时决定图标底色、分组标记、开关轨道与按钮。 */
  readonly tone?: FeatureTone
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

/** 宿主会话服务里本插件用到的子集（`ctx.get('sessions')`）。 */
export interface SessionService {
  /** 检索会话（元数据 + 内容）。 */
  search(
    query: string,
    signal: AbortSignal,
  ): Promise<
    | {
        readonly ok: true
        readonly value: {
          readonly items: readonly SessionSearchResultItem[]
          readonly hasMore: boolean
        }
      }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
  >
  /** 宿主规定的搜索结果上限。 */
  readonly searchResultLimit: number
  /**
   * 在持有某个会话期间执行一次操作。
   * @param target 会话目标（id 字符串）。
   * @param options 持有来源。
   * @param operation 拿到引用后的操作。
   */
  using<T>(
    target: string,
    options: { readonly source: string },
    operation: (reference: {
      readonly binding: { readonly session: { rename(title: string): Promise<void> } }
    }) => T | Promise<T>,
  ): Promise<T>
}

/** 宿主工作区服务里本插件用到的子集（`ctx.get('workspaces')`）。 */
export interface WorkspaceService {
  /** 登记一个目录为工作区。 */
  create(input: { readonly path: string }): Promise<WorkspaceView>
  /** 重命名工作区。 */
  rename(workspaceId: string, title: string): Promise<WorkspaceView>
  /** 删除工作区登记（不动目录与会话日志）。 */
  delete(workspaceId: string): Promise<void>
  /** 在注册顺序里移动工作区；缺省锚点表示移到末尾。 */
  insertBefore(workspaceId: string, beforeWorkspaceId?: string): Promise<void>
  /** 归档会话；运行中的会话会被宿主拒绝。 */
  archiveSession(sessionId: string, options?: { readonly stopActivity?: boolean }): Promise<void>
  /** 取消归档。 */
  unarchiveSession(sessionId: string): Promise<void>
  /** 置顶。 */
  pinSession(sessionId: string): Promise<void>
  /** 取消置顶。 */
  unpinSession(sessionId: string): Promise<void>
}

/** 右键菜单里的一条动作（本插件只读 id 与可用性）。 */
export interface ContextMenuActionView {
  /** 解析后的动作 id（`<provider>/<action>`）。 */
  readonly id: string
  /** 置灰不可点。 */
  readonly disabled?: boolean
}

/** 一次菜单解析（`resolve` 的返回值）：动作列表、选中与释放。 */
export interface ContextMenuResolution {
  /** 各贡献者依次给的动作；异步贡献结束后会更新。 */
  readonly source: { getSnapshot(): readonly ContextMenuActionView[] }
  /** 所有贡献者都完成后结算。 */
  readonly ready: Promise<void>
  /** 选中一条动作（执行它的 run；同一次解析只能选一次）。 */
  select(id: string): void
  /** 取消未完成的查询并丢弃回调。 */
  dispose(): void
}

/** 宿主右键菜单服务里本插件用到的子集（`ctx.get('contextMenus')`）。 */
export interface ContextMenusService {
  /**
   * 在指定视口坐标打开共享右键菜单。
   * @param target 捕获的目标（`{ kind, value }`）。
   * @param point 视口坐标。
   */
  open(target: unknown, point: { readonly x: number; readonly y: number }): void
  /**
   * 解析某个目标可用的动作，但不打开菜单。
   *
   * 用来借原生贡献的动作（例如「在文件夹显示」）：宿主没有暴露那个服务，
   * 只能通过菜单贡献自己的回调触发。
   *
   * @param target 捕获的目标（`{ kind, value }`）。
   * @returns 一次性的解析结果；宿主不提供时缺省。
   */
  resolve?(target: unknown): ContextMenuResolution
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
    /** 系统目录对话框；取消返回 null。 */
    pickDirectory(): Promise<string | null>
    /** 读取一层目录（内置浏览器式选择器用）；宿主不提供时缺省。 */
    listDirectory?(path?: string): Promise<DirectoryListing>
    /** 新建子目录；宿主不提供时缺省。 */
    createDirectory?(path: string, name: string): Promise<string>
  }
}
