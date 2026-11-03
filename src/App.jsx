import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FolderOpen,
  FileText,
  Star,
  History,
  Search,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  ChevronDown,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import {
  isMarkdown,
  readSaved,
  recordHistory,
  resolveRelative,
} from "./library";

const desktopAPI =
  typeof window.yamdv?.pickFiles === "function" ? window.yamdv : null;

const welcome = `# A little space for your words\n\nOpen a Markdown file or a whole folder and settle into reading. Your documents stay on your device.\n\n## Everything in its place\n\n- **Folder** keeps your Markdown files together, including nested folders.\n- **Favorites** puts the documents you return to one click away.\n- **History** remembers your last 200 opened files.\n\n> Less interface. More room for ideas.\n\n## Markdown, beautifully rendered\n\nEnjoy tables, task lists, links, images, and fenced code blocks.\n\n\`\`\`js\nconst thought = 'Make room for what matters.';\nconsole.log(thought);\n\`\`\`\n\nChoose a light or dark appearance below, or let YAMDV follow your system.\n`;
function Tree({ files, select, active, favorite, toggle, prefix = "" }) {
  const groups = new Map();
  for (const file of files) {
    const rest = file.relative.slice(prefix.length),
      first = rest.split("/")[0];
    if (!groups.has(first)) groups.set(first, []);
    groups.get(first).push(file);
  }
  return [...groups]
    .sort(
      ([a, aa], [b, bb]) =>
        Number(bb[0].relative.slice(prefix.length).includes("/")) -
          Number(aa[0].relative.slice(prefix.length).includes("/")) ||
        a.localeCompare(b),
    )
    .map(([name, items]) =>
      items[0].relative.slice(prefix.length).includes("/") ? (
        <details key={name} open>
          <summary>
            <ChevronRight size={13} />
            <Folder size={15} />
            <span>{name}</span>
          </summary>
          <div className="nested">
            <Tree
              {...{ files: items, select, active, favorite, toggle }}
              prefix={prefix + name + "/"}
            />
          </div>
        </details>
      ) : (
        <FileRow
          key={items[0].id}
          file={items[0]}
          {...{ select, active, favorite, toggle }}
        />
      ),
    );
}
function FileRow({ file, select, active, favorite, toggle }) {
  return (
    <div className={"file-row " + (active === file.id ? "selected" : "")}>
      <button
        className="file-select"
        onClick={() => select(file)}
        title={file.path || file.relative}
      >
        <FileText size={16} />
        <span>{file.name}</span>
      </button>
      <button
        className={
          "row-star " +
          (favorite.some((f) => f.id === file.id) ? "is-starred" : "")
        }
        aria-label={`Favorite ${file.name}`}
        onClick={() => toggle(file)}
      >
        <Star size={14} />
      </button>
    </div>
  );
}
export default function App() {
  const [theme, setTheme] = useState(() => readSaved("yamdv.theme", "system"));
  const [favorites, setFavorites] = useState(() =>
    readSaved("yamdv.favorites", []),
  );
  const [history, setHistory] = useState(() => readSaved("yamdv.history", []));
  const [files, setFiles] = useState([]),
    [folder, setFolder] = useState("Your workspace"),
    [tab, setTab] = useState("folder"),
    [query, setQuery] = useState("");
  const [active, setActive] = useState(null),
    [content, setContent] = useState(welcome),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(true);
  const picker = useRef(),
    folderPicker = useRef(),
    source = useRef(new Map()),
    assets = useRef(new Map()),
    request = useRef(0);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("yamdv.theme", JSON.stringify(theme));
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem("yamdv.favorites", JSON.stringify(favorites));
      localStorage.setItem("yamdv.history", JSON.stringify(history));
    } catch {
      setError(
        "Local storage is full. Your recent changes may not survive a reload.",
      );
    }
  }, [favorites, history]);
  async function select(file) {
    const token = ++request.current;
    setError("");
    setBusy(true);
    try {
      const text =
        desktopAPI && !file.snapshot
          ? await desktopAPI.readFile(file.path)
          : source.current.has(file.id)
            ? await source.current.get(file.id).text()
            : file.content;
      if (text === undefined)
        throw Error("Reopen this file or its folder to read it again.");
      if (token !== request.current) return;
      const saved = {
        ...file,
        content: desktopAPI && !file.snapshot ? undefined : text,
      };
      setActive(file);
      setContent(text);
      setHistory((h) => recordHistory(h, saved));
    } catch (e) {
      if (token === request.current) setError(e.message);
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  async function toggle(file) {
    let text = file.content;
    if (source.current.has(file.id))
      text = await source.current.get(file.id).text();
    const saved = {
      ...file,
      content:
        (!desktopAPI || file.snapshot) && active?.id === file.id
          ? content
          : text,
    };
    setFavorites((f) =>
      f.some((x) => x.id === file.id)
        ? f.filter((x) => x.id !== file.id)
        : [saved, ...f],
    );
  }
  async function open(kind) {
    setError("");
    if (!desktopAPI) {
      (kind === "folder" ? folderPicker : picker).current.click();
      return;
    }
    setBusy(true);
    try {
      const result = await (kind === "folder"
        ? desktopAPI.pickFolder()
        : desktopAPI.pickFiles());
      if (result) {
        const next = kind === "folder" ? result.files : result;
        setFiles(next);
        setFolder(kind === "folder" ? result.name : "Opened files");
        setTab("folder");
        if (next.length) await select(next[0]);
        else setError("No Markdown files found in this folder.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importFiles(list, isFolder = false) {
    const all = Array.from(list),
      next = [];
    for (const f of all) {
      const relative = f.webkitRelativePath || f.name;
      const key = relative;
      source.current.set(key, f);
      if (isMarkdown(f.name))
        next.push({
          id: key,
          name: f.name,
          relative,
          path: relative,
          snapshot: true,
        });
      else if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(f.name)) {
        if (assets.current.has(key))
          URL.revokeObjectURL(assets.current.get(key));
        assets.current.set(key, URL.createObjectURL(f));
      }
    }
    setFiles(next);
    setFolder(
      isFolder
        ? all[0]?.webkitRelativePath.split("/")[0] || "Folder"
        : "Opened files",
    );
    setTab("folder");
    if (next.length) await select(next[0]);
    else setError("No Markdown files found.");
  }
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        open(e.shiftKey ? "folder" : "file");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const currentFavorite = active && favorites.some((f) => f.id === active.id);
  const listed = (
    tab === "folder" ? files : tab === "favorites" ? favorites : history
  ).filter((f) =>
    (f.relative + " " + f.name).toLowerCase().includes(query.toLowerCase()),
  );
  function link(href) {
    if (href.startsWith("#")) {
      document
        .getElementById(decodeURIComponent(href.slice(1)))
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (/^https?:/i.test(href)) {
      if (desktopAPI) desktopAPI.openExternal(href);
      else window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (active) {
      const [target, hash] = href.split("#");
      const relative = resolveRelative(active.relative, target);
      const file = [...files, ...history, ...favorites].find(
        (f) => f.relative === relative,
      );
      if (file) {
        select(file).then(() => {
          if (hash)
            setTimeout(
              () =>
                document
                  .getElementById(decodeURIComponent(hash))
                  ?.scrollIntoView(),
              50,
            );
        });
      } else
        setError(
          "Open the folder containing this linked Markdown file to follow it.",
        );
    }
  }
  const heading =
    (Tag) =>
    ({ children, ...props }) => (
      <Tag
        id={String(children)
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")}
        {...props}
      >
        {children}
      </Tag>
    );
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={picker}
        type="file"
        accept=".md,.markdown,.mdown,.mkd"
        multiple
        hidden
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderPicker}
        type="file"
        webkitdirectory=""
        multiple
        hidden
        onChange={(e) => {
          importFiles(e.target.files, true);
          e.target.value = "";
        }}
      />
      {sidebar && (
        <aside>
          <div className="brand">
            <div className="brand-icon">
              <BookOpen size={23} />
            </div>
            <div>
              <strong>
                YAMDV<span className="brand-dot">.</span>
              </strong>
              <small>A home for your Markdown</small>
            </div>
          </div>
          <div className="open-actions">
            <button className="primary" onClick={() => open("folder")}>
              <FolderOpen size={16} />
              Open folder
            </button>
            <button
              className="icon-button"
              title="Open Markdown files"
              aria-label="Open Markdown files"
              onClick={() => open("file")}
            >
              <FileText size={18} />
            </button>
          </div>
          <nav>
            {[
              ["folder", Folder, "Folder"],
              ["favorites", Star, "Favorites"],
              ["history", History, "History"],
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                className={tab === key ? "tab active" : "tab"}
                onClick={() => {
                  setTab(key);
                  setQuery("");
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Filter files"
              placeholder="Find a file…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear filter" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            )}
          </div>
          <div className="list-heading">
            <span>
              {tab === "folder"
                ? folder
                : tab === "favorites"
                  ? "FAVORITES"
                  : "RECENTLY OPENED"}
            </span>
            <span>{listed.length}</span>
          </div>
          <div className="file-list">
            {listed.length ? (
              tab === "folder" ? (
                <Tree
                  files={listed}
                  select={select}
                  active={active?.id}
                  favorite={favorites}
                  toggle={toggle}
                />
              ) : (
                listed.map((file) => (
                  <FileRow
                    key={file.id}
                    {...{
                      file,
                      select,
                      active: active?.id,
                      favorite: favorites,
                      toggle,
                    }}
                  />
                ))
              )
            ) : (
              <div className="empty-list">
                <FolderOpen size={27} />
                <p>
                  {query
                    ? "No matching files"
                    : tab === "favorites"
                      ? "Your favorites belong here"
                      : tab === "history"
                        ? "Your reading journey starts here"
                        : "A place for your next idea"}
                </p>
                <small>
                  {tab === "folder"
                    ? "Open a folder to explore its Markdown files."
                    : tab === "favorites"
                      ? "Star a document to keep it close."
                      : "Open a document to add it to your history."}
                </small>
              </div>
            )}
          </div>
          <div className="sidebar-footer">
            <span>APPEARANCE</span>
            <div className="theme-picker">
              {[
                ["light", Sun, "Light"],
                ["dark", Moon, "Dark"],
                ["system", Monitor, "System"],
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  className={theme === key ? "chosen" : ""}
                  aria-pressed={theme === key}
                  onClick={() => setTheme(key)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <small>
              Yet Another MarkDown Viewer <span>v1.0</span>
            </small>
          </div>
        </aside>
      )}
      <main>
        <header>
          <div className="breadcrumb">
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              {sidebar ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            <span>{active ? folder : "Getting started"}</span>
            <ChevronRight size={14} />
            <strong>{active?.name || "Welcome to YAMDV"}</strong>
          </div>
          {active && (
            <button
              className={
                "favorite-button " + (currentFavorite ? "is-starred" : "")
              }
              onClick={() => toggle(active)}
            >
              <Star size={16} />
              {currentFavorite ? "Favorited" : "Add to favorites"}
            </button>
          )}
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="reader" key={active?.id || "welcome"}>
          {!active && (
            <div className="welcome-eyebrow">
              <span /> YOUR PERSONAL READING SPACE
            </div>
          )}
          <article aria-busy={busy}>
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      link(href);
                    }}
                  >
                    {children}
                  </a>
                ),
                img: ({ src, alt }) => {
                  let url = src;
                  if (src && !/^(https?:|data:|blob:)/i.test(src) && active) {
                    if (desktopAPI && !active.snapshot) {
                      const p = resolveRelative(active.path, src);
                      url =
                        "yamdv-asset://local" +
                        p.split("/").map(encodeURIComponent).join("/");
                    } else
                      url = assets.current.get(
                        resolveRelative(active.relative, src),
                      );
                  }
                  return url ? (
                    <img src={url} alt={alt} />
                  ) : (
                    <span className="missing-image">[Image: {alt || src}]</span>
                  );
                },
                h1: heading("h1"),
                h2: heading("h2"),
                h3: heading("h3"),
              }}
            >
              {content}
            </Markdown>
            {!active && (
              <div className="welcome-actions">
                <button className="primary" onClick={() => open("file")}>
                  <FileText size={16} />
                  Open a Markdown file <ArrowUpRight size={15} />
                </button>
                <span>or drop files anywhere</span>
              </div>
            )}
          </article>
        </div>
        <footer>
          <span>
            <span className="status-dot" />
            {busy ? "Opening…" : active ? "Markdown" : "Ready when you are"}
          </span>
          <span>
            {active
              ? `${content.trim() ? content.trim().split(/\s+/).length : 0} words · ${Math.max(1, Math.ceil(content.split(/\s+/).length / 220))} min read`
              : "Local files. A quieter view."}
          </span>
        </footer>
      </main>
    </div>
  );
}
