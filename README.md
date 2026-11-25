# dsh-lectern-panel

给 DeepSeek Harness 加一个左侧栏入口：**在浏览器里直接改 AI 生成的 HTML 幻灯片，改完存回原文件**，不用每次叫 agent 重跑一遍。

面板本身只做控制台的事 —— 选目录、列 deck、起停编辑器、开编辑器；真正的拖动／双击改字／排版发生在 [Lectern](https://github.com/calumhrmurray/lectern) 自己的页面上。`lectern-editor` 已作为本包依赖一起装进来，**装完就能用，不需要你再全局装一次**。

```text
插件页装上 → 左侧栏出现「幻灯片编辑器」→ 选 deck 的上一层目录 → 扫描 → 打开编辑器 → 拖动/改字 → Ctrl+S
```

## 它解决什么

用 skill 做 PPT 越来越多人产出**单文件 HTML**：好看、能跑动效、生成快。但代价是改一个错字也得把 agent 再叫一遍。这个插件把那份 HTML 当文档看，给你一个可视化编辑器，改完直接写回同一个文件（没改过的页按原字节保留，不会整份重排）。

## 安装

打开 DSH 侧栏的「插件」页 →「添加插件」→ 在搜索框里输入包名 `dsh-lectern-panel` → 点安装。终端里也可以用 `dsh plugin add dsh-lectern-panel`（网页版加 `--profile web`）。装好后重启／刷新一次 Web 页面，左侧栏图标列里会出现「幻灯片编辑器」。

`lectern-editor` 是本包的依赖，装这个包就会一起装上，**不需要**另外全局安装 lectern。

要求：DSH 桌面版（有 Web GUI）、Node.js ≥ 20。`lectern-editor` 会随依赖自动装上；如果你机器上已经有全局的 `npm i -g lectern-editor`，它也会被识别（自带的优先）。

## 用法

1. **幻灯片目录** —— 填 deck 的**上一层目录**，不是 `.html` 文件本身。
   > 为什么是上一层：deck 常把 `vendor/`、`assets/` 放在同级或上一层（`<link href="../vendor/...">`）。若把目录限定在 deck 自己那一层，这些样式表会被服务的越界保护挡掉，页面变成白底裸文字。
2. **扫描** —— 列出目录下的 HTML，认出像幻灯片的（含 `<section class="slide">`、reveal.js、`data-slide` 等）排在前面并标 `[deck]`。
3. **打开编辑器** —— 需要的话自动起服务，然后在新标签页打开 Lectern。
4. 在 Lectern 里：点选元素、双击改字、拖动位置、方向键微调，`Ctrl+S` 写回原文件。

面板里的开／关只控制**编辑服务**这一层；插件本身的启用停用在「插件」页。

## 能改什么、不能改什么

| 能 | 不能 |
| --- | --- |
| 文字、图片、位置、尺寸、层级 | 翻页箭头、页码 —— 它们是 deck 的运行时脚本（如 `runtime.js`）现生成的，源码里没有，改了不保存 |
| 任意 CSS 类名／样式的可视化调整 | 动效脚本本身的逻辑（要改还是得动代码） |
| 写回原文件，未改动的页按原字节拷贝 | — |

## 状态与设置

- 面板显示：服务是否在跑、端口、当前目录、日志（可展开）。
- 设置存在 `~/.dsh/dsh-lectern-panel.json`（`root`、`port`，可选 `entry` 手动指定 `cli/index.js`）。
- 服务只监听 `127.0.0.1`；面板的路由挂在 DSH 自己的 Web 服务下，并走 DSH 的连接鉴权（未授权请求返回 401）。
- 插件停用／DSH 退出时会结束 lectern 子进程，不留孤儿端口。

## 开发

```bash
git clone https://github.com/chicken080632-netizen/dsh-lectern-panel.git
cd dsh-lectern-panel
```

没有构建步骤：CLI 半片是 `src/host.js`（ESM），浏览器半片是手写的 `client.js`（用 `window.__ModuleLoader__` 包装，React 由宿主的模块表提供）。改完用 `install_bundle` 装本地目录即可，DSH 会以 junction 方式引入，改文件刷新页面就生效。

```
src/host.js        Host 半片：/lectern 路由、进程管理、目录扫描
client.js          浏览器半片：侧栏图标 + 面板
cordis.patch.yml   bundle 声明
locale/{zh,en}.json  插件页的标题/描述/详情
icon.svg           插件页图标
DETAIL.md(.en)     插件详情页正文
```

## License

MIT。内嵌依赖 [lectern-editor](https://www.npmjs.com/package/lectern-editor)（MIT，作者 Calum Murray）亦为 MIT，见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。

---

## English

A DeepSeek Harness sidebar panel for editing AI-generated HTML slide decks in the browser, with changes saved straight back into the file. It wraps [Lectern](https://github.com/calumhrmurray/lectern): the panel picks a folder, lists decks, starts and stops the local editor, and opens it in a new tab. `lectern-editor` ships as a dependency, so installing the plugin is enough.

Open the Plugins page in DSH, choose **Add plugin**, type the package name `dsh-lectern-panel` and install. From a terminal, `dsh plugin add dsh-lectern-panel` works too (`--profile web` for the web build). `lectern-editor` is a dependency of this package and comes with it, so no separate global Lectern install is needed. Then refresh the Web UI. Point the panel at the deck's parent folder (decks usually reference `../vendor/...`), scan, and edit. Runtime-generated controls such as nav arrows and slide numbers are not in the source and therefore not saved. MIT licensed.
