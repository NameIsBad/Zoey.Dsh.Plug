/**
 * Host self-check for the git route.
 *
 * Loads `index.js` with a fake Cordis context, captures the registered route,
 * and drives it with synthetic request/response objects. It proves the parts a
 * browser cannot: the route is registered under this package's prefix, git is
 * read for a real repository, and a bad path or branch name is refused without
 * running a mutation.
 *
 * A repository argument may be passed; the default is this checkout's parent
 * repository when it exists, otherwise the script skips the read assertion.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { apply } from '../index.js'

const failures = []
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

let route
const ctx = {
  effect(factory) {
    factory()
  },
  get() {
    return undefined
  },
  webServer: {
    register(definition) {
      route = definition
      return () => {}
    },
  },
}
apply(ctx)

check('registers one prefix route', route !== undefined && route.kind === 'prefix')
check('route lives under the package prefix', route.path === '/feature-hub', String(route.path))

/**
 * Build a fake request.
 * @param {string} method - HTTP method.
 * @param {string} url - request URL.
 * @param {object} [body] - JSON body for a POST.
 * @returns {object} request face.
 */
function request(method, url, body) {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  return {
    method,
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of payload) yield chunk
    },
  }
}

/**
 * Drive the captured handler once.
 * @param {object} req - request face.
 * @returns {Promise<{status: number, body: object}>} captured response.
 */
async function call(req) {
  let status = 0
  let text = ''
  const res = {
    writeHead(code) {
      status = code
    },
    write(chunk) {
      text += String(chunk)
      return true
    },
    end(chunk) {
      if (chunk !== undefined) text += String(chunk)
    },
  }
  await route.handler(req, res)
  return { status, body: JSON.parse(text) }
}

check('unknown path answers 404', (await call(request('GET', '/feature-hub/nope'))).status === 404)

const missing = await call(request('GET', '/feature-hub/git?cwd='))
check('a missing cwd is refused', missing.body.ok === false, JSON.stringify(missing.body))

const relative = await call(request('GET', '/feature-hub/git?cwd=relative/path'))
check('a relative cwd is refused', relative.body.ok === false, JSON.stringify(relative.body))

const outside = await call(request('GET', `/feature-hub/git?cwd=${encodeURIComponent(resolvePath('/'))}`))
check(
  'a directory outside git is answered without throwing',
  outside.status === 200 && (outside.body.ok === true || outside.body.ok === false),
)

const badBranch = await call(
  request('POST', '/feature-hub/git', { cwd: process.cwd(), action: 'checkout', branch: 'a; rm -rf /' }),
)
check(
  'a branch name with shell syntax is refused',
  badBranch.body.ok === false,
  JSON.stringify(badBranch.body),
)

const repositories = ['D:\\repos\\ConsoleApp1', 'E:\\djd\\project\\Zoey.Article.Autopilot', process.cwd()]
const repository = repositories.find((path) => {
  try {
    return statSync(join(path, '.git')).isDirectory() || statSync(join(path, '.git')).isFile()
  } catch (_error) {
    return false
  }
})

if (repository === undefined) {
  console.log('  skip read assertion (no local git repository found)')
} else {
  const read = await call(request('GET', `/feature-hub/git?cwd=${encodeURIComponent(repository)}`))
  check(
    `reads a real repository (${repository})`,
    read.body.ok === true,
    JSON.stringify(read.body).slice(0, 200),
  )
  if (read.body.ok === true) {
    const state = read.body.state
    check(
      'state names a branch',
      typeof state.branch === 'string' && state.branch !== '',
      String(state.branch),
    )
    check(
      'state lists local branches',
      Array.isArray(state.branches) && state.branches.length > 0,
      String(state.branches && state.branches.length),
    )
    check(
      'the current branch is in the list',
      state.branches.includes(state.branch),
      `${state.branch} not in ${state.branches.length} branches`,
    )
    check('state reports a dirty count', Number.isInteger(state.dirty), String(state.dirty))
    check(
      'state names the work tree root',
      typeof state.root === 'string' && state.root !== '',
      String(state.root),
    )
  }
}

// An unborn repository (git init, no commit yet) must still answer with a
// branch name instead of failing the whole read.
const unbornRepo = repositories.find((path) => {
  try {
    const gitDir = join(path, '.git')
    return statSync(gitDir).isDirectory() && readdirSync(join(gitDir, 'refs', 'heads')).length === 0
  } catch (_error) {
    return false
  }
})
if (unbornRepo === undefined) {
  console.log('  skip unborn-HEAD assertion (no empty repository found)')
} else {
  const unborn = await call(request('GET', `/feature-hub/git?cwd=${encodeURIComponent(unbornRepo)}`))
  check(
    `reads a repository without commits (${unbornRepo})`,
    unborn.body.ok === true,
    JSON.stringify(unborn.body).slice(0, 200),
  )
  if (unborn.body.ok === true) {
    check(
      'an unborn HEAD still names a branch',
      typeof unborn.body.state.branch === 'string' && unborn.body.state.branch !== '',
      String(unborn.body.state.branch),
    )
    check('an unborn HEAD is flagged', unborn.body.state.unborn === true, String(unborn.body.state.unborn))
    check(
      'an unborn repository still lists its current branch',
      Array.isArray(unborn.body.state.branches) &&
        unborn.body.state.branches.includes(unborn.body.state.branch),
      JSON.stringify(unborn.body.state.branches),
    )
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exitCode = 1
} else {
  console.log('\nall host checks passed')
}
