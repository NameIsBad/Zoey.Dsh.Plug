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
  /** 与 React 一起注入的 `React.Fragment`：JSX 片段语法编译成 `Fragment`。 */
  const Fragment: typeof ReactTypes.Fragment

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
    /**
     * 各会话的投影值（含子代理目录）。
     *
     * 原生用 `projectionsBySession[sessionId].values.subagentCatalog` 统计
     * 「有几个子代理正在跑」；宿主精简投影时这个字段可能缺省，所以是可选。
     */
    readonly projectionsBySession?: Readonly<
      Record<
        string,
        {
          readonly values?: {
            readonly subagentCatalog?: readonly { readonly id: string }[]
          }
        }
      >
    >
  }

  /** 一次会话内容检索的命中项（`sessions.search` 的返回元素）。 */
  interface SessionSearchResultItem {
    /** 命中的会话 id。 */
    readonly sessionId: string
    /** 命中片段（宿主截好的纯文本）。 */
    readonly snippet?: string
  }

  /** 目录选择器里的一级目录项。 */
  interface DirectoryEntry {
    /** 目录名（不含路径）。 */
    readonly name: string
    /** 绝对路径。 */
    readonly path: string
    /** 是否是隐藏目录（点开头）。 */
    readonly hidden?: boolean
  }

  /** 一层目录的读取结果。 */
  interface DirectoryListing {
    /** 当前目录的绝对路径。 */
    readonly path: string
    /** 宿主账户的家目录。 */
    readonly home: string
    /** 子目录（已按名称排序）。 */
    readonly entries: readonly DirectoryEntry[]
    /** 从根到当前目录的面包屑。 */
    readonly crumbs: readonly DirectoryEntry[]
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
    readonly pendingInteraction?: { readonly kind?: string } | undefined
    /** 是否有未读的完成结果。 */
    readonly completionUnread?: boolean | undefined
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
    /** 全部可见会话（草稿 / 子代理 / 归档已按列表口径过滤；与项目分组的展开、折叠无关）。 */
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
    /**
     * 在指定视口坐标打开宿主原生的会话右键菜单。
     *
     * 由外壳注入：分组只交出「哪条会话 + 弹在哪里」，菜单项（重命名、分叉、
     * 复制 ID、归档、置顶）全部由宿主插件贡献，因此分组不必知道菜单内容。
     * 宿主没提供右键能力时缺省，分组应自行忽略右键。
     */
    readonly openSessionMenu?: (
      sessionId: string,
      displayTitle: string,
      point: { readonly x: number; readonly y: number },
    ) => void
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
    /**
     * 会话级权限查询（`session/rename`、`workspace/insertSessionBefore` 等）。
     *
     * 宿主提供；精简装载时可能缺省，缺省一律按「允许」处理。
     */
    readonly useSessionAccess?: (sessionId: string, action: string) => boolean
    /**
     * 工作区级权限查询（`workspace/rename`、`workspace/delete` 等）。
     *
     * 与 {@link useSessionAccess} 同样可能缺省。
     */
    readonly useWorkspaceAccess?: (workspaceId: string, action: string) => boolean
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

  /**
   * 会话累计 token 用量投影（`tokenUsage`）。
   *
   * 四个桶互不重叠：推理 token 已计入 `outputTokens`，不重复累加。
   */
  interface TokenUsage {
    /** 未命中缓存的输入 token。 */
    readonly uncachedInputTokens: number
    /** 输出（含推理）token。 */
    readonly outputTokens: number
    /** 命中缓存的输入 token。 */
    readonly cacheReadTokens: number
    /** 写入缓存的输入 token。 */
    readonly cacheWriteTokens: number
  }

  /**
   * 全会话统计投影（`sessionStats`）。
   *
   * 只有挂载了 `@deepseek-ai/dsh-session-stats` 的组合才有这个键；
   * 桌面默认组合没有它，读取结果为 `undefined`，消费方必须自己准备回退。
   */
  interface SessionStats {
    /** 含至少一个已关闭步的轮次数。 */
    readonly turns: number
    /** 已关闭的步数。 */
    readonly steps: number
    /** 组装出消息的步的模型墙钟时间之和（毫秒）。 */
    readonly llmMs: number
    /** 工具调用墙钟时间之和（毫秒）。 */
    readonly toolMs: number
    /** 首 token 延迟之和（毫秒）。 */
    readonly ttftMs: number
    /** 上报过首 token 的步数。 */
    readonly ttftSteps: number
    /** 解码墙钟时间之和（毫秒）。 */
    readonly decodeMs: number
    /** 与 `decodeMs` 同时上报的输出 token 之和。 */
    readonly decodeTokens: number
  }

  /** 一个助手节点记录下来的计时事实。 */
  interface AssistantTiming {
    /** 本步 `step/start` 时间；窗口截断时为 null。 */
    readonly stepStartTime: number | null
    /** 首个非空增量时间；没有记录时为 null。 */
    readonly firstTokenTime: number | null
    /** 最终助手消息时间。 */
    readonly completedTime: number
  }

  /** Chat 快照里本插件读取的节点最小形状（`kind` 判别联合的窄视图）。 */
  interface ChatNodeView {
    /** 节点类别，例如 `assistant`、`user`、`tool-result`。 */
    readonly kind: string
    /** 所属轮次；不是每个类别都有。 */
    readonly turn?: number
    /** 事件时间戳（毫秒）。 */
    readonly time: number
    /** 计时事实。 */
    readonly timing?: AssistantTiming
    /** 提供方上报的原始用量对象。 */
    readonly usage?: unknown
  }

  /** Chat 快照里本插件读取的部分（`uiChat` 视图）。 */
  interface ChatSnapshotView {
    /** 已加载窗口里的节点、轮次时间与进行中的调用。 */
    readonly legacy: {
      /** 会话节点（按 seq 顺序）。 */
      readonly nodes: readonly ChatNodeView[]
      /** 每轮起止时间（毫秒）；`endTime` 在执行中缺失。 */
      readonly turnTimings: ReadonlyMap<number, { readonly startTime: number; readonly endTime?: number }>
    }
  }

  /**
   * 本插件读取的投影键与它们的值类型。
   *
   * `sessionStats` 是可选的：只有挂载了对应投影单元的装配才有这个键，
   * 因此 `undefined` 是合法读数，消费方必须准备回退。
   */
  interface SessionProjectionValues {
    /** 会话累计 token 用量。 */
    readonly tokenUsage: TokenUsage
    /** 上下文压力与窗口容量。 */
    readonly contextPressure: ContextPressure
    /** 全会话统计；未挂载该单元时为 `undefined`。 */
    readonly sessionStats?: SessionStats
  }

  /**
   * 输入框上方整行插槽（`conversation.input.dock`）控件的 props。
   *
   * 这个插槽没有 `slotInject` 契约，只能拿到标准 props；投影与 Chat 快照都
   * 通过标准 selector hook 读取。
   */
  interface ComposerDockProps {
    /** 当前会话 id。 */
    readonly sessionId: string
    /** 本功能字典的翻译函数。 */
    readonly t: Translate
    /** 会话列表选择器。 */
    readonly useSessions: <S>(selector: (snapshot: SessionListState) => S) => S
    /** 工作区快照选择器。 */
    readonly useWorkspaces: <S>(selector: (snapshot: WorkspaceSnapshot) => S) => S
    /** Chat 快照选择器（宿主 `useChat`）。 */
    readonly useChat: <S>(selector: (snapshot: ChatSnapshotView) => S) => S
    /** 会话投影读取器；键缺失时返回 `undefined`。 */
    readonly useProjection: <K extends keyof SessionProjectionValues>(
      key: K,
    ) => SessionProjectionValues[K] | undefined
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
