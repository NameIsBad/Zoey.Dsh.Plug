/**
 * 侧边栏浏览区的视图状态：分组方式、排序方式、分组展开、手动顺序、归档过滤。
 *
 * 原生用 `defineStore` + `persist: 'dsh.workspace.view.v5'` 存同样的东西；
 * 本插件不能引用那个包，所以这里用「localStorage + 订阅集合」实现等价语义：
 *   - 状态是**单个不可变快照**，写入后整份替换并通知订阅者；
 *   - 持久化失败（隐私模式、配额满）只影响记忆，不影响本次交互；
 *   - 恢复时对字段做类型校验，坏数据回落到默认值，不让一条脏记录毁掉侧边栏。
 *
 * 存储键带版本号：字段语义变了就换键，不去猜旧格式。
 */

import type { ArchivedFilter, SessionGroupBy, SessionOrderBy } from './tree'

/** localStorage 里的键（v1）。 */
const STORAGE_KEY = 'dsh-feature-hub.sidebar.view.v1'

/** 浏览区持久化的视图状态。 */
export interface ViewState {
  /** 分组方式。 */
  readonly groupBy: SessionGroupBy
  /** 会话排序方式。 */
  readonly orderBy: SessionOrderBy
  /** 各组展开状态，key 是工作区 id（未分组桶用空串）。 */
  readonly groupExpansion: Readonly<Record<string, boolean>>
  /** 各账本保存的手动顺序（工作区 id / 未分组 / 扁平列表）。 */
  readonly sessionOrderByAccount: Readonly<Record<string, readonly string[]>>
  /** 归档行可见性。 */
  readonly archivedFilter: ArchivedFilter
}

/** 视图状态的写入口。 */
export interface ViewActions {
  /** 切换分组方式。 */
  setGroupBy(mode: SessionGroupBy): void
  /**
   * 切换排序方式；切到手动时用当前可见顺序初始化各账本。
   * @param mode 目标方式。
   * @param initialOrders 当前各账本的可见顺序。
   */
  setOrderBy(mode: SessionOrderBy, initialOrders: Readonly<Record<string, readonly string[]>>): void
  /** 记住某个分组的展开状态。 */
  setGroupExpanded(key: string, expanded: boolean): void
  /** 切换归档行可见性。 */
  setArchivedFilter(filter: ArchivedFilter): void
  /**
   * 保存某个账本的手动顺序并切到手动排序。
   * @param accountKey 账本 key。
   * @param order 新顺序。
   * @param initialOrders 其余账本当前顺序（补齐缺省项）。
   */
  setSessionOrder(
    accountKey: string,
    order: readonly string[],
    initialOrders: Readonly<Record<string, readonly string[]>>,
  ): void
  /** 只在手动排序下同步若干账本（例如草稿被顶到最前）。 */
  syncSessionOrders(orders: Readonly<Record<string, readonly string[]>>): void
  /** 丢掉不再存在的工作区账本。 */
  retainAccountKeys(keys: readonly string[]): void
  /** 置顶后把该会话顶到指定账本最前。 */
  pinSessionOrder(sessionId: string, accountKeys: readonly string[]): void
}

/** 视图状态容器：读、订阅、写。 */
export interface ViewStore {
  /** 读当前快照（身份稳定，未变化时返回同一份）。 */
  get(): ViewState
  /** 订阅变化；返回退订函数。 */
  subscribe(listener: () => void): () => void
  /** 写入口。 */
  readonly actions: ViewActions
}

/** 默认状态。 */
const INITIAL_STATE: ViewState = {
  groupBy: 'workspace',
  orderBy: 'updated',
  groupExpansion: {},
  sessionOrderByAccount: {},
  archivedFilter: 'default',
}

/**
 * 只接受枚举内的值。
 * @param value 候选值。
 * @param allowed 允许集合。
 * @returns 命中时返回它，否则 undefined。
 */
function pickOne<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/**
 * 把任意读入值收窄成字符串数组表。
 * @param value 候选值。
 * @returns 合法记录；非法项被丢弃。
 */
function pickOrderMap(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, string[]> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entry)) continue
    out[key] = entry.filter((id): id is string => typeof id === 'string')
  }
  return out
}

/**
 * 把任意读入值收窄成布尔表。
 * @param value 候选值。
 * @returns 合法记录；非法项被丢弃。
 */
function pickBoolMap(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'boolean') out[key] = entry
  }
  return out
}

/**
 * 从 localStorage 恢复状态；任何异常都回落默认值。
 * @returns 恢复后的状态。
 */
