import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The market layer — rendered behaviour.
 *
 * `tests/market-synthesis.test.ts` covers the view model: every classification read from
 * the artifacts, no ranking language, Singapore's level-only association never denied.
 * This file covers what only a browser can show: that the country selector is operable,
 * that its moving pill lands on the selected tab, and that motion respects the reader.
 */

const tablist = (page: Page) => page.getByRole("tablist", { name: "Markets" });
const tab = (page: Page, name: string) => tablist(page).getByRole("tab", { name });
const pill = (page: Page) => tablist(page).locator("[data-pill]");

/** Wait until no transition or animation is running on the element. */
async function settled(locator: Locator): Promise<void> {
  await expect
    .poll(async () => locator.evaluate((node) => node.getAnimations().length === 0))
    .toBe(true);
}

/** Pixel offset between the pill and a tab, on every edge. */
async function pillOffset(page: Page, name: string): Promise<number> {
  const a = await pill(page).boundingBox();
  const b = await tab(page, name).boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  return Math.max(
    Math.abs(a!.x - b!.x),
    Math.abs(a!.y - b!.y),
    Math.abs(a!.width - b!.width),
    Math.abs(a!.height - b!.height),
  );
}

/**
 * The pill comes to rest on the tab. Polled on the END STATE rather than read once after
 * the transitions report finished: keys pressed in quick succession retarget the glide
 * mid-flight, and a single read can land between two retargets. A pill that never
 * arrived would still fail here, on the timeout.
 */
async function expectPillOn(page: Page, name: string): Promise<void> {
  await expect
    .poll(async () => pillOffset(page, name), { timeout: 3000 })
    .toBeLessThanOrEqual(1);
}

test.describe("country selector", () => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 800 },
  ]) {
    test(`the pill sits on the selected market and travels with it (${String(viewport.width)}px)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await tablist(page).scrollIntoViewIfNeeded();

      // The default is the first market in the reading order, and the pill is on it.
      await expect(tab(page, "Indonesia")).toHaveAttribute("aria-selected", "true");
      await expectPillOn(page, "Indonesia");

      await tab(page, "Singapore").click();
      await expect(tab(page, "Singapore")).toHaveAttribute("aria-selected", "true");
      await expect(tablist(page).locator('[aria-selected="true"]')).toHaveCount(1);
      await expectPillOn(page, "Singapore");

      // The panel follows: it is the Singapore deep dive now.
      await expect(
        page.getByRole("tabpanel").getByRole("heading", { name: "Singapore" }),
      ).toBeVisible();
    });
  }

  test("the pill glides between tabs instead of jumping", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await tablist(page).scrollIntoViewIfNeeded();
    await settled(pill(page));

    const duration = await pill(page).evaluate(
      (node) => getComputedStyle(node).transitionDuration,
    );
    // The glide token: 260ms, within the 200-300ms the motion system allows.
    expect(duration.split(",")[0]?.trim()).toBe("0.26s");

    await tab(page, "Norway").click();
    // Mid-flight: a transform transition is running on the pill.
    const moving = await pill(page).evaluate((node) =>
      node
        .getAnimations()
        .some((animation) => (animation as CSSTransition).transitionProperty === "transform"),
    );
    expect(moving).toBe(true);
    await expectPillOn(page, "Norway");
  });

  test("arrow keys, Home and End move the selection, the focus and the pill", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await tab(page, "Indonesia").focus();

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "United States")).toBeFocused();
    await expect(tab(page, "United States")).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("End");
    await expect(tab(page, "Norway")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Indonesia")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(page, "Indonesia")).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Norway")).toHaveAttribute("aria-selected", "true");
    await expectPillOn(page, "Norway");
  });

  test("the panel enters with a short fade on a change, and not on first load", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const content = page.getByRole("tabpanel").locator("> div");
    await expect(content).not.toHaveAttribute("data-panel-enter", "true");

    await tab(page, "Malaysia").click();
    await expect(content).toHaveAttribute("data-panel-enter", "true");
    const animation = await content.evaluate((node) => ({
      name: getComputedStyle(node).animationName,
      duration: getComputedStyle(node).animationDuration,
    }));
    expect(animation.name).toBe("panel-enter");
    expect(animation.duration).toBe("0.2s");
  });

  test("a deep link selects its market, with the pill already in place", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#market-norway");
    await expect(tab(page, "Norway")).toHaveAttribute("aria-selected", "true");
    await expectPillOn(page, "Norway");
  });

  test("tabs carry the pointer cursor and an identity dot; the pill is not a target", async ({
    page,
  }) => {
    await page.goto("/");
    for (const name of ["Indonesia", "United States", "Singapore", "Malaysia", "Norway"]) {
      await expect(tab(page, name)).toHaveCSS("cursor", "pointer");
      await expect(tab(page, name).locator("span[aria-hidden='true']")).toHaveCount(1);
    }
    await expect(pill(page)).toHaveCSS("pointer-events", "none");
    await expect(pill(page)).toHaveAttribute("aria-hidden", "true");
  });

  test("under reduced motion neither the pill nor the panel travels", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await tablist(page).scrollIntoViewIfNeeded();
    await tab(page, "United States").click();

    const timing = await page.evaluate(() => {
      const pillNode = document.querySelector<HTMLElement>("[data-pill]");
      const panel = document.querySelector<HTMLElement>('[role="tabpanel"] > div');
      return {
        pill: pillNode === null ? "" : getComputedStyle(pillNode).transitionDuration,
        panel: panel === null ? "" : getComputedStyle(panel).animationDuration,
      };
    });
    expect(timing.pill.split(",")[0]?.trim()).toBe("0.001s");
    expect(timing.panel).toBe("0.001s");
    await expectPillOn(page, "United States");
    await context.close();
  });
});

test.describe("country selector on a phone", () => {
  test("the selected tab is scrolled fully into the strip, without moving the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/#market-singapore");
    await tablist(page).scrollIntoViewIfNeeded();

    const inside = async (name: string): Promise<boolean> => {
      const strip = await tablist(page).boundingBox();
      const box = await tab(page, name).boundingBox();
      return (
        strip !== null &&
        box !== null &&
        box.x >= strip.x - 1 &&
        box.x + box.width <= strip.x + strip.width + 1
      );
    };

    // Measured before the fix: Singapore half-clipped at the strip's right edge.
    await expect.poll(async () => inside("Singapore")).toBe(true);

    const scrollY = await page.evaluate(() => window.scrollY);
    await tab(page, "Singapore").focus();
    await page.keyboard.press("End");
    await expect(tab(page, "Norway")).toHaveAttribute("aria-selected", "true");
    await expect.poll(async () => inside("Norway")).toBe(true);
    // The strip scrolled sideways; the page did not jump.
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(2);
  });
});

test("a focused tab's ring fits inside the scrolling strip at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await tab(page, "Indonesia").focus();
  await page.keyboard.press("ArrowRight");
  const room = await page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>('[role="tablist"][aria-label="Markets"]');
    const focused = document.activeElement as HTMLElement | null;
    if (strip === null || focused === null) return null;
    const style = getComputedStyle(focused);
    const ring = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
    const top = focused.offsetTop - strip.scrollTop;
    const bottom = strip.clientHeight - (top + focused.offsetHeight);
    return { ring, top, bottom };
  });
  expect(room).not.toBeNull();
  // The ring extends `ring` px beyond the tab; the strip must leave that much room.
  expect(room!.top).toBeGreaterThanOrEqual(room!.ring);
  expect(room!.bottom).toBeGreaterThanOrEqual(room!.ring);
});
