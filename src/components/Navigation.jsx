import React, { useRef } from "react";
import {
  FileText,
  Folder,
  Star,
  FileWarning,
  ChevronRight,
} from "lucide-react";
export function navigationKey(event, vim) {
  if (event.target.matches("input,textarea,select,[contenteditable=true]"))
    return;
  const container = event.currentTarget;
  const items = [...container.querySelectorAll("[data-nav]")].filter(
    (el) => el.getClientRects().length,
  );
  const current = items.indexOf(document.activeElement);
  const key = event.key;
  let next;
  if (key === "ArrowDown" || (vim && key === "j"))
    next = Math.min(items.length - 1, current + 1);
  if (key === "ArrowUp" || (vim && key === "k"))
    next = Math.max(0, current - 1);
  if (key === "Home" || (vim && key === "g" && container.dataset.lastG === "g"))
    next = 0;
  if (key === "End" || (vim && key === "G")) next = items.length - 1;
  container.dataset.lastG = key === "g" ? "g" : "";
  if (next !== undefined) {
    event.preventDefault();
    items[next]?.focus();
  }
  if (
    ["ArrowLeft", "ArrowRight"].includes(key) ||
    (vim && ["h", "l"].includes(key))
  ) {
    const summary = event.target.closest("summary");
    const detail = summary?.parentElement || event.target.closest("details");
    if (detail) {
      event.preventDefault();
      detail.open = ["ArrowRight", "l"].includes(key);
      if (!detail.open) detail.querySelector("summary")?.focus();
    }
  }
}
export function FileRow({
  file,
  onOpen,
  onMenu,
  onFavorite,
  favorite,
  status,
  selected,
}) {
  return (
    <div className={"file-row " + (selected ? "selected" : "")}>
      <button
        data-nav
        className="file-select"
        title={`${file.path || file.relative}${status ? " — " + status : ""}`}
        onClick={(e) => onOpen(file, e.metaKey || e.ctrlKey || e.shiftKey)}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onOpen(file, true);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(file, e.clientX, e.clientY);
        }}
      >
        {["missing", "permission", "inaccessible"].includes(status) ? (
          <FileWarning className={"availability-" + status} size={15} />
        ) : (
          <FileText size={15} />
        )}
        <span>{file.name}</span>
        {status && status !== "available" && (
          <small className="availability-label">{status}</small>
        )}
      </button>
      <button
        className={"row-action " + (favorite ? "starred" : "")}
        aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${file.name}`}
        onClick={() => onFavorite(file)}
      >
        <Star size={13} />
      </button>
      <button
        className="row-action"
        aria-label={`Actions for ${file.name}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onMenu(file, r.left, r.bottom);
        }}
      >
        ⋯
      </button>
    </div>
  );
}
export function FileTree({ files, prefix = "", ...props }) {
  const grouped = new Map();
  for (const file of files) {
    const name = (file.relative || file.name)
      .slice(prefix.length)
      .split("/")[0];
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push(file);
  }
  return [...grouped]
    .sort(
      ([a, aa], [b, bb]) =>
        Number(bb[0].relative.slice(prefix.length).includes("/")) -
          Number(aa[0].relative.slice(prefix.length).includes("/")) ||
        a.localeCompare(b),
    )
    .map(([name, items]) =>
      items[0].relative.slice(prefix.length).includes("/") ? (
        <details key={name} open>
          <summary data-nav>
            <ChevronRight size={12} />
            <Folder size={14} />
            {name}
          </summary>
          <div className="tree-indent">
            <FileTree files={items} prefix={prefix + name + "/"} {...props} />
          </div>
        </details>
      ) : (
        <FileRow
          key={items[0].id}
          file={items[0]}
          {...props}
          favorite={props.favorites.some((f) => f.id === items[0].id)}
          selected={props.activeId === items[0].id}
        />
      ),
    );
}
export function WorkspaceTree({
  nodes,
  selected,
  onSelect,
  onFolderMenu,
  statuses,
  ...props
}) {
  return nodes.map((node) =>
    node.type === "folder" ? (
      <details key={node.id} open>
        <summary
          data-nav
          className={selected === node.id ? "workspace-selected" : ""}
          onClick={(e) => {
            if (e.target.closest("button")) return;
            onSelect(node.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onFolderMenu(node, e.clientX, e.clientY);
          }}
        >
          <ChevronRight size={12} />
          <Folder size={14} />
          <span>{node.name}</span>
          <button
            aria-label={`Workspace actions for ${node.name}`}
            onClick={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              onSelect(node.id);
              onFolderMenu(node, r.left, r.bottom);
            }}
          >
            ⋯
          </button>
        </summary>
        <div className="tree-indent">
          <WorkspaceTree
            nodes={node.children}
            {...{ selected, onSelect, onFolderMenu, statuses, ...props }}
          />
        </div>
      </details>
    ) : (
      <FileRow
        key={node.id}
        file={node.file}
        {...props}
        status={statuses[node.file.id] || "checking"}
        favorite={props.favorites.some((f) => f.id === node.file.id)}
        selected={props.activeId === node.file.id}
        onMenu={(file, x, y) => props.onMenu(file, x, y, node.id)}
      />
    ),
  );
}
