# AGENTS.md

给在本仓库里工作的编码代理的说明。用户可见的说明在 `README.md`，这里只写"动手时必须知道的"。

## 这是什么

一个 DeepSeek Harness（DSH）插件 bundle（包名 `dsh-feature-hub`），已安装在当前 desktop profile 里并以 junction 链接到本目录。改这里的文件就是改正在运行的插件。

- **Host 半边**：根目录 `index.js`，普通 Node 模块，导出 `apply(ctx)`，注册 `/feature-hub` 前缀路由（`git` 与 `notify`）。
- **Client 半边**：`client/src/**` → 构建成单文件 `client/client.js`，由浏览器模块加载器加载。
- **元数据**：`package.json`（`dsh.bundle.patch`、`dsh.client`）、`cordis.patch.yml`、`locale/{zh,en}.json`。

## 必跑命令

源码是 TypeScript，构建产物才是运行时文件。改完任何东西都要跑全，全绿才算完成：

```sh
pnpm run check      # tsc：客户端 + Host 两套 tsconfig，严格模式
pnpm run lint       # ESLint：拦运行时会坏的写法（禁止 react / react-dom / @deepseek-ai/* 运行时导入）
pnpm run build      # esbuild：client/src/main.ts → client/client.js；index.ts → index.js
pnpm run verify     # 两个 Node 自检：槽注册/投影；git 路由
# 或者一条：pnpm run all（check → lint → build → verify）

pnpm run format       # Prettier 格式化
pnpm run format:check # 只检查格式
pnpm run sync-types   # 从已安装的 DSH 刷新 types/dsh-observed.generated.md（需 DSH 安装 + Electron）
pnpm run check-types  # 不写文件，只检查类型快照是否过期 / 契约是否漂移
```

- 只改 Host（`index.ts`）也要跑 `check` + `lint` + `build` + `verify`。
- 只改文案/样式也要跑 `check` + `lint` + `build` + `verify`（产物里内联了样式与字典）。
- `client/client.js` 与 `index.js` 是生成物，但必须一起提交：运行时读的是它们。
- 不要手写这两个产物；改 `.ts`，然后跑 `pnpm run build`。
- 改了 `styles.ts` / `locale.ts`，`format` 会把它们格式化成多行 `+` 拼接，构建照常可用。

## 让改动生效

| 改了什么                   | 怎么生效                                              | 怎么确认                                                                              |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `client/src/**`            | 构建后 HMR 自动加载（必要时刷新页面）                 | `cordis_inspect_query` 查对应槽位 occupants                                           |
| `index.js`                 | `plugin_manager set_plugin` 先 disable 再 enable 该行 | `GET /feature-hub/git` 返回 **401**（路由存在且鉴权门生效）；404 说明 Host 还是旧代码 |
| `package.json` 版本 / 描述 | 需要重装或重启                                        | 插件管理器里的版本号                                                                  |

不要用 `pnpm` 手改 profile，也不要手写 profile 的 `package.json` / `cordis.patch.yml`。

## 注释规范（强制）

- **一律用中文写注释**，包括文件头、类型、接口、类、方法、参数说明与行内说明；不要留英文注释。
- 每个文件顶部写一段"这个文件负责什么、边界在哪"。
- 每个导出的类型 / 接口 / 枚举 / 常量 / 函数 / 类 / 组件都要有注释：做什么、参数含义、返回值、失败情形。
- 每个内部函数（哪怕不导出）也要有一行注释说明用途；复杂分支在里面写清"为什么"，不要写"做了什么"。
- 禁止无意义注释（`// 设置 x`、`// 循环`）；注释解释意图与约束，不重复代码。
- 改代码时同步改注释：注释与行为不一致视为缺陷。

## 客户端硬约束

