/**
 * dsh-lectern-panel 的 Host 半片。
 *
 * 它只做三件事：
 *   1. 找到 lectern-editor（本包自带的依赖优先，其次全局安装的那份 cli/index.js）；
 *   2. 按面板的请求起一个只监听 127.0.0.1 的 lectern 进程，并负责收尸；
 *   3. 在 DSH 自己的 Web 服务上挂 /lectern 路由，让浏览器半片能查状态、启动、停止、列 deck。
 *
 * 编辑器本身仍然是 lectern 自己的页面，在独立端口上跑；这里不代理它的静态资源。
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import net from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROUTE = '/lectern'
const POST_ONLY = new Set(['/start', '/stop', '/decks'])
const DEFAULT_PORT = 8765
const PORT_SCAN = 40
const READY_TIMEOUT = 20000
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', '.cache', '.next'])
const DECK_MARK = /class\s*=\s*["'][^"']*\bslide\b|reveal\.js|data-slide/i

/** 正在跑的 lectern 进程与它当前的根目录。插件卸载时会被收掉。 */
const runtime = { child: null, port: null, root: null, log: '' }

// ------------------------------------------------------------------ 设置

function settingsFile() {
  return join(homedir(), '.dsh', 'dsh-lectern-panel.json')
}

/** 早期版本（包名还叫 @local/dsh-lectern 时）写在 lectern.json，读得到就继续用。 */
function legacySettingsFile() {
  return join(homedir(), '.dsh', 'lectern.json')
}

