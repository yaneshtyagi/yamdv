import { chromium, _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const desktop = process.argv.includes("--desktop"),
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), "yamdv-reading-"));
const files = Object.fromEntries(
  ["Alpha", "Beta", "Gamma"].map((name) => [
    name,
    path.join(fixture, name + ".md"),
  ]),
);
for (const [name, file] of Object.entries(files))
  await fs.writeFile(
    file,
    `# ${name}\n\n` +
      Array.from(
        { length: 90 },
        (_, i) =>
          `Paragraph ${i} in ${name}. Keep reading with your keyboard.\n`,
      ).join("\n"),
  );
let server, browser, app, page;
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
        "5175",
      ],
      { stdio: "ignore" },
    );
    for (let n = 0; n < 100; n++) {
      try {
        await fetch("http://127.0.0.1:5175");
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
      window.showOpenFilePicker = undefined;
      window.showDirectoryPicker = undefined;
    });
    page = await context.newPage();
    await page.goto("http://127.0.0.1:5175");
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "YAMDV", exact: true }),
  ).toBeVisible();
  async function pick(paths) {
    if (desktop) {
      await app.evaluate(({ dialog }, filePaths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
      }, paths);
      await page
        .getByRole("button", { name: "Open Markdown Files", exact: true })
        .click();
    } else {
      const request = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Open Markdown Files", exact: true })
        .click();
      await (await request).setFiles(paths);
    }
  }
  async function command(name) {
    await page
      .getByRole("button", { name: "Command Palette", exact: true })
      .click();
    const input = page.getByRole("textbox", { name: "Find a Command" });
    await expect(input).toBeFocused();
    await page.keyboard.type(name);
    await page
      .locator(".command-list button")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
  }
  const reader = page.getByRole("region", { name: "Markdown document" });
  await pick([files.Alpha, files.Beta]);
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("tab", { name: "Alpha.md" }).click();
  const alphaRow = page.getByRole("button", { name: "Alpha.md", exact: true });
  await alphaRow.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await expect(alphaRow).toBeFocused();
  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await expect(alphaRow).toBeFocused();
  const scrolled = await reader.evaluate((el) => el.scrollTop);
  await page.keyboard.press("Shift+ArrowUp");
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeLessThan(scrolled);
  await expect(alphaRow).toBeFocused();
  await page.keyboard.press("Meta+Shift+e");
  await expect(reader).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await page.keyboard.press("Meta+1");
  await alphaRow.focus();
  await command("Focus Active Document");
  await expect(reader).toBeFocused();
  await reader.evaluate((el) => (el.scrollTop = 420));
  await page.keyboard.press("Meta+=");
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText("110%");
  await page.getByRole("button", { name: "Beta.md", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "Beta.md", selected: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Go Back", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Go Forward", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Meta+[");
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText("110%");
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(350);
  await page.keyboard.press("Meta+]");
  await expect(
    page.getByRole("heading", { name: "Beta", exact: true }),
  ).toBeVisible();
  await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Go Back", exact: true }).click();
  await pick([files.Gamma]);
  await expect(
    page.getByRole("heading", { name: "Gamma", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go Forward", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await command("Close Tab");
  await command("Reopen Closed Tab");
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go Forward", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gamma", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gamma.md", exact: true }).focus();
  await page.keyboard.press("Meta+Alt+ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Beta.md", selected: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Control+Tab");
  await expect(
    page.getByRole("tab", { name: "Gamma.md", selected: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Meta+Alt+ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Beta.md", selected: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add Current File to Workspace", exact: true })
    .click();
  await expect(page.getByLabel("Destination workspace")).toBeFocused();
  await page.getByLabel("New workspace name").fill("Reading Desk");
  await page
    .getByRole("button", { name: "Add Reference", exact: true })
    .click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Beta.md", exact: true }),
  ).toBeVisible();
  await command("Add Current File to Workspace");
  await page
    .getByRole("button", { name: "Add Reference", exact: true })
    .click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(1);
  await command("Create Nested Workspace");
  await page.getByLabel("Workspace name").fill("Nested");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await pick([files.Gamma]);
  await command("Add Current File to Workspace");
  await expect(
    page.getByLabel("Destination workspace").locator("option:checked"),
  ).toHaveText("Reading Desk / Nested");
  await page
    .getByRole("button", { name: "Add Reference", exact: true })
    .click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(2);
  const gammaRow = page.getByRole("button", { name: "Gamma.md", exact: true });
  await gammaRow.focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await expect(gammaRow).toBeFocused();
  await page.keyboard.press("Meta+Shift+p");
  await expect(
    page.getByRole("textbox", { name: "Find a Command" }),
  ).toBeFocused();
  await page.keyboard.type("Focus Active Document");
  await page.keyboard.press("Enter");
  await expect(reader).toBeFocused();
  await page.keyboard.press("Meta+Shift+m");
  await expect(
    page.getByRole("menu", { name: "Actions", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("menuitem", { name: "Open Markdown Files", exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).toBeFocused();
  await page.keyboard.press("F1");
  await page
    .getByRole("button", { name: "Read Full Help", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "YAMDV Help", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Tabs and reading history",
      exact: true,
    }),
  ).toBeVisible();
  expect(await fs.readFile(files.Beta, "utf8")).toContain("# Beta");
  expect(errors).toEqual([]);
  console.log(
    `PASS ${desktop ? "desktop" : "browser"} reading workflow: sidebar scroll/focus, both tab bindings, retained tab trails, palette focus, current-file workspace addition, application-menu shortcut and built-in help`,
  );
} finally {
  await app?.close();
  await browser?.close();
  server?.kill();
}
