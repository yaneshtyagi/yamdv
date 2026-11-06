import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "yamdv-desktop-"));
const profile = path.join(fixture, "profile");
await fs.mkdir(path.join(fixture, "nested"));
const alpha = path.join(fixture, "Alpha.md"),
  beta = path.join(fixture, "nested", "Beta.md");
await fs.writeFile(
  alpha,
  "# Alpha\n\nA native needle.\n\n```mermaid\ngraph TD\nA-->B\n```\n\n$E=mc^2$",
);
await fs.writeFile(beta, "# Beta\n\nAnother needle.");
await fs.copyFile("public/logo.png", path.join(fixture, "pixel.png"));
await fs.appendFile(alpha, "\n\n![Local test](pixel.png)");
const app = await electron.launch({
  executablePath: process.env.YAMDV_PACKAGED || undefined,
  args: [
    ...(process.env.YAMDV_PACKAGED ? [] : ["."]),
    `--user-data-dir=${profile}`,
  ],
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  async function picker(paths) {
    await app.evaluate(({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
    }, paths);
  }
  await picker([alpha, beta]);
  await page
    .getByRole("button", { name: "Open Markdown Files", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Beta", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Alpha.md" }).click();
  await expect(page.locator(".diagram-svg svg")).toHaveCount(1, {
    timeout: 20000,
  });
  await expect(page.locator(".katex")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Local test" })
        .evaluate((el) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await command("Find in Active Document");
  await page
    .getByRole("textbox", { name: "Search Markdown source" })
    .fill("needle");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.keyboard.press("Meta+t");
  await expect(page.getByRole("tab")).toHaveCount(3);
  await picker([beta]);
  await page
    .getByRole("button", { name: "Open Markdown Files", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.keyboard.press("Meta+w");
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.keyboard.press("Meta+Shift+t");
  await expect(page.getByRole("tab")).toHaveCount(3);
  const opening = app.waitForEvent("window");
  await command("New Window");
  const second = await opening;
  await expect(second.getByRole("tab")).toHaveCount(1);
  await page.getByRole("tab", { name: "Alpha.md" }).click();
  await page
    .getByRole("button", { name: "Toggle Favorite", exact: true })
    .click();
  await second.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    second.getByRole("button", { name: "Alpha.md", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: "Alpha.md", exact: true }).click();
  await expect(
    second.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  await command("Dark Theme", second);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await command("Create Workspace");
  await page.getByLabel("Workspace name").fill("References");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await picker([fixture]);
  await command("Add Folder to Workspace");
  await expect(page.locator(".navigation .file-row")).toHaveCount(2);
  await fs.unlink(beta);
  await command("Check Workspace Availability");
  await expect(page.locator(".availability-missing")).toHaveCount(1);
  await command("Clean Unavailable References");
  await expect(page.getByRole("dialog")).toContainText(
    "Remove 1 confirmed missing",
  );
  await page
    .getByRole("button", { name: "Remove References", exact: true })
    .click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(1);
  expect(await fs.readFile(alpha, "utf8")).toContain("# Alpha");
  await command("Remove Workspace");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove Workspace", exact: true })
    .click();
  await expect(page.locator(".navigation .file-row")).toHaveCount(0);
  expect(await fs.readFile(alpha, "utf8")).toContain("# Alpha");
  await page.reload();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page.getByRole("button", { name: "Alpha.md", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alpha", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS desktop UI: native file bridge, tabs and native shortcuts, multiple windows, shared favorites/theme, missing-file detection, recursive cleanup, source-file preservation and reload",
  );
} finally {
  await app.close();
}
