# YAMDV

**Yet Another MarkDown Viewer** — a compact, local-first Markdown reading desk built with React and Electron. Version **0.0.1**.

## Run

Use Node.js 24 LTS or a newer supported Node.js release and npm.

```sh
npm install
npm run dev           # browser app at http://127.0.0.1:5173
npm run desktop       # production renderer in Electron
npm run desktop:dev   # Electron + Vite hot reload
npm run build         # static browser app in dist/
npm run preview       # serve the production browser build
```

Serve `dist/` with a static HTTP(S) server; it also works below a URL subdirectory. Browser file APIs require a secure context (HTTPS or localhost). Directly opening the web build's HTML from disk is not supported; use Electron for desktop file access.

```sh
npm run package       # unpacked application for the current OS in release/
npm run dist          # platform installer/archive
```

On Apple Silicon macOS, the unpacked app is `release/mac-arm64/YAMDV.app`. Intel macOS uses `release/mac/YAMDV.app`. Windows targets NSIS and Linux targets AppImage; build on the corresponding target OS. Signing/notarization credentials are not included. The provided build is unsigned.

## Reading and windows

The two toolbar buttons open Markdown files or a folder. Supported extensions: `.md`, `.markdown`, `.mdown`, `.mkd`. Folder opening is recursive; hidden entries, symbolic-link entries, and `node_modules` are skipped on desktop. Dropped files are also supported.

Opening a file replaces the active tab. **New Tab** creates an empty tab, and the next file opens there. To keep the current document, use **Open in New Tab** from a file's action menu, modified-click (Cmd/Ctrl-click or Shift-click), or middle-click. Selecting multiple files in one picker uses the active tab for the first file and creates tabs for the rest. Opening a folder opens its first Markdown file and lists the rest in the sidebar.

Tabs retain their content, scroll position, and document zoom while switching. Close, close others, reopen closed, and next/previous tab commands are available. Switching tabs does not add history entries. Open tabs and closed-tab stacks are window-local and last for the current session.

Electron supports **New Window** with independent tabs, folder, workspace selection, search, scroll, and zoom. A second launch for the same application profile opens another window in the existing process, keeping one authoritative library writer. Browser **New Window** requests another browser context; the browser decides whether to show a tab or window.

Favorites, the last **200 distinct opened references**, theme, Vim preference, and workspace definitions persist and are shared across windows of the same desktop profile/browser origin. Desktop uses an atomic JSON store with serialized operations; browsers use IndexedDB read/write transactions and BroadcastChannel notifications. Operations apply to the latest library rather than replacing it with stale window snapshots. Legacy `yamdv.favorites`, `yamdv.history`, and `yamdv.theme` localStorage values migrate once, without deleting the original values.

## Navigation and appearance

The compact sidebar has Folder, Favorites, History, Outline, and Workspaces sections. Icons have accessible labels and tooltips. File lists can be filtered by file name or relative path. Use each file's star button or **Toggle Favorite** to keep it in Favorites.

Outline is built from the Markdown syntax tree, includes H1–H6 and setext headings, ignores fenced code, and understands inline formatting. A shared GitHub-style slugger assigns unique IDs to duplicate headings, so outline and heading links agree. Selecting an entry reveals and highlights the heading.

The theme icon opens Light, Dark, and System choices with the selected setting checked. System follows OS changes immediately. GitHub Markdown CSS is scoped to the reading area and follows the selected theme.

Default zoom commands change **only the active document** (50–300%). Tabs keep their own zoom. The status-bar percentage resets it. Separate **Zoom Application UI In/Out/Reset** commands change the whole interface (70–150%). Diagram zoom is independent of both.

## Reference workspaces

A workspace is a virtual hierarchy of references to documents; importing or organizing references does not copy, move, edit, or delete the source documents. Top-level workspaces are independent collections. Their nested workspaces act as virtual folders.

1. Choose **Create Workspace** in the command palette, application menu, or Workspaces sidebar.
2. Select a workspace by clicking its name; its selected row is highlighted.
3. Use **Add Files to Workspace** or **Add Folder to Workspace**. Folder import recursively discovers Markdown files and creates a corresponding virtual hierarchy. It is a one-time reference import, not a live directory subscription.
4. Use a workspace's actions menu to create nested workspaces, rename, add references, check availability, clean, or remove the workspace.
5. Use a file's actions menu to retry/grant access, relink its reference, or **Remove from Workspace**. These actions also appear in the command palette/native Workspace menu after focusing a workspace file.

