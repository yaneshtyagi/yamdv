import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
await fs.rm("/tmp/yamdv-smoke-profile", { recursive: true, force: true });
await fs.writeFile(
  "/tmp/yamdv-native-test.md",
  "# Native file\n\nRead through the safe bridge.",
);
const app = await electron.launch({
  args: [".", "--user-data-dir=/tmp/yamdv-smoke-profile"],
});
try {
  const native = await app.firstWindow();
  await native
    .getByRole("heading", { name: "A little space for your words" })
    .waitFor();
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: ["/tmp/yamdv-native-test.md"],
    });
  });
  await native
    .getByRole("button", { name: "Open Markdown files", exact: true })
    .click();
  await native.getByRole("heading", { name: "Native file" }).waitFor();
  const next = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, file) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.loadFile(file);
  }, process.cwd() + "/dist/index.html");
  const page = await next;
  await page
    .getByRole("heading", { name: "A little space for your words" })
    .waitFor();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  // Exercise the browser import path in the same production renderer.

  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "reader-test.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Smoke document\n\n| A | B |\n| - | - |\n| one | two |\n\n- [x] Works\n\n<script>window.injected=true</script>",
      ),
    });
  await page.getByRole("heading", { name: "Smoke document" }).waitFor();
  assert.equal(await page.locator("article table").count(), 1);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await page
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page
    .getByRole("button", { name: "reader-test.md", exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page
    .getByRole("button", { name: "reader-test.md", exact: true })
    .click();
  await page.getByRole("heading", { name: "Smoke document" }).waitFor();
  await page.screenshot({ path: "/tmp/yamdv-smoke.png", fullPage: true });
  console.log(
    "PASS: packaged renderer, themes, Markdown/GFM, script isolation, favorites, persistence",
  );
} finally {
  await app.close();
}
