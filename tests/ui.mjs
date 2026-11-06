import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "yamdv-ui-"));
await fs.mkdir(path.join(fixture, "nested"));
const alpha = path.join(fixture, "Alpha.md"),
  beta = path.join(fixture, "nested", "Beta.md");
await fs.writeFile(
  alpha,
  "# Alpha\n\nNeedle and NEEDLE.\n\n## Duplicate\n\n### Duplicate\n\n#### Fourth\n\n##### Fifth\n\n###### Sixth\n\n```md\n# Not an outline heading\n```\n\n[Go to Beta](nested/Beta.md)\n\n| A | B |\n| - | - |\n| one | two |\n\n- [x] Complete\n\n~~Removed~~\n\nInline math: $E=mc^2$\n\n$$\\sum_{i=1}^{n} i$$\n\n```mermaid\ngraph LR\nA[Read] --> B[Think]\nB --> C[Understand]\n```\n\n<script>window.__yamdvUnsafeExecuted=true</script>\n\n" +
    Array.from(
      { length: 60 },
      (_, i) => `Paragraph ${i}: a line of reading material.\n`,
    ).join("\n"),
);
await fs.writeFile(
  beta,
  "# Beta\n\nAnother needle.\n\n## Last\n\n[Alpha](../Alpha.md)",
);
await fs.copyFile("public/logo.png", path.join(fixture, "pixel.png"));
await fs.appendFile(alpha, "\n\n![Local test](pixel.png)");
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
  ],
  { stdio: "ignore" },
);
const url = "http://127.0.0.1:5174";
for (let n = 0; n < 100; n++) {
  try {
    await fetch(url);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 900 },
  });
  await context.addInitScript(() => {
    window.showOpenFilePicker = undefined;
    window.showDirectoryPicker = undefined;
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "YAMDV", exact: true }),
  ).toBeVisible();
  async function command(label, target = page) {
    await target
      .getByRole("button", { name: "Command Palette", exact: true })
      .click();
    await target.getByRole("textbox", { name: "Find a Command" }).fill(label);
    await target
      .locator(".command-list button")
      .filter({ has: target.getByText(label, { exact: true }) })
      .click();
  }
  async function pick(paths, folder = false) {
    const choosing = page.waitForEvent("filechooser");
    await page
      .getByRole("button", {
        name: folder ? "Open Folder" : "Open Markdown Files",
        exact: true,
      })
      .first()
      .click();
    await (await choosing).setFiles(paths);
  }
  await pick([alpha, beta]);
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Beta", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Alpha.md" }).click();
  await expect(page.locator("article table")).toHaveCount(1);
  await expect(page.locator(".katex")).toHaveCount(2);
  await expect(page.locator(".diagram-svg svg")).toHaveCount(1, {
    timeout: 20000,
  });
  await expect(page.locator("article del")).toHaveText("Removed");
  expect(
    await page.evaluate(() => window.__yamdvUnsafeExecuted),
  ).toBeUndefined();
  await page.getByRole("button", { name: "Outline", exact: true }).click();
  await expect(page.locator(".outline-item")).toHaveCount(6);
  await page.locator(".outline-item").nth(2).click();
  await expect(page.locator("#duplicate-1")).toHaveClass(/search-hit/);
  const chromeBefore = await page.locator(".app-toolbar").boundingBox();
  await page.keyboard.press("Meta+=");
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText("110%");
  const chromeAfter = await page.locator(".app-toolbar").boundingBox();
  expect(chromeAfter.height).toBe(chromeBefore.height);
  await page.locator(".document-scroll").evaluate((el) => (el.scrollTop = 500));
  await page.getByRole("tab", { name: "Beta.md" }).click();
  await page.getByRole("tab", { name: "Alpha.md" }).click();
  expect(
    await page.locator(".document-scroll").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(400);
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText("110%");
  await page
    .getByRole("button", { name: "Toggle Favorite", exact: true })
    .click();
  await command("Find in Active Document");
  await page
    .getByRole("textbox", { name: "Search Markdown source" })
    .fill("needle");
  await expect(page.locator(".search-result")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Case sensitive", exact: true })
    .click();
  await expect(page.locator(".search-result")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Case sensitive", exact: true })
    .click();
  await page.locator(".search-result>button").first().click();
  await expect(page.locator("article .search-hit")).toHaveCount(1);
  await page.keyboard.press("F3");
  await expect(page.locator(".search-result").nth(1)).toHaveClass(/active/);
  await page.keyboard.press("Shift+F3");
  await expect(page.locator(".search-result").first()).toHaveClass(/active/);

  await page
    .getByRole("button", { name: "Regular expression", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search Markdown source" }).fill("[");
  await expect(page.locator(".error-text")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search Markdown source" })
    .fill("needle");
  await page.getByRole("combobox").selectOption("tabs");
  await expect(page.locator(".search-result")).toHaveCount(3);
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.locator(".document-scroll").evaluate((el) => (el.scrollTop = 0));
  await page.getByRole("button", { name: "Full Screen", exact: true }).click();
  const diagram = page.getByRole("dialog", { name: "Mermaid diagram" });
  await expect(diagram).toBeVisible();
  await diagram.getByRole("button", { name: "Zoom diagram in" }).click();
  await expect(diagram.locator("output")).toHaveText("110%");
  await page.keyboard.press("Meta+=");
  await expect(diagram.locator("output")).toHaveText("120%");
  for (let n = 0; n < 38; n++)
    await diagram.getByRole("button", { name: "Zoom diagram in" }).click();
  await page.keyboard.press("ArrowRight");
  expect(
    await diagram.locator(".diagram-viewport").evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(0);
  await diagram.getByRole("button", { name: "Fit", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(diagram).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset Document Zoom" }),
  ).toHaveText("100%");
  // Replacement and explicit new-tab behavior.
  await pick([beta]);
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("button", { name: "New Tab", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await pick([alpha]);
  await expect(page.getByRole("tab")).toHaveCount(3);
  await pick(fixture, true);
  await page.getByRole("img", { name: "Local test" }).scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Local test" })
        .evaluate((el) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("link", { name: "Go to Beta" }).click();
  await expect(
    page.getByRole("heading", { name: "Beta", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for Alpha.md", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Open in New Tab", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await command("Create Workspace");
  await page.getByLabel("Workspace name").fill("Study");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Workspace actions for Study" }),
  ).toBeVisible();
  const adding = page.waitForEvent("filechooser");
  await command("Add Folder to Workspace");
  await (await adding).setFiles(fixture);
  await expect(page.locator(".navigation .file-row")).toHaveCount(2);
  await command("Create Nested Workspace");
  await page.getByLabel("Workspace name").fill("More");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Workspace actions for More" }),
  ).toBeVisible();
  await command("Clean Unavailable References");
  await expect(page.getByRole("dialog")).toContainText("No confirmed missing");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: false }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const second = await context.newPage();
  await second.goto(url);
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await command("Light Theme", second);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await command("System Theme", second);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Alpha.md", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.locator(".navigation [data-nav]").first().focus();
  await page.keyboard.press("ArrowDown");
  expect(
    await page
      .locator(".navigation [data-nav]")
      .nth(1)
      .evaluate((el) => document.activeElement === el),
  ).toBe(true);
  await command("Toggle Vim Navigation");
  await expect(page.locator(".sidebar-status")).toContainText(
    "Vim navigation on",
  );
  await page.locator(".navigation [data-nav]").first().focus();
  await page.keyboard.press("j");
  expect(
    await page
      .locator(".navigation [data-nav]")
      .nth(1)
      .evaluate((el) => document.activeElement === el),
  ).toBe(true);
  await page.getByRole("button", { name: "Outline", exact: true }).click();
  await expect(page.locator(".diagram-svg svg")).toHaveCount(1);
  await page.screenshot({ path: path.join(fixture, "wide-light.png") });
  await command("Dark Theme");
  await page.setViewportSize({ width: 760, height: 650 });
  await expect(page.locator(".diagram-svg svg")).toHaveCount(1);
  await page.screenshot({ path: path.join(fixture, "narrow-dark.png") });
  await command("Keyboard Shortcuts and Help");
  await expect(page.getByRole("dialog")).toContainText("Browsers reserve");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const tall = path.join(fixture, "Large-diagram.md");
  await fs.writeFile(
    tall,
    "# Large diagram\n\n```mermaid\ngraph LR\n" +
      Array.from(
        { length: 15 },
        (_, i) => `A[Source]-->B${i}[A wider destination label ${i}]`,
      ).join("\n") +
      "\n```",
  );
  await pick([tall]);
  await expect(page.locator(".diagram-svg svg")).toHaveCount(1, {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Full Screen", exact: true }).click();
  const large = page.getByRole("dialog", { name: "Mermaid diagram" });
  for (let n = 0; n < 40; n++)
    await large.getByRole("button", { name: "Zoom diagram in" }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  expect(
    await large
      .locator(".diagram-viewport")
      .evaluate((el) => el.scrollLeft > 0 && el.scrollTop > 0),
  ).toBe(true);
  await page.keyboard.press("Escape");
  const malformed = path.join(fixture, "Malformed.md");
  await fs.writeFile(
    malformed,
    '# Still readable\n\n```mermaid\ngraph TD\nA--?bad syntax\n```\n\n$\\frac{a$\n\n[Unsafe](javascript:alert(1))\n\n```mermaid\n%%{init: {securityLevel: "loose"}}%%\ngraph TD\nA-->B\n```',
  );
  await pick([malformed]);
  await expect(page.locator(".diagram-error")).toHaveCount(2, {
    timeout: 20000,
  });
  await expect(page.locator(".katex-error")).toHaveCount(1);
  await expect(page.locator('article a[href^="javascript:"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Still readable" }),
  ).toBeVisible();
  const expensive = path.join(fixture, "Regex.md");
  await fs.writeFile(expensive, "a".repeat(20000) + "!");
  await pick([expensive]);
  await command("Find in Active Document");
  await page
    .getByRole("textbox", { name: "Search Markdown source" })
    .fill("(a+)+$");
  await page
    .getByRole("button", { name: "Regular expression", exact: true })
    .click();
  await expect(page.locator(".search-issue")).toContainText("timed out", {
    timeout: 10000,
  });
  await page.getByRole("textbox", { name: "Search Markdown source" }).fill("!");
  await expect(page.locator(".search-result")).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    "PASS browser UI: tabs, rendering, outline, zoom, search, folder links, workspaces, shared themes, persistence, keyboard navigation",
  );
  console.log("Screenshots:", fixture);
} finally {
  await browser?.close();
  server.kill();
}
