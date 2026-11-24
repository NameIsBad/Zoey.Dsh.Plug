# dsh-feature-hub

把多项能力集成进同一个 DSH 插件的「功能集」bundle。功能以**可插拔组件**的形式挂在 DSH 现有的插槽上，每个功能一个文件、自带字典与样式。

当前已实现：

| 功能                     | 位置                      | 说明                                                            |
| ------------------------ | ------------------------- | --------------------------------------------------------------- |
| 最近任务 `recent-tasks`  | 侧边栏「工作区」列表顶部  | 全部项目按活动时间倒序的最近若干条会话，可折叠、条数可配        |
| 当前分支 `git-branch`    | 输入框工具行              | 项目名（点击复制名称）+ 当前 git 分支，点击分支向上弹出切换面板 |
| 压缩上下文               | 输入框工具行右侧          | 一键执行 `/compact`，不经过输入框、不动草稿                     |
| 用量状态条 `token-usage` | 输入框正上方（内容末尾）  | 已消耗 token、本阶段速度、首字、耗时、上下文占用实时读数        |
| 任务提醒 `task-notify`   | Windows 通知中心          | 完成 / 失败 / 询问发系统通知，最小化或关闭到托盘仍收到          |
| 侧边栏外壳               | 接管 `sidebar.workspaces` | 在上面功能之外，重建了工作区列表本身                            |

> 侧边栏之所以要"接管"，是因为 DSH 的「工作区」列表没有"往里加一个分组"的扩展点：`sidebar.workspaces` 是单占位槽，想在列表里出现内容只能连列表一起渲染。接管后原生浏览区的部分能力未移植，见文末「已知缺口」。

## 功能细节

### 最近任务（`recent-tasks`）

- 固定分组，位于项目分组之上；外观与工作区分组一致（36px 区头、32px 行）。左侧图标随折叠状态切换（展开 = 时钟，收起 = 带反向箭头的历史）；不使用小三角。
- 全侧边栏图标统一用 **Lucide** 线性风格（24 网格、1.8 描边、圆头圆角）；在保持几何一致的前提下按语义上色：文件夹与「最近任务」用藤黄、分支用竹青、搜索与归档用石青、视图选项用紫棠、新建用竹绿。色值由 `client/src/lib/palette.ts` 提供，深浅主题各一套，见 `client/src/shell/icons.tsx`。
- 取数：全部项目里按会话活动时间倒序的前 N 条（**默认 5**，在「设置 → 功能集」里改，范围 1–50，改完即时生效）。活动时间取 DSH 会话列表的 `updatedAt`（用户发出消息时推进），不按创建时间排序。
- **运行中 / 待确认的会话永不被裁掉**：先取 N 条，再把超出 N 的进行中会话按时间补进来，因此列表可能长于 N；标题右侧徽标是实际条数。
- 跳过草稿（含当前新建会话：它们还没有用户消息，按创建时间排会霸占最前面）、子代理、已归档会话；没有任何可见会话的项目不出现。
- **项目折叠只是导航状态**：折叠某个项目不会把它的任务从「最近任务」里移走，这个摘要始终按全部项目取数。
- 行内：状态指示 + 标题 + 相对时间；点击打开会话；当前会话所在行有选中高亮。
- **等待交互（待回答 / 待确认 / 待审阅）不再只是一行灰色小字**：行尾换成琥珀色胶囊（带呼吸圆点），并且悬停让位给操作按钮时胶囊仍然保留；项目分组里的会话行与「最近任务」两处用的是同一套呈现。
- 可折叠，折叠状态记在 `localStorage`。

状态指示统一由侧边栏外壳导出，两处共用：

| 状态                   | 显示                  |
| ---------------------- | --------------------- |
| 运行中                 | 11px 蓝色旋转 spinner |
| 待确认（等待用户交互） | 琥珀色圆点 + 呼吸光晕 |
| 有新结果（未读完成）   | 绿色实心点            |
| 空闲                   | 不显示                |

### 当前分支（`git-branch`）