1. **用 TypeScript 写，运行时零依赖**。类型由 `tsc` 检查（`tsconfig.json` 管客户端、`tsconfig.host.json` 管 Host），产物由 esbuild 生成。可以正常用 `import type`、接口、泛型；但运行时 `import` 不要引入任何 npm 包。
2. **React 由加载器以闭包注入**（全局 `React` 和 `h`），**不要 `import React`**（只取类型可以用 `import type`）。
3. **不能用 `react-dom`**（模块表只给 React）。弹层请用顶层 `popover` 属性或 `<dialog>`，不要用 portal。
4. **不要 import 任何 `@deepseek-ai/*` 的 Client 包**（包括 primitives）。需要控件就自己写，样式抄现有页面的形制。
5. **样式只用主题 token**（`--dsw-alias-*`），需要更淡的层次用 `color-mix()` 从 `--dsw-alias-label-primary` 派生。装饰性的强调色（图标、图标底座、开关轨道、进度条、分组标记、计数胶囊）统一取 `lib/palette.ts` 的 `--fh-tone-*`，深浅主题各一套值；**不要另写十六进制颜色，也不要把强调色用在正文文字上**（浅色主题对比度会不够）。
6. **文案必须双语**：每个功能自带 `locale: { ns, dicts: { zh, en } }`，两个字典同时加键。漏键的表现是界面显示原始 key（例如 `title`）。
7. **插槽注册要放在 `ctx.effect` 里**，返回 disposer；资源（样式、字典、定时器、监听器）都要可回收。

## 功能目录结构（强制）

一个功能 = 一个文件夹，功能自己的一切（组件、字典、样式、私有工具）都放进去；只有被**两个以上**功能共用、或外壳与功能共用的小工具才提到 `lib/`。

```
client/src/
├── main.ts                  总控：外壳 + SECTIONS / CONTROLS / RIGHT_CONTROLS / DOCKS / SETTINGS 清单与装配
├── types.ts                 共享类型词汇表（描述对象、上下文、SidebarGroup 等）
├── shell/sidebar.ts         侧边栏外壳（单占位槽 sidebar.workspaces 的占用者）
├── features/<id>/           一个功能一个目录
│   ├── index.ts             组件 + 描述对象（+ 只在本功能内使用的纯函数，如投影）
│   ├── settings.ts          本功能的设置面板 + 设置描述对象（SETTINGS 清单元素）
│   ├── locale.ts            zh / en 字典（键名与 t(...) 一一对应，含 settings.title / settings.description）
│   ├── styles.ts            样式字符串（主题 token + 装饰强调色 + color-mix 派生色）
│   └── <private>.ts         仅本功能使用的工具（例：git-branch/branch-name.ts、compact-context/runner.ts）
├── features/settings/       设置页壳：页头、功能标签页、卡片框架、排序与 .fh-set-* 样式契约，不含任何功能的偏好
└── lib/                     真正跨域共用的工具
    ├── dom.ts               样式注入
    ├── palette.ts           国风强调色变量（图标/开关/进度条等装饰位）
    ├── settings-controls.tsx 设置页共用控件（开关/步进器/滑杆/胶囊/按钮）
    ├── settings-icons.tsx    设置标签页图标（时钟/压缩/仪表/铃铛）
    ├── status.ts            状态点/转圈（外壳与最近任务共用）
    └── time.ts              相对/绝对时间（外壳与最近任务共用）
```

### 边界规则

1. **功能之间不互相 import**。要共用就把能力下沉到 `lib/`，并写清"被谁共用"；不能因为"以后可能用到"就放进 `lib/`。
2. **功能可以 import `lib/` 与 `types.ts`，不要 import `shell/`**。外壳是布局与数据装配者，不能被功能反向依赖（历史问题：功能曾从外壳 import 状态图标，已抽到 `lib/status.ts`）。
3. **外壳不 import 任何 `features/`**：它只通过 `SECTIONS` / `CONTROLS` 拿描述对象，靠注入的 props 渲染。
4. **`main.ts` 只做登记与接线**：读清单、注册字典/样式/插槽、把动作注入进去；不要在里面写 UI 或业务逻辑。
5. **设置面板属于功能，不属于设置页**：偏好读写、文案、控件都放 `features/<id>/settings.ts` 与同目录的私有模块；设置页壳（`features/settings`）只通过 `SETTINGS` 清单拿描述对象、渲染卡片框架，**不 import 任何 feature**。功能的偏好模块不再下沉到 `lib/`——只有真正跨功能的工具才放那里。
6. 一个功能的私有工具与常量（校验正则、尺寸、颜色以外的阈值）留在该功能目录，不要为了"整齐"塞进 `lib/`。

