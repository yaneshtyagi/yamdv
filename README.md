# YAMDV

**Yet Another MarkDown Viewer** — a quiet, local-first Markdown reader built with React and Electron.

## Run

Requires Node.js 22.12+ (Node.js 24 LTS recommended) and npm.

```sh
npm install
npm run dev           # web app: http://127.0.0.1:5173
npm run desktop       # build and launch the desktop app
npm run desktop:dev   # Electron with Vite hot reload
```

## Build and package

```sh
npm run build         # static web app in dist/
npm run preview       # preview the web build
npm run package       # unpacked native app in release/
npm run dist          # installer/archive for the current platform
```

The macOS app is `release/mac-arm64/YAMDV.app` on Apple Silicon (or `release/mac/YAMDV.app` on Intel). Windows uses NSIS and Linux uses AppImage. Build installers on their target operating systems. Distribution builds are unsigned; public distribution requires your own signing/notarization credentials. Serve `dist/` with any static web server, including under a subdirectory.

## Reading

- Open one or multiple `.md`, `.markdown`, `.mdown`, or `.mkd` files, or recursively open a folder. Hidden folders and `node_modules` are skipped on desktop.
- Use the Folder, Favorites, and History tabs. Filter by file name or relative path. Star any file in a list or the active document's toolbar.
- History stores the 200 most recently opened distinct files. Favorites and history survive restarts. Reopening a file moves it to the top of history.
- Choose Light, Dark, or System. System follows OS changes immediately.
- Use **⌘/Ctrl+O** to open files or **⌘/Ctrl+Shift+O** to open a folder. Drop files into the window to read them.
- GitHub-flavored tables, task lists, code blocks, relative Markdown links, heading links, and images are supported. Open the containing folder for relative document links and images. External HTTP(S) links open in your browser.

## Privacy and browser behavior

No account, backend, telemetry, or file upload is used. Documents are read locally. External images referenced in a document may contact their host. Raw HTML in Markdown is disabled.

Browsers cannot retain unrestricted disk access. The web app saves text snapshots for history and favorites in localStorage so they remain readable after reload; reopen files/folders to refresh changed documents and restore related images. Browser storage quotas apply, and a visible error reports failed persistence. Desktop history reads the latest file from disk when selected and stores picker-approved paths in its local application data. A moved/deleted file shows an error; reopen it at its new location.

The desktop renderer is sandboxed with Node integration disabled, context isolation, a narrow preload bridge, and a content security policy. File access is limited to paths granted through native pickers. Local image requests are restricted to image extensions within granted document directories. No Markdown content is executed as JavaScript.

## Verification

```sh
npm test              # history limit, deduplication, file types, relative paths
node tests/smoke.mjs   # Electron launch + renderer interaction and persistence
```

The smoke test uses an isolated profile in `/tmp/yamdv-smoke-profile`. Run `npm run build` before it. It verifies light/dark controls, Markdown tables, script isolation, favorites and reopening saved browser documents after reload.
