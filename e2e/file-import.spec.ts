import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearSampleCorpus } from "./helpers";

// SPEC.md §7: "Paste or drop files/folder (File System Access API,
// webkitdirectory fallback)." This exercises the <input type="file"> path
// (the "Choose files" button), which is what both drag-and-drop file
// handling and the folder-picker fallback funnel through under the hood.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("@smoke importing a dropped/chosen .txt file creates a real embedded note", async ({ page }) => {
  await page.goto("/");
  // role=status scoped — see real-inference.spec.ts's comment on this
  // exact locator for why a bare getByText(/model: .*ready/) is fragile.
  await expect(page.getByRole("status").filter({ hasText: "ready (" })).toBeVisible({ timeout: 45_000 });
  await clearSampleCorpus(page);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(__dirname, "fixtures", "sample-note.txt"));

  await expect(page.getByText("This note came from a dropped text file rather than being typed directly.")).toBeVisible({
    timeout: 15_000,
  });
  // data-testid, not role="button" — an interactive role nested inside
  // the map's own role="img" ancestor gets flattened out of the
  // accessibility tree (M7 accessibility pass), so the markers
  // deliberately no longer claim a role they can't actually deliver on
  // for AT users. This is a plain test hook, not an a11y attribute.
  await expect(page.locator('[data-testid="map-note-marker"]')).toHaveCount(1);
});
