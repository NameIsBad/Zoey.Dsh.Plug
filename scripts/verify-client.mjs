/**
 * Self-check for the built client artifact.
 *
 * Runs `client/client.js` in a Node VM with a stub loader, React, and DOM, then
 * asserts what can be checked without the page:
 *
 *   - the artifact parses, registers the expected module id, and imports no
 *     Harness Client package;
 *   - `apply` installs the shell dictionaries and stylesheet, every enabled
 *     section's dictionaries and styles, and exactly one `sidebar.workspaces`
 *     registration that takes the seat with the lowest priority, leaves the
 *     shipped child seats alone, carries the section descriptors, and exposes
 *     the actions the shell calls;
 *   - the two pure projections behave: the digest takes the newest N rows
 *     (`recentAcrossProjects`) and the sidebar grouping follows the shipped
 *     rules (`buildSidebarGroups`: membership, pin first, newest first,
 *     ungrouped bucket, archived/blank/subagent hiding).
 *
 * What the sidebar looks like, and whether rows select and open, still needs
 * the live page: this check covers wiring, data, and load-time crashes.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolvePath(here, '..')
const artifact = readFileSync(join(packageRoot, 'client', 'client.js'), 'utf8')

let captured = null
const styleElements = []
const sandbox = {
  window: {
    localStorage: {
      getItem() {
        return null
      },
      setItem() {},
    },
    __ModuleLoader__: {
      load(definition) {
        captured = definition
      },
    },
  },
  document: {
    head: { appendChild() {} },
    createElement() {
      const element = { textContent: '', setAttribute() {}, remove() {} }
      styleElements.push(element)
      return element
    },
  },
  Date,
  console,
  Intl,
  setTimeout,
  clearTimeout,
  setInterval() {
    return 0
  },
  clearInterval() {},
}
vm.runInNewContext(artifact, sandbox, { filename: 'client.js' })

const failures = []
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

if (captured === null) throw new Error('client.js did not call __ModuleLoader__.load')
check('module id is the package name', captured.id === 'dsh-feature-hub', captured.id)

const ReactStub = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  Fragment: Symbol('Fragment'),
  Component: class {
    constructor(props) {
      this.props = props
    }
  },
  // 组件自检只需要"能渲染一次"：状态取初值、effect 不执行、ref 给一个可变盒子。
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useRef(initial) {
    return { current: initial }
  },
  useEffect() {},
}
const plugin = captured.factory((spec) => {
  if (spec === 'react') return ReactStub
  throw new Error(`unexpected external import: ${spec}`)
})

check('exports inject', Array.isArray(plugin.inject))
check(
  'inject names the seat, copy, and action services',
  ['slots', 'locale', 'uiWorkspace', 'workspaces'].every((name) => plugin.inject.includes(name)),
)
check(
  'inject names the task-notify data sources',
  ['sessions', 'remote', 'uiSession'].every((name) => plugin.inject.includes(name)),
)
check('exports apply', typeof plugin.apply === 'function')
check('exports the digest projection', typeof plugin.recentAcrossProjects === 'function')
check('exports the sidebar projection', typeof plugin.buildSidebarGroups === 'function')

const registrations = []
const localeRegistrations = []
const effects = []
const dictionaries = new Map()
const ctx = {
  effect(factory) {
    effects.push(factory)
    return factory()
  },
  locale: {
    register(ns, dicts) {
      localeRegistrations.push({ ns, locales: Object.keys(dicts) })
      dictionaries.set(ns, dicts)
    },
    // Resolve like the real service so a missing key shows up as the raw key.
    bind(ns) {
      return (key) => {
        const dict = dictionaries.get(ns)
        const table = dict === undefined ? undefined : dict.zh
        return table !== undefined && typeof table[key] === 'string' ? table[key] : key
      }
    },
  },
  slots: {
    inject(key, callback) {
      return callback()
    },
    register(options, component) {
      registrations.push({ options, component })
    },
  },
  uiWorkspace: {
    openSession() {},
    startSession() {},
    pickDirectory: async () => null,
  },
  workspaces: { create: async () => ({ workspaceId: 'w-new' }) },
}
plugin.apply(ctx)

check(
  'registers the sidebar occupant, the settings page, its icon, both composer controls, and the notice overlay',
  registrations.length === 6,
  String(registrations.length),
)
const compactEntry = registrations.find((entry) => entry.options.name === 'conversation.input.right')
check(
  'registers the compact-context control on the right of the composer tool row',
  compactEntry !== undefined &&
    compactEntry.options.id === 'compact-context' &&
    typeof compactEntry.component === 'function',
  JSON.stringify(compactEntry === undefined ? null : compactEntry.options),
)

// 渲染自检：低于阈值不渲染；达到阈值必须渲染出按钮（命令通道没挂载时也要渲染成禁用态，
// 而不是消失——"按钮不见了"曾经就是这里最容易被误判的形态）。
const compactDict = dictionaries.get('feature-hub.compact')
const tCompact = (key, params) => {
  const text = compactDict === undefined ? key : (compactDict.zh[key] ?? key)
  return String(text).replace(/\{(\w+)\}/g, (match, name) =>
    params !== undefined && name in params ? String(params[name]) : match,
  )
}
const renderCompact = (usedTokens) =>
  compactEntry.component({
    sessionId: 's-1',
    t: tCompact,
    useSessions: (selector) => selector({ byId: {} }),
    useWorkspaces: () => undefined,
    useInput: (selector) => selector({ draft: '', phase: 'plain' }),
    useProjection: () => ({ projectedTokens: usedTokens, contextWindow: 100_000 }),
    inputActions: { setDraft() {}, submit() {} },
  })
sandbox.window.localStorage.getItem = () => '30'
const aboveThreshold = renderCompact(40_000)
const belowThreshold = renderCompact(20_000)
check(
  'the compact button renders once usage reaches the configured threshold',
  aboveThreshold !== null && aboveThreshold.children[0].props.className.startsWith('fh-cx-button'),
  JSON.stringify(aboveThreshold === null ? null : aboveThreshold.children[0].props),
)
check(
  'the compact button stays out below the configured threshold',
  belowThreshold === null,
  JSON.stringify(belowThreshold === null ? null : belowThreshold.children[0].props),
)

// 压缩按钮的执行通道：必须直接问宿主命令注册表要 /compact，而不经过输入框；
// 因此构件里不应再出现任何替换草稿的调用。
check('exports the compact run channel', typeof plugin.createCompactRunner === 'function')
check('the compact button never replaces the composer draft', !artifact.includes('inputActions.setDraft'))
const compactCalls = []
const compactRunner = plugin.createCompactRunner({
  get: (name) =>
    name === 'remote'
      ? {
          commands: {
            async execute(...args) {
              compactCalls.push(args)
              return { ok: true, value: { commandId: 'cmd-1', result: { kind: 'success', text: 'ok' } } }
            },
          },
        }
      : undefined,
})
const compactRun = await compactRunner.run('s-1')
check(
  'the compact button runs /compact through the remote command channel',
  compactRun.ok === true &&
    compactCalls.length === 1 &&
    compactCalls[0][0] === 's-1' &&
    compactCalls[0][1] === '/compact' &&
    Array.isArray(compactCalls[0][2]) &&
    compactCalls[0][2].length === 0,
  JSON.stringify({ compactRun, compactCalls }),
)
check(
  'the compact runner reports an unavailable channel',
  (await plugin.createCompactRunner({}).run('s-1')).reason === 'unavailable',
)
check(
  'the run channel reports availability from the remote module',
  compactRunner.available() === true && plugin.createCompactRunner({}).available() === false,
)
const refusedRun = await plugin
  .createCompactRunner({
    get: () => ({
      commands: { execute: async () => ({ ok: false, error: { code: 'denied', message: 'refused' } }) },
    }),
  })
  .run('s-1')
check(
  'the compact runner surfaces a refused command with its reason',
  refusedRun.ok === false && refusedRun.reason === 'refused' && refusedRun.detail === 'refused',
  JSON.stringify(refusedRun),
)
const commandError = await plugin
  .createCompactRunner({
    get: () => ({
      commands: {
        execute: async () => ({ ok: true, value: { result: { kind: 'error', text: 'busy' } } }),
      },
    }),
  })
  .run('s-1')
check(
  'a command that settles as an error keeps its text',
  commandError.ok === false && commandError.detail === 'busy',
  JSON.stringify(commandError),
)
const compactDictionary = dictionaries.get('feature-hub.compact')
check(
  'compact copy promises the composer draft is untouched',
  compactDictionary !== undefined &&
    typeof compactDictionary.zh.running === 'string' &&
    typeof compactDictionary.zh.failed === 'string' &&
    compactDictionary.zh.tooltip.includes('不会动输入框'),
  compactDictionary === undefined ? 'no dictionary' : compactDictionary.zh.tooltip,
)
const chipEntry = registrations.find((entry) => entry.options.name === 'conversation.input.left')
check(
  'composer chip targets conversation.input.left with its own id',
  chipEntry !== undefined &&
    chipEntry.options.id === 'git-branch' &&
    typeof chipEntry.component === 'function',
)
check(
  'settings icon is registered for the same id',
  registrations.some(
    (entry) => entry.options.name === 'settings.section.icon' && entry.options.id === 'feature-hub',
  ),
)
const overlayEntry = registrations.find((entry) => entry.options.name === 'shell.overlay')
check(
  'task-notify occupies the frame-wide overlay with its own id',
  overlayEntry !== undefined &&
    overlayEntry.options.id === 'task-notify' &&
    typeof overlayEntry.component === 'function',
  JSON.stringify(overlayEntry === undefined ? null : overlayEntry.options),
)
const notifyFace = overlayEntry === undefined ? {} : overlayEntry.options.inject()
check(
  'overlay inject carries the notice snapshot and its actions',
  typeof notifyFace.toasts === 'function' &&
    Array.isArray(notifyFace.toasts()) &&
    typeof notifyFace.subscribe === 'function' &&
    typeof notifyFace.dismiss === 'function' &&
    typeof notifyFace.open === 'function',
)
const settingsEntry = registrations.find((entry) => entry.options.name === 'settings.section')
check(
  'settings section is a list entry with a label',
  settingsEntry !== undefined &&
    settingsEntry.options.id === 'feature-hub' &&
    typeof settingsEntry.options.label === 'function',
)
const settingsInjected = settingsEntry === undefined ? {} : settingsEntry.options.inject()
const panels = Array.isArray(settingsInjected.panels) ? settingsInjected.panels : []
check(
  'the settings page assembles one panel per feature',
  panels.map((panel) => panel.id).join(',') === 'recent-tasks,compact-context,task-notify',
  JSON.stringify(panels.map((panel) => panel.id)),
)
check(
  'each settings panel brings its own translate and component',
  panels.every(
    (panel) =>
      typeof panel.component === 'function' &&
      typeof panel.t === 'function' &&
      typeof panel.t('settings.title') === 'string' &&
      typeof panel.t('settings.description') === 'string',
  ),
)
check(
  'settings panel titles resolve from feature dictionaries',
  panels.length === 3 && panels[0].t('settings.title') === '最近任务',
  panels.length === 0 ? 'no panels' : String(panels[0].t('settings.title')),
)
const occupant = registrations.find((entry) => entry.options.name === 'sidebar.workspaces')
check('occupant targets sidebar.workspaces', occupant !== undefined)
check(
  'occupant takes the seat with the lowest priority',
  occupant.options.priority === -1,
  String(occupant.options.priority),
)
check(
  'occupant leaves the shipped child seats to their declarer',
  occupant.options.children === undefined,
  JSON.stringify(occupant.options.children),
)
check('occupant uses the hub sidebar namespace', occupant.options.locale === 'feature-hub.sidebar')
check(
  'every feature registers its dictionaries',
  localeRegistrations.length === 6 &&
    localeRegistrations.some((entry) => entry.ns === 'feature-hub.sidebar') &&
    localeRegistrations.some((entry) => entry.ns === 'feature-hub.recent-tasks') &&
    localeRegistrations.some((entry) => entry.ns === 'feature-hub.settings') &&
    localeRegistrations.some((entry) => entry.ns === 'feature-hub.branch') &&
    localeRegistrations.some((entry) => entry.ns === 'feature-hub.task-notify'),
  JSON.stringify(localeRegistrations.map((entry) => entry.ns)),
)
check('every feature installs its stylesheet', styleElements.length === 6, String(styleElements.length))
check('one effect per resource plus the registrations', effects.length === 19, String(effects.length))
check('shell component is a function', typeof occupant.component === 'function')

const injected = occupant.options.inject()
check('inject carries one section', Array.isArray(injected.sections) && injected.sections.length === 1)
check(
  'section is recent-tasks',
  injected.sections[0].id === 'recent-tasks',
  JSON.stringify(injected.sections[0]),
)
check('section renders through a component', typeof injected.sections[0].component === 'function')
check('section binds its own translate', typeof injected.sections[0].t === 'function')
check(
  'settings nav label resolves to localized text',
  settingsEntry.options.label() === '功能集',
  settingsEntry.options.label(),
)
check(
  'section title resolves to localized text',
  injected.sections[0].t('title') === '最近任务',
  injected.sections[0].t('title'),
)
check(
  'section time and status copy resolve',
  injected.sections[0].t('time.minutes', { count: 3 }) === '{count} 分钟前' &&
    injected.sections[0].t('status.running') === '运行中',
  injected.sections[0].t('status.running'),
)
check(
  'inject exposes the shell actions',
  typeof injected.openSession === 'function' &&
    typeof injected.startSession === 'function' &&
    typeof injected.addWorkspace === 'function',
)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const now = Date.now()
const rows = Array.from({ length: 25 }, (_unused, index) => ({
  id: `s-${String(index).padStart(2, '0')}`,
  displayTitle: `任务 ${index}`,
  updatedAt: now - index * HOUR,
}))
const digest = plugin.recentAcrossProjects(rows, 20)
check('digest keeps the newest 20 rows', digest.length === 20, String(digest.length))
check('digest is newest-first', digest[0].id === 's-00' && digest[1].id === 's-01')
check('digest drops the oldest rows', !digest.some((row) => row.id === 's-24'))
check(
  'no limit keeps every row',
  plugin.recentAcrossProjects(rows).length === 25,
  String(plugin.recentAcrossProjects(rows).length),
)
const inFlight = new Set(['s-23', 's-24'])
const withActive = plugin.recentAcrossProjects(rows, 3, inFlight)
check('in-flight sessions survive the size limit', withActive.length === 5, String(withActive.length))
check(
  'in-flight sessions are appended newest-first',
  withActive[3].id === 's-23' && withActive[4].id === 's-24',
)

const fixture = {
  items: [
    { workspaceId: 'w-a', title: '项目 A', path: 'E:\\work\\a', sessionIds: ['a-old', 'a-new', 'a-pin'] },
    { workspaceId: 'w-b', title: '项目 B', path: 'E:\\work\\b', sessionIds: ['b-only', 'b-archived'] },
    { workspaceId: 'w-c', title: '项目 C', path: 'E:\\work\\c', sessionIds: ['c-blank', 'c-draft'] },
    { workspaceId: 'w-d', title: '', path: 'E:\\work\\d', sessionIds: ['d-subagent'] },
  ],
  byId: {
    'a-old': { id: 'a-old', displayTitle: '旧任务', updatedAt: now - 9 * HOUR },
    'a-new': { id: 'a-new', displayTitle: '最新任务', updatedAt: now - 1 * HOUR },
    'a-pin': { id: 'a-pin', displayTitle: '置顶任务', updatedAt: now - 5 * HOUR },
    'b-only': { id: 'b-only', displayTitle: 'B 任务', updatedAt: now - 3 * HOUR },
    'b-archived': { id: 'b-archived', displayTitle: '已归档', updatedAt: now - 2 * HOUR },
    'c-blank': { id: 'c-blank', displayTitle: '草稿', updatedAt: now, blank: true },
    'c-draft': { id: 'c-draft', displayTitle: '另一草稿', updatedAt: now, blank: true },
    'd-subagent': { id: 'd-subagent', displayTitle: '子代理', updatedAt: now, origin: 'subagent' },
    loose: { id: 'loose', displayTitle: '未归属', updatedAt: now - 30 * MINUTE },
  },
  archivedSessionIds: ['b-archived'],
}

const model = plugin.buildSidebarGroups({
  items: fixture.items,
  byId: fixture.byId,
  ids: ['a-new', 'b-only', 'loose', 'a-pin', 'a-old', 'b-archived', 'c-blank', 'd-subagent'],
  archivedSessionIds: fixture.archivedSessionIds,
  pinnedSessionIds: ['a-pin'],
  currentSessionId: 'c-blank',
})
const keys = model.groups.map((group) => group.key)
check(
  'sidebar groups follow host order then the ungrouped bucket',
  keys.join(',') === 'w-a,w-b,w-c,',
  keys.join(','),
)
check('an empty-of-visible-sessions workspace drops out', !keys.includes('w-d'))
check('pinned session leads its group', model.groups[0].sessions[0].id === 'a-pin')
check(
  'group rows are newest-first after the pin',
  model.groups[0].sessions.map((session) => session.id).join(',') === 'a-pin,a-new,a-old',
)
check(
  'archived and subagent sessions stay hidden',
  !model.rows.some((session) => ['b-archived', 'd-subagent'].includes(session.id)),
)
check(
  'the current blank session stays visible',
  model.groups[2].sessions.length === 1 && model.groups[2].sessions[0].id === 'c-blank',
)
check(
  'sessions no workspace accounts land in the ungrouped bucket',
  model.groups[3].ungrouped === true && model.groups[3].sessions[0].id === 'loose',
)
check('flat rows list every visible session', model.rows.length === 6, String(model.rows.length))

// 任务提醒引擎：用假的会话列表、状态源与远程事件驱动一遍三种提醒。
check('exports the notice engine', typeof plugin.createTaskNotifyEngine === 'function')
const notifyDict = dictionaries.get('feature-hub.task-notify')
check(
  'task-notify dictionaries cover both locales',
  notifyDict !== undefined &&
    typeof notifyDict.zh['toast.completed'] === 'string' &&
    typeof notifyDict.en['toast.completed'] === 'string',
)
const statusListeners = new Set()
let statusSnapshot = new Map()
let errorListener = null
const fakeSessions = {
  list: {
    getSnapshot: () => ({
      ids: ['n-1', 'n-2', 'n-3'],
      byId: {
        'n-1': { id: 'n-1', displayTitle: '修复登录', running: true },
        'n-2': { id: 'n-2', displayTitle: '子代理', running: true, origin: 'subagent' },
        'n-3': { id: 'n-3', displayTitle: '草稿', running: true, blank: true },
      },
      phase: 'ready',
    }),
  },
}
const notifyCtx = {
  ...ctx,
  get(name) {
    if (name === 'sessions') return fakeSessions
    if (name === 'uiSession') {
      return {
        sessionStatus: {
          getSnapshot: () => statusSnapshot,
          subscribe(listener) {
            statusListeners.add(listener)
            return () => {
              statusListeners.delete(listener)
            }
          },
        },
      }
    }
    if (name === 'remote') {
      return {
        $on(event, listener) {
          if (event === 'api-session/error') errorListener = listener
          return () => {}
        },
      }
    }
    return undefined
  },
  on() {
    return () => {}
  },
}
const notifyEngine = plugin.createTaskNotifyEngine(notifyCtx, (key) => key)
// 提醒先走 Host 路由（Promise），VM 里 fetch 不可用会退回窗口内提醒；
// 这两种路径都在微任务里结算，所以每次派发后要让出一个宏任务。
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
statusSnapshot = new Map([
  ['n-1', { running: true }],
  ['n-2', { running: true }],
  ['n-3', { running: true }],
])
for (const listener of statusListeners) listener()
check('a running snapshot produces no notice', notifyEngine.face.toasts().length === 0)
statusSnapshot = new Map([
  ['n-1', { running: false }],
  ['n-2', { running: false }],
  ['n-3', { running: false }],
])
for (const listener of statusListeners) listener()
await settle()
const completedNotices = notifyEngine.face.toasts().filter((notice) => notice.kind === 'completed')
check(
  'a finished main session produces one completed notice',
  completedNotices.length === 1 && completedNotices[0].sessionId === 'n-1',
  JSON.stringify(completedNotices),
)
statusSnapshot = new Map([
  ['n-1', { running: false, pendingInteraction: { key: 'ask-1', kind: 'approval', sessionId: 'n-1' } }],
])
for (const listener of statusListeners) listener()
await settle()
const askedNotice = notifyEngine.face.toasts().find((notice) => notice.kind === 'asked')
check(
  'a pending approval produces an asked notice with its reason',
  askedNotice !== undefined && askedNotice.ask === 'approval',
  JSON.stringify(askedNotice),
)
if (typeof errorListener === 'function') errorListener('n-1', 'Model  request failed:\nrate limit')
await settle()
const failedNotice = notifyEngine.face.toasts().find((notice) => notice.kind === 'failed')
check(
  'an agent error produces a failed notice with a one-line summary',
  failedNotice !== undefined && failedNotice.detail === 'Model request failed: rate limit',
  JSON.stringify(failedNotice),
)
statusSnapshot = new Map([['n-1', { running: true }]])
for (const listener of statusListeners) listener()
statusSnapshot = new Map([['n-1', { running: false }]])
for (const listener of statusListeners) listener()
await settle()
check(
  'a completion right after a failure is suppressed',
  notifyEngine.face.toasts().filter((notice) => notice.kind === 'completed').length === 1,
)
if (failedNotice !== undefined) {
  notifyEngine.face.dismiss(failedNotice.id)
  check(
    'dismiss removes one notice only',
    !notifyEngine.face.toasts().some((notice) => notice.kind === 'failed'),
  )
}
notifyEngine.dispose()
check('dispose clears the notice snapshot', notifyEngine.face.toasts().length === 0)

check('artifact imports no Harness Client package', !/'@deepseek-ai\//.test(artifact))

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exitCode = 1
} else {
  console.log('\nall checks passed')
}
