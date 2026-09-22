import { expect, test, type Page } from "@playwright/test";

/**
 * Chart prototype — rendered behaviour.
 *
 * `tests/chart-contract.test.ts` covers everything about the chart that is decidable
 * from the option object: unit bindings, axis domains, verbatim values, annotation
 * positions, the layout band. This file covers only what requires a real browser —
 * that a canvas appears, that the interactions do something, that nothing overflows,
 * and that the fallback is reachable without a pointer.
 *
 * NO PIXEL ASSERTIONS. Chart content is drawn into a canvas, so it cannot be queried
 * from the DOM, and a screenshot baseline of a canvas is a machine-specific artifact
 * posing as a contract. What is asserted instead is the observable consequence of
 * each interaction: the tooltip's text, the `data-layout` attribute the wrapper
 * publishes, the box the canvas occupies, and the table's rows.
 */

const CHART_NAME = /Brent Crude Price and Worldwide EV Search Interest/i;
const TABLE_ID = "#oil-vs-interest-chart-table";
/** `CHART_TOOLTIP_CLASS` — a class the option sets so the readout is queryable. */
const TOOLTIP = ".oil-ev-chart-tooltip";

/** The chart's focusable region. `role="img"`, because a canvas is one graphic. */
const chartRegion = (page: Page) => page.getByRole("img", { name: CHART_NAME });

/**
 * The prototype's own frame.
 *
 * The page now carries two charts, so every control name — "Reset view", "View data
 * table" — appears twice and an unscoped `getByRole` is ambiguous under Playwright's
 * strict mode. Scoping to the figure that contains THIS chart's region is what keeps each
 * suite testing its own chart.
 */
const chartFigure = (page: Page) => page.locator("figure", { has: chartRegion(page) });

/**
 * DOM selector for the prototype's canvas wrapper.
 *
 * Qualified by `aria-describedby` rather than by document order: the five-market chart
 * appears earlier in the page, so `[data-chart-canvas]` alone matches the wrong one.
 */
const CHART_WRAPPER =
  '[data-chart-canvas="true"][aria-describedby="oil-vs-interest-chart-description"]';

/**
 * Text of the ECharts tooltip, or `""` when it is not showing.
 *
 * Reads the named tooltip element rather than scanning the page for text. An earlier
 * version searched every `div` for "Week of" and took the innermost match, which was
 * the tooltip's *heading* — so it never saw the measure rows, and it could not tell a
 * dismissed tooltip (still in the DOM, `display: none`) from a visible one.
 */
async function tooltipText(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    // Every chart on the page creates its own tooltip element with this class, and all but
    // one are hidden at any moment — so the VISIBLE one is the readout being asked about.
    // Taking the first match would return whichever chart mounted earliest.
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }
      return element.textContent ?? "";
    }
    return "";
  }, TOOLTIP);
}

test.describe("the chart renders", () => {
  test("a canvas appears inside the labelled chart region, with no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    await expect(region).toBeVisible();

    // Exactly one: a second canvas would mean an instance was leaked on re-render,
    // which is the bug `dispose()` and `reactStrictMode` exist to surface.
    await expect(region.locator("canvas")).toHaveCount(1);

    const box = await region.locator("canvas").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(600);
    expect(box!.height).toBeGreaterThan(200);

    expect(errors).toEqual([]);
  });

  test("the frame carries a title, a what-to-look-for line and its source", async ({
    page,
  }) => {
    await page.goto("/");

    const figure = page.locator("figure", { has: chartRegion(page) });
    await expect(figure.getByRole("heading", { name: CHART_NAME })).toBeVisible();
    // §5 rule 2: one visible sentence naming what to look for.
    await expect(figure.getByText(/Two measures on their own scales/)).toBeVisible();
    // Attribution comes from `manifest.sources[]`, so the real links are present.
    await expect(figure.getByRole("heading", { name: "Source" })).toBeVisible();
    expect(await figure.getByRole("link").count()).toBeGreaterThan(0);
  });

  test("the long description is available to assistive technology", async ({ page }) => {
    await page.goto("/");

    const region = chartRegion(page);
    const describedBy = await region.getAttribute("aria-describedby");
    expect(describedBy).toBe("oil-vs-interest-chart-description");

    const description = page.locator(`#${describedBy ?? ""}`);
    // Present in the DOM and wired up, but not visually duplicated: the chart and
    // the table already say it to everyone who can use them.
    await expect(description).toHaveCount(1);
    const text = (await description.textContent()) ?? "";
    expect(text).toContain("barrel");
    expect(text).toContain("index");
    expect(text.toLowerCase()).toContain("week-to-week");
  });

  test("the section is reachable from the navigation", async ({ page }) => {
    await page.goto("/");

    const link = page.getByRole("navigation", { name: "Sections" }).getByRole("link", {
      name: "Oil vs Interest",
    });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator("#oil-vs-interest")).toBeInViewport();
  });
});

