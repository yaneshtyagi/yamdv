# YAMDV Help

YAMDV (Yet Another MarkDown Viewer) is a local Markdown reading application for desktop and the browser. Your documents stay on your device.

## Start reading

Use **Open Markdown Files** to select one or more `.md`, `.markdown`, `.mdown`, or `.mkd` files. Use **Open Folder** to browse a folder recursively. You can also drop Markdown files onto the window.

Opening a file normally replaces the active tab. Selecting several files opens the first in the active tab and the rest in new tabs. Opening a folder lists its Markdown files and opens the first one. Hidden entries and `node_modules` are skipped; desktop folder scans do not follow symbolic-link entries.

## Tabs and reading history

Use **+ / New Tab** to create an empty tab, then open a document into it. Use a file’s actions menu → **Open in New Tab**, Cmd/Ctrl-click, Shift-click, or middle-click to keep the current tab and read another file separately.

Tabs keep their own reading positions, document zoom, search targets, and back/forward trails. **Go Back** and **Go Forward** restore earlier documents in the same tab, including their reading position and zoom. You can use the arrow buttons above the document or Cmd/Ctrl+[ and Cmd/Ctrl+].

There is no step limit on a tab’s back/forward trail. Opening a different file after going back starts a new branch and clears that tab’s forward trail. Reopening the same file refreshes it without adding a duplicate step. Back/forward navigation uses the text retained in that tab, so it can restore a visit even if its source file has changed or disappeared; reopen the file to read its latest contents.

Closing and reopening a tab preserves its entire trail. The application keeps the last 20 closed tabs available to reopen; a trail is discarded when its closed tab is evicted, or when the application window closes. Tabs and their trails are session-local, not saved across application restarts. The shared History sidebar is separate and retains the last 200 distinct opened references.

Switch tabs with Ctrl+Tab / Ctrl+Shift+Tab. Cmd+Option+Right / Left also switches tabs on macOS; Ctrl+Alt+Right / Left is the corresponding shortcut on other platforms. Close, close other tabs, and reopen closed tabs through the tab menus or command palette.

## Keyboard reading from the sidebar

In Folder, Favorites, History, Outline, or Workspaces, use Up/Down to move between entries, Home/End for first/last, Left/Right to collapse/expand folders, and Enter or Space to open a focused file button.

Scroll sideways to read long filenames. Drag the sidebar divider to resize it, or focus the divider and press Left/Right. The width is saved locally.

While focus stays in a sidebar navigation list, **Shift+Down** scrolls the active document down and **Shift+Up** scrolls it up. The selected sidebar item and keyboard focus stay in place. These shortcuts do not change selection in text fields.

Use **Cmd/Ctrl+Shift+E** to focus the active document. Arrow keys, Page Up/Page Down, Space/Shift+Space, and Home/End then use the reader’s normal scrolling behavior. Use Cmd/Ctrl+1 through 5 to return focus to a sidebar section.

Optional **Vim Navigation** adds j/k (move), h/l (collapse/expand), gg (first), and G (last) in sidebar lists. Vim navigation does not intercept input fields or editable controls.

## Reading cursor and document Vim

Click rendered text to place the reading cursor. A thin caret and subtle active-line band mark your position; the band stays visible when focus moves to the sidebar. The cursor follows rendered/soft-wrapped lines and is kept with each tab visit, including while switching tabs or reopening a retained tab. Images and Mermaid diagrams have their own controls and are excluded from text navigation. The document remains read-only.

Enable **Vim Navigation** and focus the reader with **Cmd/Ctrl+Shift+E**. The same setting enables Vim navigation in both the sidebar and the document. In the reader:

| Keys            | Reading action                                                        |
| --------------- | --------------------------------------------------------------------- |
| `h` / `l`       | Previous / next character                                             |
| `j` / `k`       | Next / previous rendered line                                         |
| `w` / `b` / `e` | Next word start / previous word start / word end                      |
| `0` / `$`       | Start / end of the rendered line                                      |
| `gg` / `G`      | Start / end of the document                                           |
| Ctrl+D / Ctrl+U | About half a screen down / up                                         |
| Ctrl+F / Ctrl+B | About one screen down / up                                            |
| `v`             | Enter character visual selection; motions extend the selection        |
| `V` (Shift+v)   | Enter rendered-line visual selection; motions include entire lines    |
| `y`             | Copy a visual or existing mouse selection, then return to normal mode |
| `yy`            | Copy the current rendered line                                        |
| Escape          | Cancel selection and return to normal mode without leaving the reader |

Arrow keys also move the reading cursor. Mouse selection and the system Copy shortcut remain available. Visual selection uses the browser's real text selection and copies **rendered plain text**, not Markdown syntax. Code toolbar labels are excluded. Use **Copy code** to copy a code block's literal text. A copy failure keeps the selection and suggests the system Copy shortcut.