The same file is deduplicated across a top-level workspace and its descendants, but can appear in another top-level workspace. Stable node IDs keep nested references addressable across windows. Relinking to a file already in that workspace is rejected.

Availability is checked asynchronously at import/library changes and window focus, and can be refreshed explicitly. Missing references show a distinct warning icon. Permission-required and inaccessible files are labeled separately. **Clean Unavailable References** checks the selected workspace recursively, previews the count of confirmed missing references, and asks for confirmation. It rechecks those references before removal. It retains permission-required/inaccessible references and empty virtual folders. Workspace removal only removes references and their virtual hierarchy.

Browser access differs by capability:

- Browsers supporting File System Access store file/directory handles in IndexedDB. Reads use the current file after permission is granted. Retry/Grant Access can renew permission; the browser may require a user gesture.
- Other browsers use cached text snapshots from file/folder pickers. These remain readable after reload and are labeled as snapshots in workspace availability. Reopen files/folders to refresh changed content and related images. Snapshot identity uses the visible relative path, size, and modification time; browsers cannot expose a reliable absolute path, so changed snapshots may appear as separate history references.
- Lack of browser permission never counts as confirmed deletion. Missing persistent handles can be relinked. Snapshot references cannot prove a disk file was deleted and are retained by cleanup.
- With persistent directory handles, related local images can be resolved again after reload if directory permission remains granted. With picker snapshots, reopen the folder to restore image access.

The library schema is versioned (`version: 1`) and loaded defensively. Browser snapshots are an access fallback/cache, not managed copies of source documents. Browser storage quotas and user-cleared site data apply; persistence failures are reported visibly.

## Search

Use **Find in Active Document** or the Search button. The scope selector supports:

- Active document
- All open tabs in the current window
- Current folder
- Favorites
- History
- Selected workspace, recursively

Search operates on **Markdown source**. Open-tab scopes use their loaded text; disk/library scopes read current granted files or browser snapshots. Results are grouped by file, with line/column and a highlighted source snippet. Clicking opens in the active tab; the result's arrow opens in a new tab. The reader reveals and outlines the smallest corresponding rendered block where source positions are available. Hidden Markdown syntax or diagram source may have no exact rendered text equivalent. Search is navigation-only; it never edits documents.

Plain text is the default. `.*` enables regex, and `Aa` enables case sensitivity. Searches are case-insensitive by default. Invalid patterns are reported inline; zero-length-only regex matches are skipped. Missing/inaccessible files appear as issues, separately from files with no matches.

File reads are limited to four concurrent jobs. Queries are debounced; changes cancel previous searches and discard stale results. Regex matching runs in terminable workers with a 1.5-second per-file timeout, so a pathological pattern does not lock the interface. Limits: 2,048 query characters, 5 million source characters per file, 200 matches per file, and 1,000 displayed matches total. The UI reports limits/timeouts. F3/Shift+F3 navigate the available results.

## Markdown, math, and diagrams

GitHub-flavored tables, task lists, strikethrough, autolinks, fenced code, heading links, and relative Markdown/image links are supported. Open the containing folder for relative document navigation. Code is presented as readable fenced blocks; no code is executed.

Inline `$...$` and display `$$...$$` LaTeX use KaTeX. Invalid or unsupported math remains local to the expression and does not prevent reading the document. Trust-requiring commands are disabled.

Fenced `mermaid` blocks render diagrams lazily. Each has zoom out/in, reset, fit, and **Full Screen** controls. Full-screen mode fills the application viewport, hiding the surrounding chrome. Scrollbars, the mouse wheel/trackpad, and arrow keys move oversized diagrams horizontally and vertically. Diagram zoom ranges from 10–500%; Fit calculates a viewport-fitting scale. Escape exits and restores focus. Commands target the focused diagram, or the first diagram if none is focused. In full-screen mode, document zoom shortcuts operate on the diagram instead.

Malformed diagrams show a local error and their source. Mermaid configuration directives/frontmatter and click actions are rejected; diagram input is limited to 100,000 characters and 500 edges. Rendering uses Mermaid strict mode with HTML labels disabled and sanitizes generated SVG, removing links, scripts, and foreign objects.