function readState(): ViewState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return INITIAL_STATE
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return INITIAL_STATE
    const record = parsed as Record<string, unknown>
    return {
      groupBy:
        pickOne(record.groupBy, ['workspace', 'workspace-tree', 'flat'] as const) ?? INITIAL_STATE.groupBy,
      orderBy: pickOne(record.orderBy, ['manual', 'updated'] as const) ?? INITIAL_STATE.orderBy,
      groupExpansion: pickBoolMap(record.groupExpansion),
      sessionOrderByAccount: pickOrderMap(record.sessionOrderByAccount),
      archivedFilter:
        pickOne(record.archivedFilter, ['default', 'show', 'only'] as const) ?? INITIAL_STATE.archivedFilter,
    }
  } catch (_error) {
    return INITIAL_STATE
  }
}

/**
 * 写入 localStorage；失败只影响下次启动的记忆。
 * @param state 当前状态。
 */
function writeState(state: ViewState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (_error) {
    // 存储不可用时静默：本次会话内的交互仍然正常。
  }
}

/**
 * 复制一份顺序表，避免把只读投影直接写进状态。
 * @param orders 只读顺序表。
 * @returns 可变副本。
 */
function copyOrders(orders: Readonly<Record<string, readonly string[]>>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(orders).map(([key, order]) => [key, [...order]]))
}

/**
 * 创建一个视图状态容器。
 * @returns 带读写入口的容器；每次调用都是独立实例（插件重载不会串状态）。
 */
export function createViewStore(): ViewStore {
  let state: ViewState = readState()
  const listeners = new Set<() => void>()
  /**
   * 提交一份新状态：整份替换、持久化、通知订阅者。
   * @param next 新状态。
   */
  const commit = (next: ViewState): void => {
    state = next
    writeState(next)
    for (const listener of [...listeners]) listener()
  }
  const actions: ViewActions = {
    setGroupBy(mode) {
      if (mode === state.groupBy) return
      commit({ ...state, groupBy: mode })
    },
    setOrderBy(mode, initialOrders) {
      if (mode === state.orderBy) return
      commit({
        ...state,
        orderBy: mode,
        sessionOrderByAccount: mode === 'manual' ? copyOrders(initialOrders) : {},
      })
    },
    setGroupExpanded(key, expanded) {
      if ((state.groupExpansion[key] ?? true) === expanded) return
      commit({ ...state, groupExpansion: { ...state.groupExpansion, [key]: expanded } })
    },
    setArchivedFilter(filter) {
      if (filter === state.archivedFilter) return
      commit({ ...state, archivedFilter: filter })
    },
    setSessionOrder(accountKey, order, initialOrders) {
      const base = state.orderBy === 'manual' ? state.sessionOrderByAccount : initialOrders
      commit({
        ...state,
        orderBy: 'manual',
        sessionOrderByAccount: { ...copyOrders(base), [accountKey]: [...order] },
      })
    },
    syncSessionOrders(orders) {
      if (state.orderBy !== 'manual') return
      commit({
        ...state,
        sessionOrderByAccount: { ...state.sessionOrderByAccount, ...copyOrders(orders) },
      })
    },
    retainAccountKeys(keys) {
      const retained = new Set(keys)
      const groupExpansion = Object.fromEntries(
        Object.entries(state.groupExpansion).filter(([key]) => retained.has(key)),
      )
      const sessionOrderByAccount = Object.fromEntries(
        Object.entries(state.sessionOrderByAccount).filter(([key]) => retained.has(key)),
      )
      commit({ ...state, groupExpansion, sessionOrderByAccount })
    },
    pinSessionOrder(sessionId, accountKeys) {
      const selected = new Set(accountKeys)
      const next = Object.fromEntries(
        Object.entries(state.sessionOrderByAccount).map(([key, order]) => [
          key,
          selected.has(key) ? [sessionId, ...order.filter((id) => id !== sessionId)] : order,
        ]),
      )
      commit({ ...state, sessionOrderByAccount: next })
    },
  }
  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    actions,
  }
}

/**
 * 订阅视图状态（组件用）。
 * @param store 状态容器。
 * @returns 当前快照；容器变化时组件重渲染。
 */
export function useViewState(store: ViewStore): ViewState {
  const [snapshot, setSnapshot] = React.useState<ViewState>(() => store.get())
  React.useEffect(() => {
    setSnapshot(store.get())
    return store.subscribe(() => {
      setSnapshot(store.get())
    })
  }, [store])
  return snapshot
}