### 描述对象的形状

四个可插拔清单 + 一个设置页壳，字段一致才便于统一安装：

| 注册点       | 清单             | 描述对象字段                                                                  |
| ------------ | ---------------- | ----------------------------------------------------------------------------- |
| 侧边栏分组   | `SECTIONS`       | `id`、`order`、`locale`、`styles?`、`component`、`enabled?`                   |
| 输入框工具行 | `CONTROLS`       | `id`、`order`、`locale`、`styles?`、`component`、`enabled?`                   |
| 输入框右侧   | `RIGHT_CONTROLS` | `id`、`order`、`locale`、`styles?`、`component`、`enabled?`                   |
| 输入框上方   | `DOCKS`          | `id`、`order`、`locale`、`styles?`、`component`、`enabled?`                   |
| 设置面板     | `SETTINGS`       | `id`、`order`、`locale`、`styles?`、`component`、`icon?`、`tone?`、`enabled?` |
| 设置页壳     | 单独注册         | `id`、`order`、`locale`、`styles`、`component`、`icon`                        |

### 加一个功能的步骤

1. 建 `client/src/features/<id>/`，写 `index.ts`（组件 + 描述对象）、`locale.ts`、`styles.ts`；私有工具另开文件。
2. 需要设置时再写 `settings.ts`：只渲染 `.fh-set-row` 等骨架结构；标签页文字与卡片说明分别用功能字典里的 `settings.title` / `settings.description`，由页壳统一渲染。
3. 在 `main.ts` 的 `SECTIONS`、`CONTROLS`（工具行左侧）、`RIGHT_CONTROLS`（工具行右侧）或 `DOCKS`（输入框正上方的整行 `conversation.input.dock`）里加一行；有设置面板则同时加进 `SETTINGS`。
4. 字典键与 `zh` / `en` 两份同时加；CSS 类名带本功能前缀（`fh-br-`、`fh-ws-` 之类），避免与外壳或其它功能撞名。设置标签页用 `icon` + `tone`（`gold / red / blue / green / violet / pink`）声明外观，控件从 `lib/settings-controls.tsx` 取，不要重写一套。
5. 跑 `pnpm run all`（check → lint → build → verify），再按"让改动生效"确认槽位。

## 插槽规则（踩过的坑，别再犯）

- `single` 槽位**priority 数值小的赢**。接管 `sidebar.workspaces` 用 `-1`（写 `100` 会输给原生的 `0`）。
- **不要声明别人已经声明的子槽**（`sidebar.workspaces.directoryFlow`、`sidebar.session.row.*` 等）。原生浏览区装着时会抛 `already declared`，整个注册失败，表现为"插件没生效"。同理，没有在本次注册里声明的子槽**不要用 `renderSlot` 去渲染**。
- 弹层：`display` 只能写在 `:popover-open` 上。给裸 `[popover]` 写 `display: flex` 会盖掉 UA 的 `display: none`，关闭状态会作为普通元素渲染在输入框底下（"弹框被遮挡"）。
- 胶囊/单行文字不要用 `line-height: 1` 配 `overflow: hidden`，g/p/y 的下伸部会被切掉；统一 `line-height: 18px`。
- `inject` 只对**声明了 `slotInject` 的槽位**可用（`sidebar.workspaces`、`settings.section`、`shell.overlay` 可以；`conversation.input.right` 这类 `slotInject` 为空的槽位不行）。给不声明 inject 的槽位传 `inject` 不会生效。
- 没有 `slotInject` 的槽位又需要执行宿主动作时，用功能目录里的 `<private>.ts` 做**模块级绑定**：总控 `apply` 时 `bind…(create…)`，`ctx.effect` 的清理函数里解绑；组件只 import 该模块的调用入口，不直接碰服务。

## Host 约束

