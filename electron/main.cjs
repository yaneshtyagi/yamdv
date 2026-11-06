const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  protocol,
  net,
  Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
let normalize, applyOperation;
const commands = require("../shared/commands.json");
const allowed = new Set(),
  assets = new Set(),
  contexts = new Map();
let library,
  queue = Promise.resolve(),
  grantQueue = Promise.resolve();
const markdown = (p) => /\.(md|markdown|mdown|mkd)$/i.test(p);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "yamdv-asset",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
function trusted(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const url = event.senderFrame?.url || "";
  if (
    !win ||
    event.senderFrame !== event.sender.mainFrame ||
    !(
      url.startsWith(
        pathToFileURL(path.join(__dirname, "../dist/index.html")).href,
      ) ||
      (process.argv.includes("--dev") &&
        url.startsWith("http://127.0.0.1:5173/"))
    )
  )
    throw Error("Untrusted sender");
  return win;
}
async function atomic(name, data) {
  const dest = path.join(app.getPath("userData"), name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest + ".tmp", JSON.stringify(data));
  await fs.rename(dest + ".tmp", dest);
}
function saveGrants() {
  grantQueue = grantQueue
    .catch(() => {})
    .then(() => atomic("grants.json", [...allowed]));
  return grantQueue;
}
async function describe(p) {
  p = await fs.realpath(p);
  if (!markdown(p)) throw Error("Only Markdown files may be opened");
  allowed.add(p);
  assets.add(path.dirname(p));
  return { id: p, path: p, name: path.basename(p), relative: path.basename(p) };
}
async function scan(root, dir = root) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await scan(root, p)));
    else if (entry.isFile() && markdown(p))
      result.push({
        ...(await describe(p)),
        relative: path.relative(root, p).split(path.sep).join("/"),
      });
  }
  return result;
}
async function status(p) {
  if (typeof p !== "string" || !allowed.has(p)) return "permission";
  try {
    const canonical = await fs.realpath(p);
    if (canonical !== p) return "inaccessible";
    const stat = await fs.stat(p);
    if (!stat.isFile()) return "missing";
    await fs.access(p, fs.constants.R_OK);
    return "available";
  } catch (e) {
    return ["ENOENT", "ENOTDIR"].includes(e.code) ? "missing" : "inaccessible";
  }
}
function command(id) {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  if (id === "new-window") return createWindow();
  win.webContents.send("command", id);
}
function buildMenu() {
  const ctx =
    contexts.get(BrowserWindow.getFocusedWindow()?.webContents.id) || {};
  const template = [
    "File",
    "Edit",
    "View",
    "Navigate",
    "Workspace",
    "Help",
  ].map((group) => ({
    label: group,
    submenu: commands
      .filter((c) => c.group === group)
      .map((c) => ({
        label: c.label,
        enabled: !c.needs || !!ctx[c.needs],
        accelerator: c.key
          ?.replace("Mod", "CommandOrControl")
          .replace("Plus", "Plus")
          .replace("Minus", "-"),
        click: () => command(c.id),
      })),
  }));
  template[1].submenu.unshift(
    { role: "undo" },
    { role: "redo" },
    { type: "separator" },
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    { role: "selectAll" },
    { type: "separator" },
  );
  if (process.platform === "darwin")
    template.unshift({
      label: "YAMDV",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  else template[0].submenu.push({ type: "separator" }, { role: "quit" });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 880,
    minWidth: 720,
    minHeight: 480,
    title: "YAMDV",
    icon: path.join(__dirname, "../build/icon.png"),
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("focus", buildMenu);
  const contentsId = win.webContents.id;
  win.on("closed", () => contexts.delete(contentsId));
  win.webContents.on("zoom-changed", (e, direction) => {
    e.preventDefault();
    win.webContents.send(
      "command",
      direction === "in" ? "zoom-in" : "zoom-out",
    );
  });
  if (process.argv.includes("--dev")) win.loadURL("http://127.0.0.1:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
  return win;
}
app.whenReady().then(async () => {
  ({ normalize, applyOperation } = await import("../shared/library.mjs"));
  try {
    for (const p of JSON.parse(
      await fs.readFile(
        path.join(app.getPath("userData"), "grants.json"),
        "utf8",
      ),
    )) {
      if (typeof p === "string") {
        allowed.add(p);
        assets.add(path.dirname(p));
      }
    }
  } catch {}
  try {
    library = normalize(
      JSON.parse(
        await fs.readFile(
          path.join(app.getPath("userData"), "library.json"),
          "utf8",
        ),
      ),
    );
  } catch {
    library = normalize();
  }
  protocol.handle("yamdv-asset", async (request) => {
    try {
      const p = await fs.realpath(
        decodeURIComponent(new URL(request.url).pathname),
      );
      if (
        ![...assets].some((root) => p.startsWith(root + path.sep)) ||
        !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p)
      )
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(p).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  function handle(name, fn) {
    ipcMain.handle(name, (e, ...args) => {
      const win = trusted(e);
      return fn(win, ...args);
    });
  }
  handle("pick-files", async (win) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
      ],
    });
    if (result.canceled) return null;
    const files = await Promise.all(result.filePaths.map(describe));
    await saveGrants();
    return files;
  });
  handle("pick-folder", async (win) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled) return null;
    const root = await fs.realpath(result.filePaths[0]),
      files = await scan(root);
    await saveGrants();
    return { name: path.basename(root), files };
  });
  handle("dropped-file", async (_, p) => {
    const f = await describe(p);
    await saveGrants();
    return f;
  });
  handle("read-file", async (_, p) => {
    const state = await status(p);
    if (state !== "available")
      throw Error(
        state === "missing"
          ? "ENOENT: File is no longer available."
          : `Access ${state}. Reopen or relink the file.`,
      );
    return fs.readFile(p, "utf8");
  });
  handle("file-status", (_, p) => status(p));
  handle("external", (_, url) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url))
      return shell.openExternal(url);
  });
  handle("new-window", () => {
    createWindow();
    return true;
  });
  handle("get-library", () => library);
  handle("mutate-library", (_, op) => {
    queue = queue
      .catch(() => {})
      .then(async () => {
        const next = applyOperation(library, op);
        await atomic("library.json", next);
        library = next;
        for (const win of BrowserWindow.getAllWindows())
          win.webContents.send("library", next);
        return next;
      });
    return queue;
  });
  handle("command-state", (win, ctx) => {
    contexts.set(win.webContents.id, ctx);
    buildMenu();
  });
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
