import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  FolderOpen,
  FileText,
  Star,
  History,
  ListTree,
  Library,
  Search,
  Sun,
  Moon,
  Monitor,
  Menu,
  PanelLeft,
  Plus,
  X,
  Command,
} from "lucide-react";
import {
  tabsReducer,
  initialTabs,
  uid,
  clampZoom,
  referenceNodes,
} from "./model";
import {
  desktop,
  normalize,
  getLibrary,
  mutate,
  subscribe,
  legacy,
  findNode,
  collectFiles,
} from "./services/store";
import {
  readFile,
  pickFiles,
  pickFolder,
  importFiles,
  availability,
  grant,
  boundedMap,
} from "./services/files";
import {
  commands,
  commandEnabled,
  matchesShortcut,
  shortcutLabel,
} from "./commands";
import { analyzeMarkdown } from "./markdown";
import { resolveRelative } from "./library";
import {
  FileTree,
  FileRow,
  WorkspaceTree,
  navigationKey,
} from "./components/Navigation";
import Modal from "./components/Modal";
import Popup from "./components/Popup";
import SearchPanel from "./components/SearchPanel";
import { scopeFiles } from "./services/search";
const Document = lazy(() => import("./components/Document"));
const sections = [
  ["folder", FolderOpen, "Folder"],
  ["favorites", Star, "Favorites"],
  ["history", History, "History"],
  ["outline", ListTree, "Outline"],
  ["workspaces", Library, "Workspaces"],
];
const welcome = `# YAMDV\n\nYour Markdown reading desk. Open a file or folder to begin.\n\n- **⌘/Ctrl+O** — open Markdown files\n- **⌘/Ctrl+Shift+O** — open a folder\n- **⌘/Ctrl+Shift+P** — find any command\n\nUse the **+** button to create a tab. Files normally replace the active tab; use a file’s actions menu to open it in a new tab.\n\n### A workspace is a collection of references\n\nOrganize files from different folders without moving or copying your documents.\n`;
export default function App() {
  const [library, setLibrary] = useState(normalize),
    [state, dispatch] = useReducer(tabsReducer, undefined, initialTabs),
    [section, setSection] = useState("folder"),
    [files, setFiles] = useState([]),
    [folder, setFolder] = useState("No folder open"),
    [filter, setFilter] = useState(""),
    [sidebar, setSidebar] = useState(true),
    [selectedWorkspace, setSelectedWorkspace] = useState(null),
    [statuses, setStatuses] = useState({}),
    [reference, setReference] = useState(null),
    [resolvedTheme, setResolvedTheme] = useState("light"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [popup, setPopup] = useState(null),
    [modal, setModal] = useState(null),
    [paletteQuery, setPaletteQuery] = useState(""),
    [searchScope, setSearchScope] = useState(null),
    [results, setResults] = useState([]),
    [resultIndex, setResultIndex] = useState(-1),
    [uiZoom, setUiZoom] = useState(1),
    [ready, setReady] = useState(false);
  const active = state.tabs.find((t) => t.id === state.activeId),
    workspace = findNode(library.workspaces, selectedWorkspace);
  const requests = useRef(new Map()),
    scrolls = useRef(new Map()),
    runRef = useRef(),
    navRef = useRef(),
    tabBar = useRef();
  const accept = useCallback(
    (next) => setLibrary((old) => (next.revision >= old.revision ? next : old)),
    [],
  );
  const change = useCallback(
    async (op) => {
      try {
        const next = await mutate(op);
        accept(next);
        return next;
      } catch (e) {
        setError("Could not save library: " + e.message);
        throw e;
      }
    },
    [accept],
  );
  useEffect(() => {
    const stop = subscribe(accept);
    mutate({ type: "migrate", legacy: legacy() })
      .then(accept)
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
    return stop;
  }, [accept]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const value =
        library.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : library.theme;
      setResolvedTheme(value);
      document.documentElement.dataset.theme = value;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [library.theme]);
  const workspaceFiles = useMemo(
    () => (workspace ? collectFiles(workspace.children) : []),
    [workspace],
  );
  const refreshAvailability = useCallback(
    async (signal) => {
      const all = collectFiles(library.workspaces);
      const checked = await boundedMap(all, availability, { signal, limit: 4 });
      if (!signal?.aborted)
        setStatuses(
          Object.fromEntries(
            all.map((f, i) => [f.id, checked[i]?.value || "inaccessible"]),
          ),
        );
    },
    [library.workspaces],
  );
  useEffect(() => {
    const controller = new AbortController();
    refreshAvailability(controller.signal);
    const onFocus = () => refreshAvailability(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshAvailability]);
  useEffect(() => {
    if (selectedWorkspace && !workspace) setSelectedWorkspace(null);
  }, [selectedWorkspace, workspace]);
  async function openDocument(
    file,
    newTab = false,
    target = null,
    contentOverride,
  ) {
    const targetId = state.activeId,
      token = uid(),
      key = newTab ? token : targetId || "empty";
    requests.current.set(key, token);
    setBusy(true);
    setError("");
    try {
      const content = contentOverride ?? (await readFile(file));
      if (requests.current.get(key) !== token) return;
      const saved = {
        ...file,
        content: file.snapshot && !file.handle ? content : undefined,
      };
      delete saved._content;
      dispatch({
        type: "open",
        file: saved,
        content,
        newTab,
        tabId: targetId,
        target,
      });
      await change({ type: "opened", file: saved });
    } catch (e) {
      setError(`${file.name}: ${e.message}`);
    } finally {
      if (requests.current.get(key) === token) requests.current.delete(key);
      setBusy(requests.current.size > 0);
    }
  }
  async function openPicker(kind, workspaceImport = false) {
    try {
      const result = await (kind === "folder" ? pickFolder() : pickFiles());
      if (!result) return;
      const next = kind === "folder" ? result.files : result;
      if (workspaceImport) {
        if (!workspace) return;
        await change({
          type: "workspace-add",
          id: workspace.id,
          nodes: referenceNodes(next),
        });
        setSection("workspaces");
        return;
      }
      setFiles(next);
      setFolder(kind === "folder" ? result.name : "Opened files");
      setSection("folder");
      if (!next.length) {
        setError("No Markdown files found.");
        return;
      }
      await openDocument(next[0]);
      if (kind !== "folder")
        for (const file of next.slice(1)) await openDocument(file, true);
    } catch (e) {
      setError(e.message);
    }
  }
  async function favorite(file) {
    try {
      const existing = library.favorites.some((f) => f.id === file.id);
      const saved = { ...file };
      if (file.snapshot && !file.handle && !existing)
        saved.content =
          active?.file?.id === file.id ? active.content : await readFile(file);
      await change({ type: "favorite", file: saved, value: !existing });
    } catch (e) {
      setError(e.message);
    }
  }
  function saveScroll() {
    if (active)
      dispatch({
        type: "patch",
        id: active.id,
        patch: { scroll: scrolls.current.get(active.id) ?? active.scroll },
      });
  }
  function activate(id) {
    saveScroll();
    dispatch({ type: "activate", id });
  }
  function contextMenu(file, x, y, nodeId) {
    setPopup({ type: "file", file, x, y, nodeId });
  }
  function actionModal(kind) {
    setModal({
      type: "name",
      action: kind,
      value: kind === "rename" ? workspace?.name || "" : "",
      title:
        kind === "rename"
          ? "Rename Workspace"
          : kind === "nested"
            ? "Create Nested Workspace"
            : "Create Workspace",
    });
  }
  async function cleanWorkspace() {
    if (!workspace) return;
    setBusy(true);
    try {
      const checked = await boundedMap(workspaceFiles, availability, {
        limit: 4,
      });
      const missing = workspaceFiles
        .filter((_, i) => checked[i]?.value === "missing")
        .map((f) => f.id);
      setModal({
        type: "confirm",
        title: "Clean Unavailable References",
        message: missing.length
          ? `Remove ${missing.length} confirmed missing file reference(s) from “${workspace.name}” recursively? Source files are never deleted. Inaccessible and permission-required references will be kept.`
          : "No confirmed missing references found. References requiring permission are kept.",
        confirm: missing.length ? "Remove References" : null,
        onConfirm: async () => {
          const candidates = workspaceFiles.filter((f) =>
            missing.includes(f.id),
          );
          const rechecked = await boundedMap(candidates, availability, {
            limit: 4,
          });
          await change({
            type: "workspace-clean",
            id: workspace.id,
            missing: candidates
              .filter((f, i) => rechecked[i]?.value === "missing")
              .map((f) => f.id),
          });
        },
      });
      await refreshAvailability();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function resultOpen(file, match, newTab) {
    const index = results.findIndex(
      (r) => r.file.id === file.id && r.match.offset === match.offset,
    );
    if (index >= 0) setResultIndex(index);
    openDocument(
      file,
      newTab,
      { line: match.line, offset: match.offset },
      file._content,
    );
  }
  function nextMatch(delta) {
    if (!results.length) return;
    const index =
      resultIndex < 0
        ? delta > 0
          ? 0
          : results.length - 1
        : (resultIndex + delta + results.length) % results.length;
    setResultIndex(index);
    resultOpen(results[index].file, results[index].match, false);
  }
  function zoom(delta, reset = false) {
    if (document.querySelector("[data-diagram-fullscreen]")) {
      window.dispatchEvent(
        new CustomEvent("diagram-command", {
          detail: reset ? "zoom-reset" : delta > 0 ? "zoom-in" : "zoom-out",
        }),
      );
      return;
    }
    if (active?.file)
      dispatch({
        type: "patch",
        patch: { zoom: reset ? 1 : clampZoom(active.zoom + delta) },
      });
  }
  const markdownInfo = useMemo(
    () => analyzeMarkdown(active?.content || ""),
    [active?.content],
  );
  const ctx = {
    reference:
      section === "workspaces" &&
      !!reference?.nodeId &&
      !!findNode(library.workspaces, reference.nodeId),
    diagram: markdownInfo.hasDiagram,
    tab: !!active,
    document: !!active?.file,
    closed: !!state.closed.length,
    workspace: !!workspace,
    results: !!results.length,
  };
  async function executeCommand(id, targetReference = reference) {
    setPopup(null);
    const c = commands.find((c) => c.id === id);
    if (
      c &&
      !commandEnabled(c, { ...ctx, reference: !!targetReference?.nodeId })
    )
      return;
    if (id === "open-new-tab") return openDocument(active.file, true);
    if (id.startsWith("diagram-")) {
      window.dispatchEvent(new CustomEvent("diagram-command", { detail: id }));
      return;
    }
    if (id === "reference-remove")
      return change({ type: "workspace-remove", id: targetReference.nodeId });
    if (id === "reference-relink") {
      const list = await pickFiles();
      if (list?.[0])
        return change({
          type: "workspace-relink",
          id: targetReference.nodeId,
          file: list[0],
        });
      return;
    }
    if (id === "reference-retry") {
      await grant(targetReference.file);
      await refreshAvailability();
      return;
    }

    if (id === "open-files") return openPicker("files");
    if (id === "open-folder") return openPicker("folder");
    if (id === "new-tab") {
      saveScroll();
      dispatch({ type: "new" });
      return;
    }
    if (id === "close-tab") {
      saveScroll();
      requests.current.delete(state.activeId);
      dispatch({ type: "close" });
      return;
    }
    if (id === "reopen-tab") {
      saveScroll();
      dispatch({ type: "reopen" });
      return;
    }
    if (id === "close-others") {
      requests.current.clear();
      dispatch({ type: "close-others" });
      return;
    }
    if (id === "new-window") {
      if (desktop) return desktop.newWindow();
      window.open(location.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (id.startsWith("search-")) {
      setSearchScope(id.slice(7));
      setSidebar(true);
      return;
    }
    if (id === "next-match") return nextMatch(1);
    if (id === "previous-match") return nextMatch(-1);
    if (id === "zoom-in") return zoom(0.1);
    if (id === "zoom-out") return zoom(-0.1);
    if (id === "zoom-reset") return zoom(0, true);
    if (id.startsWith("ui-")) {
      setUiZoom((z) =>
        id === "ui-reset"
          ? 1
          : Math.max(0.7, Math.min(1.5, z + (id === "ui-in" ? 0.1 : -0.1))),
      );
      return;
    }
    if (id.startsWith("theme-"))
      return change({ type: "theme", value: id.slice(6) });
    if (id.startsWith("sidebar-")) {
      setSection(id.slice(8));
      setSearchScope(null);
      setSidebar(true);
      requestAnimationFrame(() =>
        navRef.current?.querySelector("[data-nav]")?.focus(),
      );
      return;
    }
    if (id === "toggle-sidebar") {
      setSidebar(!sidebar);
      return;
    }
    if (id === "next-tab" || id === "previous-tab") {
      const i = state.tabs.findIndex((t) => t.id === state.activeId);
      activate(
        state.tabs[
          (i + (id === "next-tab" ? 1 : -1) + state.tabs.length) %
            state.tabs.length
        ].id,
      );
      return;
    }
    if (id === "favorite") return favorite(active.file);
    if (id === "workspace-create") return actionModal("create");
    if (id === "workspace-nested") return actionModal("nested");
    if (id === "workspace-rename") return actionModal("rename");
    if (id === "workspace-delete") {
      setModal({
        type: "confirm",
        title: "Remove Workspace",
        message: `Remove “${workspace.name}” and its references? Source files are never deleted.`,
        confirm: "Remove Workspace",
        onConfirm: () => change({ type: "workspace-remove", id: workspace.id }),
      });
      return;
    }
    if (id === "workspace-add-files") return openPicker("files", true);
    if (id === "workspace-add-folder") return openPicker("folder", true);
    if (id === "workspace-check") return refreshAvailability();
    if (id === "workspace-clean") return cleanWorkspace();
    if (id === "toggle-vim")
      return change({ type: "vim", value: !library.vim });
    if (id === "palette") {
      setPaletteQuery("");
      setModal({ type: "palette" });
      return;
    }
    if (id === "help") setModal({ type: "help" });
  }
  function run(...args) {
    return executeCommand(...args).catch((e) => setError(e.message));
  }
  runRef.current = run;
  useEffect(() => {
    const listener = (e) => {
      if (e.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) {
        if (e.key === "Escape") return;
        return;
      }
      const cmd = commands.find((c) => matchesShortcut(e, c.key));
      if (cmd) {
        if (!desktop && cmd.browserReserved) return;
        e.preventDefault();
        runRef.current(cmd.id);
      } else if (e.key === "Escape") {
        setPopup(null);
        setSearchScope(null);
        navRef.current?.querySelector("[data-nav]")?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => desktop?.onCommand((id) => runRef.current(id)), []);
  useEffect(() => {
    desktop?.commandState(ctx);
  }, [
    ctx.tab,
    ctx.document,
    ctx.closed,
    ctx.workspace,
    ctx.results,
    ctx.diagram,
    ctx.reference,
  ]);
  function onLink(href, newTab) {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      if (desktop) desktop.openExternal(href);
      else window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const [target, hash] = href.split("#");
      if (!target) {
        dispatch({
          type: "patch",
          patch: { target: { heading: decodeURIComponent(hash) } },
        });
        return;
      }
      if (!active?.file) return;
      const relative = resolveRelative(active.file.relative, target),
        absolute = resolveRelative(active.file.path, target);
      const file = [
        ...files,
        ...library.history,
        ...library.favorites,
        ...collectFiles(library.workspaces),
      ].find(
        (f) =>
          f.relative === relative || f.path?.replaceAll("\\", "/") === absolute,
      );
      if (file)
        openDocument(
          file,
          newTab,
          hash ? { heading: decodeURIComponent(hash) } : null,
        );
      else setError("Open the containing folder to follow this Markdown link.");
    } catch (e) {
      setError(e.message);
    }
  }
  const outline = markdownInfo.outline;
  const displayed = (
    section === "folder"
      ? files
      : section === "favorites"
        ? library.favorites
        : library.history
  ).filter((f) =>
    `${f.relative} ${f.name}`.toLowerCase().includes(filter.toLowerCase()),
  );
  // Source identity ignores history reorder and transient zoom/scroll state.
  const sourceInput = {
    tabs: state.tabs,
    active,
    folder: files,
    favorites: library.favorites,
    history: library.history,
    workspace: workspaceFiles,
  };
  const sourceKey = JSON.stringify(
    scopeFiles(searchScope, sourceInput)
      .map((f) => [f.id, f.path, f._content, f.content])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
  const sources = useMemo(() => sourceInput, [searchScope, sourceKey]);
  const updateResults = useCallback((value) => {
    setResults(value);
    setResultIndex(-1);
  }, []);
  const rowProps = {
    onReference: setReference,
    onOpen: (f, n) => {
      saveScroll();
      openDocument(f, n);
    },
    onMenu: contextMenu,
    onFavorite: favorite,
    favorites: library.favorites,
    activeId: active?.file?.id,
  };
  const selectedCommands = commands.filter((c) =>
    `${c.label} ${c.group}`.toLowerCase().includes(paletteQuery.toLowerCase()),
  );
  return (
    <div
      className="ide"
      style={{ zoom: uiZoom, height: `calc(100dvh / ${uiZoom})` }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        try {
          const list = await importFiles(e.dataTransfer.files);
          if (list.length) {
            setFiles(list);
            setFolder("Dropped files");
            await openDocument(list[0]);
            for (const f of list.slice(1)) await openDocument(f, true);
          }
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <header className="app-toolbar">
        <button
          className="icon-button"
          aria-label="Application Menu"
          title="Application menu and commands"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPopup({ type: "app", x: r.left, y: r.bottom });
          }}
        >
          <Menu size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Toggle Sidebar"
          onClick={() => run("toggle-sidebar")}
        >
          <PanelLeft size={16} />
        </button>
        <button className="toolbar-button" onClick={() => run("open-folder")}>
          <FolderOpen size={15} />
          Open Folder
        </button>
        <button className="toolbar-button" onClick={() => run("open-files")}>
          <FileText size={15} />
          Open Markdown Files
        </button>
        <div className="toolbar-spacer" />
        <button
          className="icon-button"
          aria-label="Search"
          onClick={() => run("search-active")}
        >
          <Search size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Command Palette"
          onClick={() => run("palette")}
        >
          <Command size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={`Theme: ${library.theme}`}
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPopup({ type: "theme", x: r.right - 170, y: r.bottom });
          }}
        >
          {library.theme === "system" ? (
            <Monitor size={16} />
          ) : library.theme === "dark" ? (
            <Moon size={16} />
          ) : (
            <Sun size={16} />
          )}
        </button>
        <div className="brand">
          <img src="./logo.png" alt="" />
          <div>
            <strong>YAMDV</strong>
            <small>Yet Another MarkDown Viewer</small>
          </div>
        </div>
      </header>
      <div className="workbench">
        {sidebar && (
          <aside className="sidebar">
            <nav className="sidebar-tabs" aria-label="Sidebar sections">
              {sections.map(([id, Icon, label]) => (
                <button
                  key={id}
                  aria-label={label}
                  title={label}
                  aria-pressed={section === id && !searchScope}
                  onClick={() => {
                    setSection(id);
                    setSearchScope(null);
                    setFilter("");
                  }}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            {searchScope ? (
              <SearchPanel
                scope={searchScope}
                onScope={setSearchScope}
                sources={sources}
                onResult={resultOpen}
                onResults={updateResults}
                activeResult={results[resultIndex]}
                onClose={() => setSearchScope(null)}
              />
            ) : (
              <>
                <div className="sidebar-heading">
                  <strong>
                    {section === "folder"
                      ? folder
                      : section === "outline"
                        ? "DOCUMENT OUTLINE"
                        : section.toUpperCase()}
                  </strong>
                  {section === "workspaces" && (
                    <button
                      aria-label="Create Workspace"
                      onClick={() => run("workspace-create")}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                {!["outline", "workspaces"].includes(section) && (
                  <input
                    className="file-filter"
                    aria-label="Filter Files"
                    placeholder="Filter files…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                )}
                <div
                  ref={navRef}
                  className="navigation"
                  aria-label={section + " navigation"}
                  onKeyDown={(e) => navigationKey(e, library.vim)}
                >
                  {section === "outline" ? (
                    outline.length ? (
                      outline.map((h) => (
                        <button
                          data-nav
                          key={h.id}
                          className="outline-item"
                          style={{ paddingLeft: 10 + (h.depth - 1) * 12 }}
                          onClick={() =>
                            dispatch({
                              type: "patch",
                              patch: { target: { heading: h.id } },
                            })
                          }
                        >
                          <small>H{h.depth}</small>
                          <span>{h.text || "(empty heading)"}</span>
                        </button>
                      ))
                    ) : (
                      <p className="empty-state">
                        No headings in this document.
                      </p>
                    )
                  ) : section === "workspaces" ? (
                    <>
                      <WorkspaceTree
                        nodes={library.workspaces}
                        selected={selectedWorkspace}
                        onSelect={setSelectedWorkspace}
                        onFolderMenu={(node, x, y) => {
                          setSelectedWorkspace(node.id);
                          setPopup({ type: "workspace", node, x, y });
                        }}
                        statuses={statuses}
                        {...rowProps}
                      />
                      {!library.workspaces.length && (
                        <p className="empty-state">
                          Create a workspace to organize references without
                          moving files.
                        </p>
                      )}
                    </>
                  ) : section === "folder" ? (
                    <FileTree files={displayed} {...rowProps} />
                  ) : (
                    displayed.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        {...rowProps}
                        favorite={library.favorites.some(
                          (f) => f.id === file.id,
                        )}
                        selected={active?.file?.id === file.id}
                      />
                    ))
                  )}
                  {!["outline", "workspaces"].includes(section) &&
                    !displayed.length && (
                      <p className="empty-state">
                        {filter
                          ? "No matching files."
                          : section === "favorites"
                            ? "Star a document to keep it here."
                            : section === "history"
                              ? "Recently opened files appear here."
                              : "Open a folder or Markdown files."}
                      </p>
                    )}
                </div>
                {section === "workspaces" && workspace && (
                  <div className="workspace-actions">
                    <span title={workspace.name}>{workspace.name}</span>
                    <button onClick={() => run("workspace-add-files")}>
                      + Files
                    </button>
                    <button onClick={() => run("workspace-add-folder")}>
                      + Folder
                    </button>
                    <button
                      aria-label="Workspace Actions"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPopup({
                          type: "workspace",
                          node: workspace,
                          x: r.left,
                          y: r.bottom,
                        });
                      }}
                    >
                      ⋯
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="sidebar-status">
              <span>
                {library.vim ? "Vim navigation on" : "Arrow-key navigation"}
              </span>
              <button aria-label="Keyboard Help" onClick={() => run("help")}>
                ?
              </button>
            </div>
          </aside>
        )}
        <main>
          <div
            ref={tabBar}
            className="document-tabs"
            role="tablist"
            aria-label="Documents"
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const i = state.tabs.findIndex((t) => t.id === state.activeId);
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? state.tabs.length - 1
                      : (i +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          state.tabs.length) %
                        state.tabs.length;
                activate(state.tabs[next].id);
                requestAnimationFrame(() =>
                  tabBar.current.querySelector("[aria-selected=true]")?.focus(),
                );
              }
            }}
          >
            {state.tabs.map((tab) => (
              <div
                className={
                  "document-tab " + (tab.id === state.activeId ? "active" : "")
                }
                key={tab.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  activate(tab.id);
                  setPopup({
                    type: "tab",
                    tabId: tab.id,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              >
                <button
                  role="tab"
                  id={"tab-" + tab.id}
                  aria-controls={"panel-" + tab.id}
                  aria-selected={tab.id === state.activeId}
                  tabIndex={tab.id === state.activeId ? 0 : -1}
                  onClick={() => activate(tab.id)}
                >
                  <FileText size={13} />
                  <span>{tab.file?.name || "New Tab"}</span>
                </button>
                <button
                  aria-label={`Close ${tab.file?.name || "New Tab"}`}
                  className="close-tab"
                  onClick={() => {
                    requests.current.delete(tab.id);
                    dispatch({ type: "close", id: tab.id });
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              className="new-tab"
              aria-label="New Tab"
              title="New Tab"
              onClick={() => run("new-tab")}
            >
              <Plus size={16} />
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss Error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {active ? (
            <div
              className="document-panel"
              role="tabpanel"
              id={"panel-" + active.id}
              aria-labelledby={"tab-" + active.id}
            >
              <div className="document-info">
                <span title={active.file?.path}>
                  {active.file?.relative || "Start reading"}
                </span>
                {active.file && (
                  <button
                    aria-pressed={library.favorites.some(
                      (f) => f.id === active.file.id,
                    )}
                    aria-label="Toggle Favorite"
                    onClick={() => favorite(active.file)}
                  >
                    <Star size={13} />
                  </button>
                )}
              </div>
              <Suspense
                fallback={<p className="empty-state">Loading reader…</p>}
              >
                <Document
                  key={active.id}
                  tab={
                    active.file
                      ? {
                          ...active,
                          scroll:
                            scrolls.current.get(active.id) ?? active.scroll,
                        }
                      : { ...active, content: welcome }
                  }
                  theme={resolvedTheme}
                  onLink={onLink}
                  onScroll={(value) => scrolls.current.set(active.id, value)}
                />
              </Suspense>
            </div>
          ) : (
            <div className="empty-editor">
              <img src="./logo.png" alt="YAMDV" />
              <h1>No open tabs</h1>
              <button onClick={() => run("new-tab")}>New Tab</button>
              <button onClick={() => run("open-files")}>
                Open Markdown Files
              </button>
            </div>
          )}
          <footer>
            <span>
              {busy ? "Working…" : ready ? "Ready" : "Loading library…"}
              {workspace ? " · " + workspace.name : ""}
            </span>
            <span>
              {active?.file
                ? `${active.content.trim() ? active.content.trim().split(/\s+/).length : 0} words`
                : "Markdown"}
              <button
                aria-label="Reset Document Zoom"
                onClick={() => run("zoom-reset")}
                disabled={!active?.file}
              >
                {Math.round((active?.zoom || 1) * 100)}%
              </button>
              <span className="version">v0.0.1</span>
            </span>
          </footer>
        </main>
      </div>
      {popup && (
        <Popup
          x={popup.x}
          y={popup.y}
          onClose={() => setPopup(null)}
          label={popup.type === "theme" ? "Theme" : "Actions"}
        >
          {popup.type === "theme" ? (
            ["light", "dark", "system"].map((value) => (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={library.theme === value}
                onClick={() => run("theme-" + value)}
              >
                {library.theme === value ? "✓" : "　"}{" "}
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))
          ) : popup.type === "file" ? (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  openDocument(popup.file, false);
                  setPopup(null);
                }}
              >
                Open
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  saveScroll();
                  openDocument(popup.file, true);
                  setPopup(null);
                }}
              >
                Open in New Tab
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  favorite(popup.file);
                  setPopup(null);
                }}
              >
                Toggle Favorite
              </button>
              {popup.nodeId &&
                ["reference-retry", "reference-relink", "reference-remove"].map(
                  (id) => (
                    <button
                      key={id}
                      role="menuitem"
                      onClick={() =>
                        run(id, { file: popup.file, nodeId: popup.nodeId })
                      }
                    >
                      {commands.find((c) => c.id === id).label}
                    </button>
                  ),
                )}
            </>
          ) : popup.type === "workspace" ? (
            commands
              .filter(
                (c) =>
                  c.group === "Workspace" && !c.id.startsWith("reference-"),
              )
              .map((c) => (
                <button
                  key={c.id}
                  role="menuitem"
                  disabled={!commandEnabled(c, ctx)}
                  onClick={() => run(c.id)}
                >
                  {c.label}
                </button>
              ))
          ) : popup.type === "tab" ? (
            ["new-tab", "close-tab", "close-others", "reopen-tab"].map((id) => {
              const c = commands.find((c) => c.id === id);
              return (
                <button
                  key={id}
                  role="menuitem"
                  disabled={!commandEnabled(c, ctx)}
                  onClick={() => run(id)}
                >
                  {c.label}
                  <kbd>{shortcutLabel(c.key)}</kbd>
                </button>
              );
            })
          ) : (
            ["File", "Edit", "View", "Navigate", "Workspace", "Help"].map(
              (group) => (
                <details key={group}>
                  <summary>{group}</summary>
                  {commands
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <button
                        key={c.id}
                        role="menuitem"
                        disabled={!commandEnabled(c, ctx)}
                        onClick={() => run(c.id)}
                      >
                        {c.label}
                        <kbd>{shortcutLabel(c.key)}</kbd>
                      </button>
                    ))}
                </details>
              ),
            )
          )}
        </Popup>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "palette"
              ? "Command Palette"
              : modal.type === "help"
                ? "Keyboard Shortcuts and Help"
                : modal.title
          }
          onClose={() => setModal(null)}
          className={modal.type === "palette" ? "palette" : ""}
        >
          {modal.type === "palette" ? (
            <>
              <input
                autoFocus
                aria-label="Find a Command"
                placeholder="Type a command…"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.currentTarget.parentElement
                      .querySelector(".command-list button:not(:disabled)")
                      ?.focus();
                  }
                  if (e.key === "Enter") {
                    const c = selectedCommands.find((c) =>
                      commandEnabled(c, ctx),
                    );
                    if (c) {
                      setModal(null);
                      run(c.id);
                    }
                  }
                }}
              />
              <div
                className="command-list"
                onKeyDown={(e) => {
                  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
                    e.preventDefault();
                    const all = [
                        ...e.currentTarget.querySelectorAll(
                          "button:not(:disabled)",
                        ),
                      ],
                      index = all.indexOf(document.activeElement);
                    all[
                      (index + (e.key === "ArrowDown" ? 1 : -1) + all.length) %
                        all.length
                    ]?.focus();
                  }
                }}
              >
                {selectedCommands.map((c) => (
                  <button
                    key={c.id}
                    disabled={!commandEnabled(c, ctx)}
                    onClick={() => {
                      setModal(null);
                      run(c.id);
                    }}
                  >
                    <small>{c.group}</small>
                    <span>{c.label}</span>
                    <kbd>{shortcutLabel(c.key)}</kbd>
                  </button>
                ))}
              </div>
            </>
          ) : modal.type === "name" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!modal.value.trim()) return;
                const id = modal.action === "rename" ? workspace.id : uid();
                await change(
                  modal.action === "rename"
                    ? { type: "workspace-rename", id, name: modal.value }
                    : {
                        type: "workspace-create",
                        id,
                        name: modal.value,
                        parent: modal.action === "nested" ? workspace.id : null,
                      },
                );
                setSelectedWorkspace(id);
                setSection("workspaces");
                setModal(null);
              }}
            >
              <label>
                Workspace name
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={modal.value}
                  onChange={(e) =>
                    setModal({ ...modal, value: e.target.value })
                  }
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className="primary" type="submit">
                  Save
                </button>
              </div>
            </form>
          ) : modal.type === "confirm" ? (
            <>
              <p>{modal.message}</p>
              <div className="modal-actions">
                <button autoFocus onClick={() => setModal(null)}>
                  {modal.confirm ? "Cancel" : "Close"}
                </button>
                {modal.confirm && (
                  <button
                    className="primary"
                    onClick={async () => {
                      await modal.onConfirm();
                      setModal(null);
                    }}
                  >
                    {modal.confirm}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="help-content">
              <p>
                Files replace the active tab. Use a file’s actions menu,
                ⌘/Ctrl-click, Shift-click, or middle-click to open in a new tab.
              </p>
              <p>
                Arrow keys navigate lists. Home/End jump to the first/last
                entry. Left/Right collapse/expand folders. Enter opens. Optional
                Vim mode adds j/k, h/l, gg/G. Bindings are inactive in input
                fields.
              </p>
              <button
                aria-pressed={library.vim}
                onClick={() => run("toggle-vim")}
              >
                Vim Navigation: {library.vim ? "On" : "Off"}
              </button>
              <p>
                Diagram full-screen: arrow keys pan; ⌘/Ctrl +/- zooms the
                diagram; ⌘/Ctrl+0 resets; Escape closes. Diagram zoom takes
                precedence over document zoom.
              </p>
              {!desktop && (
                <p>
                  Browsers reserve New Tab, Close Tab, Reopen Tab, and New
                  Window shortcuts. Use YAMDV’s + button, application menu, or
                  command palette for those operations. Persistent file handles
                  depend on browser support; snapshots are used otherwise.
                </p>
              )}
              <table>
                <tbody>
                  {commands
                    .filter((c) => c.key)
                    .map((c) => (
                      <tr key={c.id}>
                        <td>{c.label}</td>
                        <td>
                          <kbd>{shortcutLabel(c.key)}</kbd>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p>
                Workspace removal only removes references. Cleanup removes
                confirmed missing references recursively and keeps references
                that need permission.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