- 路由要自己鉴权：`connection.requestRejection(req)` 挡未认证请求（`connection` 用 `ctx.get` 取，可能不存在）。
- 只用 `execFile('git', ['-C', cwd, ...args])` 传参数组，**绝不拼 shell 字符串**；分支名再校验一次（`/^[A-Za-z0-9._/-]+$/`，长度 ≤120）。
- 只接受**绝对路径且真实存在的目录**，并且必须 `rev-parse --is-inside-work-tree === true`。
- 未提交仓库（`git init` 后）：`refs/heads` 为空、`rev-parse HEAD` 会 fatal。用 `symbolic-ref --short HEAD` 读分支名，并把当前分支补进列表。
- 返回值必须是纯 JSON（结构化克隆安全），不要把 Node 对象直接抛给客户端。

## 类型契约怎么维护

`types/` 下有三类东西，职责不同：

| 文件                              | 怎么来的                   | 说明                                                                                                                                                                                                                                               |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/dsh-client.d.ts`           | **手写**                   | 插槽 props（`SidebarWorkspacesProps`、`ComposerLeftProps`、`SettingsSectionProps`）、`React`/`h`、Host 上下文、菜单与翻译函数。这些**无法自动同步**：`dsh-client-ui-slots` 不是安装目录里的包，插槽契约是 DSH 编译期的环境声明，磁盘上没有源文件。 |
| `types/wire.ts`                   | 手写                       | 两半边共享的 git 线上结构。                                                                                                                                                                                                                        |
| `types/dsh-observed.generated.md` | `pnpm run sync-types` 生成 | 当前安装的 DSH 里这些形状的**真实字段与类型**，外加与我们契约的漂移报告。不参与编译，只用于对照与 review。                                                                                                                                         |

- 升级 DSH 后跑 `pnpm run sync-types`，看报告里的 ❌（我们声明了、上游没有）与 ℹ️（上游新增）。
- `pnpm run check-types` 适合放进 CI：快照过期或契约漂移会退出 1。
- 数据形状在 `dsh-client.d.ts` 里刻意保持**窄**（例如 `SessionId` 写成 `string`）：不把上游整张类型图搬进来，只声明我们真正读取的字段。
- Desktop 版源码在 `app.asar` 里，脚本会自动用 `DSH_NODE_EXECUTABLE`（Electron，`ELECTRON_RUN_AS_NODE=1`）重跑自己；纯 npm 安装则直接读文件。

## 代码风格

- ESLint 扁平配置在 `eslint.config.mjs`，除推荐规则外有三条项目专属禁令：运行时 import `react`、import `react-dom`、import `@deepseek-ai/*`（`import type` 全部放行）。
- Prettier 配置在 `.prettierrc.json`（无分号、单引号、宽度 110）。生成物在 `.prettierignore` 里。
- 提交前跑 `pnpm run format:check`；格式化与 lint 都通过再交付。

## 数据与副作用

- 会话/工作区数据只通过插槽 props 的 selector hooks 读（`useSessions`、`useWorkspaces`、`useSessionStatus`），**不要自己扫 session log，不要写会话数据**。
- 不要读写别的插件的 DOM、样式表或源码。
- 偏好设置用功能目录内的 localStorage + 订阅模块（如 `features/recent-tasks/preferences.ts`、`features/task-notify/preferences.ts`），别的地方不要直接碰 `localStorage`。唯一例外是设置页壳自己的 UI 记忆（当前标签，键 `dsh-feature-hub.settings.active-tab`），它不是任何功能的偏好。

## 改动的验收标准

- 三条命令全绿。
- 受影响的槽位用 `cordis_inspect_query`（client `Slots`）确认 occupant 存在且 `active: true`。
- 没有浏览器控制时，明确说出"视觉未验证"，不要声称看过效果。
- 涉及 UI 的改动，答复里写清：改了什么、为什么、用户该在哪里看、还有什么没做。

## 与本仓库无关的文件

根目录的 `acl-backup-*.json`、`acl-*.jsonl` 是之前 DSH 沙箱权限修复留下的记录，不属于本插件，不要提交进业务改动里。
