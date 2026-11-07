import { chromium, _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const desktop = process.argv.includes("--desktop"),
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), "yamdv-scroll-"));
await fs.writeFile(
  path.join(fixture, "00-Long.md"),
  "# Long document\n\n" +
    Array.from(
      { length: 180 },
      (_, i) =>
        `## Section ${i}\n\nBody text for section ${i}. ${i === 165 ? "Unique deep search needle." : ""}\n\n`,
    ).join(""),
);
await fs.writeFile(
  path.join(fixture, "01-Other.md"),
  "# Other document\n\n" + "Other content.\n\n".repeat(160),
);
for (let i = 2; i < 45; i++)
  await fs.writeFile(
    path.join(fixture, `${String(i).padStart(2, "0")}-Note.md`),
    `# Note ${i}`,
  );
let app, browser, server, page;
try {
  if (desktop) {
    app = await electron.launch({
      executablePath: process.env.YAMDV_PACKAGED || undefined,
      args: [
        ...(process.env.YAMDV_PACKAGED ? [] : ["."]),
        `--user-data-dir=${path.join(fixture, "profile")}`,
      ],
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
        "5177",
      ],
      { stdio: "ignore" },
    );
    for (let n = 0; n < 100; n++) {
      try {
        await fetch("http://127.0.0.1:5177");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 },
    });
    await context.addInitScript(() => {
      window.showDirectoryPicker = undefined;
      window.showOpenFilePicker = undefined;
    });
    page = await context.newPage();
    await page.goto("http://127.0.0.1:5177");
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "YAMDV", exact: true }),
  ).toBeVisible();
  const metrics = () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      };
      return {
        windowY: scrollY,
        windowX: scrollX,
        viewport: innerHeight,
        documentHeight: document.scrollingElement.scrollHeight,
        toolbar: rect(".app-toolbar"),
        sidebar: rect(".sidebar"),
        status: rect("main>footer"),
        ideScroll: document.querySelector(".ide").scrollTop,
        readerScroll: document.querySelector(".document-scroll").scrollTop,
      };
    });
  async function fixedChrome() {
    const state = await metrics();
    expect(state.windowY).toBe(0);
    expect(state.windowX).toBe(0);
    expect(state.ideScroll).toBe(0);
    expect(state.documentHeight).toBeLessThanOrEqual(state.viewport + 1);
    expect(state.toolbar.top).toBeCloseTo(0, 0);
    expect(state.sidebar.top).toBeCloseTo(state.toolbar.bottom, 0);
    expect(state.status.bottom).toBeCloseTo(state.viewport, 0);
  }
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
      ({ dialog }, root) =>
        (dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [root],
        })),
      fixture,
    );
    await page
      .getByRole("button", { name: "Open Folder", exact: true })
      .click();
  } else {
    const choosing = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Open Folder", exact: true })
      .click();
    await (await choosing).setFiles(fixture);
  }
  await page.getByRole("button", { name: "00-Long.md", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Long document", exact: true }),
  ).toBeVisible();

  await fixedChrome();
  await page.getByRole("button", { name: "Outline", exact: true }).click();
  await page.locator(".outline-item").last().click();
  await expect(page.locator("#section-179")).toHaveClass(/search-hit/);

  await fixedChrome();
  expect((await metrics()).readerScroll).toBeGreaterThan(1000);
  await page.evaluate(() => window.scrollTo(0, 500));
  await fixedChrome();
  await command("Find in Active Document");
  await page
    .getByRole("textbox", { name: "Search Markdown source" })
    .fill("Unique deep search needle");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator(".search-result>button").first().click();
  await expect(page.locator("article .search-hit")).toHaveCount(1);
  await fixedChrome();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.getByRole("button", { name: "Folder", exact: true }).click();
  await page.getByRole("button", { name: "01-Other.md", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Other document" }),
  ).toBeVisible();
  await fixedChrome();
  await command("Go Back");
  await expect(
    page.getByRole("heading", { name: "Long document", exact: true }),
  ).toBeAttached();
  await fixedChrome();
  expect((await metrics()).readerScroll).toBeGreaterThan(1000);
  await command("Toggle Vim Navigation");
  await page.keyboard.press("Meta+Shift+e");
  await page.keyboard.press("Shift+g");
  await expect
    .poll(() => page.locator(".document-scroll").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(1000);
  await fixedChrome();
  for (const zoom of [
    "Zoom Application UI In",
    "Zoom Application UI Out",
    "Zoom Application UI Out",
  ]) {
    await command(zoom);
    await fixedChrome();
    await command("Show Outline");
    await page.locator(".outline-item").last().click();
    await fixedChrome();
  }
  await command("Reset Application UI Zoom");
  await fixedChrome();
  await page.screenshot({ path: path.join(fixture, "scroll-contained.png") });
  expect(errors).toEqual([]);
  console.log(
    `PASS ${desktop ? "desktop" : "browser"} scrolling containment: opening long files, deep outline/search jumps, restored visits, Vim and UI zoom keep application chrome stationary`,
  );
  console.log("Screenshot:", fixture);
} finally {
  await app?.close();
  await browser?.close();
  server?.kill();
}