Markdown HTML is disabled; unsafe URL schemes are rejected. External HTTP(S) links open in the browser. Referenced external images may contact their host. Electron keeps context isolation, sandboxing, no renderer Node integration, trusted IPC sender checks, picker-approved file access, and a restrictive CSP. Local image access is limited to image extensions under granted document directories, with canonical-path checks. No document upload, account, backend, or telemetry is used.

## Commands and keyboard

Electron has File, Edit, View, Navigate, Workspace, and Help menus (plus the platform application menu). The browser has an application menu. Both have a searchable **Command Palette**. All are driven by `shared/commands.json`, including enabled states and shortcuts. Contextual reference commands use the focused workspace file; diagram commands use the focused/first diagram.

| Action                                              | macOS                     | Windows/Linux             |
| --------------------------------------------------- | ------------------------- | ------------------------- |
| Open Markdown Files                                 | Cmd+O                     | Ctrl+O                    |
| Open Folder                                         | Cmd+Shift+O               | Ctrl+Shift+O              |
| New / Close Tab                                     | Cmd+T / Cmd+W             | Ctrl+T / Ctrl+W           |
| Reopen Closed Tab                                   | Cmd+Shift+T               | Ctrl+Shift+T              |
| New Window                                          | Cmd+Shift+N               | Ctrl+Shift+N              |
| Next / Previous Tab                                 | Ctrl+Tab / Ctrl+Shift+Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Find Active / Search All Tabs                       | Cmd+F / Cmd+Shift+F       | Ctrl+F / Ctrl+Shift+F     |
| Next / Previous Match                               | F3 / Shift+F3             | F3 / Shift+F3             |
| Document Zoom In / Out / Reset                      | Cmd+Plus / Minus / 0      | Ctrl+Plus / Minus / 0     |
| Toggle Sidebar                                      | Cmd+B                     | Ctrl+B                    |
| Folder / Favorites / History / Outline / Workspaces | Cmd+1 through Cmd+5       | Ctrl+1 through Ctrl+5     |
| Toggle Favorite                                     | Cmd+D                     | Ctrl+D                    |
| Command Palette                                     | Cmd+Shift+P               | Ctrl+Shift+P              |
| Shortcut Help                                       | F1                        | F1                        |

Browsers reserve new/close/reopen tab and new-window shortcuts; YAMDV deliberately leaves those to the browser. Use the + button, tab close buttons, menus, or command palette instead. Browser/OS policy may reserve additional combinations. Menus and the palette provide keyboard-accessible alternatives.

Lists and outlines support Up/Down, Home/End, and Enter. Trees also support Left/Right to collapse/expand. Tab strips use Left/Right and Home/End. Menus support arrow navigation and Escape; dialogs trap focus and restore it when dismissed. Actions have visible focus indicators.

Optional **Vim Navigation** adds j/k, h/l, gg/G to sidebar navigation. It is a small, discoverable navigation layer, not a full editor mode. These bindings never intercept text inputs, selects, or editable controls. Diagram full-screen shortcuts take precedence over document zoom; Escape leaves the transient diagram/menu/dialog/search state.

## Development and verification

```sh
npm test                 # model, migrations, persistence, outline, search, permissions, commands
npm run test:ui          # production build + browser integration suite (Chrome)
npm run test:smoke       # production build + native Electron integration suite
npm run package          # desktop packaging
npm run format           # format maintained source and tests
npm run assets           # regenerate derivatives from logo/logo.png and GitHub CSS
```

UI suites use isolated temporary profiles and disposable fixtures; no personal browser profile or documents are used. The browser suite expects Google Chrome; install it or change the Playwright channel for your environment. Native tests automate picker responses with fixture paths and exercise the real preload/IPC/read path. They do not validate the OS dialog's visual appearance.

Architecture: React tab reducer for window-local state; versioned shared operation reducer for library/workspaces; Electron authoritative serialized store or browser IndexedDB transaction store; narrow file-service abstraction; source-position Markdown metadata; isolated regex workers; lazy document/diagram rendering. `tests/` contains regression checks for these boundaries and representative UI flows.

The existing `v0.0.1` Git tag is intentionally left at its original commit. Package/app metadata is reconciled from the previous `1.0.0` value to the explicitly requested `0.0.1`; no existing tag is moved or recreated.

The supplied `logo/logo.png` is retained unchanged. `scripts/assets.mjs` crops/resizes derivatives into `public/` and `build/`, and generates scoped GitHub Markdown styles from the installed package. Third-party packages retain their licenses; GitHub Markdown CSS is MIT licensed.
