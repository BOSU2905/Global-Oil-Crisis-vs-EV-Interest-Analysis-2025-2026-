import { expect, test } from "@playwright/test";

/**
 * Foundation smoke tests — Phase 3C step 1.
 *
 * These cover the two things the scaffold actually claims to have established:
 *
 *   1. The accessibility contract's page-level requirements
 *      (docs/product-architecture.md §5): landmarks, one h1, a working skip link.
 *   2. That the design tokens resolve through Tailwind in a real browser.
 *
 * (2) is the one that could not be verified before this phase. `globals.css`
 * maps tokens with `@theme inline`, which makes Tailwind emit its own
 * `--color-bg: var(--color-bg)` inside `@layer theme` while `tokens.css` declares
 * the real value unlayered. The cascade is supposed to resolve in favour of the
 * unlayered declaration. Asserting a *computed* colour is what proves it, because
 * if the layer order were wrong the variable would be invalid and the assertion
 * would fail rather than silently rendering a transparent page.
 */

const BG_LIGHT = "rgb(252, 252, 253)"; // --color-bg → --neutral-25  #fcfcfd
const BG_DARK = "rgb(11, 13, 14)"; //    --color-bg → --neutral-950 #0b0d0e

test.describe("page structure", () => {
  test("exposes one h1 and the three page landmarks", async ({ page }) => {
    await page.goto("/");

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText("EV Interest Analysis");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("skip link is the first tab stop and becomes visible when focused", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    // Off-screen until focused, so it must not be "visible" initially.
    await expect(skipLink).not.toBeInViewport();

    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    // And it must actually point at the main landmark.
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await expect(page.locator("#main-content")).toHaveCount(1);
  });
});

test.describe("artifact-driven content", () => {
  test("renders the observation scope read from the generated artifacts", async ({ page }) => {
    await page.goto("/");

    // Coverage comes from panel.json. Asserting the real boundary dates proves the
    // pipeline → JSON → validated bundle → React path is live, not stubbed.
    await expect(page.getByText("2025-08-31", { exact: false })).toBeVisible();
    await expect(page.getByText("2026-03-29", { exact: false })).toBeVisible();

    // Five markets, from the registry in countries.json.
    for (const label of ["Indonesia", "Malaysia", "Norway", "Singapore", "United States"]) {
      await expect(page.getByRole("listitem").filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test("shows the cross-market comparability constraint", async ({ page }) => {
    await page.goto("/");
    // The guardrail against the original project's invalid cross-market ranking.
    await expect(page.getByRole("heading", { name: "Comparability constraint" })).toBeVisible();
  });

  test("renders no correlation coefficient or p-value on the foundation page", async ({
    page,
  }) => {
    await page.goto("/");
    const body = (await page.locator("body").innerText()).toLowerCase();
    // Statistics belong to sections that can also carry the specification caveat.
    // The scaffold must not leak one early.
    expect(body).not.toMatch(/\br\s*=\s*[-\d.]/);
    expect(body).not.toMatch(/\bp\s*[=<]\s*[\d.]/);
    expect(body).not.toContain("pearson");
  });
});

test.describe("design tokens resolve through Tailwind", () => {
  test("light theme background comes from the token, not a Tailwind default", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", BG_LIGHT);
  });

  test("dark theme is applied with no dark: variants in the markup", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", BG_DARK);
  });

  test("a mapped utility resolves to the semantic token value", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    // Singapore's identifier colour is --hue-teal-600 #0891b2 in the light theme.
    // Reading it off a real element confirms the country palette survived the
    // removal of Tailwind's default colour palette.
    //
    // Note the browser returns the *resolved* value, not the literal
    // `var(--hue-teal-600)` authored in tokens.css: custom-property var()
    // references are substituted at computed-value time. That makes this a
    // stronger check than a textual one, because it proves the whole
    // primitive → semantic chain resolved rather than just that text was copied.
    const resolved = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-country-singapore"),
    );
    expect(resolved.trim()).toBe("#0891b2");

    const computed = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--color-country-singapore)";
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    expect(computed).toBe("rgb(8, 145, 178)");
  });
});
