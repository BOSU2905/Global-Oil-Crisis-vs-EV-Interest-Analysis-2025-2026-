import { expect, test } from "@playwright/test";

/**
 * Content component tests — Phase 3C step 4.
 *
 * These cover what only exists once rendered. The compile-time and source-level
 * half of the same contract is in `tests/content-contract.test.ts`; Node cannot
 * load `.tsx`, so the split is forced rather than chosen.
 *
 * The two that matter most are the ones a reader depends on and a type cannot
 * express: that a caveat is readable without hovering, and that the disclosure is
 * operable by keyboard and closes on Escape.
 */

test.describe("Card and MetricCard", () => {
  test("the three coverage metrics render label, value and unit from the artifacts", async ({
    page,
  }) => {
    await page.goto("/");

    const cards = page.locator("#scope ul li");
    await expect(cards.first()).toBeVisible();

    // Values are artifact fields, not literals: the real boundary dates prove the
    // pipeline → JSON → validated bundle → React path is live.
    await expect(page.getByText("2025-08-31", { exact: false })).toBeVisible();
    await expect(page.getByText("2026-03-29", { exact: false })).toBeVisible();
    await expect(page.getByText("Weekly observations")).toBeVisible();
    await expect(page.getByText("Markets", { exact: true })).toBeVisible();
  });

  test("cards do not float — no visible shadow on any card surface", async ({ page }) => {
    await page.goto("/");

    // design-system.md §1 and §4: elevation is border + background delta. This is
    // the rule `Card` exists to hold, so it is checked on the rendered box rather
    // than only in the class list.
    //
    // Tailwind v4's `shadow-none` does not compute to the keyword `none`: it emits
    // the composed shadow chain with every layer fully transparent. Asserting the
    // keyword would fail for the right reason and the wrong cause, so the check is
    // that no layer has any colour.
    const card = page.locator("#scope ul li").first();
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    const opaqueLayer = /rgba?\((?!0, 0, 0, 0\))/;
    expect(shadow === "none" || !opaqueLayer.test(shadow)).toBe(true);

    await expect(card).toHaveCSS("border-style", "solid");
    await expect(card).toHaveCSS("border-top-width", "1px");
  });

  test("metric values carry tabular figures", async ({ page }) => {
    await page.goto("/");

    // A column of statistics that does not align looks careless in a data product
    // (design-system.md §3), and alignment depends on this property, not on the
    // font alone.
    const value = page.locator("#scope ul li .numeric").first();
    await expect(value).toHaveCSS("font-variant-numeric", "tabular-nums");
  });

  test("a caveat is readable without hovering, not only as a badge", async ({ page }) => {
    await page.goto("/");

    // The badge is a summary. If the sentence were only a `title` attribute the
    // qualification would depend on a hover, which the §5 accessibility contract
    // does not allow.
    await expect(page.getByText("Provisional", { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText("flagged as partial in the panel", { exact: false }),
    ).toBeVisible();
  });
});

test.describe("Badge", () => {
  test("every market badge carries its name as text", async ({ page }) => {
    await page.goto("/");

    // Colour is never the only cue (§5): the word is always present.
    for (const label of ["Indonesia", "Malaysia", "Norway", "Singapore", "United States"]) {
      await expect(page.getByRole("listitem").filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test("badges are uppercased by CSS, so the accessible text is not shouted", async ({
    page,
  }) => {
    await page.goto("/");

    const badge = page.locator("#scope ul li span").filter({ hasText: "Indonesia" }).first();
    await expect(badge).toHaveCSS("text-transform", "uppercase");
    // The DOM text keeps its original case — a screen reader reads a word, not
    // letters. This is the same decision as the section eyebrows.
    expect(await badge.textContent()).toBe("Indonesia");
  });
});

test.describe("Callout", () => {
  test("the comparability guardrail is a callout with a worded badge", async ({ page }) => {
    await page.goto("/");

    const callout = page.locator("#comparability > div");
    await expect(callout).toBeVisible();
    await expect(callout.getByText("Guardrail")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparability constraint" })).toBeVisible();
  });

  test("both the constraint and the remedy are visible without interaction", async ({
    page,
  }) => {
    await page.goto("/");

    // §6 hard rule: cross-market non-comparability may not live inside a
    // disclosure. It is the guardrail the original project broke.
    await expect(page.getByText("Remedy.", { exact: false })).toBeVisible();
    // `p.text-small` rather than the first `p`, which is the eyebrow the callout's
    // SectionHeader renders.
    const explanation = page.locator("#comparability p.text-small").first();
    await expect(explanation).toBeVisible();
    expect((await explanation.innerText()).length).toBeGreaterThan(40);
  });
});

test.describe("ReadMore", () => {
  test("the summary is visible and the detail is absent until asked for", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Provisional data.")).toBeVisible();

    const toggle = page.getByRole("button", { name: "What that means for the charts" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "provisional-weeks-detail");

    // Unmounted rather than hidden, so "collapsed" is not a lie to find-in-page or
    // to a screen reader in browse mode.
    await expect(page.locator("#provisional-weeks-detail")).toHaveCount(0);
  });

  test("clicking expands it, changes the label, and reveals the panel", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "What that means for the charts" });
    await toggle.click();

    await expect(page.locator("#provisional-weeks-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      page.getByText("Charts must mark those weeks visibly", { exact: false }),
    ).toBeVisible();
  });

  test("Escape closes it and returns focus to the toggle", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "What that means for the charts" });
    await toggle.click();
    await expect(page.locator("#provisional-weeks-detail")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("#provisional-weeks-detail")).toHaveCount(0);
    // Focus must not be left on a element that no longer exists (§6: never trapped,
    // and never lost either).
    await expect(page.locator("#provisional-weeks-toggle")).toBeFocused();
  });

  test("the toggle meets the 44px tap target at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const box = await page
      .getByRole("button", { name: "What that means for the charts" })
      .boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("StatHighlight", () => {
  test("an inline figure carries an accessible name and tabular figures", async ({ page }) => {
    await page.goto("/");

    // A bare number inside a sentence reads fine visually and poorly aloud, so the
    // label travels with it.
    const stat = page.locator("#provisional-weeks [aria-label]").first();
    await expect(stat).toBeVisible();
    const name = await stat.getAttribute("aria-label");
    expect(name).toContain("provisional");
    await expect(stat).toHaveCSS("font-variant-numeric", "tabular-nums");
  });
});

test.describe("SourceNote", () => {
  test("the footer's attribution still comes from the manifest after the extraction", async ({
    page,
  }) => {
    await page.goto("/");

    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("heading", { name: "Sources" })).toBeVisible();

    // Every source is a real outbound link with a publisher, read from
    // manifest.sources[]. No URL is typed into the component.
    const links = footer.getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("rel", "noreferrer noopener");
      expect(await link.getAttribute("href")).toMatch(/^https?:\/\//);
    }
  });
});

test.describe("step 4 renders no inferential statistic", () => {
  test("no coefficient, p-value or interval appears on the foundation page", async ({
    page,
  }) => {
    await page.goto("/");
    // Repeated here deliberately: step 4 introduced the components that CAN render
    // a statistic, so the assertion that this page still does not is now load-bearing
    // for a different reason than it was in step 1.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/\br\s*=\s*[-\d.]/);
    expect(body).not.toMatch(/\bp\s*[=<]\s*[\d.]/);
    expect(body).not.toContain("pearson");
    expect(body).not.toContain("other specifications");
  });
});
