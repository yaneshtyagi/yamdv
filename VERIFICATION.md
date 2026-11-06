# Verification — YAMDV 0.0.1

Validated on macOS ARM64 with Node.js 26.13.0, Google Chrome, and Electron 45.2.1.

| Check                                   | Result                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| `npm test`                              | 22 tests passed across 6 files                                        |
| `npm run build`                         | Passed; static production build generated                             |
| `node tests/ui.mjs`                     | Passed against the production web build in an isolated Chrome context |
| `node tests/smoke.mjs`                  | Passed against the Electron source entry point                        |
| `npm run package`                       | Passed; macOS ARM64 app produced with supplied icon                   |
| Packaged executable + `tests/smoke.mjs` | Passed against `release/mac-arm64/YAMDV.app/Contents/MacOS/YAMDV`     |
| `npm audit --omit=dev`                  | Zero reported production vulnerabilities                              |
| `git diff --check`                      | Passed                                                                |

The browser suite covers file replacement and explicit new tabs, multiple-file selection, per-tab scroll/document zoom, H1–H6 outlines, duplicate heading targets, GFM tables/task lists/strikethrough, math, diagrams, zoom precedence, full-screen keyboard panning in both axes, invalid diagrams/math, unsafe links/HTML, real regex timeout/recovery, plain/regex/case options, result highlighting and F3 navigation, recursive folder import, relative links/images, workspaces, nested workspace creation, snapshot cleanup behavior, shared theme changes between contexts, system-theme changes, favorites after reload, arrow/Vim navigation, help dialogs, and narrow/wide light/dark screenshots.

The native suite uses the actual preload/IPC/file-access layer. It covers native file opening, document tabs and native menu shortcuts, multiple independent windows, shared favorites/theme updates, production file-origin search workers, math/diagram rendering, local images through the restricted asset protocol, nested missing-reference detection, recursive cleanup, workspace removal, source-file preservation, and reopening favorites after reload. It also passes when launched with the actual packaged macOS executable:

```sh
YAMDV_PACKAGED="/absolute/path/to/YAMDV.app/Contents/MacOS/YAMDV" node tests/smoke.mjs
```

Unit tests cover tab operations, history limit/deduplication, one-time legacy migration, transactional stale-window operations, malformed storage, workspace nesting/deduplication/relinking/cleanup, Markdown source metadata, unsafe Mermaid configuration, all search scopes, literal/regex/case behavior, source locations, cancellation, bounded reads, worker termination, browser permission renewal and missing/inaccessible distinctions, and command/shortcut uniqueness.

## Practical limits and unverified surfaces

- Windows and Linux native binaries were not built or run on this macOS host. Packaging targets and platform shortcut mappings are configured; cross-platform behavior still needs validation on those systems.
- Native dialog responses are automated with disposable fixture paths. The OS picker’s own appearance is not visually tested.
- Browser integration tests exercise the standard picker/snapshot fallback. Persistent File System Access behavior is covered at the service boundary with simulated handles; actual browser permission-prompt/regrant interactions are not end-to-end automated.
- Browser-reserved tab/window shortcuts remain browser operations. Application menus/buttons/palette provide alternatives.
- The application bundle is unsigned. Distribution signing/notarization requires the owner’s credentials.
- Vite reports a size advisory for optional Mermaid layout chunks; those are split out and loaded on demand.
- Snapshot fallback identity and permissions have browser constraints, documented in README.md. Cleanup never treats unavailable permission as confirmed deletion.

## Compatibility and source preservation

- Application/package version: `0.0.1`.
- Existing `v0.0.1` tag preserved at `4d6f6414e8211db12195fd795c5fe38a8e6ea12e`.
- Supplied `logo/logo.png` SHA-256 before and after:
  `e158815abaeeb8afb599494390012834812703610661955efa9dece6828939fd`.
- Workspaces are references; neither removal nor janitor operations delete or write source documents.
