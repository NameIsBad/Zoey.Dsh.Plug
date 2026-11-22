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

import { SidebarEntry, SIDEBAR_DICT, SIDEBAR_NS, SIDEBAR_STYLES, buildSidebarGroups } from './shell/sidebar'
import { recentAcrossProjects, recentTasksSection } from './features/recent-tasks/index'
import { recentTasksSettings } from './features/recent-tasks/settings'
import { gitBranchFeature } from './features/git-branch/index'
import { compactContextFeature } from './features/compact-context/index'
import { bindCompactRunner, createCompactRunner } from './features/compact-context/runner'
import { compactContextSettings } from './features/compact-context/settings'
import {
  TASK_NOTIFY_NS,
  TaskNotifyOverlay,
  createTaskNotifyEngine,
  taskNotify,
} from './features/task-notify/index'
import { taskNotifySettings } from './features/task-notify/settings'
import { installStyles } from './lib/dom'
import {
  FeatureHubSettings,
  FeatureHubSettingsIcon,
  SETTINGS_NS,
  featureHubSettings,
} from './features/settings/index'
import type {
  ClientContext,
  ControlDescriptor,
  LocaleSpec,
  RightControlDescriptor,
  SectionDescriptor,
  SettingsItemDescriptor,
} from './types'

/**
 * 本插件需要的客户端服务：插槽、字典、会话/工作区动作。
 *
 * 后三项是任务提醒的数据源：`sessions`（会话标题）、`remote`（失败事件）、
 * `uiSession`（运行状态与待交互）。写进 inject 是为了让 apply 等到它们就绪，
 * 否则任务提醒可能因为取服务时服务还没注册而整块失效。
 */
export const inject: readonly string[] = [
  'slots',
  'locale',
  'uiWorkspace',
  'workspaces',
  'sessions',
  'remote',
  'uiSession',
]

/** 侧边栏分组清单（按 order 升序渲染）。 */
export const SECTIONS: readonly SectionDescriptor[] = [recentTasksSection]

/** 输入框工具行左侧控件清单。 */
export const CONTROLS: readonly ControlDescriptor[] = [gitBranchFeature]

/** 输入框工具行右侧控件清单（模型选择与发送按钮之间）。 */
export const RIGHT_CONTROLS: readonly RightControlDescriptor[] = [compactContextFeature]

/** 「功能集」设置页里的功能面板清单（按 order 升序渲染）。 */
export const SETTINGS: readonly SettingsItemDescriptor[] = [
  recentTasksSettings,
  compactContextSettings,
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
  // 外壳自身的字典与样式。
  ctx.effect(() => ctx.locale.register(SIDEBAR_NS, SIDEBAR_DICT), 'feature-hub:sidebar:dictionaries')
  ctx.effect(() => installStyles(SIDEBAR_STYLES), 'feature-hub:sidebar:styles')

  // 所有功能（含设置面板）的字典与样式先统一去重安装：
  // 同一个命名空间可能同时出现在主功能描述与设置描述里，重复注册会打架。
  const resources: readonly FeatureResources[] = [
    ...SECTIONS,
    ...CONTROLS,
    ...RIGHT_CONTROLS,
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

  // 设置页：一页 + 一个导航图标。图标 id 必须与页面 id 相同才会配对显示；
  // 页面内容由各功能的面板拼成，页面壳只负责卡片框架。
  const tSettings = ctx.locale.bind(SETTINGS_NS)
  const settingsPanels = enabledOf(SETTINGS).map((item) => ({
    id: item.id,
    order: item.order,
    component: item.component,
    t: ctx.locale.bind(item.locale.ns),
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
              openSession: (sessionId: string) => {
                ctx.uiWorkspace.openSession(sessionId)
              },
              startSession: (workspaceId?: string) => {
                ctx.uiWorkspace.startSession(workspaceId)
              },
              // 拖拽排序：insertBefore 会先乐观改本地顺序再与 Host 对齐；
              // 若当前宿主没有这个方法，静默跳过（拖拽退化为无操作，不抛错）。
              reorderWorkspace: async (workspaceId: string, beforeWorkspaceId?: string) => {
                const service = ctx.workspaces
                if (typeof service.insertBefore !== 'function') return
                try {
                  await service.insertBefore(workspaceId, beforeWorkspaceId)
                } catch (error) {
                  console.error('feature-hub: workspace reorder failed', error)
                }
              },
              addWorkspace: async () => {
                const path = await ctx.uiWorkspace.pickDirectory()
                if (path === null || path === undefined || path === '') return
                const created = await ctx.workspaces.create({ path })
                const workspaceId =
                  created === undefined || created === null ? undefined : created.workspaceId
                if (workspaceId !== undefined) ctx.uiWorkspace.startSession(workspaceId)
              },
            }),
          },
          SidebarEntry,
        ),
      ),
    'feature-hub:sidebar',
  )
}

// 供 Node 自检直接调用：模块加载器会忽略它不认识的导出键。
export { buildSidebarGroups }
export { recentAcrossProjects }
export { createTaskNotifyEngine }
export { createCompactRunner }