async function readFileJson(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function readSettings() {
  return (await readFileJson(settingsFile())) ?? (await readFileJson(legacySettingsFile())) ?? {}
}

async function writeSettings(patch) {
  try {
    const next = { ...(await readSettings()), ...patch }
    await mkdir(dirname(settingsFile()), { recursive: true })
    await writeFile(settingsFile(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch {
    // 记不住上次用的目录不影响编辑，静默即可。
  }
}

// ------------------------------------------------------------- lectern 本体

const LECTERN_CLI = 'lectern-editor/cli/index.js'

/**
 * 本包自带的那份 lectern-editor：装插件时随依赖一起装进同一层 node_modules，
 * 所以用户不需要自己再跑一次 `npm i -g lectern-editor`。
 * 依次从「本模块所在位置」「profile 根目录」两个基点解析——DSH 装 bundle 时可能用
 * junction 指向工作区，此时从模块真实路径往上是找不到 profile 的 node_modules 的。
 */
function bundledEntry() {
  const bases = [import.meta.url]
  const profile = process.env.DSH_PROFILE_DIR
  if (profile) bases.push(pathToFileURL(join(profile, 'package.json')).href)
  for (const base of bases) {
    try {
      const found = createRequire(base).resolve(LECTERN_CLI)
      if (existsSync(found)) return found
    } catch {
      // 这一层没有，换下一个基点。
    }
  }
  return null
}

/** 可能的全局安装位置，按可信度排序。 */
function entryCandidates(configured) {
  const list = []
  if (typeof configured === 'string' && configured.trim()) list.push(configured.trim())
  const bundled = bundledEntry()
  if (bundled) list.push(bundled)
  const join3 = (...parts) => join(...parts)
  for (const prefix of [process.env.APPDATA, process.env.LOCALAPPDATA]) {
    if (prefix) list.push(join3(prefix, 'npm', 'node_modules', 'lectern-editor', 'cli', 'index.js'))
  }
  list.push(join3(homedir(), '.npm-global', 'lib', 'node_modules', 'lectern-editor', 'cli', 'index.js'))
  list.push('/usr/local/lib/node_modules/lectern-editor/cli/index.js')
  list.push('/opt/homebrew/lib/node_modules/lectern-editor/cli/index.js')
  return list
}

/** 解析出真正存在的 cli/index.js；找不到返回 null。 */
function resolveLectern(configured) {
  for (const candidate of entryCandidates(configured)) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    } catch {
      // 权限或路径问题，继续试下一个。
    }
  }
  return null
}

// ------------------------------------------------------------------ 端口

function portFree(port) {
  return new Promise((done) => {
    const probe = net.createServer()
    probe.once('error', () => done(false))
    probe.once('listening', () => probe.close(() => done(true)))
    probe.listen(port, '127.0.0.1')
  })
}

async function pickPort(preferred) {
  const base = Number.isInteger(preferred) && preferred > 0 && preferred < 65536 ? preferred : DEFAULT_PORT
  for (let offset = 0; offset < PORT_SCAN; offset++) {
    const candidate = base + offset
    if (candidate > 65535) break
    if (await portFree(candidate)) return candidate
  }
  throw new Error(`从 ${base} 起的 ${PORT_SCAN} 个端口都被占用了，先关掉别的 lectern 再试。`)
}

// ------------------------------------------------------------------ 进程

/**
 * 用当前运行时自己的可执行文件启动 node 脚本：Electron 里 process.execPath 是 electron.exe，
 * 配合 ELECTRON_RUN_AS_NODE=1 就是一个 node；纯 node 运行时这个变量没有副作用。
 */
function spawnEntry(executable, entry, args, env) {
  return spawn(executable, [entry, ...args], {
    cwd: dirname(entry),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function waitReady(port, isDead) {
  const deadline = Date.now() + READY_TIMEOUT
  const url = `http://127.0.0.1:${port}/`
  return new Promise((done, fail) => {
    const tick = async () => {
      if (isDead()) {
        fail(new Error('lectern 进程启动后立刻退出了，看下面的日志。'))
        return
      }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1200) })
        if (res.status < 500) {
          done()
          return
        }
      } catch {
        // 还没起来，继续等。
      }
      if (Date.now() > deadline) {
        fail(new Error(`等了 ${Math.round(READY_TIMEOUT / 1000)} 秒，lectern 还没在这个端口上响应。`))
        return
      }
      setTimeout(tick, 250)
    }
    tick()
  })
}

function logChunk(chunk) {
  runtime.log = `${runtime.log}${chunk}`.slice(-6000)
}

async function startServer(options) {
  const root = resolve(String(options?.root ?? '').trim() || '')
  const known = existsSync(root) ? statSync(root) : null
  if (!known) throw new Error(`目录不存在：${root}`)
  if (!known.isDirectory()) throw new Error(`这里要的是 deck 的上一层目录，不是文件：${root}`)

  const settings = await readSettings()
  const entry = resolveLectern(settings.entry)
  if (!entry) {
    throw new Error('没找到 lectern-editor：dsh-lectern-panel 本该带着它一起装进来，说明依赖没装上。重装本插件，或在终端跑一次 `npm i -g lectern-editor` 兜底。')
  }
  const distIndex = join(dirname(dirname(entry)), 'dist', 'index.html')
  if (!existsSync(distIndex)) throw new Error(`lectern 安装不完整，缺 ${distIndex}，重装一次 lectern-editor。`)

  await stopServer()
  const port = await pickPort(settings.port)

  // 先试运行时自带的 node，再退回 PATH 上的 node。
  const attempts = [
    { label: 'bundled', executable: process.execPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NO_COLOR: '1' } },
    { label: 'path', executable: 'node', env: { ...process.env, NO_COLOR: '1' } },
  ]
  const failures = []
  for (const attempt of attempts) {
    runtime.log = ''
    let dead = false
    const child = spawnEntry(attempt.executable, entry, [root, '--port', String(port), '--host', '127.0.0.1', '--no-open'], attempt.env)
    child.stdout?.on('data', logChunk)
    child.stderr?.on('data', logChunk)
    child.once('error', (error) => {
      dead = true
      logChunk(`\n[spawn failed] ${error?.message ?? error}`)
    })
    child.once('exit', (code, signal) => {
      dead = true
      logChunk(`\n[lectern exited code=${code} signal=${signal}]`)
      // 进程被别人（或系统）收掉时，面板不该还显示「运行中」。
      if (runtime.child === child) {
        runtime.child = null
        runtime.port = null
        runtime.log = `${runtime.log}\n[编辑服务已退出，可以重新启动]`.trim()
      }
    })
    runtime.child = child
    runtime.port = port
    runtime.root = root
    try {
      await waitReady(port, () => dead)
      await writeSettings({ root, port })
      return snapshot(await readSettings())
    } catch (error) {
      failures.push(`${attempt.label}: ${error?.message ?? error}`)
      await stopServer()
    }
  }
  throw new Error(`lectern 启动失败。\n${failures.join('\n')}\n${runtime.log.slice(-1200)}`)
}

