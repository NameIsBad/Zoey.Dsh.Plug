/**
 * 从已安装的 DSH 里同步「数据形状」的观测快照，并检查我们声明的契约是否漂移。
 *
 * 背景：DSH 没有发布客户端类型包。`types/dsh-client.d.ts` 里的
 * `SessionSummary` / `WorkspaceView` 等声明只能手写，一旦上游字段改名或删除，
 * 往往到运行时才发现。这些声明在安装目录的 `src/*.ts` 里是真实存在的，可以
 * 自动抽取出来做对照——这就是本脚本的用途。
 *
 * 输出：`types/dsh-observed.generated.md`
 *   - 每个形状在**当前安装的 DSH** 里的真实字段与类型（快照，便于 review diff）；
 *   - 与 `types/dsh-client.d.ts` 的漂移报告：
 *       · 我们声明了但上游没有 → 错误（退出码 1，说明字段被改名/删除）
 *       · 上游新增但我们没声明 → 提示（不报错，按需补）
 *
 * 边界（重要）：
 *   - 只有**数据形状**能这样同步。**插槽 props 不能**：`dsh-client-ui-slots`
 *     并不是安装目录里的包，插槽契约是 DSH 自己编译期的环境声明，磁盘上
 *     没有可抽取的源文件，只能继续手写维护。
 *   - 脚本不写 `types/dsh-client.d.ts`：契约是"窄的、我们负责的"，自动改写容易
 *     把上游的复杂类型图带进来。脚本负责**发现**差异，人工负责**决策**。
 *
 * 用法：
 *   node scripts/sync-dsh-types.mjs                # 生成快照 + 漂移报告
 *   node scripts/sync-dsh-types.mjs --check        # 不写文件，只检查（有漂移退出 1）
 *   node scripts/sync-dsh-types.mjs --from <dir>   # 指定 @deepseek-ai 目录
 *
 * Desktop 版源码在 app.asar 里，普通 Node 读不了；脚本会自动用
 * `DSH_NODE_EXECUTABLE`（Electron）以 `ELECTRON_RUN_AS_NODE=1` 重新执行自己。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const contractFile = join(packageRoot, 'types', 'dsh-client.d.ts')
const outputFile = join(packageRoot, 'types', 'dsh-observed.generated.md')

/**
 * 需要观测的声明：包名、包内相对路径、种子声明名。
 *
 * 只放"我们的代码直接用到"的形状；同一文件内被它们引用的声明会自动补全。
 */
const SOURCES = [
  {
    pkg: 'dsh-api-session-controller',
    file: 'src/client/sessions/service.ts',
    names: ['SessionSummary', 'SessionListState'],
  },
  {
    pkg: 'dsh-client-ui-session',
    file: 'src/client/index.ts',
    names: ['SessionStatus', 'SessionStatusSnapshot'],
  },
  { pkg: 'dsh-api-workspace-controller', file: 'src/types.ts', names: ['WorkspaceView'] },
  { pkg: 'dsh-api-workspace-controller', file: 'src/client/model.ts', names: ['WorkspaceSnapshot'] },
  { pkg: 'dsh-session', file: 'src/types.ts', names: ['SessionId'] },
  {
    pkg: 'dsh-api-session-controller',
    file: 'src/client/contract/sessions.ts',
    names: ['SessionRetainInfo'],
  },
  { pkg: 'dsh-api-session-controller', file: 'src/client/sessions/lineage.ts', names: ['SessionListEntry'] },
  {
    pkg: 'dsh-session-projection',
    file: 'src/types.ts',
    names: ['SessionProjectionSummaryValues'],
  },
]

/** 解析命令行参数。 */
function parseArgs(argv) {
  const args = { from: undefined, check: false, electron: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') args.check = true
    else if (arg === '--from') args.from = argv[index + 1]
    else if (arg === '--electron') args.electron = argv[index + 1]
  }
  return args
}

/**
 * 定位 `@deepseek-ai` 目录。
 * @param from 显式指定的目录。
 * @returns 该目录的绝对路径。
 */