test.describe("hover and keyboard inspection", () => {
  test("hovering a week reveals its date and both measures with their units", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    const box = await region.boundingBox();
    expect(box).not.toBeNull();

    await region.hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
    await expect
      .poll(async () => (await tooltipText(page)).includes("Week of"), { timeout: 4000 })
      .toBe(true);

    const text = await tooltipText(page);
    // The week, from the artifact's `week_start` / `week_end`.
    expect(text).toMatch(/Week of \d{1,2} \w{3} 20\d\d/);
    // Both measures, each with its own unit — the obligation of a dual-axis chart.
    expect(text).toContain("Brent crude");
    expect(text).toMatch(/\$\d+\.\d{2} \/ barrel/);
    expect(text).toContain("Worldwide");
    expect(text).toMatch(/\d+ \/ 100 index/);
  });

  test("the tooltip follows the pointer to a different week", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    const box = await region.boundingBox();
    expect(box).not.toBeNull();

    await region.hover({ position: { x: box!.width * 0.25, y: box!.height / 2 } });
    await expect.poll(async () => (await tooltipText(page)).includes("Week of")).toBe(true);
    const first = await tooltipText(page);

    await region.hover({ position: { x: box!.width * 0.75, y: box!.height / 2 } });
    await expect
      .poll(async () => (await tooltipText(page)) !== first, { timeout: 4000 })
      .toBe(true);
    const second = await tooltipText(page);

    expect(second).toMatch(/Week of/);
    expect(second).not.toBe(first);
  });

  test("arrow keys step the readout, so it does not depend on hover", async ({ page }) => {
    await page.goto("/");

    // §5 rule 6: the chart region is focusable and the arrow keys move the pointer.
    // §5 rule 5: no critical information may be hover-only.
    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    // The chart mounts lazily via IntersectionObserver, so a keypress before init
    // lands on a region with no instance behind it and silently does nothing.
    await expect(region.locator("canvas")).toHaveCount(1);
    await region.focus();
    await expect(region).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await tooltipText(page)).includes("Week of")).toBe(true);
    const first = await tooltipText(page);

    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await tooltipText(page)) !== first).toBe(true);

    // Escape dismisses it rather than trapping the reader in an open tooltip.
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => (await tooltipText(page)).includes("Week of"), { timeout: 3000 })
      .toBe(false);
  });

  test("a week with no oil observation says so instead of showing a blank", async ({
    page,
  }) => {
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    await expect(region.locator("canvas")).toHaveCount(1);
    await region.focus();
    // The Brent extract stops one week short of the Trends grid, so the last
    // observation has interest but no price.
    await page.keyboard.press("End");

    await expect.poll(async () => (await tooltipText(page)).includes("Week of")).toBe(true);
    const text = await tooltipText(page);
    expect(text.toLowerCase()).toContain("no observation");
    // The interest reading for that week still exists and is still shown.
    expect(text).toMatch(/\d+ \/ 100 index/);
  });
});

