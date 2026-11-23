/**
 * 两半边共享的线上数据结构。
 *
 * Host 路由与 Client 胶囊必须对同一组字段达成一致，所以只保留一份声明：
 * 改字段名时是类型检查报错，而不是运行时界面坏掉。纯类型文件，不会被编译进
 * 任何一个运行时产物。
 */

/** 一个仓库的分支状态（Host 读出来、Client 显示）。 */
export interface RepoState {
  /** 工作树根目录。 */
  readonly root: string
  /** 当前分支名；游离 HEAD 时为 `HEAD`。 */
  readonly branch: string
  /** 是否处于游离 HEAD。 */
  readonly detached: boolean
  /** 是否还没有任何提交（此时分支尚未成为 ref）。 */
  readonly unborn: boolean
  /** 本地分支名列表（未出生时会包含当前分支）。 */
  readonly branches: readonly string[]
  /** 未提交改动的文件数。 */
  readonly dirty: number
}

/** `/feature-hub/git` 的响应外壳。 */
export interface GitPayload {
  /** 是否成功。 */
  readonly ok: boolean
  /** 成功时的最新状态。 */
  readonly state?: RepoState
  /** 失败时的错误码与可直接展示的原文。 */
  readonly error?: { readonly code: string; readonly message: string }
}

/** 任务提醒的全部偏好；Host 是这份数据的唯一真相，客户端只做缓存。 */
export interface NotifyPrefs {
  /** 总开关；关闭后任何客户端都不许再弹提醒。 */
  readonly enabled: boolean
  /** 任务完成时提醒。 */
  readonly completed: boolean
  /** 任务失败时提醒。 */
  readonly failed: boolean
  /** 等待用户确认或回答时提醒。 */
  readonly asked: boolean
  /** 使用 Windows 系统通知；关闭时只留窗口内提醒。 */
  readonly system: boolean
}

/** `/feature-hub/notify` 的请求体。 */
export interface NotifyInput {
  /** 通知标题（Host 会裁剪到 120 字）。 */
  readonly title: string
  /** 通知正文（Host 会裁剪到 300 字）。 */
  readonly body?: string
  /** 同一事件的分组标识；Host 用它合并多个客户端对同一事件的重复投递。 */
  readonly tag?: string
}

/** `/feature-hub/notify` 的响应外壳。 */
export interface NotifyPayload {
  /** 是否成功处理请求。 */
  readonly ok: boolean
  /** 是否成功交给 Windows 通知平台。 */
  readonly shown?: boolean
  /** 被偏好拦下（总开关关了）：调用方不应再退到窗口内提醒。 */
  readonly blocked?: boolean
  /** 命中去重窗口：同样的 tag 刚刚弹过。 */
  readonly duplicate?: boolean
  /** 失败时的错误码与可直接展示的原文。 */
  readonly error?: { readonly code: string; readonly message: string }
}

/** `/feature-hub/notify/prefs` 的响应外壳（GET 与 POST 共用）。 */
export interface NotifyPrefsPayload {
  /** 是否成功处理请求。 */
  readonly ok: boolean
  /** Host 上是否已经有一份存下来的偏好；false 表示调用方可以把自己那份推上来做初始值。 */
  readonly stored?: boolean
  /** 当前生效的偏好。 */
  readonly prefs?: NotifyPrefs
  /** 失败时的错误码与可直接展示的原文。 */
  readonly error?: { readonly code: string; readonly message: string }
}

/** 会改动仓库的请求体。 */
export interface GitActionInput {
  /** 绝对工作目录。 */
  readonly cwd: string
  /** 动作：读取、切换、创建；缺省为读取。 */
  readonly action?: 'read' | 'branches' | 'checkout' | 'create'
  /** 目标分支名（切换或创建时必填）。 */
  readonly branch?: string
  /** 创建分支时的起点（缺省从当前 HEAD 拉出）。 */
  readonly from?: string
}
