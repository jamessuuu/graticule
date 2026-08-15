import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// SPEC.md §7: "Paste or drop files/folder (File System Access API,
// webkitdirectory fallback)." This exercises the <input type="file"> path
// (the "Choose files" button), which is what both drag-and-drop file
// handling and the folder-picker fallback funnel through under the hood.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("@smoke importing a dropped/chosen .txt file creates a real embedded note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/model: .*ready/)).toBeVisible({ timeout: 45_000 });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(__dirname, "fixtures", "sample-note.txt"));

  await expect(page.getByText("This note came from a dropped text file rather than being typed directly.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('svg[role="img"] [role="button"]')).toHaveCount(1);
});