test.describe("legend, zoom and reset", () => {
  test("the legend hides and restores a series without disturbing the other", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    await expect(region.locator("canvas")).toHaveCount(1);

    // Real buttons, not canvas shapes: `aria-pressed` carries the state and the
    // control is keyboard-operable, which a painted legend is not.
    const oilToggle = chartFigure(page).getByRole("button", { name: /Brent crude/ });
    await expect(oilToggle).toHaveAttribute("aria-pressed", "true");

    const box = await region.boundingBox();
    await region.hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
    await expect.poll(async () => (await tooltipText(page)).includes("Brent crude")).toBe(true);

    await oilToggle.click();
    await expect(oilToggle).toHaveAttribute("aria-pressed", "false");

    // Re-hover before reading: clicking the legend moved the pointer out of the plot,
    // which dismisses the tooltip — and an empty tooltip would satisfy "no longer
    // mentions Brent crude" for the wrong reason.
    const readout = async (): Promise<string> => {
      await region.hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
      return tooltipText(page);
    };

    await expect
      .poll(async () => (await readout()).includes("Week of"), { timeout: 4000 })
      .toBe(true);
    const hidden = await readout();
    expect(hidden).not.toContain("Brent crude");
    // Axis semantics survive: the interest reading is still there and still an index.
    expect(hidden).toMatch(/\d+ \/ 100 index/);

    await oilToggle.click();
    await expect(oilToggle).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await readout()).includes("Brent crude"), { timeout: 4000 })
      .toBe(true);
  });

  test("the legend is keyboard operable and names both units", async ({ page }) => {
    await page.goto("/");

    // §5 rule 6: every control reachable and operable by keyboard. This is the reason
    // the legend is HTML rather than ECharts' canvas legend.
    const oilToggle = chartFigure(page).getByRole("button", { name: /Brent crude/ });
    const interestToggle = page.getByRole("button", { name: /Worldwide/ });

    // The unit travels with the label, so which axis a series is read against never
    // has to be inferred from the chart.
    await expect(oilToggle).toContainText("USD / barrel");
    await expect(interestToggle).toContainText("Search interest index");

    await oilToggle.focus();
    await expect(oilToggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(oilToggle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(oilToggle).toHaveAttribute("aria-pressed", "true");
  });

  test("a reset control is present whenever zoom is enabled", async ({ page }) => {
    await page.goto("/");

    // `assertInteractionsCoherent` makes this structural, but the control has to
    // actually exist and be operable — a reader who pinch-zooms on a phone with no
    // way back is stranded in a four-week window.
    const reset = chartFigure(page).getByRole("button", { name: "Reset view" });
    await expect(reset).toBeVisible();
    await expect(reset).toBeEnabled();
    const box = await reset.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("zooming changes the view and reset returns it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    const box = await region.boundingBox();
    expect(box).not.toBeNull();

    // Read the week at a fixed position, zoom in, and read it again. If the x-domain
    // narrowed, the same pixel now points at a different observation.
    await region.hover({ position: { x: box!.width * 0.3, y: box!.height / 2 } });
    await expect.poll(async () => (await tooltipText(page)).includes("Week of")).toBe(true);
    const before = await tooltipText(page);

    await page.keyboard.down("Control");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");

    await region.hover({ position: { x: box!.width * 0.3, y: box!.height / 2 } });
    await expect
      .poll(async () => (await tooltipText(page)) !== before, { timeout: 4000 })
      .toBe(true);

    await chartFigure(page).getByRole("button", { name: "Reset view" }).click();
    await region.hover({ position: { x: box!.width * 0.3, y: box!.height / 2 } });
    await expect
      .poll(async () => (await tooltipText(page)) === before, { timeout: 4000 })
      .toBe(true);
  });

  test("plain wheel scrolls the page and does not zoom the chart", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    const box = await region.boundingBox();
    expect(box).not.toBeNull();

    // Read the week at a fixed position first. If a plain wheel zoomed, the x-domain
    // would narrow and the same pixel would afterwards point at a different week.
    await region.hover({ position: { x: box!.width * 0.3, y: box!.height / 2 } });
    await expect.poll(async () => (await tooltipText(page)).includes("Week of")).toBe(true);
    const before = await tooltipText(page);

    // Scroll back to the top so there is somewhere to scroll TO. Without this the
    // assertion can fail for the wrong reason: `scrollIntoViewIfNeeded` can leave the
    // page at its maximum offset, where no wheel event can move it further.
    // `globals.css` sets `scroll-behavior: smooth` on `html`, so `scrollTo` animates
    // and reading `scrollY` straight afterwards catches it mid-flight. `instant`
    // opts out for this one call.
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
    const scrollBefore = 0;

    const freshBox = await region.boundingBox();
    await page.mouse.move(
      freshBox!.x + freshBox!.width / 2,
      Math.min(freshBox!.y + freshBox!.height / 2, 850),
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);

    // A chart inside a long-scroll article that swallows the wheel is worse than one
    // that does not zoom at all, which is why zoom requires Ctrl.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);

    // And the domain is untouched: same pixel, same week.
    await region.scrollIntoViewIfNeeded();
    const after = await region.boundingBox();
    await region.hover({ position: { x: after!.width * 0.3, y: after!.height / 2 } });
    await expect
      .poll(async () => (await tooltipText(page)) === before, { timeout: 4000 })
      .toBe(true);
  });
});

