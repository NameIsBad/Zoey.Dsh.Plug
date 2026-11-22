/**
 * 「压缩上下文」的执行通道：把 `/compact` 直接交给宿主命令注册表。
 *
 * 为什么不再走输入框：早先的实现和你手敲 `/compact` 一样（`setDraft` 写入草稿 +
 * `submit` 提交），代价是必须替换草稿——正在写的文字会被覆盖，所以只能执行前弹
 * 确认框。这里改走 Client Remote 的 `commands.execute`，和 `/` 命令面板是同一条
 * RPC：输入框与草稿完全不参与，既不需要确认框，也不会有"草稿被清理"的风险。
 *
 * 边界：只发一次命令，不重试、不解析成功文案、不读写会话日志；宿主拒绝时把原因
 * 原样交回调用方展示。宿主没有挂载命令执行能力时返回 `unavailable`，由按钮改为
 * 禁用，而不是退回输入框。
 *
 * 为什么是模块级绑定：`conversation.input.right` 这个插槽没有 `slotInject` 契约，
 * 组件拿不到客户端上下文，所以由总控在 `apply` 时绑定通道、卸载时解绑；组件只
 * 认这个模块，不直接依赖任何服务。
 */

/** 一次压缩请求的结局；失败时带上可直接展示的原因（可能来自宿主）。 */
export type CompactRunResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unavailable' | 'refused'; readonly detail?: string }

/** 压缩执行通道。 */
export interface CompactRunner {
  /**
   * 对指定会话执行一次 `/compact`。
   * @param sessionId 目标会话 id；宿主按它定位 agent。
   * @returns 成功、通道不可用，或宿主拒绝（带原因）。
   */
  run(sessionId: string): Promise<CompactRunResult>
  /**
   * 探测通道此刻是否完整可用（按钮据此决定禁用与否）。
   * @returns 远端同时提供 `commands` 与 `execute` 时为 true。
   */
  available(): boolean
}

/** Remote 服务里命令执行的最小面。 */
interface RemoteCommands {
  /** 执行一条完整命令行；附件为空数组，压缩命令不接受附件。 */
  execute?: (agent: string, line: string, attachments: readonly unknown[]) => Promise<unknown>
}

/** 宿主命令执行结果：Remote 包装层 + 命令自身结算结果。 */
interface CommandExecution {
  /** Remote 层是否成功送到宿主。 */
  readonly ok?: boolean
  /** 送达后的命令结算；`undefined` 表示这个名字不在命令目录里。 */
  readonly value?:
    | {
        readonly result?: { readonly kind?: string; readonly text?: string }
      }
    | undefined
  /** Remote 层失败的原因。 */
  readonly error?: { readonly code?: string; readonly message?: string }
}

/** 压缩命令的完整命令行；它不带任何参数。 */
const COMPACT_LINE = '/compact'

/** 当前生效的通道；`null` 表示插件未加载或正在卸载。 */
let bound: CompactRunner | null = null

/**
 * 创建执行通道。
 * @param ctx 只需要 `get` 的客户端上下文（用它取 `remote` 服务）。
 * @returns 每次调用都重新解析 `remote` 的通道：服务可能晚于本插件就绪。
 */
export function createCompactRunner(ctx: { get?: (service: string) => unknown }): CompactRunner {
  return {
    available() {
      const commands = resolveCommands(ctx)
      return commands !== null && typeof commands.execute === 'function'
    },
    async run(sessionId) {
      const commands = resolveCommands(ctx)
      const execute = commands?.execute
      if (commands === null || typeof execute !== 'function') {
        return { ok: false, reason: 'unavailable' }
      }
      try {
        const raw = (await execute.call(commands, sessionId, COMPACT_LINE, [])) as
          CommandExecution | undefined
        return interpret(raw)
      } catch (error) {
        return { ok: false, reason: 'refused', detail: messageOf(error) }
      }
    },
  }
}

/**
 * 从客户端上下文里取命令执行子集。
 * @param ctx 只需要 `get` 的上下文。
 * @returns `remote.commands`；服务或命名空间缺失时返回 null。
 */
function resolveCommands(ctx: { get?: (service: string) => unknown }): RemoteCommands | null {
  const remote = ctx.get?.('remote') as { commands?: RemoteCommands } | undefined
  return remote?.commands ?? null
}

/**
 * 把宿主 RPC 的结果翻译成三种结局。
 * @param raw `commands.execute` 的返回值。
 * @returns 成功，或带原因的拒绝。
 */
function interpret(raw: CommandExecution | undefined): CompactRunResult {
  if (raw === undefined || raw === null) return { ok: false, reason: 'refused' }
  // Remote 层失败：策略拒绝、会话不可用等，错误信息已在 `error.message`。
  if (raw.ok === false) return { ok: false, reason: 'refused', detail: raw.error?.message }
  const value = raw.value
  if (value === undefined || value === null) return { ok: false, reason: 'refused' }
  const result = value.result
  // 命令进入处理器但结算为错误（例如宿主拒绝压缩、取消、保存失败）。
  if (result?.kind === 'error') return { ok: false, reason: 'refused', detail: result.text }
  return { ok: true }
}

/**
 * 取异常的展示文案。
 * @param error 任意抛出物。
 * @returns `Error` 的 message，其余转成字符串。
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 绑定或解绑执行通道（总控在 `apply` 与卸载时调用）。
 * @param runner 通道；`null` 表示插件正在卸载，之后按钮改为禁用。
 */
export function bindCompactRunner(runner: CompactRunner | null): void {
  bound = runner
}

/**
 * 当前是否有可用的执行通道。
 * @returns 已绑定且远端提供 `commands.execute` 时为 true；否则按钮应禁用并说明原因。
 */
export function isCompactAvailable(): boolean {
  return bound !== null && bound.available()
}

/**
 * 用已绑定的通道执行一次压缩。
 * @param sessionId 目标会话 id。
 * @returns 通道未绑定时返回 `unavailable`。
 */
export function runCompact(sessionId: string): Promise<CompactRunResult> {
  const runner = bound
  if (runner === null) return Promise.resolve({ ok: false, reason: 'unavailable' })
  return runner.run(sessionId)
}