This is a reading-oriented Vim subset: it does not implement editing, insert mode, operator/count combinations, or a full Vim command language. Vim keys do not intercept text inputs, buttons, link controls, search boxes, or dialogs. On Windows/Linux, Ctrl+D/F/B are used for Vim paging while the reader has Vim focus; the corresponding application operations remain available through buttons, menus, and the command palette.

## Sidebar sections

- **Folder:** recursively browse the currently opened folder, or the set of opened/dropped files. Filter by file name or relative path.
- **Favorites:** star a document from its toolbar or file row. Favorites persist between sessions and are shared between application windows.
- **History:** the last 200 distinct opened references. Opening a file updates its position; merely switching tabs does not.
- **Outline:** H1–H6 headings from the active document. Inline formatting and duplicate headings are handled correctly; headings in code blocks are excluded. Select a heading to reveal it in the reader. The outline highlights the heading that contains the reading cursor, and reopening Outline returns focus to that heading. Use **Cmd+Option+Up/Down** on macOS or **Ctrl+Alt+Up/Down** elsewhere to jump between headings at the same level under the same parent. For example, the next H2 shortcut skips nested H3s and stops at the end of the current H1.
- **Workspaces:** collections of document references organized into virtual folders.

## Workspaces

Create a workspace from the Workspaces sidebar, application menu, or command palette. Select its name before adding files, importing folders, or creating a nested workspace.

A workspace holds references, not managed copies of source files. **Add Files to Workspace** adds selected Markdown files. **Add Folder to Workspace** imports a hierarchy of references once; it does not subscribe to later directory changes. Nested workspaces act as virtual folders. References are deduplicated across a top-level workspace and its descendants, but the same document can belong to another top-level workspace.

To add what you are reading, use the document’s **Add Current File to Workspace** button or the command of the same name. Choose any workspace or nested workspace, or create a new workspace in the dialog. Adding the same reference again does not create a duplicate. The source file remains where it is.

Workspace menus support renaming, nested workspace creation, adding references, checking availability, and removal. A file’s actions menu supports **Retry / Grant Access**, **Relink**, and **Remove from Workspace**. Reference actions are also available in the command palette after focusing a workspace file.

Missing files have a distinct warning icon. Permission-required and inaccessible files have separate labels. **Clean Unavailable References** checks the selected workspace recursively, previews confirmed missing references, and asks before removing them. It rechecks before removal, keeps permission-required/inaccessible references, and retains empty virtual folders. Neither workspace removal nor cleanup ever deletes source files.

## Search

Open Search or use Cmd/Ctrl+F. Select a scope: active document, all tabs, current folder, favorites, history, or selected workspace recursively. Cmd/Ctrl+Shift+F opens search across all tabs.

Search reads Markdown source. Results show file groups, line/column, and highlighted snippets. Clicking a result opens it in the active tab and reveals the corresponding rendered block when possible. Use the result’s arrow for a new tab. F3 / Shift+F3 move to the next/previous match.

Plain text and case-insensitive matching are the defaults. Toggle **Aa** for case-sensitive matching and **.*** for regular expressions. Invalid expressions are reported. Empty queries and zero-length-only regex matches do not produce results. Unavailable files are listed separately from files with no matches.

Search is bounded to four concurrent reads, 2,048 query characters, 5 million source characters per file, 200 matches per file, and 1,000 displayed matches total. Regex work runs in isolated workers with a 1.5-second per-file timeout. Changing a query cancels the previous search; timeouts do not freeze the reader. Search never edits documents.

## Markdown, images, math, and diagrams

The reader uses GitHub Markdown styling and supports headings, links, images, lists, block quotes, fenced code, tables, task lists, strikethrough, and autolinks. Each ordinary code block has **Wrap lines** and **Copy code** controls. Wrapping is off by default, can be toggled independently per block, and preserves indentation while breaking long lines to fit. Wrapping choices stay with a tab visit during the session; they do not edit the file or persist across restarts. Open the containing folder for relative Markdown links and local images. Heading links use the same unique heading IDs as Outline.

Inline `$...$` and display `$$...$$` LaTeX math are rendered with KaTeX. Unsupported or invalid expressions remain local to the expression.

Fenced `mermaid` blocks become diagrams. Each diagram has independent zoom out/in, reset, fit, and full-screen controls. Full-screen mode fills the application viewport; use the mouse/trackpad, scrollbars, or arrow keys to pan oversized diagrams horizontally or vertically. Cmd/Ctrl+Plus, Minus, and 0 control the diagram while it is full-screen. Escape exits and returns focus. Diagram commands target the focused diagram, or the first diagram if none is focused.

Diagram zoom ranges from 10–500%. Invalid diagrams display an error and their source without breaking the rest of the document. Configuration directives, Mermaid frontmatter, and click actions are disabled. Limits are 100,000 characters and 500 edges.

Raw Markdown HTML is disabled. Unsafe link schemes, executable content, and trust-requiring math commands are blocked. Referenced external images can still contact their hosts; HTTP(S) document links open in your browser.

