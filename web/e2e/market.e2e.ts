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

/**
 * THE MARKET MAP — Revision 7, reworked in Batch 3, then made the navigation.
 *
 * There is no list of countries under the picture: each plate on the stage IS the button.
 * What a browser must show: nothing is emphasised until the reader chooses; hovering (or a
 * keyboard reaching) a market previews it and selects nothing; choosing one focuses it with
 * the other four dimmed IN PLACE; Back (or Escape, or the same tile again) returns to all
 * five; the picture is big enough to read on a phone; and Singapore's editorial panel is
 * never shown without its evidence group.
 */
const MARKET_IDS = ["indonesia", "us", "singapore", "malaysia", "norway"] as const;
const map = (page: Page) => page.locator(".market-map");
const panel = (page: Page) => page.locator("#market-synthesis-panel");
const tiles = (page: Page) => map(page).locator(".map-tile");
const tile = (page: Page, id: string) => map(page).locator(`.map-tile[data-market="${id}"]`);
const readout = (page: Page) => map(page).locator(".map-readout");
const back = (page: Page) => readout(page).getByRole("button", { name: "Back to all markets" });
const stage = (page: Page) => map(page).locator("> div").first();
/** A market's button, found the way an assistive technology finds it: by role and name. */
const button = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Markets on the map" })
    .getByRole("button", { name, exact: true });
const plateOpacity = (page: Page, id: string) =>
  tile(page, id)
    .locator(".map-tile-plate")
    .evaluate((node) => Number(getComputedStyle(node).opacity));

async function openSynthesis(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
  await expect(map(page)).toBeVisible();
}