- 两个胶囊：**项目名**（文件夹图标，悬停显示完整路径）+ **分支名**（分支图标，完整不省略）。
- **点击项目胶囊即复制项目名称**（就是胶囊上显示的那段文字：工作区标题，重命名过就用新名字；未分组会话退回目录名）；悬停时右侧露出一个复制图标，复制成功/失败会在胶囊上短暂显示「已复制 / 复制失败」，1.6 秒后复原，不弹窗、不打断输入。`navigator.clipboard` 不可用（非安全上下文）时自动退回 `execCommand('copy')`。
- 分支名来自会话工作目录；不在 git 仓库里时整个控件不渲染。
- 工作区有未提交改动时分支胶囊带一个小黄点，悬停显示文件数。
- 点击**向上弹出**面板：搜索本地分支、点选切换、底部「新分支名 + 创建并切换」；git 的报错原样显示。
- **切换前警告**：会话还没跑过（blank）时直接切；已跑过或正在执行时，先弹出黄色确认块（写明原因与脏文件数），确认后才执行 checkout。创建分支不警告。
- 只在会话（cwd）变化与点击胶囊时重新读取分支，不轮询：手动在终端里切过分支后，再点一次胶囊即可刷新。

### 压缩上下文（`compact-context`）

- 输入框工具行右侧（模型选择与发送之间）多一个**彩色图标按钮**：实心圆徽标 + 相向箭头 + 中线；常规为业务蓝，占用 ≥80% 转为警示琥珀。悬停提示「上下文已用 xx%，点击压缩（等同 /compact）」。
- **只在上下文占用达到配置阈值时出现**：默认 50%，最小 20%，可在「设置 → 功能集 → 压缩按钮出现阈值（%）」调整（存储键 `dsh-feature-hub.compact.threshold`），改完即时生效。百分比与输入框下方那圈同源：`projectedTokens ?? pressureTokens` / 窗口容量，按显示的整数百分比判定；未达阈值时完全不渲染、不占位。
- 点击即压缩：直接调用**宿主命令执行通道**（Client Remote 的 `commands.execute('/compact')`，与 `/` 命令面板同一条 RPC），和手敲 `/compact` 得到同样的命令日志与结果，但**不经过输入框**——不写草稿、不提交、不动附件，所以没有「草稿被替换」的确认框。
- 轮次执行中、输入框正在提交、或宿主没有挂载命令执行通道时按钮禁用，并提示原因（宿主此时会拒绝压缩）。压缩失败会在按钮上方弹一条提示（9 秒自动收起），失败原因原样显示。

### 用量状态条（`token-usage`）

- 位置：`conversation.input.dock`——**输入框卡片正上方的整行插槽**，也就是会话内容最末尾，紧贴输入框。
- 一行读数，默认全部展示：`已消耗 19.2M tok · 速度 ≈144 tok/s · 首字 ≈1.6s · 耗时 ≈17m37s · 上下文 22%`。
- 口径全部与宿主同源，不自己估算：
  - **已消耗**：`tokenUsage` 投影的三个提示词桶（未缓存输入 + 缓存读 + 缓存写）+ 输出桶，与输入框下方那排统计胶囊同一口径。
  - **速度 / 首字**：取当前对话窗口里**最新一轮**的助手节点计时。速度按「解码 token ÷ 解码墙钟」算，首字等待不计入吞吐。
  - **耗时**：该轮 `turn/start → turn/end`；仍在执行时按当前时间估算，因此带「≈」。超过一分钟后写成 `15m45s` / `1h03m`，不再显示 `945s`。
  - **上下文**：`contextPressure` 投影（`projectedTokens ?? pressureTokens` / 窗口容量），与输入框下方那圈百分比同源。
