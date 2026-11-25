# Deck editor (dsh-lectern-panel)

Adds a sidebar entry that drives the Lectern visual editor for HTML slide decks: pick a folder, list the decks in it, start a server bound to `127.0.0.1`, and edit slides in a browser tab where `Ctrl+S` writes back into the same file.

## What it does

- Sidebar icon `Deck editor` (order 7); selecting it opens the panel.
- The panel has three groups: choose a folder, scan for decks, start or stop the editor server. "Edit in browser" opens `http://127.0.0.1:<port>/?ws=local&deck=<relative path>`.
- The port is the first free one from 8765 upward. On a successful start the folder and port are remembered in `~/.dsh/dsh-lectern-panel.json`.
- The spawned lectern process is stopped when this plugin is turned off or DSH exits, so it cannot keep writing to your decks.

## Dependency

**No separate install needed.** `lectern-editor` is a normal npm dependency of this package and is installed with it; the host half prefers that copy. An existing global `npm i -g lectern-editor` is still picked up if present.

Lookup order for `cli/index.js`: `entry` from `~/.dsh/dsh-lectern-panel.json`, then the bundled dependency, then `%APPDATA%\npm\node_modules\lectern-editor`, `%LOCALAPPDATA%\npm\node_modules\lectern-editor`, `~/.npm-global/lib/node_modules/…`, `/usr/local/lib/…`, `/opt/homebrew/lib/…`.

## Pick the right folder

Choose the folder **one level above** the deck. Many HTML decks keep `vendor/` and `assets/` next to the deck folder and reference them as `../vendor/...`; pointing this panel at the deck folder itself makes those stylesheets 404 and the page renders as unstyled text.

## What saves, what does not

- Saved: text, images, size, position, stacking, grouping, inserting and deleting elements. Only the slides you touched are rewritten; the rest is copied byte for byte.
- Not saved: anything the deck's own runtime script generates (nav arrows, page numbers, the `is-active` state). Those do not exist in the file, so editing them leaves nothing behind.
- The editor is Lectern's own page on its own port and does not use DSH theme tokens; DSH only starts, stops, and opens it.
