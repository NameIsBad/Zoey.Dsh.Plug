/**
 * 本文件是插件的 Client 注册中心，也是唯一的入口（构建产物就是它）。
 *
 * 三层结构：
 *   1. **侧边栏外壳**：接管 `sidebar.workspaces` 这个单占位槽，渲染区头、
 *      项目分组、会话行、状态指示与右键菜单目标；
 *   2. **功能清单**：`SECTIONS` 是侧边栏分组，`CONTROLS`/`RIGHT_CONTROLS` 是
 *      输入框工具行控件，`SETTINGS` 是「功能集」设置页里的功能面板；
 *   3. **总控装配**：本文件只读清单、按命名空间/样式去重安装资源、把动作注入
 *      描述对象；功能自己的 UI、文案、偏好、设置面板都在 `features/<id>/` 里，
 *      加/删功能 = 改清单里的一行。
 *
 * 接管座位有两个必须记住的事实（都是实测）：
 *   - `single` 槽位是「priority 数值小的赢」，原生浏览区是 0，所以要写 -1；
 *   - 原生浏览区还装着时**不能重复声明**它声明的子槽（`sidebar.workspaces.directoryFlow`
 *     等），否则整个注册抛错、插件看起来没生效。因此外壳不声明任何子槽，也不渲染它们。
 */

import { SidebarEntry, SIDEBAR_DICT, SIDEBAR_NS, SIDEBAR_STYLES } from './shell/sidebar'
import { createViewStore } from './shell/view-state'
import { pushNotice } from './shell/notify'
import {
  ShellOverlays,
  confirmSessionRename,
  setSessionRename,
  subscribeRename,
  getSessionRename,
} from './shell/overlays'
import type { RowMenuRequest } from './shell/rows'
import { recentAcrossProjects, recentTasksSection } from './features/recent-tasks/index'
import { recentTasksSettings } from './features/recent-tasks/settings'
import { gitBranchFeature } from './features/git-branch/index'
import { compactContextFeature } from './features/compact-context/index'
import { bindCompactRunner, createCompactRunner } from './features/compact-context/runner'
import { compactContextSettings } from './features/compact-context/settings'
import { tokenUsageFeature } from './features/token-usage/index'
import { tokenUsageSettings } from './features/token-usage/settings'
import {
  TASK_NOTIFY_NS,
  TaskNotifyOverlay,
  createTaskNotifyEngine,
  taskNotify,
} from './features/task-notify/index'
import { taskNotifySettings } from './features/task-notify/settings'
import { installStyles } from './lib/dom'
import { PALETTE_STYLES } from './lib/palette'
import {
  FeatureHubSettings,
  FeatureHubSettingsIcon,
  SETTINGS_NS,
  featureHubSettings,
} from './features/settings/index'
import type {
  ClientContext,
  ContextMenusService,
  ControlDescriptor,
  DockDescriptor,
  LocaleSpec,
  RightControlDescriptor,
  SectionDescriptor,
  SessionService,
  SettingsItemDescriptor,
  WorkspaceService,
} from './types'

/**
 * 本插件需要的客户端服务：插槽、字典、会话/工作区动作。
 *
 * 后三项是任务提醒的数据源：`sessions`（会话标题）、`remote`（失败事件）、
 * `uiSession`（运行状态与待交互）。写进 inject 是为了让 apply 等到它们就绪，
 * 否则任务提醒可能因为取服务时服务还没注册而整块失效。
 *
 * `remote.commands` 必须单独声明：`remote` 是门面服务，命令执行是它的一个
 * facet，Cordis 对 facet 的访问同样做 inject 校验——只写 `remote` 时
 * `ctx.remote.commands` 会抛「cannot get property "remote.commands" without
 * inject」。压缩按钮正是靠这条通道执行 `/compact`，漏了它按钮会在渲染时抛错、
 * 被插槽错误边界下线（表现为「按钮不见了」）。
 */
