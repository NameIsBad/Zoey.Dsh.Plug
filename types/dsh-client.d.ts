/**
 * DSH 客户端插件的环境类型声明（两半边共用）。
 *
 * DSH 并没有提供可安装的这两类类型包：插槽清单与数据形状都写在安装目录里
 * 各 `dsh-client-ui-*` 的 `src/*.ts` 中。因此这里手写一份"本插件真正用到"的
 * 契约——升级 DSH 后若字段变了，请同步修改本文件；宁可补一个字段，也不要把
 * 类型放宽成 `any`。
 */

import type * as ReactTypes from 'react'

declare global {
  /** 由模块加载器注入到 factory 闭包里的 React 运行时。 */
  const React: typeof ReactTypes
  /** 与 React 一起注入的 `React.createElement`。 */
  const h: typeof ReactTypes.createElement

  /** 客户端会话列表里的一行（来自 api-session-controller）。 */
  interface SessionSummary {
    /** 会话 id。 */
    readonly id: string
    /** 持久化的标题，宿主投影出来之前可能没有。 */
    readonly title?: string
    /** 展示用标题：标题 → 项目目录名 → 会话 id。 */
    readonly displayTitle: string
    /** 会话的工作目录（原始项目路径）。 */
    readonly cwd?: string
    /** 父会话 id（子代理会话才有）。 */
    readonly parentId?: string
    /** 会话来源；子代理会话为 `subagent`。 */
    readonly origin?: 'subagent'
    /** 宿主报告的运行状态。 */
    readonly running: boolean
    /** 本地持有计数，`mainView` 大于 0 表示正被某个视图打开。 */
    readonly retainedBy: { readonly mainView: number } & Record<string, number>
    /** 是否还没有任何消息的草稿会话。 */
    readonly blank: boolean
    /** 最近一次活动时间（毫秒时间戳）。 */
    readonly updatedAt: number
    /** 摘要投影值（标题等）。 */
    readonly projectionValues?: Readonly<Record<string, unknown>>
  }

  /** 会话列表快照（`useSessions` 的入参）。 */
  interface SessionListState {
    /** 宿主列表顺序。 */
    readonly ids: readonly string[]
    /** 按 id 索引的会话行。 */
    readonly byId: Readonly<Record<string, SessionSummary>>
    /** 列表加载阶段。 */
    readonly phase: string
  }

  /** 一个已注册的工作区（来自 api-workspace-controller）。 */
  interface WorkspaceView {
    /** 工作区 id。 */
    readonly workspaceId: string
    /** 规范化后的目录路径。 */
    readonly path: string
    /** 显示标题。 */
    readonly title: string
    /** 归属本工作区的会话 id（手工顺序）。 */
    readonly sessionIds: readonly string[]
    /** 创建时间（ISO 字符串）。 */
    readonly createdAt: string
    /** 最近修改时间（ISO 字符串）。 */
    readonly updatedAt: string
  }

  /** 工作区快照（`useWorkspaces` 的入参）。 */
  interface WorkspaceSnapshot {
    /** 工作区列表，宿主顺序。 */
    readonly items: readonly WorkspaceView[]
    /** 全局归档会话集合。 */
    readonly archivedSessionIds: readonly string[]
    /** 全局置顶集合，最近置顶的在前。 */
    readonly pinnedSessionIds: readonly string[]
    /** 加载状态。 */
    readonly state: 'idle' | 'loading' | 'error'
    /** 列表就绪阶段。 */
    readonly phase: 'pending' | 'ready'
    /** 失败信息。 */
    readonly error: unknown
  }

  /** 一条会话的实时状态（`useSessionStatus` 的 entry）。 */
  interface SessionStatus {
    /** 是否正在执行。 */
    readonly running?: boolean | undefined
    /** 是否存在等待用户回答的交互。 */
    readonly pendingInteraction?: unknown
    /** 是否有未读的完成结果。 */
    readonly completionUnread?: boolean
  }

  /** 状态快照：不同装载方式下可能是 Map，也可能是普通对象。 */
  type SessionStatusSnapshot = ReadonlyMap<string, SessionStatus> | Readonly<Record<string, SessionStatus>>

  /** 右键菜单的会话目标。 */
  interface SessionMenuTarget {
    /** 目标族：会话。 */
    readonly kind: 'session'
    /** 会话身份与展示标题。 */
    readonly value: { readonly sessionId: string; readonly displayTitle: string }
  }

  /** `useContextMenu()` 返回值里本插件用到的部分。 */
  interface UseContextMenu {
    /**
     * 给元素挂上右键/Shift+F10 触发菜单的能力。
     * @param target 菜单作用对象。
     * @param handlers 可选事件处理（例如补充键盘行为）。
     * @returns 可直接展开到元素 props 上的对象。
     */
    getTriggerProps(
      target?: SessionMenuTarget,
      handlers?: { onKeyDown?: (event: ReactTypes.KeyboardEvent) => void },
    ): Record<string, unknown>
  }

  /** 绑定到某个字典命名空间的翻译函数。 */
  type Translate = (key: string, params?: Record<string, string | number>) => string

  /** 外壳传给每个侧边栏分组的 props。 */
  interface SidebarSectionProps {
    /** 本分组的翻译函数。 */
    readonly t: Translate
    /** 外壳的时钟（相对时间用）。 */
    readonly now: number
    /** 全部可见会话。 */
    readonly rows: readonly SessionSummary[]
    /** 原始快照，供分组自行投影。 */
    readonly snapshot: {
      readonly items: readonly WorkspaceView[]
      readonly byId: Readonly<Record<string, SessionSummary>>
      readonly ids: readonly string[]
      readonly archivedSessionIds: readonly string[]
      readonly pinnedSessionIds: readonly string[]
      readonly statuses: SessionStatusSnapshot | undefined
    }
    /** 打开某条会话。 */
    readonly openSession: (sessionId: string) => void
    /** 当前打开的会话 id（用于选中态）。 */
    readonly currentSessionId: string | null
  }

  /** `sidebar.workspaces` 占位槽占用者收到的 props。 */
  interface SidebarWorkspacesProps {
    /** 外壳给的折叠状态：true 为宽态，false 为图标栏。 */
    readonly wide: boolean
    /** 让侧边栏展开（已展开时无副作用）。 */
    readonly expandSidebar: () => void
    /** 外壳字典的翻译函数。 */
    readonly t: Translate
    /** 注入的功能分组清单。 */
    readonly sections?: readonly {
      readonly id: string
      readonly order: number
      readonly component: unknown
      readonly t: Translate
      readonly showProject: boolean
    }[]
    /** 打开会话。 */
    readonly openSession: (sessionId: string) => void
    /** 在指定工作区新建会话（缺省时沿用当前工作区）。 */
    readonly startSession: (workspaceId?: string) => void
    /** 走目录选择流程添加工作区。 */
    readonly addWorkspace: () => Promise<void>
    /** 把某个工作区移动到另一个工作区之前（缺省表示移到末尾）。 */
    readonly reorderWorkspace?: (workspaceId: string, beforeWorkspaceId?: string) => Promise<void>
    /** 提示"归档会话不可打开"。 */
    readonly notifyArchivedNotOpenable?: () => void
    /** 工作区快照选择器。 */
    readonly useWorkspaces: <S>(selector: (snapshot: WorkspaceSnapshot) => S) => S
    /** 会话列表选择器。 */
    readonly useSessions: <S>(selector: (snapshot: SessionListState) => S) => S
    /** 会话状态选择器。 */
    readonly useSessionStatus: <S>(selector: (snapshot: SessionStatusSnapshot) => S) => S
    /** 主面板信息选择器。 */
    readonly usePanelInfo: <S>(selector: (info: { readonly activePanelId: string | null }) => S) => S
    /** 右键菜单工具。 */
    readonly useContextMenu: () => UseContextMenu
    /** 侧边栏滚动绑定钩子（把本区域接入外壳的滚动接力）。 */
    readonly useSectionScroller?: () => { readonly bindScrollerRef: (element: HTMLElement | null) => void }
  }

  /** 输入框工具行控件（`conversation.input.left`）收到的 props。 */
  interface ComposerLeftProps {
    /** 当前会话 id。 */
    readonly sessionId: string
    /** 本功能字典的翻译函数。 */
    readonly t: Translate
    /** 会话列表选择器。 */
    readonly useSessions: <S>(selector: (snapshot: SessionListState) => S) => S
    /** 工作区快照选择器。 */
    readonly useWorkspaces: <S>(selector: (snapshot: WorkspaceSnapshot) => S) => S
  }

  /** 输入框提交平面：只有 `plain` 时才能安全地提交新的命令。 */
  type ComposerPhase = 'plain' | 'adjudicating' | 'claimed' | 'submitting' | 'sending'

  /** 输入框里本插件用到的状态子集。 */
  interface ComposerInputState {
    /** 草稿的纯文本投影。 */
    readonly draft: string
    /** 提交平面；非 `plain` 表示提交事务正在进行。 */
    readonly phase: ComposerPhase
  }

  /** 输入框动作：写草稿与提交（等同用户敲入并回车）。 */
  interface ComposerInputActions {
    /** 用纯文本替换整个草稿。 */
    setDraft(text: string): void
    /** 进入提交流程（含斜杠命令的判定与认领）。 */
    submit(): void
  }

  /** 输入框工具行右侧（`conversation.input.right`）控件的 props。 */
  interface ComposerRightProps {
    /** 当前会话 id。 */
    readonly sessionId: string
    /** 本功能字典的翻译函数。 */
    readonly t: Translate
    /** 会话列表选择器。 */
    readonly useSessions: <S>(selector: (snapshot: SessionListState) => S) => S
    /** 工作区快照选择器。 */
    readonly useWorkspaces: <S>(selector: (snapshot: WorkspaceSnapshot) => S) => S
    /** 输入框状态选择器。 */
    readonly useInput: <S>(selector: (state: ComposerInputState) => S) => S
    /** 输入框动作；没有输入能力时为 undefined。 */
    readonly inputActions: ComposerInputActions | undefined
    /** 会话投影读取器（本插件只读 `contextPressure`）。 */
    readonly useProjection: (key: 'contextPressure') => ContextPressure | undefined
  }

  /** 上下文压力投影：已用 token 与模型窗口容量。 */
  interface ContextPressure {
    /** 投影后的已用 token（优先于 `pressureTokens`，宿主百分比即用它）。 */
    readonly projectedTokens?: number
    /** 当前请求的估算压力 token。 */
    readonly pressureTokens?: number
    /** 当前路由的上下文窗口容量。 */
    readonly contextWindow?: number
  }

  /** 设置页（`settings.section`）收到的 props。 */
  interface SettingsSectionProps {
    /** 本页字典的翻译函数。 */
    readonly t: Translate
    /** 关闭设置面板（由外壳持有开关状态）。 */
    readonly close: () => void
  }

  /** 功能自带设置面板（「功能集」页里的一张卡片内容）收到的 props。 */
  interface FeatureSettingsProps {
    /** 该功能字典的翻译函数（与功能本身共用同一个命名空间）。 */
    readonly t: Translate
  }

  /** Host 半边收到的 Cordis 上下文（本插件用到的子集）。 */
  interface HostContext {
    /** 注册一个随插件卸载回收的副作用。 */
    effect(factory: () => () => void, label?: string): void
    /** 读取一个可选服务；不存在时返回 undefined。 */
    get(service: string): unknown
    /** Web 服务器服务：注册路由。 */
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: HostRequest, res: HostResponse) => void | Promise<void>
      }): () => void
    }
  }

  /** 路由处理函数看到的请求（Node IncomingMessage 的结构子集）。 */
  interface HostRequest {
    readonly url?: string
    readonly method?: string
    readonly headers: Record<string, string | string[] | undefined>
    [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
  }

  /** 路由处理函数写入的响应（Node ServerResponse 的结构子集）。 */
  interface HostResponse {
    statusCode: number
    headersSent?: boolean
    writeHead(status: number, headers?: Record<string, string>): void
    write(chunk: string | Uint8Array): boolean
    end(body?: string | Uint8Array): void
    destroy?(error?: Error): void
  }
}

export {}