function locateBase(from) {
  if (typeof from === 'string' && from !== '') return resolve(from)
  const installDir = process.env.DSH_INSTALL_DIR
  if (typeof installDir === 'string' && installDir !== '') {
    // DSH_INSTALL_DIR 指向 .../node_modules/@deepseek-ai/dsh，取其父目录。
    return dirname(resolve(installDir))
  }
  throw new Error(
    '找不到 DSH 安装目录：请设置 DSH_INSTALL_DIR，或用 --from 指定 node_modules/@deepseek-ai 的路径',
  )
}

/**
 * 源码在 asar 里时必须用 Electron 的 Node；普通 Node 会得到 ENOENT。
 * @param base 安装目录。
 * @param args 命令行参数。
 */
function ensureAsarCapable(base, args) {
  if (!base.includes('app.asar')) return
  if (process.versions.electron !== undefined) return
  const electron = args.electron ?? process.env.DSH_NODE_EXECUTABLE
  if (typeof electron !== 'string' || electron === '') {
    throw new Error(
      '源码位于 app.asar，普通 Node 读不了；请设置 DSH_NODE_EXECUTABLE 或用 --electron 指定 Electron 可执行文件',
    )
  }
  const result = spawnSync(electron, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  process.exit(result.status === null ? 1 : result.status)
}

/**
 * 去掉声明文本里的注释，避免把上游英文注释带进快照。
 * @param text 声明源码。
 * @returns 去注释后的文本。
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 在同一文件里收集被引用到的其它声明（传递闭包）。
 * @param ts TypeScript 模块。
 * @param file 已解析的源文件。
 * @param seeds 种子声明名。
 * @returns 需要输出的声明节点列表。
 */
function collectDeclarations(ts, file, seeds) {
  const declared = new Map()
  for (const statement of file.statements) {
    const name = statement.name?.getText(file)
    if (typeof name !== 'string') continue
    const interesting =
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    if (!interesting) continue
    declared.set(name, statement)
  }
  const out = new Map()
  const queue = [...seeds]
  while (queue.length > 0) {
    const name = queue.shift()
    const node = declared.get(name)
    if (node === undefined || out.has(name)) continue
    out.set(name, node)
    const text = node.getText(file)
    for (const candidate of declared.keys()) {
      if (candidate === name || out.has(candidate)) continue
      // 只补本文件内被引用到的声明；跨文件的由 SOURCES 显式列出。
      if (new RegExp(`\\b${candidate}\\b`).test(text)) queue.push(candidate)
    }
  }
  return [...out.values()]
}

/**
 * 把一个声明渲染成快照表格行。
 * @param ts TypeScript 模块。
 * @param file 源文件。
 * @param declaration 声明节点。
 * @returns 该声明在快照里的 markdown 片段。
 */
function renderSnapshot(ts, file, declaration) {
  const name = declaration.name.getText(file)
  if (ts.isTypeAliasDeclaration(declaration)) {
    const text = stripComments(declaration.type.getText(file)).replace(/\s+/g, ' ')
    return [`### \`${name}\`（类型别名）`, '', '```ts', text.slice(0, 400), '```', ''].join('\n')
  }
  if (!ts.isInterfaceDeclaration(declaration)) return ''
  const rows = ['### `' + name + '`', '', '| 字段 | 类型 | 可选 |', '| --- | --- | --- |']
  for (const member of declaration.members) {
    if (!ts.isPropertySignature(member)) continue
    const field = member.name.getText(file).replace(/^['"]|['"]$/g, '')
    const optional = member.questionToken === undefined ? '否' : '是'
    const type = stripComments(member.type?.getText(file) ?? 'unknown').replace(/\s+/g, ' ')
    rows.push(`| \`${field}\` | \`${type.replace(/\|/g, '\\|')}\` | ${optional} |`)
  }
  rows.push('')
  return rows.join('\n')
}

/**
 * 读出我们契约文件里各接口的字段名，用于漂移比对。
 * @param ts TypeScript 模块。
 * @returns `接口名 → 字段名集合`。
 */
function readContract(ts) {
  const text = readFileSync(contractFile, 'utf8')
  const file = ts.createSourceFile(contractFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const contract = new Map()
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && ts.isModuleDeclaration(node.parent) === false) {
      const fields = new Set()
      for (const member of node.members) {
        if (!ts.isPropertySignature(member)) continue
        fields.add(member.name.getText(file).replace(/^['"]|['"]$/g, ''))
      }
      contract.set(node.name.getText(file), fields)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return contract
}

const args = parseArgs(process.argv.slice(2))
const base = locateBase(args.from)
ensureAsarCapable(base, args)

const { default: ts } = await import('typescript')
const sections = []
const observed = new Map()
const provenance = []
for (const source of SOURCES) {
  const filePath = join(base, source.pkg, ...source.file.split('/'))
  if (!existsSync(filePath)) {
    console.warn(`跳过（文件不存在）：${source.pkg}/${source.file}`)
    continue
  }
  const text = readFileSync(filePath, 'utf8')
  const file = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declarations = collectDeclarations(ts, file, source.names)
  const rendered = []
  for (const declaration of declarations) {
    const name = declaration.name.getText(file)
    if (ts.isInterfaceDeclaration(declaration)) {
      const fields = new Set()
      for (const member of declaration.members) {
        if (ts.isPropertySignature(member)) fields.add(member.name.getText(file).replace(/^['"]|['"]$/g, ''))
      }
      observed.set(name, fields)
    }
    const block = renderSnapshot(ts, file, declaration)
    if (block !== '') rendered.push(block)
  }
  if (rendered.length > 0) {
    sections.push(`## \`${source.pkg}/${source.file}\``, '', ...rendered)
    provenance.push(`${source.pkg}/${source.file}`)
  }
}

// 漂移比对：只检查"我们声明了、上游却没有"的字段（改名/删除会直接坏掉）。
const contract = readContract(ts)
const errors = []
const notices = []
for (const [name, fields] of contract) {
  const upstream = observed.get(name)
  if (upstream === undefined) continue
  for (const field of fields) {
    if (!upstream.has(field)) errors.push(`\`${name}.${field}\`：我们声明了该字段，但上游已不存在`)
  }
  for (const field of upstream) {
    if (!fields.has(field)) notices.push(`\`${name}.${field}\`：上游新增/未声明，按需补充`)
  }
}

const version = (() => {
  try {
    const manifest = JSON.parse(readFileSync(join(base, 'dsh', 'package.json'), 'utf8'))
    return typeof manifest.version === 'string' ? manifest.version : 'unknown'
  } catch (_error) {
    return 'unknown'
  }
})()

const report = [
  '# DSH 数据形状观测快照（自动生成，请勿手改）',
  '',
  '由 `pnpm run sync-types` 从已安装的 DSH 源码抽取，用于对照 `types/dsh-client.d.ts`。',
  '',
  `- 来源 DSH 版本：\`${version}\``,
  ...provenance.map((line) => `- \`${line}\``),
  '',
  '> 插槽 props（`SidebarWorkspacesProps` 等）不在这里：它们不是磁盘上的包，',
  '> 属于 DSH 编译期的环境声明，只能手写维护。',
  '',
  '## 漂移报告',
  '',
  errors.length === 0 && notices.length === 0 ? '未发现差异。' : '',
  ...errors.map((line) => `- ❌ ${line}`),
  ...notices.map((line) => `- ℹ️ ${line}`),
  '',
  ...sections,
  '',
].join('\n')

if (args.check) {
  const current = existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : ''
  if (current !== report) {
    console.error('观测快照已过期：请运行 pnpm run sync-types 并提交更新。')
    process.exitCode = 1
  }
  if (errors.length > 0) {
    console.error(`发现 ${errors.length} 处契约漂移：\n${errors.join('\n')}`)
    process.exitCode = 1
  }
} else {
  writeFileSync(outputFile, report, 'utf8')
  console.log(`已写入 ${outputFile}（DSH ${version}）`)
}

if (errors.length > 0) {
  console.error(`\n契约漂移（${errors.length}）：\n${errors.join('\n')}`)
  process.exitCode = 1
}
if (notices.length > 0) {
  console.log(`上游新增字段（${notices.length}），按需补充：\n${notices.join('\n')}`)
}
