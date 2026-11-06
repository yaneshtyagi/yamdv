import { desktop, handleStore } from "./store";
import { isMarkdown } from "../library";
import { uid } from "../model";
const sources = new Map(),
  handles = new Map(),
  images = new Map();
export class FileAccessError extends Error {
  constructor(message, status = "inaccessible") {
    super(message);
    this.status = status;
  }
}
export async function readFile(file) {
  if (desktop && !file.snapshot) {
    try {
      return await desktop.readFile(file.path);
    } catch (e) {
      throw new FileAccessError(
        e.message,
        /ENOENT|ENOTDIR/.test(e.message) ? "missing" : "inaccessible",
      );
    }
  }
  if (sources.has(file.id)) return sources.get(file.id).text();
  const handle = handles.get(file.id) || (await handleStore(file.id));
  if (handle) {
    handles.set(file.id, handle);
    try {
      if ((await handle.queryPermission({ mode: "read" })) !== "granted")
        throw new FileAccessError(
          "Regrant access using Retry / Grant Access.",
          "permission",
        );
      return await (await handle.getFile()).text();
    } catch (e) {
      if (e instanceof FileAccessError) throw e;
      throw new FileAccessError(
        e.message,
        e.name === "NotFoundError" ? "missing" : "inaccessible",
      );
    }
  }
  if (typeof file.content === "string") return file.content;
  throw new FileAccessError(
    "Reopen or relink this file to grant access.",
    "permission",
  );
}
export async function availability(file) {
  if (desktop && !file.snapshot) return desktop.fileStatus(file.path);
  const h = handles.get(file.id) || (await handleStore(file.id));
  if (h) {
    try {
      if ((await h.queryPermission({ mode: "read" })) !== "granted")
        return "permission";
      await h.getFile();
      return "available";
    } catch (e) {
      return e.name === "NotFoundError" ? "missing" : "inaccessible";
    }
  }
  return sources.has(file.id)
    ? "available"
    : typeof file.content === "string"
      ? "snapshot"
      : "permission";
}
export async function grant(file) {
  const h = handles.get(file.id) || (await handleStore(file.id));
  if (h) {
    await h.requestPermission({ mode: "read" });
    return availability(file);
  }
  return availability(file);
}
async function descriptor(handle, relative, root = "") {
  let id;
  for (const [key, known] of handles) {
    if (await known.isSameEntry(handle)) {
      id = key;
      break;
    }
  }
  id ||= root ? `handle:${root}/${relative}` : `handle:${uid()}`;
  handles.set(id, handle);
  await handleStore(id, handle);
  const f = await handle.getFile();
  return {
    id,
    name: handle.name,
    relative,
    path: relative,
    snapshot: true,
    handle: true,
    content: await f.text(),
  };
}
async function pickHandlesFolder() {
  const root = await window.showDirectoryPicker({ mode: "read" });
  let rootId;
  const known = (await handleStore("roots")) || [];
  for (const entry of known) {
    try {
      if (await entry.handle.isSameEntry(root)) {
        rootId = entry.id;
        break;
      }
    } catch {}
  }
  if (!rootId) {
    rootId = uid();
    known.push({ id: rootId, handle: root });
    await handleStore("roots", known);
  }
  const files = [];
  async function walk(dir, prefix = "") {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const relative = prefix + name;
      if (h.kind === "directory") await walk(h, relative + "/");
      else if (isMarkdown(name))
        files.push(await descriptor(h, relative, rootId));
      else if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name)) {
        images.set(
          `${rootId}/${relative}`,
          URL.createObjectURL(await h.getFile()),
        );
      }
    }
  }
  await walk(root);
  return { name: root.name, files: files.map((f) => ({ ...f, rootId })) };
}
function fallbackPicker(folder) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if (folder) input.webkitdirectory = true;
    else input.accept = ".md,.markdown,.mdown,.mkd";
    input.onchange = async () => {
      const files = await importFiles(input.files);
      resolve(
        folder
          ? {
              name:
                input.files[0]?.webkitRelativePath.split("/")[0] || "Folder",
              files,
            }
          : files,
      );
      input.remove();
    };
    input.oncancel = () => {
      resolve(null);
      input.remove();
    };
    input.hidden = true;
    document.body.append(input);
    input.click();
  });
}
export async function pickFiles() {
  try {
    if (desktop) return desktop.pickFiles();
    if (window.showOpenFilePicker) {
      const hs = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "Markdown",
            accept: { "text/markdown": [".md", ".markdown", ".mdown", ".mkd"] },
          },
        ],
      });
      return Promise.all(hs.map((h) => descriptor(h, h.name)));
    }
    return fallbackPicker(false);
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}
export async function pickFolder() {
  try {
    if (desktop) return desktop.pickFolder();
    if (window.showDirectoryPicker) return pickHandlesFolder();
    return fallbackPicker(true);
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}
export async function importFiles(list) {
  const batch = uid(),
    files = [];
  for (const f of Array.from(list)) {
    if (isMarkdown(f.name)) {
      if (desktop) {
        const native = await desktop.droppedFile(f);
        if (native) {
          files.push(native);
          continue;
        }
      }
      const relative = f.webkitRelativePath || f.name;
      const id = `snapshot:${batch}/${relative}`;
      sources.set(id, f);
      files.push({
        id,
        name: f.name,
        path: relative,
        relative,
        snapshot: true,
        content: await f.text(),
        rootId: batch,
      });
    } else if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(f.name))
      images.set(
        `${batch}/${f.webkitRelativePath || f.name}`,
        URL.createObjectURL(f),
      );
  }
  return files;
}
export function imageURL(file, relative) {
  if (desktop && !file.snapshot)
    return (
      "yamdv-asset://local" +
      relative.split("/").map(encodeURIComponent).join("/")
    );
  return images.get(`${file.rootId}/${relative}`);
}
export async function boundedMap(items, fn, { limit = 4, signal } = {}) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length && !signal?.aborted) {
        const i = cursor++;
        try {
          result[i] = { value: await fn(items[i], i) };
        } catch (error) {
          result[i] = { error };
        }
      }
    }),
  );
  return result;
}
