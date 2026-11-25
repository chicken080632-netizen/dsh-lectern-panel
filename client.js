/**
 * dsh-lectern-panel 的浏览器半片：左侧栏一个入口 + main 里的面板。
 *
 * 手写的 CJS 工厂（不跑打包工具）：React 由宿主模块表提供，样式随组件内联。
 * 面板只做控制台的事——选目录、列 deck、起停 lectern、开浏览器；真正的编辑发生在
 * lectern 自己的页面上（独立端口），所以这里既不需要 iframe，也不需要主题穿透。
 */
window.__ModuleLoader__.load({
  id: 'dsh-lectern-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL_ID = 'lectern'
    const API = '/lectern'

    const isEn = () => String((typeof document !== 'undefined' && document.documentElement.lang) || '').toLowerCase().startsWith('en')
    const t = (zh, en) => (isEn() ? en : zh)

    async function api(path, body) {
      const init = body === undefined
        ? { headers: {} }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      const res = await fetch(API + path, init)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    }

    const CSS = `
.lct-root { height: 100%; overflow: auto; padding: 26px 30px 44px; background: var(--dsw-alias-bg-base, transparent); color: var(--dsw-alias-label-primary, inherit); font-size: 14px; line-height: 1.55; }
.lct-page { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.lct-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 4px; }
.lct-head-main { flex: 1; min-width: 0; }
.lct-title { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }
.lct-sub { margin: 5px 0 0; font-size: 13px; color: var(--dsw-alias-label-secondary, #888); }
.lct-card { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25)); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, transparent); }
.lct-card-head { display: flex; align-items: center; gap: 10px; }
.lct-card-title { margin: 0; font-size: 14px; font-weight: 600; }
.lct-grow { flex: 1; }
.lct-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lct-input { flex: 1; min-width: 220px; height: 34px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4)); border-radius: 8px; background: var(--dsw-alias-bg-base, transparent); color: inherit; font: inherit; font-size: 13px; }
.lct-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 1px; }
.lct-btn { height: 34px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4)); border-radius: 8px; background: var(--dsw-alias-bg-layer-2, transparent); color: inherit; font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.lct-btn:hover:not(:disabled) { border-color: var(--dsw-alias-label-secondary, #888); }
.lct-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 1px; }
.lct-btn:disabled { opacity: 0.5; cursor: default; }
.lct-btn.is-primary { background: var(--dsw-alias-brand-primary, #4d6bfe); border-color: transparent; color: #fff; }
.lct-btn.is-danger { color: var(--dsw-alias-state-error-primary, #d33); border-color: currentColor; }
.lct-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border: 1px solid currentColor; border-radius: 999px; font-size: 12px; color: var(--dsw-alias-state-idle-primary, #888); white-space: nowrap; }
.lct-pill.is-ok { color: var(--dsw-alias-state-success-primary, #2fa36b); }
.lct-pill.is-warn { color: var(--dsw-alias-state-warn-primary, #d99a1f); }
.lct-hint { margin: 0; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary, #888); }
.lct-note { padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25)); border-radius: 10px; background: var(--dsw-alias-bg-layer-2, transparent); font-size: 13px; }
.lct-note.is-error { color: var(--dsw-alias-state-error-primary, #d33); border-color: currentColor; }
.lct-list { display: flex; flex-direction: column; }
.lct-item { display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-radius: 8px; }
.lct-item:hover { background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.1)); }
.lct-item-main { flex: 1; min-width: 0; }
.lct-item-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lct-item-path { font-size: 11px; color: var(--dsw-alias-label-secondary, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lct-log { margin: 0; max-height: 170px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; color: var(--dsw-alias-label-secondary, #888); }
.lct-empty { padding: 6px 4px; font-size: 13px; color: var(--dsw-alias-label-secondary, #888); }
@media (max-width: 640px) { .lct-root { padding: 18px 16px 36px; } .lct-input { min-width: 0; } }
`

    function Btn(props) {
      const cls = ['lct-btn']
      if (props.variant) cls.push(`is-${props.variant}`)
      return h('button', {
        type: 'button',
        className: cls.join(' '),
        onClick: props.onClick,
        disabled: Boolean(props.disabled),
        title: props.title,
      }, props.children)
    }

    function Pill(props) {
      const cls = ['lct-pill']
      if (props.tone) cls.push(`is-${props.tone}`)
      return h('span', { className: cls.join(' ') }, props.children)
    }

    function Card(props) {
      return h('section', { className: 'lct-card' }, props.children)
    }

    function LecternPage() {
      const [state, setState] = React.useState(null)
      const [root, setRoot] = React.useState('')
      const [decks, setDecks] = React.useState([])
      const [scanned, setScanned] = React.useState(false)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      // 轮询失败留下的错误，等下一次成功再清掉；用户操作导致的错误由各操作自己清。
      const pollFailed = React.useRef(false)

      const refresh = React.useCallback(async () => {
        try {
          const data = await api('/state')
          setState(data)
          setRoot(prev => prev || data.root || (data.settings && data.settings.root) || '')
          if (pollFailed.current) {
            pollFailed.current = false
            setError('')
          }
        } catch (err) {
          pollFailed.current = true
          setError(err.message)
        }
      }, [])

      React.useEffect(() => {
        refresh()
        const timer = setInterval(refresh, 4000)
        return () => clearInterval(timer)
      }, [refresh])

      const scan = async () => {
        setBusy('scan')
        setError('')
        setNotice('')
        try {
          const data = await api('/decks', { root })
          setDecks(data.decks || [])
          setScanned(true)
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      const start = async () => {
        setBusy('start')
        setError('')
        setNotice('')
        try {
          const data = await api('/start', { root })
          setState(data)
          setNotice(t('编辑服务已启动。', 'Editor server is running.'))
        } catch (err) {
          setError(err.message)
          refresh()
        } finally {
          setBusy('')
        }
      }

      const stop = async () => {
        setBusy('stop')
        setError('')
        setNotice('')
        try {
          setState(await api('/stop', {}))
          setNotice(t('编辑服务已停止。', 'Editor server stopped.'))
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      const openEditor = async (deckRel) => {
        setError('')
        try {
          const current = state && state.running && state.root === root ? state : await api('/start', { root })
          setState(current)
          if (!current.running) throw new Error(t('服务没起来，先看下面的日志。', 'The server is not running — check the log below.'))
          const base = current.url || `http://127.0.0.1:${current.port}/?ws=local`
          const url = deckRel ? `${base}&deck=${encodeURIComponent(deckRel)}` : base
          window.open(url, '_blank', 'noopener,noreferrer')
        } catch (err) {
          setError(err.message)
        }
      }

      const running = Boolean(state && state.running)
      const found = Boolean(state && state.lectern && state.lectern.found)
      const decksOnly = decks.filter(row => row.deck)
      const others = decks.filter(row => !row.deck)

      return h('div', { className: 'lct-root' },
        h('style', null, CSS),
        h('div', { className: 'lct-page' },
          h('header', { className: 'lct-head' },
            h('div', { className: 'lct-head-main' },
              h('h1', { className: 'lct-title' }, t('幻灯片编辑器', 'Deck editor')),
              h('p', { className: 'lct-sub' }, t(
                '在浏览器里直接改 AI 生成的 HTML 幻灯片，保存写回原文件，不用再叫 agent 重跑。',
                'Edit AI-generated HTML slides in the browser; saves go back into the same file, no agent round trip.',
              )),
            ),
            h(Pill, { tone: running ? 'ok' : found ? null : 'warn' },
              running ? `${t('运行中', 'Running')} · ${state.port}` : found ? t('未启动', 'Stopped') : t('没装 lectern', 'Not installed'),
            ),
          ),

          error ? h('div', { className: 'lct-note is-error' }, error) : null,
          notice ? h('div', { className: 'lct-note' }, notice) : null,

          h(Card, null,
            h('div', { className: 'lct-card-head' },
              h('h2', { className: 'lct-card-title' }, t('1 · 幻灯片目录', '1 · Deck folder')),
              h('span', { className: 'lct-grow' }),
              h(Btn, { onClick: scan, disabled: busy === 'scan' || !root.trim() }, busy === 'scan' ? t('扫描中…', 'Scanning…') : t('扫描 deck', 'Scan')),
            ),
            h('div', { className: 'lct-row' },
              h('input', {
                className: 'lct-input',
                value: root,
                spellCheck: false,
                placeholder: 'C:\\path\\to\\deck-parent-folder',
                onChange: (event) => { setRoot(event.target.value); setScanned(false); setDecks([]) },
                'aria-label': t('幻灯片目录', 'Deck folder'),
              }),
            ),
            h('p', { className: 'lct-hint' }, t(
              '要选「deck 的上一层」：deck 常把 vendor/、assets/ 之类放在同级或上一层，选中 deck 自己那层会让这些样式表 404。',
              'Pick the folder one level above the deck: decks usually reference vendor/ and assets/ from there, and pointing at the deck folder itself makes those stylesheets 404.',
            )),
          ),

          scanned ? h(Card, null,
            h('div', { className: 'lct-card-head' },
              h('h2', { className: 'lct-card-title' }, t('2 · 找到的幻灯片', '2 · Decks found')),
              h('span', { className: 'lct-grow' }),
              h('span', { className: 'lct-hint' }, `${decksOnly.length} ${t('个 deck', 'decks')} · ${others.length} ${t('个普通页面', 'other pages')}`),
            ),
            decks.length === 0
              ? h('p', { className: 'lct-empty' }, t('这个目录下没找到 .html 文件。', 'No .html files in that folder.'))
              : h('div', { className: 'lct-list' },
                decksOnly.concat(others).map(row => h('div', { className: 'lct-item', key: row.rel },
                  h('div', { className: 'lct-item-main' },
                    h('div', { className: 'lct-item-name' }, `${row.name}${row.deck ? '' : t('（不像幻灯片）', ' (not a deck)')}`),
                    h('div', { className: 'lct-item-path', title: row.rel }, row.rel),
                  ),
                  h(Btn, { onClick: () => openEditor(row.rel) }, t('在浏览器编辑', 'Edit in browser')),
                )),
              ),
          ) : null,

          h(Card, null,
            h('div', { className: 'lct-card-head' },
              h('h2', { className: 'lct-card-title' }, t('3 · 编辑服务', '3 · Editor server')),
              h('span', { className: 'lct-grow' }),
              h(Btn, { onClick: running ? stop : start, disabled: busy === 'start' || busy === 'stop' || !root.trim(), variant: running ? 'danger' : 'primary' },
                busy === 'start' ? t('启动中…', 'Starting…') : running ? t('停止', 'Stop') : t('启动', 'Start'),
              ),
              h(Btn, { onClick: () => openEditor(null), disabled: !root.trim() }, t('打开编辑器', 'Open editor')),
            ),
            h('div', { className: 'lct-row' },
              h(Pill, { tone: running ? 'ok' : null }, running ? `127.0.0.1:${state.port}` : t('未运行', 'Not running')),
              h(Pill, { tone: found ? null : 'warn' }, found ? t('已找到 lectern', 'Lectern found') : t('未找到 lectern', 'Lectern missing')),
            ),
            found ? null : h('p', { className: 'lct-hint' }, t(
              '没找到 lectern-editor。先在终端跑 `npm i -g lectern-editor`，回来点「启动」即可。',
              'lectern-editor was not found. Run `npm i -g lectern-editor` in a terminal, then press Start.',
            )),
            state && state.log ? h('details', null,
              h('summary', { className: 'lct-hint' }, t('服务日志', 'Server log')),
              h('pre', { className: 'lct-log' }, state.log),
            ) : null,
          ),

          h('p', { className: 'lct-hint' }, t(
            '编辑在 lectern 自己的标签页里进行：拖拽、双击改字、Ctrl+S 写回原文件。导航箭头和页码是 deck 的运行时脚本生成的，改了不会保存。面板的开关在「插件」页；这里管的是编辑服务的开关。',
            'Editing happens in the Lectern tab: drag, double-click to edit text, Ctrl+S writes back. Nav arrows and page numbers come from the deck runtime script, so edits there do not persist. Turn this bundle on or off on the Plugins page; the switches here control the editor server.',
          )),
        ),
      )
    }

    function PanelIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      },
      h('rect', { x: 2.75, y: 3.5, width: 18.5, height: 12.5, rx: 2.2 }),
      h('path', { d: 'M5.75 7.5h7.5' }),
      h('path', { d: 'M5.75 11h4.5' }),
      h('path', { d: 'M8.75 19.5h6.5' }),
      h('path', { d: 'M13 12.6l5.2 2.1-2.25 0.95-0.95 2.25z', fill: 'currentColor', stroke: 'none' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // 面板：侧栏点了那枚图标之后 main 显示它。
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, LecternPage))
        // 侧栏图标：label 是 thunk，每次投影重读，换语言自动跟随。
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 7,
          label: () => t('幻灯片编辑器', 'Deck editor'),
        }, PanelIcon))
      },
    }
  },
})
