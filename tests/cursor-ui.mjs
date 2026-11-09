import { chromium, _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const desktop = process.argv.includes("--desktop"),
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), "yamdv-cursor-")),
  file = path.join(fixture, `Cursor-${"long-filename-".repeat(9)}.md`);
const source =
  '# Cursor demo\n\nFirst paragraph with **bold words** and a [link](https://example.com).\n\nSecond paragraph with more reading.\n\nUnicode 👩‍💻 café text.\n\n```js\nconst long = "' +
  "a".repeat(400) +
  '";\nconst short = 1;\n```\n\n```txt\nAnother block\n```\n\n' +
  Array.from(
    { length: 60 },
    (_, i) => `Reading paragraph ${i}. Keep focus here.\n`,
  ).join("\n") +
  "\n## First subsection\n\nBefore the rule.\n\n---\n\nAfter the rule.\n\n## Second subsection\n\n### Child subsection\n\n# Next chapter\n\n## Different parent\n";
await fs.writeFile(file, source);
let app, browser, server, page, originalClipboard;
try {
  if (desktop) {
    app = await electron.launch({
      executablePath: process.env.YAMDV_PACKAGED || undefined,
      args: [
        ...(process.env.YAMDV_PACKAGED ? [] : ["."]),
        `--user-data-dir=${path.join(fixture, "profile")}`,
      ],
    });
    await app.evaluate(({ clipboard }) => {
      globalThis.__yamdvPreviousClipboard = clipboard.readText();
    });
    page = await app.firstWindow();
  } else {
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "5176",
      ],
      { stdio: "ignore" },
    );
    for (let n = 0; n < 100; n++) {
      try {
        await fetch("http://127.0.0.1:5176");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.addInitScript(() => (window.showOpenFilePicker = undefined));
    page = await context.newPage();
    await page.goto("http://127.0.0.1:5176");
    originalClipboard = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "YAMDV", exact: true }),
  ).toBeVisible();
  async function command(name) {
    await page
      .getByRole("button", { name: "Command Palette", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Find a Command" }).fill(name);
    await page
      .locator(".command-list button")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
  }
  if (desktop) {
    await app.evaluate(
      ({ dialog }, path) =>
        (dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [path],
        })),
      file,
    );
    await page
      .getByRole("button", { name: "Open Markdown Files", exact: true })
      .click();
  } else {
    const choose = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Open Markdown Files", exact: true })
      .click();
    await (await choose).setFiles(file);
  }
  await expect(
    page.getByRole("heading", { name: "Cursor demo" }),
  ).toBeVisible();
  const reader = page.getByRole("region", { name: "Markdown document" }),
    pre = page.locator(".code-block pre").first();
  await expect
    .poll(() => pre.evaluate((el) => el.scrollWidth > el.clientWidth))
    .toBe(true);
  const initialHeight = await pre.evaluate((el) => el.clientHeight);
  await page
    .getByRole("button", { name: "Wrap lines", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Wrap lines", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await pre.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
    true,
  );
  expect(await pre.evaluate((el) => el.clientHeight)).toBeGreaterThan(
    initialHeight,
  );
  await expect(
    page.getByRole("button", { name: "Wrap lines", exact: true }).nth(1),
  ).toHaveAttribute("aria-pressed", "false");
  await command("Toggle Vim Navigation");
  await page.keyboard.press("Meta+Shift+e");
  await expect(reader).toBeFocused();
  await expect(page.locator(".reading-caret")).toBeVisible();
  await expect(page.locator(".reading-active-line")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await expect(reader).toHaveAttribute("data-reader-offset", "0");
  await page.keyboard.press("j");
  await expect
    .poll(async () => Number(await reader.getAttribute("data-reader-offset")))
    .toBeGreaterThan(0);
  const before = Number(await reader.getAttribute("data-reader-offset"));
  await page.keyboard.press("l");
  await expect
    .poll(async () => Number(await reader.getAttribute("data-reader-offset")))
    .toBeGreaterThan(before);
  await page.keyboard.press("h");
  await expect(reader).toHaveAttribute("data-reader-offset", String(before));
  const first = page.locator("article>p").first();
  await first.click({ position: { x: 5, y: 8 } });
  await page.keyboard.press("0");
  await page.keyboard.press("v");
  await page.keyboard.press("l");
  await page.keyboard.press("l");
  await expect(reader).toHaveAttribute("data-reader-mode", "visual");
  expect(await page.evaluate(() => getSelection().toString())).toBe("Fir");
  await page.keyboard.press("y");
  const clipboardText = () =>
    desktop
      ? app.evaluate(({ clipboard }) => clipboard.readText())
      : page.evaluate(() => navigator.clipboard.readText());
  await expect.poll(clipboardText).toBe("Fir");
  await expect(reader).toHaveAttribute("data-reader-mode", "normal");
  await page.keyboard.press("0");
  await expect(reader).toHaveAttribute("data-reader-offset", "12");
  const lineStart = await reader.getAttribute("data-reader-offset");
  await page.keyboard.press("y");
  await page.keyboard.press("y");
  await expect
    .poll(clipboardText)
    .toContain("First paragraph with bold words and a link.");
  await expect(reader).toHaveAttribute("data-reader-offset", lineStart);
  await page.keyboard.press("l");
  await page.keyboard.press("l");
  await page.keyboard.press("l");
  await page.keyboard.press("v");
  await page.keyboard.press("h");
  await page.keyboard.press("h");
  expect(await page.evaluate(() => getSelection().toString())).toBe("irs");
  await page.keyboard.press("Escape");
  await page.keyboard.press("0");
  await page.keyboard.press("Shift+v");
  await expect(reader).toHaveAttribute("data-reader-mode", "visual-line");
  expect(await page.evaluate(() => getSelection().toString())).toContain(
    "First paragraph with bold words and a link.",
  );
  await page.keyboard.press("j");
  expect(await page.evaluate(() => getSelection().toString())).toContain(
    "Second paragraph",
  );
  await page.screenshot({
    path: path.join(
      fixture,
      desktop ? "desktop-visual.png" : "browser-visual.png",
    ),
  });
  await page.keyboard.press("Escape");
  await expect(reader).toBeFocused();
  expect(await page.evaluate(() => getSelection().isCollapsed)).toBe(true);
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await page.keyboard.press("v");
  await page.keyboard.press("Shift+g");
  const selected = await page.evaluate(() => getSelection().toString());
  expect(selected).toContain("Reading paragraph 59");
  expect(selected).not.toContain("Wrap lines");
  expect(selected).not.toContain("Copy code");
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBe(0);
  await page
    .getByRole("button", { name: "Copy code", exact: true })
    .first()
    .click();
  await expect
    .poll(clipboardText)
    .toContain('const long = "' + "a".repeat(400));
  await page.keyboard.press("Meta+Shift+e");
  const initialZoom = await page
    .getByRole("button", { name: "Reset Document Zoom" })
    .innerText();
  await page.keyboard.press("Meta+Alt+=");
  await expect
    .poll(() => page.locator(".ide").evaluate((el) => Number(el.style.zoom)))
    .toBeCloseTo(1.1);
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText(initialZoom);
  await page.keyboard.press("Meta+Alt+-");
  await expect
    .poll(() => page.locator(".ide").evaluate((el) => Number(el.style.zoom)))
    .toBeCloseTo(1);
  await page.keyboard.press("Meta+Alt+=");
  await page.keyboard.press("Meta+Alt+0");
  await expect
    .poll(() => page.locator(".ide").evaluate((el) => Number(el.style.zoom)))
    .toBe(1);
  await command("New Tab");
  await command("Close Tab");
  await expect(
    page.getByRole("button", { name: "Wrap lines", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Meta+Shift+e");
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await page.screenshot({
    path: path.join(
      fixture,
      desktop ? "desktop-cursor.png" : "browser-cursor.png",
    ),
  });
  await command("Show History");
  const nav = page.locator(".navigation");
  const sidebar = page.locator(".sidebar");
  expect(await nav.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await nav.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  expect(await nav.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  const initialWidth = (await sidebar.boundingBox()).width;
  const divider = page.getByRole("separator", { name: "Resize sidebar" });
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + 100);
  await page.mouse.up();
  expect((await sidebar.boundingBox()).width).toBeCloseTo(initialWidth + 100);
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  expect((await sidebar.boundingBox()).width).toBeCloseTo(initialWidth + 84);

  await command("Show Outline");
  const outline = page.getByLabel("outline navigation");
  const activeHeading = outline.locator('[aria-current="location"]');
  await expect(activeHeading).toContainText("Cursor demo");
  await activeHeading.click();
  await page.keyboard.press("Meta+Shift+e");
  await page.keyboard.press("Meta+Alt+ArrowDown");
  await expect(activeHeading).toContainText("Next chapter");
  await page.keyboard.press("Meta+Alt+ArrowUp");
  await expect(activeHeading).toContainText("Cursor demo");
  await outline.getByRole("button", { name: /First subsection/ }).click();
  await expect(activeHeading).toContainText("First subsection");
  await page.keyboard.press("Meta+Shift+e");
  await page.keyboard.press("Meta+Alt+ArrowDown");
  await expect(activeHeading).toContainText("Second subsection");
  const sectionOffset = await reader.getAttribute("data-reader-offset");
  await command("Show Outline");
  await expect(activeHeading).toBeFocused();
  await page.keyboard.press("Meta+Shift+e");
  await expect(reader).toBeFocused();
  await expect(reader).toHaveAttribute("data-reader-offset", sectionOffset);
  await page.keyboard.press("Meta+Alt+ArrowDown");
  await expect(activeHeading).toContainText("Second subsection");
  await page.keyboard.press("Meta+Alt+ArrowUp");
  await expect(activeHeading).toContainText("First subsection");
  await page.getByText("After the rule.", { exact: true }).click({
    position: { x: 5, y: 8 },
  });
  await page.keyboard.press("k");
  await expect
    .poll(() => page.evaluate(() => getSelection().focusNode?.textContent))
    .toBe("Before the rule.");
  await page.keyboard.press("k");
  await expect
    .poll(() => page.evaluate(() => getSelection().focusNode?.textContent))
    .toBe("First subsection");
  await page.getByRole("heading", { name: "Child subsection" }).click({
    position: { x: 5, y: 8 },
  });
  await expect(activeHeading).toContainText("Child subsection");

  const toolbar = page.locator(".app-toolbar");
  const order = await toolbar
    .locator(":scope > .brand, :scope > button")
    .evaluateAll((elements) =>
      elements.map(
        (el) => el.getAttribute("aria-label") || el.textContent.trim(),
      ),
    );
  expect(order).toEqual([
    "YAMDVYet Another MarkDown Viewer",
    "Open Folder",
    "Open Markdown Files",
    "Search",
    "Command Palette",
    "Theme: system",
    "Toggle Sidebar",
    "Application Menu",
  ]);
  await toolbar.getByRole("button", { name: /^Theme:/ }).click();
  for (const name of ["Light", "Dark", "System"]) {
    await expect(
      page.getByRole("menuitemradio", { name }).locator("svg").first(),
    ).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".version")).toHaveText("v0.0.2");
  expect(await fs.readFile(file, "utf8")).toBe(source);
  expect(errors).toEqual([]);
  console.log(
    `PASS ${desktop ? "desktop" : "browser"} cursor workflow: independent code wrapping, rendered-line cursor, document Vim/visual selection and clipboard, UI zoom shortcuts, retained preferences, horizontal navigation and sidebar resizing, section jumps and outline focus, horizontal rules, toolbar order and theme icons, unchanged source`,
  );
  console.log("Screenshot:", fixture);
} finally {
  if (app) {
    await app
      .evaluate(({ clipboard }) =>
        clipboard.writeText(globalThis.__yamdvPreviousClipboard || ""),
      )
      .catch(() => {});
    await app.close();
  }
  if (browser) {
    if (originalClipboard !== undefined && page)
      await page
        .evaluate(
          (text) => navigator.clipboard.writeText(text),
          originalClipboard,
        )
        .catch(() => {});
    await browser.close();
  }
  server?.kill();
}