- 没有 `sessionStats` 投影时（桌面默认组合没挂载它），速度与首字全部从 Chat 快照回算；**回算不出来就整段不显示**，绝不拿 0 冒充读数。
- 全部可配置：「设置 → 功能集 → 用量状态条」里可以关总开关、逐项关掉五个指标、切换精确数字（`12,345`）与紧凑写法（`12.3K` / `1.2M`），以及关掉执行中的每秒刷新。偏好存在 `dsh-feature-hub.token-usage`，改完即时生效。
- 执行中「耗时」用主题的业务蓝强调；整行 `role="status"` 并带完整 `aria-label`，屏幕阅读器一次读到全部读数。

### 任务提醒（`task-notify`）

- 三个触发点：一轮回答正常结束（完成）、`api-session/error`（失败，带错误摘要）、出现待交互（批准工具调用 / 回答问题）。
- 数据只读：消费客户端已有的会话状态快照与远程事件，**不读会话日志、不写会话数据**。
- **主通道是 Windows 系统通知**（通知中心里的原生 toast）：客户端检测到事件后，调用本插件 Host 路由 `POST /feature-hub/notify`，由 Host 用 PowerShell + WinRT 投递（AUMID 与安装器快捷方式一致）。完成 / 失败 / 等待回应都会弹，**窗口最小化或关闭到系统托盘时照样收到**——DSH 关闭窗口只是隐藏到托盘，客户端与 Host 都还在运行；点击通知经 `dsh://open` 把窗口拉回前台。
- 为什么不用渲染进程的 `Notification`：`dsh-app://` 页面里它能构造、权限也显示 granted，但**不会进入 Windows 通知中心**（实测通知数据库没有记录）；所以只留作 Host 不可达时的二线兜底。
- 窗口内右下角提醒（8 秒自动消失，最多 4 条）只在系统通知**发不出去**时兜底：Host 路由失败、环境没有 Notification 接口、或用户关掉「使用 Windows 系统通知」。二者不会同时出现。
- **局限**：从托盘彻底退出应用后，进程结束，任何提醒都不会再发；Windows 的专注助手 / 通知开关也可能静音 toast。
- 子代理会话、草稿会话不提醒；失败后 5 秒内的「完成」不再重复提醒；同一会话同类事件 2 秒内合并。
- 开关在「设置 → 功能集 → 任务提醒」：总开关、完成 / 失败 / 询问三类分别开关、「使用 Windows 系统通知」，以及一个「发送测试」按钮（走同一条 Host 通道，用来验证系统通知能否出现）。
- 开关是**全局的**：偏好同时存在客户端 localStorage 与 Host 的 `$DSH_HOME/feature-hub/notify-prefs.json`，窗口之间用 `storage` 事件同步；`POST /feature-hub/notify` 自己会按总开关拒绝对任何客户端弹通知（多窗口、浏览器镜像页、远程访问的客户端都关得住），并顺手合并同一事件在 2 秒内的重复投递。
- 引擎**每次投递前都重读开关**，关掉总开关会立刻收走已经弹出的窗口内提醒；刚打开页面的一秒半内只建立基线不提醒。

### 侧边栏外壳

- 区头：`工作区` 标题、搜索、添加工作区。
- 项目分组：折叠/展开（左侧图标随之切换：展开 = 开口文件夹、收起 = 合口文件夹，不再画小三角）、悬停显示 `…` 与 `+`（`+` 在该项目下新建会话，继承工作区路径）；`…`、右键与 Shift+F10 打开**工作区菜单**（重命名、在文件夹显示、删除工作区）。菜单由本插件自绘并执行——原生工作区菜单的「重命名 / 删除工作区」只写请求、对话框由原生浏览区渲染，接管后没人消费（表现为点了没反应）；「在文件夹显示」仍借原生动作触发。组内会话按置顶 → 最新排序；未归属项目的会话进入「未分组」。**项目分组标题可拖拽排序**：拖到目标分组上/下半区即插入其前/后，落点有主题色提示线，顺序写回 Host。
- 会话行：状态指示、标题、相对时间、置顶标记、选中高亮；等待回答 / 等待确认时行尾显示琥珀色胶囊（悬停或键盘聚焦时依旧保留，只让时间与置顶让位给操作按钮）；右键 / Shift+F10 打开**原生会话菜单**（重命名、分支、复制 ID、归档、置顶、在应用中打开）。
- 渲染抛错时降级为简版列表 + 一行提示，不会让整块区域空白。