test.describe("market map", () => {
  test("by default no market is singled out, and every classification is visible", async ({
    page,
  }) => {
    await openSynthesis(page);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(panel(page).getByRole("heading", { name: "All Five Markets" })).toBeVisible();
    // Every market's classification, without any interaction (§5 rule 5).
    for (const label of [
      "No detectable contemporaneous association",
      "Level-only association",
      "Inconclusive association",
    ]) {
      await expect(panel(page).getByText(label, { exact: false }).first()).toBeVisible();
    }
    // Five buttons, in the reading order, none pressed, none dimmed, and a hint under them.
    await expect(tiles(page)).toHaveCount(5);
    for (const id of MARKET_IDS) {
      await expect(tile(page, id)).toHaveAttribute("aria-pressed", "false");
      await expect(tile(page, id)).toHaveAttribute("data-dim", "false");
      expect(await plateOpacity(page, id)).toBe(1);
    }
    await expect(readout(page)).toContainText("preview");
    await expect(back(page)).toHaveCount(0);
    // The locator is there, with five neutral marks and nothing active.
    await expect(map(page).locator(".map-locator-mark")).toHaveCount(5);
    await expect(map(page).locator('.map-locator [data-active="true"]')).toHaveCount(0);

    // One material for every plate, one size for every beacon, one size for every tile.
    const look = await page.evaluate(() => {
      const all = [...document.querySelectorAll<HTMLElement>(".market-map .map-tile")];
      const scaleOf = (node: HTMLElement): string =>
        /scale\(([^)]+)\)/.exec(
          node.querySelector("[data-beacon] > g[transform]")?.getAttribute("transform") ?? "",
        )?.[1] ?? "";
      const sizeOf = (node: HTMLElement): string => {
        const box = node.querySelector("svg")?.getBoundingClientRect();
        return box === undefined
          ? ""
          : `${String(Math.round(box.width))}x${String(Math.round(box.height))}`;
      };
      return {
        ids: all.map((node) => node.dataset["market"]),
        fills: all.map((node) => {
          const top = node.querySelector(".map-plate-top");
          return top === null ? "" : getComputedStyle(top).fill;
        }),
        scales: all.map(scaleOf),
        sizes: all.map(sizeOf),
      };
    });
    expect(look.ids).toEqual([...MARKET_IDS]);
    expect(new Set(look.fills).size).toBe(1);
    expect(look.scales.every((scale) => scale !== "")).toBe(true);
    expect(new Set(look.scales).size).toBe(1);
    expect(new Set(look.sizes).size).toBe(1);
  });

  test("the map is the only way to choose a market: no second selector under it", async ({
    page,
  }) => {
    await openSynthesis(page);
    // Every market has exactly ONE button in the whole section (it used to have two: the
    // plate was decoration and a list of buttons under it was the control).
    for (const name of ["Indonesia", "United States", "Singapore", "Malaysia", "Norway"]) {
      await expect(
        page.locator("#market-synthesis").getByRole("button", { name, exact: true }),
      ).toHaveCount(1);
    }
    await expect(
      page.getByRole("list", { name: "Markets on the map" }).getByRole("button"),
    ).toHaveCount(5);
    // ...and that button is the plate itself.
    await expect(button(page, "Malaysia")).toHaveAttribute("data-market", "malaysia");
    await expect(map(page).locator("ul button")).toHaveCount(5);
  });

  test("hovering previews a market and selects nothing", async ({ page }) => {
    await openSynthesis(page);
    const rest = await tile(page, "malaysia")
      .locator(".map-plate-raised")
      .evaluate((node) => getComputedStyle(node).transform);

    await tile(page, "malaysia").hover();
    // The plate lifts and the readout shows a short preview, from the panel's own words.
    await expect(readout(page)).toContainText("Malaysia");
    await expect(readout(page)).toContainText("Inconclusive association · Fragile");
    await expect(readout(page)).toContainText("peaked four weeks before the crude-price peak");
    await expect
      .poll(async () =>
        tile(page, "malaysia")
          .locator(".map-plate-raised")
          .evaluate((node) => getComputedStyle(node).transform),
      )
      .not.toBe(rest);
    // The locator marks where it is while it is previewed...
    await expect(map(page).locator('.map-locator-mark[data-active="true"]')).toHaveAttribute(
      "data-locates",
      "malaysia",
    );
    // ...but nothing is chosen: not now, and not after resting far longer than the old
    // 110ms dwell that used to choose it.
    await page.waitForTimeout(700);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(tile(page, "malaysia")).toHaveAttribute("aria-pressed", "false");
    await expect(panel(page).getByRole("heading", { name: "All Five Markets" })).toBeVisible();
    await expect(readout(page)).toContainText("Malaysia");

    // Moving on changes the preview; leaving the map brings the hint back.
    await tile(page, "norway").hover();
    await expect(readout(page)).toContainText("Norway");
    await expect(readout(page)).not.toContainText("Malaysia");
    await page.mouse.move(2, 2);
    await expect(readout(page)).toContainText("preview");
    await expect(map(page).locator('.map-locator [data-active="true"]')).toHaveCount(0);
  });

  test("choosing a market focuses it and dims the other four IN PLACE", async ({ page }) => {
    await openSynthesis(page);
    const neutral = await tile(page, "us")
      .locator(".map-plate-top")
      .evaluate((node) => getComputedStyle(node).fill);
    const positions = async () =>
      Promise.all(
        MARKET_IDS.map(async (id) => JSON.stringify(await tile(page, id).boundingBox())),
      );
    const before = await positions();

    await tile(page, "us").click();
    await expect(map(page)).toHaveAttribute("data-active-market", "us");
    await expect(tile(page, "us")).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).getByRole("heading", { name: "United States" })).toBeVisible();

    // All five are still on the stage, where they were: dimmed, not removed.
    await expect(tiles(page)).toHaveCount(5);
    expect(await positions()).toEqual(before);
    for (const id of MARKET_IDS.filter((entry) => entry !== "us")) {
      await expect(tile(page, id)).toHaveAttribute("aria-pressed", "false");
      await expect(tile(page, id)).toHaveAttribute("data-dim", "true");
      await expect.poll(async () => plateOpacity(page, id)).toBeLessThan(0.6);
      // The picture recedes; the name does not. It is a button, and it stays readable.
      await expect(tile(page, id).locator(".map-tile-label")).toHaveCSS("opacity", "1");
    }
    expect(await plateOpacity(page, "us")).toBe(1);

    // Only the chosen plate takes its colour.
    await expect
      .poll(async () =>
        tile(page, "us")
          .locator(".map-plate-top")
          .evaluate((node) => getComputedStyle(node).fill),
      )
      .not.toBe(neutral);
    const fills = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".market-map .map-tile:not([data-active='true']) .map-plate-top",
        ),
      ].map((node) => getComputedStyle(node).fill),
    );
    expect(new Set(fills)).toEqual(new Set([neutral]));

    // The locator marks it, and the readout is now the way back.
    const located = await page.evaluate(() =>
      [...document.querySelectorAll<SVGElement>('.map-locator [data-active="true"]')].map(
        (node) => node.dataset["locates"],
      ),
    );
    expect([...new Set(located)]).toEqual(["us"]);
    await expect(back(page)).toBeVisible();
  });

  test("a dimmed market is one click from being the focus, and resting on it says so", async ({
    page,
  }) => {
    await openSynthesis(page);
    await tile(page, "malaysia").click();
    await expect(tile(page, "norway")).toHaveAttribute("data-dim", "true");
    // Settled first: the dimming is a transition, and reading mid-flight would read "not dimmed".
    await expect.poll(async () => plateOpacity(page, "norway")).toBeLessThan(0.6);
    const dimmed = await plateOpacity(page, "norway");

    await tile(page, "norway").hover();
    await expect.poll(async () => plateOpacity(page, "norway")).toBeGreaterThan(dimmed + 0.2);
    // Looking is still not choosing.
    await expect(map(page)).toHaveAttribute("data-active-market", "malaysia");

    await tile(page, "norway").click();
    await expect(map(page)).toHaveAttribute("data-active-market", "norway");
    await expect(tile(page, "norway")).toHaveAttribute("aria-pressed", "true");
    await expect(tile(page, "malaysia")).toHaveAttribute("aria-pressed", "false");
    await expect(tile(page, "malaysia")).toHaveAttribute("data-dim", "true");
    await expect(panel(page).getByRole("heading", { name: "Norway" })).toBeVisible();
  });

  test("Back to all markets returns to five equal plates, and focus to the tile", async ({
    page,
  }) => {
    await openSynthesis(page);
    await tile(page, "singapore").click();
    await expect(back(page)).toBeVisible();
    await back(page).click();

    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(panel(page).getByRole("heading", { name: "All Five Markets" })).toBeVisible();
    await expect(back(page)).toHaveCount(0);
    for (const id of MARKET_IDS) {
      await expect(tile(page, id)).toHaveAttribute("data-dim", "false");
      await expect.poll(async () => plateOpacity(page, id)).toBe(1);
    }
    await expect(map(page).locator('.map-locator [data-active="true"]')).toHaveCount(0);
    // The Back button has just unmounted; focus goes to the tile the reader was on, not to
    // the top of the document.
    await expect(tile(page, "singapore")).toBeFocused();
  });

  test("Escape anywhere in the section goes back, and so does choosing the chosen tile again", async ({
    page,
  }) => {
    await openSynthesis(page);
    await tile(page, "norway").click();
    await page.keyboard.press("Escape");
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(tile(page, "norway")).toBeFocused();

    // From inside the panel too (focus on its link, not on the map).
    await tile(page, "malaysia").click();
    await panel(page)
      .getByRole("link", { name: /Open the Malaysia deep dive/ })
      .focus();
    await page.keyboard.press("Escape");
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(tile(page, "malaysia")).toBeFocused();

    // And pressing the chosen tile again lets go, as the old key's toggle did.
    await tile(page, "us").click();
    await expect(tile(page, "us")).toHaveAttribute("aria-pressed", "true");
    await tile(page, "us").click();
    await expect(tile(page, "us")).toHaveAttribute("aria-pressed", "false");
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
  });

  test("the keyboard reaches every market in order, previews it, and chooses with Enter or Space", async ({
    page,
  }) => {
    await openSynthesis(page);
    const status = panel(page).locator("[aria-live]");
    await expect(status).toHaveText("Showing all five markets.");

    await button(page, "Indonesia").focus();
    for (const id of ["us", "singapore", "malaysia", "norway"]) {
      await page.keyboard.press("Tab");
      await expect(tile(page, id)).toBeFocused();
    }
    // A keyboard gets the preview a mouse gets, and a ring to see where it is.
    await expect(readout(page)).toContainText("Norway");
    await expect(readout(page)).toContainText("No detectable contemporaneous association");
    const ring = await tile(page, "norway").evaluate((node) => {
      const style = getComputedStyle(node);
      return Number.parseFloat(style.outlineWidth);
    });
    expect(ring).toBeGreaterThan(0);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");

    await page.keyboard.press("Enter");
    await expect(tile(page, "norway")).toHaveAttribute("aria-pressed", "true");
    await expect(status).toHaveText("Showing Norway.");
    // Focus stays on the tile, and Shift+Tab walks back along the same row.
    await expect(tile(page, "norway")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(tile(page, "malaysia")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(status).toHaveText("Showing Malaysia.");
    await expect(tile(page, "norway")).toHaveAttribute("aria-pressed", "false");
  });

  test("Singapore's editorial panel is never shown apart from its evidence group", async ({
    page,
  }) => {
    await openSynthesis(page);
    // The preview names the evidence group alone...
    await tile(page, "singapore").hover();
    await expect(readout(page)).toContainText("Level-only association");
    await expect(readout(page)).not.toContainText("Maturity Gap");
    // ...and choosing it shows the editorial name only beside that group (KIRO.md §19 rule 3).
    await tile(page, "singapore").click();
    const view = panel(page);
    await expect(view.getByRole("heading", { name: "Singapore" })).toBeVisible();
    await expect(view.getByText("Maturity Gap")).toBeVisible();
    await expect(view.getByText("Editorial", { exact: true })).toBeVisible();
    await expect(view.getByText("Level-only association")).toBeVisible();
    await expect(
      view.getByRole("link", { name: "Open the Singapore deep dive" }),
    ).toBeVisible();
  });

  test("the picture is hidden from assistive technology, and the buttons say they are buttons", async ({
    page,
  }) => {
    await openSynthesis(page);
    const audit = await page.evaluate(() => {
      const root = document.querySelector(".market-map");
      const svgs = root === null ? [] : [...root.querySelectorAll("svg")];
      return {
        svgs: svgs.length,
        hidden: svgs.every((svg) => svg.closest('[aria-hidden="true"]') !== null),
        focusable:
          root?.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")
            .length ?? -1,
      };
    });
    // Five plates and the locator, every drawing hidden; the only things that take focus in
    // the figure are the five plate buttons (the Back control is not there until a choice).
    expect(audit.svgs).toBe(6);
    expect(audit.hidden).toBe(true);
    expect(audit.focusable).toBe(5);

    for (const id of MARKET_IDS) {
      await expect(tile(page, id)).toHaveCSS("cursor", "pointer");
      await expect(tile(page, id)).toHaveAttribute("aria-controls", "market-synthesis-panel");
    }
    await tile(page, "norway").click();
    await expect(back(page)).toHaveCSS("cursor", "pointer");
  });

  test("the locator says where, and is not a control", async ({ page }) => {
    await openSynthesis(page);
    // Malaysia and Singapore are ~2.7px apart at this size: nothing to aim at.
    await map(page)
      .locator(".map-locator")
      .click({ position: { x: 150, y: 50 } });
    await page.waitForTimeout(400);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
  });

  test("a tap chooses at once and leaves no hover behind; the hint is the touch one", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
    // A phone cannot "rest on" anything, so it is not told to.
    await expect(map(page).locator(".map-hint-touch")).toBeVisible();
    await expect(map(page).locator(".map-hint-pointer")).toBeHidden();

    await tile(page, "malaysia").tap();
    await expect(map(page)).toHaveAttribute("data-active-market", "malaysia");
    await expect(back(page)).toBeVisible();
    expect((await back(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await back(page).tap();
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    // No preview is left showing (a tap is not a hover), only the touch hint.
    await expect(map(page).locator(".map-hint-touch")).toBeVisible();
    await expect(readout(page)).not.toContainText("Inconclusive");
    await context.close();
  });

  test("the entrance plays once on scroll, and never replays a stage already in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(map(page)).toHaveAttribute("data-intro", "pending");
    await expect(tile(page, "us")).toHaveCSS("opacity", "0");
    await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
    // `play` is brief: the entrance hands itself back (`done`) when it has finished.
    await expect(map(page)).toHaveAttribute("data-intro", /^(play|done)$/);
    await expect(map(page)).toHaveAttribute("data-intro", "done");
    await expect(tile(page, "us")).toHaveCSS("opacity", "1");

    // Choosing and going back does not restart it: the tiles were never removed.
    await tile(page, "norway").click();
    await back(page).click();
    await expect(map(page)).toHaveAttribute("data-intro", "done");
    await expect(tile(page, "malaysia")).toHaveCSS("animation-name", "none");

    // A stage already on screen when the page hydrates is shown as it is — never hidden and
    // replayed. A viewport tall enough to hold the whole page puts it there at load.
    await page.setViewportSize({ width: 1440, height: 12000 });
    await page.goto("about:blank");
    await page.goto("/");
    await expect(map(page)).toBeInViewport();
    await page.waitForTimeout(400);
    await expect(map(page)).not.toHaveAttribute("data-intro", /.+/);
    await expect(tile(page, "us")).toHaveCSS("opacity", "1");
  });

  test("under reduced motion the entrance has no travel and no stagger", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
    await expect(map(page)).toHaveAttribute("data-intro", /^(play|done)$/);
    // The entrance rules read these two tokens, and the entrance ends too quickly under
    // reduced motion to catch mid-flight, so read what the rules would resolve to.
    const timing = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.animationDuration = "var(--duration-slow)";
      probe.style.animationDelay = "calc(4 * var(--stagger) + var(--duration-medium))";
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const result = { duration: style.animationDuration, delay: style.animationDelay };
      probe.remove();
      return result;
    });
    expect(timing.duration).toBe("0.001s");
    // The stagger collapses to zero; only the 1ms base delay (--duration-medium) remains.
    expect(Number.parseFloat(timing.delay)).toBeLessThanOrEqual(0.001);
    await expect(tile(page, "norway")).toHaveCSS("opacity", "1");
    // The dimming and the lift are transitions on the same tokens: instant, not gone.
    await tile(page, "norway").click();
    await expect(tile(page, "us")).toHaveAttribute("data-dim", "true");
    await expect.poll(async () => plateOpacity(page, "us")).toBeLessThan(0.6);
    await context.close();
  });

  test("the stage keeps its size through hover and choice, and the panel sits beside it from xl", async ({
    page,
  }) => {
    for (const width of [1440, 1024, 375]) {
      await openSynthesis(page, width);
      const rest = await stage(page).boundingBox();
      await tile(page, "indonesia").hover();
      await expect(readout(page)).toContainText("Indonesia");
      const hovered = await stage(page).boundingBox();
      await tile(page, "us").click();
      await expect(map(page)).toHaveAttribute("data-active-market", "us");
      const chosen = await stage(page).boundingBox();
      expect(rest).not.toBeNull();
      // The same height whether at rest, previewing or chosen, so nothing below it moves.
      for (const box of [hovered, chosen]) {
        expect(Math.abs(box!.width - rest!.width)).toBeLessThan(1);
        expect(Math.abs(box!.height - rest!.height)).toBeLessThan(1);
      }
      const panelBox = await panel(page).boundingBox();
      expect(panelBox).not.toBeNull();
      if (width >= 1280) {
        expect(panelBox!.x).toBeGreaterThanOrEqual(chosen!.x + chosen!.width);
      } else {
        expect(panelBox!.y).toBeGreaterThanOrEqual(chosen!.y + chosen!.height - 1);
      }
    }
  });

  test("the caption says what the drawing is, in both states", async ({ page }) => {
    await openSynthesis(page);
    const caption = map(page).locator("figcaption");
    for (const fragment of ["says nothing about a market", "Alaska", "Hawaii", "Svalbard"]) {
      await expect(caption).toContainText(fragment);
    }
    await tile(page, "singapore").click();
    await expect(tile(page, "singapore")).toHaveAttribute("aria-pressed", "true");
    await expect(caption).toContainText("says nothing about a market");
    await expect(caption).toBeVisible();
  });

  test("on a phone every plate is a readable, tappable button, with no overflow", async ({
    page,
  }) => {
    await openSynthesis(page, 375);
    // Measured before Batch 3: Singapore was 3x3px here, and the labels were switched off.
    for (const id of MARKET_IDS) {
      const svg = await tile(page, id).locator("svg").boundingBox();
      expect(svg?.width ?? 0).toBeGreaterThanOrEqual(90);
      expect(svg?.height ?? 0).toBeGreaterThanOrEqual(55);
      const target = await tile(page, id).boundingBox();
      expect(target?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(tile(page, id).locator(".map-tile-label")).toBeVisible();
    }
    // Three and two: two rows.
    const rows = new Set<number>();
    for (const id of MARKET_IDS)
      rows.add(Math.round((await tile(page, id).boundingBox())?.y ?? 0));
    expect(rows.size).toBe(2);
    expect((await map(page).locator(".map-locator").boundingBox())?.width ?? 0).toBeGreaterThan(
      100,
    );

    await tile(page, "singapore").click();
    await expect(panel(page).getByRole("heading", { name: "Singapore" })).toBeVisible();
    await expect(tiles(page)).toHaveCount(5);
    expect((await back(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("market synthesis orientation", () => {
  const boxes = async (page: Page) => {
    const section = page.locator("#market-synthesis");
    const title = section.locator("h2");
    const aside = section.getByText(/^One worldwide line cannot show/);
    const lead = section.getByText(/^Five markets, one oil shock/);
    const [t, a, l] = await Promise.all([
      title.boundingBox(),
      aside.boundingBox(),
      lead.boundingBox(),
    ]);
    expect(t).not.toBeNull();
    expect(a).not.toBeNull();
    expect(l).not.toBeNull();
    return { t: t!, a: a!, l: l! };
  };

  for (const width of [1920, 1440, 1280]) {
    test(`at ${String(width)}px it fills the empty label column beside the lead`, async ({
      page,
    }) => {
      await openSynthesis(page, width);
      const { t, a, l } = await boxes(page);
      // Under the title, on its left edge, inside the label column and clear of the lead.
      expect(Math.abs(a.x - t.x)).toBeLessThan(1);
      expect(a.y).toBeGreaterThanOrEqual(t.y + t.height);
      expect(a.x + a.width).toBeLessThanOrEqual(l.x);
      // Beside the lead, not below it: that is the space it uses.
      expect(a.y).toBeLessThan(l.y + l.height);
      expect(a.y + a.height).toBeGreaterThan(l.y + l.height * 0.6);
      await expect(
        page.locator("#market-synthesis").getByText(/^One worldwide line cannot show/),
      ).toBeVisible();
    });
  }

  for (const width of [1024, 375]) {
    test(`at ${String(width)}px it follows the title and precedes the lead, in one column`, async ({
      page,
    }) => {
      await openSynthesis(page, width);
      const { t, a, l } = await boxes(page);
      expect(Math.abs(a.x - t.x)).toBeLessThan(1);
      expect(Math.abs(l.x - t.x)).toBeLessThan(1);
      expect(a.y).toBeGreaterThanOrEqual(t.y + t.height);
      expect(l.y).toBeGreaterThanOrEqual(a.y + a.height);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("it reads in order: title, orientation, lead", async ({ page }) => {
    await openSynthesis(page);
    const order = await page.evaluate(() => {
      const section = document.querySelector("#market-synthesis");
      const nodes = [...(section?.querySelectorAll("h2, p") ?? [])];
      const find = (re: RegExp) => nodes.findIndex((node) => re.test(node.textContent ?? ""));
      return [
        find(/^What the Shock Revealed$/),
        find(/^One worldwide line/),
        find(/^Five markets, one oil shock/),
      ];
    });
    expect(order[0]).toBeGreaterThanOrEqual(0);
    expect(order[1]).toBeGreaterThan(order[0]!);
    expect(order[2]).toBeGreaterThan(order[1]!);
  });
});