async function stopServer() {
  const child = runtime.child
  runtime.child = null
  runtime.port = null
  if (!child) return
  await new Promise((done) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      done()
    }
    child.once('exit', finish)
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      // 已经没了。
    }
    setTimeout(finish, 4000)
  })
}

// ------------------------------------------------------------------ deck 扫描

function collectDecks(root) {
  const found = []
  const walk = (dir, depth) => {
    if (depth > 4 || found.length >= 300) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (found.length >= 300) return
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full, depth + 1)
        continue
      }
      if (!entry.isFile() || !/\.html?$/i.test(entry.name)) continue
      let isDeck = false
      try {
        const info = statSync(full)
        if (info.size <= 8_000_000) isDeck = DECK_MARK.test(readFileSync(full, 'utf8').slice(0, 400_000))
      } catch {
        // 读不了就按普通 html 列出来。
      }
      found.push({ rel: relative(root, full).split(sep).join('/'), name: entry.name, deck: isDeck })
    }
  }
  walk(root, 0)
  found.sort((a, b) => (a.deck === b.deck ? a.rel.localeCompare(b.rel) : a.deck ? -1 : 1))
  return found
}

// ------------------------------------------------------------------ 状态与路由

function snapshot(settings) {
  const entry = resolveLectern(settings?.entry)
  const running = Boolean(runtime.child) && Boolean(runtime.port)
  return {
    running,
    port: runtime.port,
    root: runtime.root ?? settings?.root ?? '',
    url: running ? `http://127.0.0.1:${runtime.port}/?ws=local` : null,
    log: runtime.log.slice(-2500),
    lectern: { found: Boolean(entry), entry: entry ?? null },
    settings: { root: settings?.root ?? '', port: settings?.port ?? DEFAULT_PORT },
  }
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        fail(new Error('请求体太大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return done({})
      try {
        done(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        done({})
      }
    })
    req.on('error', fail)
  })
}

async function route(ctx, req, res) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname.startsWith(ROUTE) ? url.pathname.slice(ROUTE.length) || '/' : url.pathname
  const method = req.method ?? 'GET'

  if (method === 'GET' && (path === '/' || path === '/state')) {
    const settings = await readSettings()
    json(res, 200, snapshot(settings))
    return
  }

  if (method === 'POST' && path === '/start') {
    const body = await readBody(req)
    const settings = await readSettings()
    if (body?.port !== undefined && Number.isInteger(body.port)) await writeSettings({ port: body.port })
    const next = await startServer({ root: body?.root ?? settings.root })
    json(res, 200, next)
    return
  }

  if (method === 'POST' && path === '/stop') {
    await stopServer()
    json(res, 200, snapshot(await readSettings()))
    return
  }

  if (method === 'POST' && path === '/decks') {
    const body = await readBody(req)
    const settings = await readSettings()
    const root = resolve(String(body?.root ?? settings.root ?? '').trim() || '')
    const known = existsSync(root) ? statSync(root) : null
    if (!known || !known.isDirectory()) {
      json(res, 400, { error: `目录不存在：${root}` })
      return
    }
    await writeSettings({ root })
    json(res, 200, { root, decks: collectDecks(root) })
    return
  }

  // 接口存在但不接受这个方法时，别回「未知的路由」，否则一眼看不出是方法用错了。
  if (POST_ONLY.has(path)) {
    json(res, 405, { error: `${path} 只接受 POST，收到的是 ${method}` })
    return
  }

  json(res, 404, { error: `未知的路由：${method} ${path}` })
}

export const name = 'dsh-lectern-panel'

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      try {
        // Web 服务不替插件路由鉴权，每个请求自己过一遍 Host/Origin 与登录凭证检查。
        const rejection = ctx.get('connection')?.requestRejection?.({ headers: req.headers })
        if (rejection) {
          json(res, rejection, { error: '未授权' })
          return
        }
        await route(ctx, req, res)
      } catch (error) {
        if (res.headersSent) {
          res.end()
          return
        }
        json(res, error?.status && Number.isInteger(error.status) ? error.status : 500, {
          error: error?.message ? String(error.message) : String(error),
        })
      }
    },
  }), 'dsh-lectern: /lectern routes')

  // 插件被关掉时别留下一个孤儿 lectern（它还在写用户的 deck 文件）。
  ctx.effect(() => () => {
    stopServer().catch(() => {})
  }, 'dsh-lectern: stop the editor process on unload')
}