### 外观与配色

- **设置页「功能集」**：页头（彩色四色方块标 + 功能数徽标）下面是一排功能标签页（每个功能一个彩色图标 + 名称，键盘 ←/→/Home/End 可切换，上次停留的标签会记住），一次只看一个功能的设置；卡片里保留该功能的说明，再按「显示内容 / 速度与耗时 / 提醒时机」等分组。开关换成 38×22 胶囊、阈值用滑杆 + 常用值胶囊、条数用步进器，全部有键盘焦点环与禁用态。控件在 `client/src/lib/settings-controls.tsx`，标签页与卡片框架、`.fh-set-*` 样式契约在 `client/src/features/settings/`。
- **一套国风强调色**（`client/src/lib/palette.ts`）：朱砂、藤黄、石青、竹青、紫棠、胭脂。浅色主题用压深的色值、深色主题用提亮的色值；只用于图标、图标底座、开关轨道、进度条与分组标记，文字与边框仍走 `--dsw-alias-*` 主题 token，所以两套主题下对比度都成立。
- **侧边栏细节**：文件夹图标是同色低透明填充（悬停加深），最近任务计数是藤黄色胶囊；菜单、悬停卡片、对话框统一 12–18px 圆角与双层阴影，菜单选中项带主题蓝勾选、危险项悬停泛红；用量状态条的每个读数前有一个 5px 色点区分指标。
- 所有颜色都在 `light` 与 `dark` 两套 token 下实测过（设置页、侧边栏、菜单、悬停卡片）。

## 结构

源码是 **TypeScript**，运行时只认构建产物。

```
index.ts                     Host 半边源码：/feature-hub/git（分支）+ /feature-hub/notify（Windows 通知）
index.js                     构建产物（Node 入口，勿手改）
cordis.patch.yml             插入 id=feature-hub 的插件行
client/client.js             构建产物（唯一被浏览器加载的文件，勿手改）
client/src/main.ts                       总控：外壳 + SECTIONS / CONTROLS / RIGHT_CONTROLS / DOCKS / SETTINGS 清单与装配
client/src/shell/sidebar.ts              侧边栏外壳：区头、列表、项目分组、会话行、拖拽、错误兜底
client/src/features/recent-tasks/        功能：最近任务（index / settings / preferences / locale / styles）
client/src/features/git-branch/          功能：分支胶囊（index / locale / styles / branch-name / clipboard）
client/src/features/settings/            设置页壳：页头、卡片框架、彩色图标底座、排序与 .fh-set-* 样式契约
client/src/features/compact-context/     功能：压缩上下文按钮（index / runner / settings / threshold / locale / styles）
client/src/features/token-usage/         功能：用量状态条（index / metrics / preferences / settings / locale / styles）
client/src/features/task-notify/         功能：任务提醒（index / settings / engine / preferences / desktop-notify / locale / styles）
client/src/lib/palette.ts                国风强调色变量（浅色 / 深色两套值）
client/src/lib/settings-controls.tsx     设置页共用控件（开关 / 步进器 / 滑杆 / 胶囊 / 按钮）
client/src/lib/settings-icons.tsx        设置卡片图标（时钟 / 压缩 / 仪表 / 铃铛）
client/src/lib/*.ts                      其它跨域共用工具（dom、status、time）
client/src/types.ts                      本插件自有的类型（功能/设置描述对象、上下文等）
types/dsh-client.d.ts        DSH 客户端环境声明（手写：插槽 props、React/h、Host 上下文）
types/dsh-observed.generated.md  自动生成：当前 DSH 的真实数据形状 + 与契约的漂移报告
types/wire.ts                两半边共享的线上结构（git 路由的请求/响应）
eslint.config.mjs            ESLint 扁平配置（含"禁止运行时 import react/react-dom/@deepseek-ai/*"）
.prettierrc.json             Prettier 配置（无分号、单引号、宽度 110）
scripts/build.mjs            esbuild：client/src/main.ts → client/client.js；index.ts → index.js
scripts/sync-dsh-types.mjs   从已安装的 DSH 抽取数据形状，生成快照并检查契约漂移
scripts/verify-client.mjs    客户端自检：装配、槽注册、投影函数
scripts/verify-host.mjs      Host 自检：驱动 git 路由（真实仓库 + 无提交仓库 + 注入拒绝）
locale/{zh,en}.json          插件管理器里的标题与说明
```