test.describe("the tabular fallback", () => {
  test("it is reachable by a visible control and is absent until asked for", async ({
    page,
  }) => {
    await page.goto("/");

    // Unmounted rather than `display:none`: 31 rows of hidden text under every chart
    // is reachable by find-in-page and by a screen reader in browse mode, so
    // "collapsed" would be a lie.
    await expect(page.locator(TABLE_ID)).toHaveCount(0);

    const toggle = chartFigure(page).getByRole("button", { name: "View data table" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "oil-vs-interest-chart-table");

    await toggle.click();
    await expect(page.locator(TABLE_ID)).toBeVisible();
    await expect(chartFigure(page).getByRole("button", { name: "Hide data table" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("it carries one row per observation, with both units in the headers", async ({
    page,
  }) => {
    await page.goto("/");
    await chartFigure(page).getByRole("button", { name: "View data table" }).click();

    const table = page.locator(TABLE_ID);
    // 31 Trends weeks. The count comes from the artifact, so a mismatch means the
    // table and the chart are no longer the same data.
    await expect(table.locator("tbody tr")).toHaveCount(31);

    const headers = await table.locator("thead th").allInnerTexts();
    // `allInnerTexts` returns RENDERED text, and the header role is CSS-uppercased,
    // so the comparison has to be case-insensitive. The source strings are Title Case.
    expect(headers.join(" ")).toMatch(/USD/i);
    expect(headers.join(" ")).toMatch(/barrel/i);
    expect(headers.join(" ")).toMatch(/index/i);

    // Every row header is a week, so a screen reader announces the date with the
    // figures rather than a bare pair of numbers.
    await expect(table.locator("tbody tr").first().locator("th")).toHaveAttribute(
      "scope",
      "row",
    );
  });

  test("the missing observation and the partial week are marked in words", async ({ page }) => {
    await page.goto("/");
    await chartFigure(page).getByRole("button", { name: "View data table" }).click();

    const table = page.locator(TABLE_ID);
    // §5 rule 7: a table has no encoding other than text, so the flags must be text.
    await expect(table.getByText("No observation")).toBeVisible();
    await expect(table.getByText("Partial week")).toBeVisible();
  });

  test("it is keyboard reachable and scrollable without a pointer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await chartFigure(page).getByRole("button", { name: "View data table" }).click();

    // A scroll container has to be focusable, or a keyboard user cannot reach the
    // columns that overflow at 375px.
    const table = page.locator(TABLE_ID);
    await expect(table).toHaveAttribute("tabindex", "0");
    await table.focus();
    await expect(table).toBeFocused();
  });
});

test.describe("responsive behaviour", () => {
  for (const [label, width, expectedLayout] of [
    ["mobile", 375, "stacked-panels"],
    ["tablet/desktop", 1280, "dual-axis"],
    ["large desktop", 1920, "dual-axis"],
  ] as const) {
    test(`${label} (${String(width)}px): the documented layout band, no overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/", { waitUntil: "networkidle" });

      const region = chartRegion(page);
      await region.scrollIntoViewIfNeeded();

      // `dualAxisLayout()` decides this; the wrapper publishes the branch that ran,
      // because axis titles are drawn into a canvas and cannot be queried.
      await expect
        .poll(async () => region.getAttribute("data-layout"), { timeout: 5000 })
        .toBe(expectedLayout);

      // The canvas must track the frame rather than keeping an earlier width — the
      // defect this replaced left it at 1006px inside a 375px viewport.
      const canvas = await region.locator("canvas").boundingBox();
      const wrapper = await region.boundingBox();
      expect(canvas).not.toBeNull();
      expect(Math.abs(canvas!.width - wrapper!.width)).toBeLessThan(4);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${String(width)}px`).toBe(0);
    });
  }

  test("resizing from desktop to mobile switches band and leaves no overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    await expect.poll(async () => region.getAttribute("data-layout")).toBe("dual-axis");

    await page.setViewportSize({ width: 375, height: 800 });
    await expect
      .poll(async () => region.getAttribute("data-layout"), { timeout: 5000 })
      .toBe("stacked-panels");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test("the controls wrap instead of overflowing at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");

    for (const name of ["Reset view", "View data table"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      // The 44px tap target still applies at the width where it matters most.
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("the chart states its caveats without interaction", () => {
  test("the specification caveat and both unit notes are visible", async ({ page }) => {
    await page.goto("/");

    // Scoped to the VISIBLE paragraphs. The `sr-only` long description states the same
    // facts for screen-reader users, so an unscoped text query matches twice — and a
    // test that resolves to two elements proves nothing about either.
    const figure = page.locator("figure", { has: chartRegion(page) });
    const visibleNotes = figure.locator("p:not(#oil-vs-interest-chart-description)");

    // KIRO §16: the level co-movement may not be shown without the comparison. It is
    // in the frame, not behind a disclosure.
    await expect(visibleNotes.filter({ hasText: /Levels only\./ })).toBeVisible();
    await expect(visibleNotes.filter({ hasText: /does not survive comparing/ })).toBeVisible();

    // The Google Trends normalisation guardrail, restated where a chart could invite
    // a cross-market read.
    await expect(visibleNotes.filter({ hasText: /scaled to its own maximum/ })).toBeVisible();
    // And the crude-vs-pump-price rule.
    await expect(visibleNotes.filter({ hasText: /not a retail pump price/ })).toBeVisible();

    // The two data-coverage footnotes.
    await expect(visibleNotes.filter({ hasText: /drawn dashed/ })).toBeVisible();
    await expect(visibleNotes.filter({ hasText: /broken rather than/ })).toBeVisible();
  });

  test("still no coefficient, p-value or interval appears anywhere on the page", async ({
    page,
  }) => {
    await page.goto("/");

    // The prototype deliberately renders no statistic. A coefficient belongs to the
    // Robustness section, which can carry the full specification comparison beside
    // it; here the comparison travels as words.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/\br\s*=\s*[-\d.]/);
    expect(body).not.toMatch(/\bp\s*[=<]\s*[\d.]/);
    expect(body).not.toContain("pearson");
  });
});

/**
 * Reset determinism.
 *
 * THE BUG THESE EXIST FOR
 * Reset used to feel smooth after some gestures and snap after others. Two mechanisms in
 * ECharts 6 produced that, both read in the library source rather than guessed at:
 *
 *   1. roam actions are pushed through a `fixRate` throttle whose interval defaults to
 *      100ms while animation is on, so the last increment of a gesture is SCHEDULED, not
 *      sent — and a reset issued inside that window was overwritten by a roam that
 *      arrived after it;
 *   2. roam actions carry `animation: { easing: "cubicOut", duration: 100 }`, and
 *      `getAnimationConfig()` treats the update payload as the highest-priority source, so
 *      a reset sent without one fell back to a different duration depending on what the
 *      reader had just done.
 *
 * `EChart` therefore drives the transition itself. These tests assert the observable
 * consequence: every sequence ends at exactly the full domain, and every reset passes
 * through intermediate states rather than jumping.
 *
 * The window is read from `data-zoom-start` / `data-zoom-end`, which the wrapper publishes
 * on every ECharts `dataZoom` event. No pixel assertions and no reaching into the library.
 */

/** The published x-domain window, as percentages. */
async function zoomWindow(page: Page): Promise<{ start: number; end: number }> {
  return page.evaluate((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    return {
      start: Number(element?.dataset["zoomStart"] ?? "0"),
      end: Number(element?.dataset["zoomEnd"] ?? "100"),
    };
  }, CHART_WRAPPER);
}

/**
 * Click Reset and record every window the chart passes through.
 *
 * A `MutationObserver` rather than a sampling loop: it records every change the component
 * makes, so the count is a property of the transition rather than of how fast the polling
 * happened to be. The observation window is generous — several times `--duration-slow` —
 * so a slow machine records fewer frames rather than a failure.
 */
async function resetAndRecord(page: Page): Promise<{ samples: string[]; resetting: boolean }> {
  await page.evaluate((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element === null) return;
    const recorded: string[] = [];
    let sawResetting = false;
    const observer = new MutationObserver(() => {
      const current = `${element.dataset["zoomStart"] ?? ""}-${element.dataset["zoomEnd"] ?? ""}`;
      if (recorded[recorded.length - 1] !== current) recorded.push(current);
      if (element.dataset["resetting"] === "true") sawResetting = true;
    });
    observer.observe(element, { attributes: true });
    const store = window as unknown as {
      __reset?: { samples: string[]; resetting: () => boolean; stop: () => void };
    };
    store.__reset = {
      samples: recorded,
      resetting: () => sawResetting,
      stop: () => observer.disconnect(),
    };
  }, CHART_WRAPPER);

  await chartFigure(page).getByRole("button", { name: "Reset view" }).click();
  await expect.poll(async () => (await zoomWindow(page)).start, { timeout: 4000 }).toBe(0);
  await expect.poll(async () => (await zoomWindow(page)).end, { timeout: 4000 }).toBe(100);

  return page.evaluate(() => {
    const store = window as unknown as {
      __reset?: { samples: string[]; resetting: () => boolean; stop: () => void };
    };
    const state = store.__reset;
    if (state === undefined) return { samples: [], resetting: false };
    state.stop();
    return { samples: [...state.samples], resetting: state.resetting() };
  });
}

/** Ctrl + wheel over the plot centre, which is the chart's zoom accelerator. */
async function zoomIn(page: Page, steps = 6): Promise<void> {
  const region = chartRegion(page);
  const box = await region.boundingBox();
  expect(box).not.toBeNull();
  await page.keyboard.down("Control");
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  for (let i = 0; i < steps; i += 1) await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  await expect.poll(async () => (await zoomWindow(page)).end < 100, { timeout: 4000 }).toBe(true);
}

/** Drag inside the plot, which pans the x-domain. */
async function pan(page: Page, dx: number): Promise<void> {
  const box = await chartRegion(page).boundingBox();
  expect(box).not.toBeNull();
  const y = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + dx, y, { steps: 8 });
  await page.mouse.up();
}

test.describe("reset is deterministic", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await chartRegion(page).scrollIntoViewIfNeeded();
    await expect.poll(async () => (await zoomWindow(page)).end).toBe(100);
  });

  test("the initial view is the full domain", async ({ page }) => {
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
  });

  test("zoom in, reset: returns to the full domain, and animates getting there", async ({
    page,
  }) => {
    await zoomIn(page);
    const before = await zoomWindow(page);
    expect(before.end - before.start).toBeLessThan(100);

    const { samples, resetting } = await resetAndRecord(page);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
    expect(resetting).toBe(true);
    // More than one step: a snap would produce a single change straight to 0-100.
    expect(samples.length).toBeGreaterThan(2);
  });

  test("pan, reset: returns to the full domain and animates", async ({ page }) => {
    await zoomIn(page);
    await pan(page, -160);
    const { samples } = await resetAndRecord(page);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
    expect(samples.length).toBeGreaterThan(2);
  });

  test("zoom and pan repeatedly, reset: still the full domain, still animated", async ({
    page,
  }) => {
    for (let round = 0; round < 3; round += 1) {
      await zoomIn(page, 3);
      await pan(page, round % 2 === 0 ? -120 : 140);
    }
    const { samples } = await resetAndRecord(page);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
    expect(samples.length).toBeGreaterThan(2);
  });

  test("reset immediately after a gesture is not undone by a trailing roam", async ({
    page,
  }) => {
    // The throttled roam dispatch can land up to ~100ms after the last wheel event. The
    // frame loop re-asserts the window for the whole transition, so a late roam is
    // overwritten rather than winning. Clicking with no settling pause is the case that
    // used to fail.
    await zoomIn(page, 8);
    await chartFigure(page).getByRole("button", { name: "Reset view" }).click();
    await expect.poll(async () => (await zoomWindow(page)).start, { timeout: 4000 }).toBe(0);
    await expect.poll(async () => (await zoomWindow(page)).end, { timeout: 4000 }).toBe(100);
    // And it stays there: nothing arrives afterwards to move it.
    await page.waitForTimeout(400);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
  });

  test("repeated resets behave identically", async ({ page }) => {
    for (let round = 0; round < 3; round += 1) {
      await zoomIn(page, 4);
      const { samples } = await resetAndRecord(page);
      expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
      expect(samples.length).toBeGreaterThan(2);
    }
  });

  test("two resets in a row, with no zoom between, leave the domain intact", async ({
    page,
  }) => {
    const reset = chartFigure(page).getByRole("button", { name: "Reset view" });
    await reset.click();
    await reset.click();
    await page.waitForTimeout(300);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
  });

  test("resize while zoomed keeps the window, and reset still returns it", async ({ page }) => {
    await zoomIn(page);
    const zoomed = await zoomWindow(page);
    expect(zoomed.end).toBeLessThan(100);

    // Across the md boundary, which rebuilds the option rather than resizing it.
    await page.setViewportSize({ width: 375, height: 900 });
    await expect.poll(async () => chartRegion(page).getAttribute("data-layout")).toBe(
      "stacked-panels",
    );
    // The reader's zoom survives the rebuild: `notMerge` would otherwise reset it silently.
    const afterResize = await zoomWindow(page);
    expect(afterResize.end).toBeLessThan(100);

    await chartFigure(page).getByRole("button", { name: "Reset view" }).click();
    await expect.poll(async () => (await zoomWindow(page)).end, { timeout: 4000 }).toBe(100);
    expect(await zoomWindow(page)).toEqual({ start: 0, end: 100 });
  });

  test("the keyboard can zoom, because the canvas slider cannot be focused", async ({
    page,
  }) => {
    const region = chartRegion(page);
    await region.focus();
    await page.keyboard.press("+");
    await expect.poll(async () => (await zoomWindow(page)).end < 100, { timeout: 4000 }).toBe(
      true,
    );

    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await expect.poll(async () => (await zoomWindow(page)).end, { timeout: 4000 }).toBe(100);
  });
});

test.describe("entrance motion", () => {
  test("the chart animates in once and then stops", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = chartRegion(page);
    // Before the frame is in view the canvas has not mounted: the entrance is meant to be
    // seen, so the observer no longer pre-mounts 200px early.
    await region.scrollIntoViewIfNeeded();

    await expect.poll(async () => region.getAttribute("data-entrance"), {
      timeout: 6000,
    }).toBe("done");

    // And it stays done. A second entrance would mean the option was rebuilt with
    // animation on, which is what a legend toggle or a resize must not do.
    await page.waitForTimeout(500);
    await expect(region).toHaveAttribute("data-entrance", "done");
  });

  test("the frame settles before the line draws, and both end still", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    // Scoped to the prototype's own reveal wrapper: the page carries two.
    const reveal = page.locator("[data-chart-reveal]", { has: chartRegion(page) });
    await reveal.scrollIntoViewIfNeeded();
    await expect.poll(async () => reveal.getAttribute("data-chart-reveal"), {
      timeout: 6000,
    }).toBe("entered");

    // Fully opaque and untranslated once entered — the end state is the readable one.
    const settled = await reveal.evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, transform: style.transform };
    });
    expect(Number(settled.opacity)).toBeGreaterThan(0.99);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(settled.transform);
  });

  test("a legend toggle does not restart the entrance", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const region = chartRegion(page);
    await region.scrollIntoViewIfNeeded();
    await expect.poll(async () => region.getAttribute("data-entrance"), {
      timeout: 6000,
    }).toBe("done");

    await chartFigure(page).getByRole("button", { name: /Brent crude/ }).click();
    await page.waitForTimeout(300);
    await expect(region).toHaveAttribute("data-entrance", "done");
  });

  test("reduced motion skips the entrance and keeps every interaction", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const region = page.getByRole("img", { name: CHART_NAME });
    await region.scrollIntoViewIfNeeded();

    // "reduced", not "done": the chart was never animated in.
    await expect.poll(async () => region.getAttribute("data-entrance"), {
      timeout: 6000,
    }).toBe("reduced");

    // Usability is untouched. Hover still opens the readout...
    const box = await region.boundingBox();
    await region.hover({ position: { x: box!.width * 0.4, y: box!.height / 2 } });
    await expect
      .poll(async () =>
        page.evaluate((selector) => {
          for (const element of document.querySelectorAll<HTMLElement>(selector)) {
            if (getComputedStyle(element).display === "none") continue;
            return element.textContent ?? "";
          }
          return "";
        }, TOOLTIP),
      )
      .toContain("Week of");

    // ...and zoom and reset still work, arriving instantly instead of over 360ms.
    await region.focus();
    await page.keyboard.press("+");
    await expect
      .poll(async () =>
        page.evaluate((selector) => {
          const element = document.querySelector<HTMLElement>(selector);
          return Number(element?.dataset["zoomEnd"] ?? "100");
        }, CHART_WRAPPER),
      )
      .toBeLessThan(100);

    await chartFigure(page).getByRole("button", { name: "Reset view" }).click();
    await expect
      .poll(async () =>
        page.evaluate((selector) => {
          const element = document.querySelector<HTMLElement>(selector);
          return Number(element?.dataset["zoomEnd"] ?? "0");
        }, CHART_WRAPPER),
      )
      .toBe(100);

    await context.close();
  });
});
