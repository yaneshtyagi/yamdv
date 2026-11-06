// All changes are operations against the latest state, never stale UI snapshots.
const VERSION = 1;
const fileOK = (f) =>
  f && typeof f.id === "string" && typeof f.name === "string";
function nodes(value, seen = new Set(), depth = 0) {
  if (!Array.isArray(value) || depth > 30) return [];
  return value
    .filter(
      (n) =>
        n &&
        typeof n.id === "string" &&
        !seen.has(n.id) &&
        ["folder", "file"].includes(n.type),
    )
    .map((n) => {
      seen.add(n.id);
      return n.type === "file" && fileOK(n.file)
        ? { id: n.id, type: "file", file: n.file }
        : {
            id: n.id,
            type: "folder",
            name: String(n.name || "Workspace"),
            children: nodes(n.children, seen, depth + 1),
          };
    });
}
function normalize(value = {}) {
  if (!value || typeof value !== "object") value = {};
  return {
    version: VERSION,
    revision: Number(value.revision) || 0,
    migrated: !!value.migrated,
    theme: ["light", "dark", "system"].includes(value.theme)
      ? value.theme
      : "system",
    vim: !!value.vim,
    favorites: Array.isArray(value.favorites)
      ? value.favorites
          .filter(fileOK)
          .filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i)
      : [],
    history: Array.isArray(value.history)
      ? value.history
          .filter(fileOK)
          .filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i)
          .slice(0, 200)
      : [],
    workspaces: nodes(value.workspaces).filter((n) => n.type === "folder"),
  };
}
function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = n.children && findNode(n.children, id);
    if (found) return found;
  }
  return null;
}
function collectFiles(nodes) {
  return nodes.flatMap((n) =>
    n.type === "file" ? [n.file] : collectFiles(n.children || []),
  );
}
function removeNodes(nodes, ids) {
  return nodes
    .filter((n) => !ids.has(n.id))
    .map((n) =>
      n.children ? { ...n, children: removeNodes(n.children, ids) } : n,
    );
}
function applyOperation(raw, op) {
  const s = normalize(raw);
  switch (op.type) {
    case "migrate":
      if (!s.migrated) {
        const old = normalize(op.legacy);
        s.favorites = [
          ...s.favorites,
          ...old.favorites.filter(
            (f) => !s.favorites.some((x) => x.id === f.id),
          ),
        ];
        s.history = [
          ...s.history,
          ...old.history.filter((f) => !s.history.some((x) => x.id === f.id)),
        ].slice(0, 200);
        if (s.revision === 0) s.theme = old.theme;
        s.migrated = true;
      }
      break;
    case "theme":
      if (["light", "dark", "system"].includes(op.value)) s.theme = op.value;
      break;
    case "vim":
      s.vim = !!op.value;
      break;
    case "favorite":
      if (!fileOK(op.file)) break;
      s.favorites = s.favorites.filter((f) => f.id !== op.file.id);
      if (op.value) s.favorites.unshift(op.file);
      break;
    case "opened":
      if (fileOK(op.file))
        s.history = [
          { ...op.file, openedAt: op.time || Date.now() },
          ...s.history.filter((f) => f.id !== op.file.id),
        ].slice(0, 200);
      break;
    case "workspace-create": {
      const n = {
        id: op.id,
        type: "folder",
        name: String(op.name || "Workspace").slice(0, 200),
        children: [],
      };
      const parent = findNode(s.workspaces, op.parent);
      if (parent?.type === "folder") parent.children.push(n);
      else if (!op.parent) s.workspaces.push(n);
      break;
    }
    case "workspace-rename": {
      const n = findNode(s.workspaces, op.id);
      if (n?.type === "folder" && op.name?.trim())
        n.name = op.name.trim().slice(0, 200);
      break;
    }
    case "workspace-add": {
      const n = findNode(s.workspaces, op.id);
      if (n?.type !== "folder") break;
      const ids = new Set(collectFiles(n.children).map((f) => f.id));
      function prune(ns) {
        return nodes(ns).flatMap((x) => {
          if (x.type === "file") {
            if (ids.has(x.file.id)) return [];
            ids.add(x.file.id);
            return [x];
          }
          return [{ ...x, children: prune(x.children) }];
        });
      }
      n.children.push(...prune(op.nodes));
      break;
    }
    case "workspace-remove":
      s.workspaces = removeNodes(s.workspaces, new Set([op.id]));
      break;
    case "workspace-clean": {
      const n = findNode(s.workspaces, op.id);
      if (n?.children) {
        const eligible = new Set(
          collectFiles(n.children)
            .filter((f) => op.missing?.includes(f.id))
            .map((f) => f.id),
        );
        function clean(ns) {
          return ns
            .filter((x) => x.type !== "file" || !eligible.has(x.file.id))
            .map((x) =>
              x.children ? { ...x, children: clean(x.children) } : x,
            );
        }
        n.children = clean(n.children);
      }
      break;
    }
    case "workspace-relink": {
      const n = findNode(s.workspaces, op.id);
      if (n?.type === "file" && fileOK(op.file)) n.file = op.file;
      break;
    }
    default:
      throw Error("Unknown library operation");
  }
  s.revision++;
  return normalize(s);
}
export { normalize, applyOperation, findNode, collectFiles, removeNodes };