export const inject: readonly string[] = [
  'slots',
  'locale',
  'uiWorkspace',
  'workspaces',
  'sessions',
  'remote',
  'remote.commands',
  'uiSession',
  // 侧边栏行与分组共用宿主的右键菜单服务（菜单项由原生插件贡献）。
  'contextMenus',
]

/** 侧边栏分组清单（按 order 升序渲染）。 */
export const SECTIONS: readonly SectionDescriptor[] = [recentTasksSection]

/** 输入框工具行左侧控件清单。 */
export const CONTROLS: readonly ControlDescriptor[] = [gitBranchFeature]

/** 输入框工具行右侧控件清单（模型选择与发送按钮之间）。 */
export const RIGHT_CONTROLS: readonly RightControlDescriptor[] = [compactContextFeature]

/** 输入框上方整行插槽清单（会话内容末尾的读数，紧贴输入框）。 */
export const DOCKS: readonly DockDescriptor[] = [tokenUsageFeature]

/** 「功能集」设置页里的功能面板清单（按 order 升序渲染）。 */
export const SETTINGS: readonly SettingsItemDescriptor[] = [
  recentTasksSettings,
  compactContextSettings,
  tokenUsageSettings,
  taskNotifySettings,
]

/** 一个功能贡献给总控的资源：字典与可选样式。 */
interface FeatureResources {
  /** 功能 id，用于样式去重与 effect 标签。 */
  readonly id: string
  /** 该功能的字典命名空间与文案（同一命名空间只注册一次）。 */
  readonly locale: LocaleSpec
  /** 该功能的样式表（同一 id 只安装一次）。 */
  readonly styles?: string
}

/**
 * 过滤掉被停用（`enabled === false`）的功能。
 * @param list 功能清单。
 * @returns 需要安装的功能。
 */
function enabledOf<T extends { enabled?: boolean }>(list: readonly T[]): readonly T[] {
  return list.filter((item) => item !== undefined && item !== null && item.enabled !== false)
}

/**
 * 安装外壳、全部功能与设置页。
 * @param ctx 客户端上下文（插槽、字典、会话与工作区动作）。
 */
