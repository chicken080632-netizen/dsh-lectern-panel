# 幻灯片编辑器 (dsh-lectern-panel)

给 DSH 的左侧栏加一个入口：选中目录 → 列出 deck → 起一个只监听 `127.0.0.1` 的 Lectern 编辑器 → 在浏览器标签页里直接改 HTML 幻灯片，`Ctrl+S` 写回原文件。

## 它做什么

- 左侧栏图标：`幻灯片编辑器`（order 7），点开后进入面板。
- 面板三段：选目录、扫描 deck、起停编辑服务；点某一页的「在浏览器编辑」会直接打开 `http://127.0.0.1:<port>/?ws=local&deck=<相对路径>`。
- 端口从 8765 起找一个空闲的；启动成功后把目录和端口记进 `~/.dsh/dsh-lectern-panel.json`，下次打开面板自动带出来。
- 插件关掉、或 DSH 退出时，它起的 lectern 进程会被收掉，不留孤儿进程继续写你的 deck。

## 依赖

**不需要单独装 lectern。** `lectern-editor` 是本包的 npm 依赖，装插件时一起装进来，Host 半片会优先用这一份；如果你机器上本来就有全局的 `npm i -g lectern-editor`，它也能被找到（自带的优先）。

找 `cli/index.js` 的顺序：`~/.dsh/dsh-lectern-panel.json` 里的 `entry` → 本包依赖 → `%APPDATA%\npm\node_modules\lectern-editor` → `%LOCALAPPDATA%\npm\node_modules\lectern-editor` → `~/.npm-global/lib/node_modules/…` → `/usr/local/lib/…` → `/opt/homebrew/lib/…`。装上后点「启动」，状态变成「已找到 lectern」即通。

## 目录要选对

选 **deck 的上一层**。很多 HTML 幻灯片把 `vendor/`、`assets/` 放在 deck 目录的上一级，用 `../vendor/...` 引用；如果直接把目录选成 deck 自己那层，这些样式表会 404，页面变成白底裸文字。

## 能改什么、不能改什么

- 能改：文字、图片、尺寸、位置、层级、成组、增删元素，保存只写回改动过的那一页，其余按原字节拷贝。
- 不能改：由 deck 自己的运行时脚本生成的东西（导航箭头、页码、`is-active` 状态）。它们在源码里不存在，改完保存不会留下。
- 编辑器是 lectern 自己的页面，跑在独立端口上，不借用 DSH 的主题；DSH 这里只负责起停与开标签页。

## 面板上还有一条

面板底部会显示服务日志尾部；服务启动失败时先看它——最常见的原因是目录选成了文件本身。插件自带的依赖万一没装上，重启一次插件即可。
