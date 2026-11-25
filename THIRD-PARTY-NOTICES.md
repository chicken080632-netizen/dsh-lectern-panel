# Third-party notices

This package depends on and launches the following third-party software. It is
installed as a normal npm dependency; no source of it is vendored into this
repository.

## lectern-editor

- Version: 2.4.0 (range `^2.4.0`)
- Author: Calum Murray
- License: MIT
- Repository: https://github.com/calumhrmurray/lectern
- npm: https://www.npmjs.com/package/lectern-editor

A visual drag-and-drop editor for AI-generated slide decks. This plugin only
starts its CLI (`cli/index.js`) as a child process on `127.0.0.1`, points it at
the folder you choose, and links you to its own page. The editing UI, the
write-back logic, and its distribution assets all remain Lectern's own work.

MIT license text of the dependency is included in the installed package under
`node_modules/lectern-editor/LICENSE`.