export function apply(ctx: ClientContext): void {
  // 国风强调色只在装饰性位置使用（图标、图标底、开关轨道），由设置页、侧边栏
  // 与输入框控件共用；变量名带 `--fh-` 前缀，深浅主题各一套值。
  ctx.effect(() => installStyles(PALETTE_STYLES), 'feature-hub:palette')
  // 外壳自身的字典与样式。
  ctx.effect(() => ctx.locale.register(SIDEBAR_NS, SIDEBAR_DICT), 'feature-hub:sidebar:dictionaries')
  ctx.effect(() => installStyles(SIDEBAR_STYLES), 'feature-hub:sidebar:styles')
  const tSidebar = ctx.locale.bind(SIDEBAR_NS)

  // 所有功能（含设置面板）的字典与样式先统一去重安装：
  // 同一个命名空间可能同时出现在主功能描述与设置描述里，重复注册会打架。
  const resources: readonly FeatureResources[] = [
    ...SECTIONS,
    ...CONTROLS,
    ...RIGHT_CONTROLS,
    ...DOCKS,
    ...SETTINGS,
    featureHubSettings,
    taskNotify,
  ]
  const registeredNamespaces = new Set<string>()
  for (const feature of resources) {
    if (registeredNamespaces.has(feature.locale.ns)) continue
    registeredNamespaces.add(feature.locale.ns)
    ctx.effect(
      () => ctx.locale.register(feature.locale.ns, feature.locale.dicts),
      `feature-hub:${feature.id}:dictionaries`,
    )
  }
  const installedStyles = new Set<string>()
  for (const feature of resources) {
    if (typeof feature.styles !== 'string' || feature.styles === '') continue
    if (installedStyles.has(feature.id)) continue
    installedStyles.add(feature.id)
    ctx.effect(() => installStyles(feature.styles as string), `feature-hub:${feature.id}:styles`)
  }

  // 输入框工具行左侧控件。
  for (const control of enabledOf(CONTROLS)) {
    ctx.effect(
      () =>
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: control.id,
              order: control.order,
              locale: control.locale.ns,
            },
            control.component,
          ),
        ),
      `feature-hub:${control.id}:seat`,
    )
  }

  // 压缩按钮的执行通道：`/compact` 走 Client Remote 的命令执行，不经过输入框，
  // 所以不替换、也不清理用户草稿。`conversation.input.right` 插槽没有 inject
  // 契约，组件拿不到 ctx，只能由总控在这里绑定、卸载时解绑。
  ctx.effect(() => {
    bindCompactRunner(createCompactRunner(ctx))
    return () => {
      bindCompactRunner(null)
    }
  }, 'feature-hub:compact-context:runner')

  // 输入框工具行右侧控件。
  for (const control of enabledOf(RIGHT_CONTROLS)) {
    ctx.effect(
      () =>
        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.right',
              id: control.id,
              order: control.order,
              locale: control.locale.ns,
            },
            control.component,
          ),
        ),
      `feature-hub:${control.id}:seat`,
    )
  }

  // 输入框上方整行插槽（会话内容末尾）：用量状态条挂在这里。
  // 这个插槽同样没有 inject 契约，组件只靠标准 props（投影 + Chat 快照）读数据。
  for (const dock of enabledOf(DOCKS)) {
    ctx.effect(
      () =>
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.dock',
              id: dock.id,
              order: dock.order,
              locale: dock.locale.ns,
            },
            dock.component,
          ),
        ),
      `feature-hub:${dock.id}:seat`,
    )
  }

  // 设置页：一页 + 一个导航图标。图标 id 必须与页面 id 相同才会配对显示；
  // 页面内容由各功能的面板拼成，页面壳只负责卡片框架。
  const tSettings = ctx.locale.bind(SETTINGS_NS)
  const settingsPanels = enabledOf(SETTINGS).map((item) => ({
    id: item.id,
    order: item.order,
    component: item.component,
    t: ctx.locale.bind(item.locale.ns),
    icon: item.icon,
    tone: item.tone,
  }))
  ctx.effect(
    () =>
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: featureHubSettings.id,
            order: featureHubSettings.order,
            label: () => tSettings('title'),
            locale: SETTINGS_NS,
            inject: () => ({ panels: settingsPanels }),
          },
          FeatureHubSettings,
        ),
      ),
    'feature-hub:settings',
  )
  ctx.effect(
    () =>
      ctx.slots.inject('settings.section.icon', () =>
        ctx.slots.register(
          {
            name: 'settings.section.icon',
            id: featureHubSettings.id,
            order: featureHubSettings.order,
          },
          FeatureHubSettingsIcon,
        ),
      ),
    'feature-hub:settings:icon',
  )

  // 任务提醒：引擎订阅会话状态与远程事件，右下角浮动层负责渲染。
  // 字典与样式已在上面的统一循环里安装；这里只装配引擎与座位。
  ctx.effect(() => {
    const engine = createTaskNotifyEngine(ctx, ctx.locale.bind(TASK_NOTIFY_NS))
    const seat = ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: taskNotify.id,
          order: taskNotify.order,
          locale: TASK_NOTIFY_NS,
          inject: () => engine.face,
        },
        TaskNotifyOverlay,
      ),
    )
    return () => {
      seat()
      engine.dispose()
    }
  }, 'feature-hub:task-notify:overlay')

  // 传给每个分组的数据与动作。
  const sections = enabledOf(SECTIONS).map((section) => ({
    id: section.id,
    order: section.order,
    component: section.component,
    t: ctx.locale.bind(section.locale.ns),
    showProject: false,
  }))

  // 浏览区自己持有的视图状态（分组/排序/展开/手动顺序/归档过滤）。
  const viewStore = createViewStore()

  // 宿主会话与工作区服务可能缺省（精简装载）：每个动作都先取服务再调用，
  // 缺服务时给出可见提示，而不是让按钮看起来「点了没反应」。
  const sessions = (): SessionService | undefined => ctx.get?.('sessions') as SessionService | undefined
  const workspaces = (): WorkspaceService | undefined =>
    ctx.get?.('workspaces') as WorkspaceService | undefined
  const fail = (key: string, reason: unknown): void => {
    const message = reason instanceof Error ? reason.message : String(reason)
    pushNotice(tSidebar(key, { message }), 'warn')
  }

  /** 搜索：宿主控制器返回 `RemoteResult`，这里折成浏览区要的普通结果。 */
  const searchSessions = async (
    query: string,
    signal: AbortSignal,
  ): Promise<{ readonly items: readonly SessionSearchResultItem[]; readonly hasMore: boolean }> => {
    const service = sessions()
    if (service === undefined || typeof service.search !== 'function') return { items: [], hasMore: false }
    const result = await service.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  // 侧边栏外壳：-1 才能从原生浏览区手里拿到这个单占位槽。
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.workspaces', () =>
        ctx.slots.register(
          {
            name: 'sidebar.workspaces',
            priority: -1,
            locale: SIDEBAR_NS,
            inject: () => ({
              sections,
              viewStore,
              openSession: (sessionId: string) => {
                ctx.uiWorkspace.openSession(sessionId)
              },
              startSession: (workspaceId?: string) => {
                ctx.uiWorkspace.startSession(workspaceId)
              },
              searchSessions,
              searchResultLimit: sessions()?.searchResultLimit ?? 50,
              requestSessionRename: (sessionId: string, currentTitle: string) => {
                setSessionRename({ sessionId, currentTitle })
              },
              renameSession: async (sessionId: string, title: string) => {
                const service = sessions()
                if (service === undefined || typeof service.using !== 'function') {
                  throw new Error('sessions service is unavailable')
                }
                await service.using(sessionId, { source: 'featureHubWorkspaceOperation' }, (reference) =>
                  reference.binding.session.rename(title),
                )
              },
              notifyArchivedNotOpenable: () => {
                pushNotice(tSidebar('toast.archivedNotOpenable'), 'warn')
              },
              renameWorkspace: async (workspaceId: string, title: string) => {
                const service = workspaces()
                if (service === undefined) throw new Error('workspaces service is unavailable')
                await service.rename(workspaceId, title)
              },
              deleteWorkspace: async (workspaceId: string) => {
                const service = workspaces()
                if (service === undefined) throw new Error('workspaces service is unavailable')
                await service.delete(workspaceId)
              },
              // 「在文件夹显示」是原生 open-in-app 插件贡献的菜单动作，宿主没有
              // 暴露对应服务；这里解析一次工作区菜单，借它的 select 触发同一条动作。
              revealWorkspace: async (workspaceId: string, path: string) => {
                const menus = ctx.get?.('contextMenus') as ContextMenusService | undefined
                const resolution = menus?.resolve?.({
                  kind: 'workspace',
                  value: { workspaceId, path, displayTitle: '' },
                })
                if (resolution === undefined) return false
                try {
                  await resolution.ready
                  const reveal = resolution.source
                    .getSnapshot()
                    .find((item) => item.id.endsWith('/reveal') && item.disabled !== true)
                  if (reveal === undefined) return false
                  resolution.select(reveal.id)
                  return true
                } finally {
                  // select 会自行释放；未选中时这里负责收掉回调。
                  resolution.dispose()
                }
              },
              insertWorkspaceBefore: async (workspaceId: string, beforeWorkspaceId?: string) => {
                const service = workspaces()
                if (service === undefined) throw new Error('workspaces service is unavailable')
                await service.insertBefore(workspaceId, beforeWorkspaceId)
              },
              archiveSession: (sessionId: string) => {
                const service = workspaces()
                if (service === undefined) {
                  pushNotice(tSidebar('toast.archiveFailed'), 'warn')
                  return
                }
                service.archiveSession(sessionId).catch((reason: unknown) => {
                  fail('toast.archiveFailed', reason)
                })
              },
              unarchiveSession: async (sessionId: string) => {
                const service = workspaces()
                if (service === undefined) throw new Error('workspaces service is unavailable')
                await service.unarchiveSession(sessionId)
              },
              pinSession: (sessionId: string) => {
                const service = workspaces()
                if (service === undefined) {
                  pushNotice(tSidebar('toast.pinFailed'), 'warn')
                  return
                }
                service
                  .pinSession(sessionId)
                  .then(() => {
                    // 置顶后把该会话顶到它所在账本的最前，界面立刻跟随。
                    viewStore.actions.pinSessionOrder(sessionId, [])
                  })
                  .catch(() => {
                    pushNotice(tSidebar('toast.pinFailed'), 'warn')
                  })
              },
              unpinSession: (sessionId: string) => {
                const service = workspaces()
                if (service === undefined) {
                  pushNotice(tSidebar('toast.unpinFailed'), 'warn')
                  return
                }
                service.unpinSession(sessionId).catch(() => {
                  pushNotice(tSidebar('toast.unpinFailed'), 'warn')
                })
              },
              createWorkspace: async (input: { readonly path: string }) => {
                const service = workspaces()
                if (service === undefined) throw new Error('workspaces service is unavailable')
                return service.create(input)
              },
              pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
              // 只有宿主真的提供列目录时才启用内置浏览对话框；
              // native 后端只实现 pick()，此时直接走系统对话框。
              canBrowseDirectories:
                typeof ctx.uiWorkspace.listDirectory === 'function' &&
                typeof ctx.uiWorkspace.createDirectory === 'function',
              listDirectory: async (path?: string) => {
                const service = ctx.uiWorkspace
                if (typeof service.listDirectory !== 'function') {
                  throw new Error('directory listing is unavailable')
                }
                return service.listDirectory(path)
              },
              createDirectory: async (path: string, name: string) => {
                const service = ctx.uiWorkspace
                if (typeof service.createDirectory !== 'function') {
                  throw new Error('directory creation is unavailable')
                }
                return service.createDirectory(path, name)
              },
              openContextMenu: (
                target: RowMenuRequest,
                point: { readonly x: number; readonly y: number },
              ) => {
                // 菜单项由宿主插件贡献（重命名/分支/复制 ID/归档/置顶、工作区重命名/删除），
                // 形态与原生右键完全一致；这里只负责把目标交出去。
                const menus = ctx.get?.('contextMenus') as ContextMenusService | undefined
                if (menus === undefined) {
                  pushNotice(tSidebar('toast.menuUnavailable'), 'warn')
                  return
                }
                const value =
                  target.kind === 'session'
                    ? { sessionId: target.sessionId, displayTitle: target.displayTitle }
                    : {
                        workspaceId: target.workspaceId,
                        path: target.path,
                        displayTitle: target.displayTitle,
                      }
                menus.open({ kind: target.kind, value } as never, point)
              },
              notify: (message: string, tone: 'info' | 'warn') => {
                pushNotice(message, tone)
              },
            }),
          },
          SidebarEntry,
        ),
      ),
    'feature-hub:sidebar',
  )

  // 会话重命名对话框与失败提示都挂在框架级浮层上：它们要能盖住正文，
  // 而且必须比触发它们的行活得更久。
  ctx.effect(
    () =>
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'feature-hub.shell-overlays',
            order: 950,
            locale: SIDEBAR_NS,
            inject: () => ({
              state: getSessionRename,
              subscribe: subscribeRename,
              close: () => {
                setSessionRename(null)
              },
              confirm: (sessionId: string, title: string) => confirmSessionRename(ctx, sessionId, title),
              t: tSidebar,
            }),
          },
          ShellOverlays,
        ),
      ),
    'feature-hub:shell-overlays',
  )
}

// 供 Node 自检直接调用：模块加载器会忽略它不认识的导出键。
export { buildSidebarGroups } from './shell/tree'
export { recentAcrossProjects }
export { createTaskNotifyEngine }
export { createCompactRunner }
export { stageReading, formatSeconds } from './features/token-usage/metrics'