## 开发语言与构建

源码全部是 TypeScript，开启严格模式（`strict`、`noUncheckedIndexedAccess`、`noUnusedLocals`）。注释一律中文。代码风格由 ESLint + Prettier 统一。

```sh
pnpm install            # 首次：安装类型、构建、lint、格式化工具
pnpm run check          # tsc：客户端与 Host 两套配置
pnpm run lint           # ESLint
pnpm run build          # esbuild：生成 client/client.js 与 index.js
pnpm run verify         # 两个 Node 自检
pnpm run all            # check → lint → build → verify

pnpm run format         # Prettier 写入
pnpm run format:check   # 只检查格式
pnpm run sync-types     # 从已安装的 DSH 刷新类型快照（需 DSH + Electron）
pnpm run check-types    # 只检查快照是否过期 / 契约是否漂移（可放 CI）
```

- 两个产物（`client/client.js`、`index.js`）是要提交的，运行时读的是它们；但**不要手改**。
- React 由模块加载器注入到 factory 闭包里（全局 `React` / `h`），所以源码里**不 import React**；需要类型时用 `import type`。ESLint 会拦住违规的运行时导入。
- 不能用 `react-dom`（模块表里没有），弹层用顶层 `popover` / `<dialog>`。
- DSH 没有发布客户端类型包：
  - **数据形状**（会话、工作区、状态）可以从安装目录的源码自动抽取，`pnpm run sync-types` 会刷新 `types/dsh-observed.generated.md` 并报告漂移（❌ 字段被删/改名、ℹ️ 上游新增）。
  - **插槽 props**（`SidebarWorkspacesProps` 等）磁盘上没有源文件，只能继续在 `types/dsh-client.d.ts` 手写；升级 DSH 后按快照里的真实字段名核对一次。

## 安装与生效

```sh
# 首次：在 DSH 里安装本地目录（已在桌面 profile 装过，则跳过）
# plugin_manager install_bundle，target = /path/to/dsh-plug
```

- 安装后是 junction 链接，改源码即改插件目录。
- 客户端改动：`build-client.mjs` 后页面通过 HMR 自动加载，无必要时刷新。
- **Host 改动（index.js）需要重载插件行**：`plugin_manager set_plugin`（disabled → enabled）即可，验证方式是 `GET /feature-hub/git` 返回 401（鉴权门生效）而不是 404。
- 停用插件即恢复原生侧边栏。

## 加功能

几种承载位置，各自对应一个注册点：

| 想加的东西             | 清单                                      | 组件收到的 props                                                    |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| 侧边栏里的一个分组     | `SECTIONS`（`client/src/main.ts`）        | `{ t, rows, snapshot, now, openSession, currentSessionId }`         |
| 输入框工具行的一个控件 | `CONTROLS`                                | 插槽标准 props（`sessionId`、`useSessions`、`useWorkspaces`、`t`…） |
| 输入框工具行右侧控件   | `RIGHT_CONTROLS`                          | 标准 props + `useInput`、`inputActions`                             |
| 输入框上方的整行区域   | `DOCKS`（`conversation.input.dock`）      | 标准 props + `useChat`（Chat 快照与轮次时间）                       |
| 功能自己的设置面板     | `SETTINGS`（`features/<id>/settings.ts`） | `{ t }`（只渲染设置行，卡片框架由设置页壳提供）                     |
| 窗口级浮动层           | 直接注册 `shell.overlay`                  | 标准 props + 注册时 `inject` 进去的数据/动作                        |

新功能文件导出一个描述对象：