## Themes and zoom

The theme icon offers **Light**, **Dark**, and **System**, with the current choice checked. System follows OS appearance changes immediately. The preference is shared across windows.

Cmd/Ctrl+Plus / Minus / 0 change only the active Markdown document (50–300%). The status-bar percentage resets document zoom. Tabs and back/forward visits retain their own zoom. Separate **Zoom Application UI** commands adjust the entire interface (70–150%) using **Cmd+Option+Plus / Minus / 0** on macOS or **Ctrl+Alt+Plus / Minus / 0** elsewhere. These Alt-modified bindings keep document and diagram zoom settings unchanged. Diagram controls have their own zoom state and take precedence in diagram full-screen mode.

## Menus, command palette, and help

Use **Cmd/Ctrl+Shift+M** for the application menu inside the window, including when the operating system’s menu bar is hidden in full-screen mode. Navigate the menu with arrow keys, Enter, and Escape. You can also click its toolbar icon. Native Electron menus offer the same commands.

Use **Cmd/Ctrl+Shift+P** for the command palette. Its search box receives focus immediately; type a command, press Enter for the first enabled result, or use Down/Up to choose another result. Less common operations remain keyboard-accessible here without needing a dedicated shortcut.

F1 opens quick shortcut help. **Read Full Help** opens this guide in a new document tab, where search and outline work normally.

| Action                                              | macOS                                              | Windows/Linux                                    |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Open Markdown files                                 | Cmd+O                                              | Ctrl+O                                           |
| Open folder                                         | Cmd+Shift+O                                        | Ctrl+Shift+O                                     |
| New / close tab                                     | Cmd+T / Cmd+W                                      | Ctrl+T / Ctrl+W                                  |
| Reopen closed tab                                   | Cmd+Shift+T                                        | Ctrl+Shift+T                                     |
| Next / previous tab                                 | Ctrl+Tab / Ctrl+Shift+Tab; Cmd+Option+Right / Left | Ctrl+Tab / Ctrl+Shift+Tab; Ctrl+Alt+Right / Left |
| Go back / forward in this tab                       | Cmd+[ / Cmd+]                                      | Ctrl+[ / Ctrl+]                                  |
| Scroll document while sidebar focused               | Shift+Up / Down                                    | Shift+Up / Down                                  |
| Focus active document                               | Cmd+Shift+E                                        | Ctrl+Shift+E                                     |
| Open application menu                               | Cmd+Shift+M                                        | Ctrl+Shift+M                                     |
| New window                                          | Cmd+Shift+N                                        | Ctrl+Shift+N                                     |
| Find in active document                             | Cmd+F                                              | Ctrl+F                                           |
| Search all tabs                                     | Cmd+Shift+F                                        | Ctrl+Shift+F                                     |
| Next / previous search match                        | F3 / Shift+F3                                      | F3 / Shift+F3                                    |
| Document zoom in / out / reset                      | Cmd+Plus / Minus / 0                               | Ctrl+Plus / Minus / 0                            |
| Application UI zoom in / out / reset                | Cmd+Option+Plus / Minus / 0                        | Ctrl+Alt+Plus / Minus / 0                        |
| Toggle sidebar                                      | Cmd+B                                              | Ctrl+B                                           |
| Previous / next sibling section                     | Cmd+Option+Up / Down                               | Ctrl+Alt+Up / Down                               |
| Folder / Favorites / History / Outline / Workspaces | Cmd+1 through 5                                    | Ctrl+1 through 5                                 |
| Toggle favorite                                     | Cmd+D                                              | Ctrl+D                                           |
| Command palette                                     | Cmd+Shift+P                                        | Ctrl+Shift+P                                     |
| Quick shortcut help                                 | F1                                                 | F1                                               |

Browsers and operating systems reserve some shortcuts. Browsers keep their own new/close/reopen tab and new-window combinations; use YAMDV’s buttons, menus, or palette for those operations. Other shortcuts may also be reserved by the host. Desktop shortcuts are application-local, not global system bindings.

## Windows, persistence, and browser access

New Window creates an independent reading window on desktop. In a browser, the browser decides whether the requested new context is a window or tab. Windows have independent document tabs, trails, folder, workspace selection, search, and zoom. Favorites, shared history, workspace definitions, theme, and Vim preference are shared within the same application profile/browser origin.

Desktop reads files through picker-approved paths. Browser File System Access support can retain handles, but permission may need renewal. Other browsers use text snapshots from file/folder pickers; reopen files to refresh them and restore local image access. Snapshots cannot prove that a disk file has been deleted and are kept by cleanup. Browser storage quotas and clearing site data affect saved state. Snapshot identity uses the visible relative path, size, and modification time because browsers cannot expose a reliable absolute path.

There is no account, backend, telemetry, or document upload. The app is a viewer: it does not save edits back to Markdown documents. For installation, development commands, packaging, and verification details, see README.md and VERIFICATION.md in the source repository.
