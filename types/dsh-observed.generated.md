# DSH 数据形状观测快照（自动生成，请勿手改）

由 `pnpm run sync-types` 从已安装的 DSH 源码抽取，用于对照 `types/dsh-client.d.ts`。

- 来源 DSH 版本：`0.2.2-rc.5`
- `dsh-api-session-controller/src/client/sessions/service.ts`
- `dsh-client-ui-session/src/client/index.ts`
- `dsh-api-workspace-controller/src/types.ts`
- `dsh-api-workspace-controller/src/client/model.ts`
- `dsh-session/src/types.ts`
- `dsh-api-session-controller/src/client/contract/sessions.ts`
- `dsh-api-session-controller/src/client/sessions/lineage.ts`
- `dsh-session-projection/src/types.ts`

> 插槽 props（`SidebarWorkspacesProps` 等）不在这里：它们不是磁盘上的包，
> 属于 DSH 编译期的环境声明，只能手写维护。

## 漂移报告


- ℹ️ `SessionSummary.formatStatus`：上游新增/未声明，按需补充
- ℹ️ `SessionListState.projectionsBySession`：上游新增/未声明，按需补充

## `dsh-api-session-controller/src/client/sessions/service.ts`

### `SessionSummary`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `id` | `SessionId` | 否 |
| `title` | `string` | 是 |
| `displayTitle` | `string` | 否 |
| `cwd` | `string` | 是 |
| `parentId` | `SessionId` | 是 |
| `origin` | `'subagent'` | 是 |
| `formatStatus` | `SessionListEntry['formatStatus']` | 是 |
| `running` | `boolean` | 否 |
| `retainedBy` | `SessionRetainInfo['retainedBy']` | 否 |
| `blank` | `boolean` | 否 |
| `updatedAt` | `number` | 否 |
| `projectionValues` | `Readonly<Partial<SessionProjectionSummaryValues>>` | 是 |

### `SessionListState`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `ids` | `SessionId[]` | 否 |
| `byId` | `Record<SessionId, SessionSummary>` | 否 |
| `phase` | `SessionListPhase` | 否 |
| `projectionsBySession` | `Readonly<Record<SessionId, SessionProjectionSnapshot>>` | 否 |

## `dsh-client-ui-session/src/client/index.ts`

### `SessionStatus`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `running` | `boolean \| undefined` | 否 |
| `pendingInteraction` | `SessionPendingInteraction \| undefined` | 否 |
| `completionUnread` | `boolean` | 否 |

### `SessionStatusSnapshot`（类型别名）

```ts
ReadonlyMap<SessionId, SessionStatus>
```

### `SessionPendingInteraction`（类型别名）

```ts
[keyof SessionPendingInteractionMap] extends [never] ? SessionPendingInteractionBase : SessionPendingInteractionMap[keyof SessionPendingInteractionMap]
```

### `SessionPendingInteractionBase`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `key` | `string` | 否 |
| `kind` | `string` | 否 |
| `sessionId` | `SessionId` | 否 |

### `SessionPendingInteractionMap`

| 字段 | 类型 | 可选 |
| --- | --- | --- |

## `dsh-api-workspace-controller/src/types.ts`

### `WorkspaceView`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `workspaceId` | `WorkspaceId` | 否 |
| `path` | `string` | 否 |
| `title` | `string` | 否 |
| `sessionIds` | `readonly SessionId[]` | 否 |
| `createdAt` | `string` | 否 |
| `updatedAt` | `string` | 否 |

## `dsh-api-workspace-controller/src/client/model.ts`

### `WorkspaceSnapshot`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `items` | `readonly WorkspaceView[]` | 否 |
| `archivedSessionIds` | `WorkspaceArchiveValue['archivedSessionIds']` | 否 |
| `pinnedSessionIds` | `WorkspacePinValue['pinnedSessionIds']` | 否 |
| `state` | `'idle' \| 'loading' \| 'error'` | 否 |
| `phase` | `WorkspaceListPhase` | 否 |
| `error` | `RemoteFailure \| null` | 否 |

### `WorkspaceListPhase`（类型别名）

```ts
'pending' | 'ready'
```

## `dsh-session/src/types.ts`

### `SessionId`（类型别名）

```ts
Branded<'SessionId'>
```

## `dsh-api-session-controller/src/client/contract/sessions.ts`

### `SessionRetainInfo`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `referenceCount` | `number` | 否 |
| `retainedBy` | `Readonly<Partial<Record<SessionReferenceSource, number>>>` | 否 |

## `dsh-api-session-controller/src/client/sessions/lineage.ts`

### `SessionListEntry`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `sessionId` | `SessionId` | 否 |
| `title` | `string` | 是 |
| `updatedAt` | `number` | 否 |
| `running` | `boolean` | 否 |
| `blank` | `boolean` | 否 |
| `parentSessionId` | `SessionId` | 是 |
| `origin` | `'subagent'` | 是 |
| `formatStatus` | `SessionSummary['formatStatus']` | 是 |
| `cwd` | `string` | 是 |
| `projectionValues` | `Readonly<Partial<SessionProjectionSummaryValues>>` | 是 |
| `depth` | `number` | 否 |

### `TitledSessionSummary`

| 字段 | 类型 | 可选 |
| --- | --- | --- |
| `title` | `string` | 是 |
| `projectionValues` | `Readonly<Partial<SessionProjectionSummaryValues>>` | 是 |

## `dsh-session-projection/src/types.ts`

### `SessionProjectionSummaryValues`（类型别名）

```ts
Omit<SessionProjectionViewValues, SessionProjectionSummaryExcludedKey>
```

### `SessionProjectionViewValues`（类型别名）

```ts
{ [K in keyof SessionProjectionMap]: SessionProjectionViewValue<SessionProjectionMap[K]> }
```

### `SessionProjectionSummaryExcludedKey`（类型别名）

```ts
{ [K in keyof SessionProjectionMap]: NonNullable<SessionProjectionMap[K]> extends SessionProjectionSummaryExcluded<unknown> ? K : never }[keyof SessionProjectionMap]
```

### `SessionProjectionMap`

| 字段 | 类型 | 可选 |
| --- | --- | --- |

### `SessionProjectionViewValue`（类型别名）

```ts
T extends SessionProjectionSummaryExcluded<infer Value> ? Value : T
```

### `SessionProjectionSummaryExcluded`（类型别名）

```ts
T & { readonly [sessionProjectionSummaryExcluded]: true }
```