```js
export const myFeature = {
  id: 'my-feature', // 同时是插槽里的 id / key
  order: 20,
  locale: { ns: 'feature-hub.my-feature', dicts: { zh, en } },
  styles: '…',
  component: MyComponent,
}
```

设置面板单独一个文件 `features/<id>/settings.ts`，导出同样形状的描述对象（不含 `styles` 也行）：

```js
export const myFeatureSettings = {
  id: 'my-feature',
  order: 20,
  locale: { ns: 'feature-hub.my-feature', dicts: { zh, en } },
  component: MyFeatureSettings, // 只渲染 .fh-set-row / .fh-set-group，描述用 settings.description
  icon: MySettingsIcon, // 标签页与面板的图标（可来自 lib/settings-icons.tsx）
  tone: 'blue', // 标签页与卡片强调色：gold / red / blue / green / violet / pink
}
```

设置页按功能分标签（标签文字取功能字典的 `settings.title`，说明取 `settings.description`，都由页壳统一渲染）：面板内部复用页壳的 `.fh-set-*` 类名（与侧边栏外壳的 `fh-ws-*` 契约同理）即可。开关、步进器、滑杆、常用值胶囊与按钮从 `lib/settings-controls.tsx` 引用，不要在功能里重写一套控件。然后在 `main.ts` 的 `SETTINGS` 清单里登记一行，停用功能时整个标签与卡片一起消失。只有一个功能时页壳不渲染标签栏，改为在卡片里显示标题。

## 已知缺口（相对原生浏览区）

- **工作区菜单是自绘的**：原生工作区菜单里的「重命名 / 删除工作区」只往它自己注入面的 store 里写请求，对话框由原生浏览区渲染；接管后那条请求没人消费，菜单项会「点了没反应」，所以这两项改由本插件的菜单 + 对话框执行。代价是第三方插件后续往 `workspace` 右键目标新增的动作不会出现在这个菜单里；「在文件夹显示」借原生动作触发，文案固定为「在文件夹显示」（原生会按平台显示 Finder / Explorer / 文件管理器）。
- **会话行**右键仍走宿主原生菜单（重命名、分支、复制 ID、归档、置顶、在应用中打开），不受上面这处替换影响。

## 踩过的坑（都是实测，别再犯）

1. **`single` 槽位是 priority 数值小的赢**：原生浏览区注册在 `0`，接管方必须写 `-1`；写 `100` 会让原生继续 `active: true`。
2. **子槽不能在接管时重复声明**：原生浏览区还装着时声明 `sidebar.workspaces.directoryFlow` 等会抛 `already declared`，整个注册失败（表现为"插件没生效"）。只能不声明，并且在拿到 `renderSlot` 前不要渲染它们。
3. **弹层 `display` 只能写在 `:popover-open`**：给裸 `[popover]` 写 `display: flex` 会盖掉 UA 的 `display: none`，关闭状态的弹层会以普通元素渲染在输入框下面（"弹框被遮挡"就是这个）。
4. **`line-height: 1` + `overflow: hidden` 会削掉 g/p/y**：胶囊类文字统一 `line-height: 18px`。
5. **没有 react-dom**：模块表只给 React，弹层用顶层 `popover` / `<dialog>`，不要指望 portal。
6. **未提交仓库的分支**：`git init` 后 `refs/heads` 是空的，`rev-parse HEAD` 会 fatal；要用 `symbolic-ref --short HEAD`，并把当前分支补进列表。
7. **Host 路由必须自己鉴权**：用 `connection.requestRejection(req)` 挡未认证请求；git 一律 `execFile('git', ['-C', cwd, ...args])`，不要拼 shell 字符串。
8. **渲染进程 `Notification` 不进 Windows 通知中心**：在 `dsh-app://` 页面里构造成功、权限 granted，但通知平台收不到。要 Windows 级通知必须绕到 Host 用 PowerShell + WinRT，AUMID 用 `electron.app.<应用名>`；通知文案通过环境变量/参数传给固定脚本，不要拼命令。
