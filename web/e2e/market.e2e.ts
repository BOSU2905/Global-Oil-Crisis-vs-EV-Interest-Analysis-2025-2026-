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
 * THE MARKET STAGE — Revision 7, reworked in Batch 3.
 *
 * The picture is decorative to assistive technology; the key and the panel beside it are
 * the control and the content. What a browser must show: nothing is emphasised until the
 * reader chooses, every market is drawn the same, the stage follows the key and the panel
 * follows the stage, the silhouettes are big enough to read on a phone, and Singapore's
 * editorial panel is never shown without its evidence group.
 */
const MARKET_IDS = ["indonesia", "us", "singapore", "malaysia", "norway"] as const;
const map = (page: Page) => page.locator(".market-map");
const panel = (page: Page) => page.locator("#market-synthesis-panel");
const tiles = (page: Page) => map(page).locator(".map-tile");
const tile = (page: Page, id: string) => map(page).locator(`.map-tile[data-market="${id}"]`);
const spotlight = (page: Page) => map(page).locator(".map-spotlight");
const stage = (page: Page) => map(page).locator("> div").first();
const key = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Markets on the map" })
    .getByRole("button", { name, exact: true });

async function openSynthesis(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
  await expect(map(page)).toBeVisible();
}

/** A pointer that arrives in the first moments after load is ignored by design (MAP_QUIET_MS). */
async function openForPointer(page: Page, width = 1440): Promise<void> {
  await openSynthesis(page, width);
  await page.waitForTimeout(500);
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
    // Five tiles, in the reading order, none of them active, and no spotlight.
    await expect(tiles(page)).toHaveCount(5);
    await expect(spotlight(page)).toHaveCount(0);
    for (const id of MARKET_IDS)
      await expect(tile(page, id)).toHaveAttribute("data-active", "false");
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

  test("resting on a tile puts that market alone on the stage, in its colour", async ({
    page,
  }) => {
    await openForPointer(page);
    const neutral = await tile(page, "us")
      .locator(".map-plate-top")
      .evaluate((node) => getComputedStyle(node).fill);

    await tile(page, "us").hover();
    await expect(map(page)).toHaveAttribute("data-active-market", "us");
    await expect(panel(page).getByRole("heading", { name: "United States" })).toBeVisible();
    await expect(key(page, "United States")).toHaveAttribute("aria-pressed", "true");

    // The others leave: one silhouette on the stage, and it alone takes the tint.
    await expect(tiles(page)).toHaveCount(0);
    await expect(spotlight(page)).toHaveAttribute("data-market", "us");
    const top = spotlight(page).locator(".map-plate-top");
    await expect(top).toHaveCount(1);
    await expect
      .poll(async () => top.evaluate((node) => getComputedStyle(node).fill))
      .not.toBe(neutral);

    // The locator marks that market, and only it.
    const located = await page.evaluate(() =>
      [...document.querySelectorAll<SVGElement>('.map-locator [data-active="true"]')].map(
        (node) => node.dataset["locates"],
      ),
    );
    expect(located.length).toBeGreaterThan(0);
    expect([...new Set(located)]).toEqual(["us"]);

    // Nothing reverts when the pointer leaves, so it can travel to the panel's link.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    await expect(map(page)).toHaveAttribute("data-active-market", "us");
  });

  test("Singapore's editorial panel is never shown apart from its evidence group", async ({
    page,
  }) => {
    await openSynthesis(page);
    // A click selects at once; Singapore is a real outline now, not a 3px dot.
    await tile(page, "singapore").click();
    const view = panel(page);
    await expect(view.getByRole("heading", { name: "Singapore" })).toBeVisible();
    // KIRO.md §19 rule 3: Maturity Gap and level-only association, in the same view.
    await expect(view.getByText("Maturity Gap")).toBeVisible();
    await expect(view.getByText("Editorial", { exact: true })).toBeVisible();
    await expect(view.getByText("Level-only association")).toBeVisible();
    await expect(
      view.getByRole("link", { name: "Open the Singapore deep dive" }),
    ).toBeVisible();
  });

  test("the key selects and releases a market from the keyboard, and is announced", async ({
    page,
  }) => {
    await openSynthesis(page);
    const status = panel(page).locator("[aria-live]");
    await expect(status).toHaveText("Showing all five markets.");

    await key(page, "Norway").focus();
    await page.keyboard.press("Enter");
    await expect(key(page, "Norway")).toHaveAttribute("aria-pressed", "true");
    await expect(status).toHaveText("Showing Norway.");
    await expect(map(page)).toHaveAttribute("data-active-market", "norway");
    // The stage follows the key: Norway alone, the tiles gone.
    await expect(spotlight(page)).toHaveAttribute("data-market", "norway");
    await expect(tiles(page)).toHaveCount(0);

    // Pressing it again lets go, and the five tiles come back.
    await page.keyboard.press("Enter");
    await expect(key(page, "Norway")).toHaveAttribute("aria-pressed", "false");
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    await expect(tiles(page)).toHaveCount(5);
    await expect(spotlight(page)).toHaveCount(0);

    // Escape anywhere in the key lets go too, and so does the panel's own button.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(status).toHaveText("Showing all five markets.");
    await key(page, "Malaysia").click();
    await panel(page)
      .getByRole("button", { name: /Show all five markets/ })
      .click();
    await expect(panel(page).getByRole("heading", { name: "All Five Markets" })).toBeVisible();
  });

  test("the picture is hidden from assistive technology and adds no tab stop", async ({
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
    // Five tiles and the locator; every one hidden; nothing in the figure takes focus.
    expect(audit.svgs).toBe(6);
    expect(audit.hidden).toBe(true);
    expect(audit.focusable).toBe(0);

    // What is pointable says so; the key carries the same control for everyone else.
    for (const id of MARKET_IDS) await expect(tile(page, id)).toHaveCSS("cursor", "pointer");
    await expect(key(page, "Indonesia")).toHaveCSS("cursor", "pointer");
  });

  test("the locator says where, and is not a control", async ({ page }) => {
    await openForPointer(page);
    // Malaysia and Singapore are ~2.7px apart at this size: nothing to aim at.
    await map(page)
      .locator(".map-locator")
      .click({ position: { x: 150, y: 50 } });
    await page.waitForTimeout(400);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");

    await key(page, "Malaysia").click();
    const located = await page.evaluate(() =>
      [...document.querySelectorAll<SVGElement>('.map-locator [data-active="true"]')].map(
        (node) => node.dataset["locates"],
      ),
    );
    expect([...new Set(located)]).toEqual(["malaysia"]);
  });

  test("a touch passing over a tile does not select it; a mouse resting there does", async ({
    page,
  }) => {
    await openForPointer(page);
    const enter = async (pointerType: "touch" | "mouse"): Promise<void> => {
      await tile(page, "norway").evaluate((node, type) => {
        node.dispatchEvent(
          new PointerEvent("pointerover", { bubbles: true, pointerType: type }),
        );
      }, pointerType);
    };
    // A finger crossing a row of large tiles must not choose one...
    await enter("touch");
    await page.waitForTimeout(400);
    await expect(map(page)).toHaveAttribute("data-has-active", "false");
    // ...and the positive control: the same event from a mouse does, after the rest.
    await enter("mouse");
    await expect(map(page)).toHaveAttribute("data-active-market", "norway");
  });

  test("the entrance plays once on scroll, and never replays a stage already in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(map(page)).toHaveAttribute("data-intro", "pending");
    await expect(tile(page, "us")).toHaveCSS("opacity", "0");
    await page.locator("#market-synthesis").scrollIntoViewIfNeeded();
    // `play` is brief now: the entrance hands itself back (`done`) when it has finished.
    await expect(map(page)).toHaveAttribute("data-intro", /^(play|done)$/);
    await expect(map(page)).toHaveAttribute("data-intro", "done");
    await expect(tile(page, "us")).toHaveCSS("opacity", "1");

    // Choosing a market and letting go brings the tiles back WITHOUT the stagger.
    await key(page, "Norway").click();
    await panel(page)
      .getByRole("button", { name: /Show all five markets/ })
      .click();
    await expect(tiles(page)).toHaveCount(5);
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
    await context.close();
  });

  test("choosing a market never resizes the stage, and the panel sits beside it from xl", async ({
    page,
  }) => {
    for (const width of [1440, 1024, 375]) {
      await openSynthesis(page, width);
      const before = await stage(page).boundingBox();
      await key(page, "United States").click();
      await expect(spotlight(page)).toHaveAttribute("data-market", "us");
      const after = await stage(page).boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      // The same size in both states, so what is below it never moves.
      expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
      expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);

      const panelBox = await panel(page).boundingBox();
      expect(panelBox).not.toBeNull();
      if (width >= 1280) {
        expect(panelBox!.x).toBeGreaterThanOrEqual(after!.x + after!.width);
      } else {
        const keyBox = await key(page, "Norway").boundingBox();
        expect(panelBox!.y).toBeGreaterThanOrEqual(keyBox!.y + keyBox!.height - 1);
      }
    }
  });

  test("the caption says what the drawing is, in both states", async ({ page }) => {
    await openSynthesis(page);
    const caption = map(page).locator("figcaption");
    for (const fragment of ["says nothing about a market", "Alaska", "Hawaii", "Svalbard"]) {
      await expect(caption).toContainText(fragment);
    }
    await key(page, "Singapore").click();
    await expect(spotlight(page)).toHaveAttribute("data-market", "singapore");
    await expect(caption).toContainText("says nothing about a market");
    await expect(caption).toBeVisible();
  });

  test("on a phone every silhouette stays readable, with no overflow", async ({ page }) => {
    await openSynthesis(page, 375);
    // Measured before Batch 3: Singapore was 3x3px here, and the labels were switched off.
    for (const id of MARKET_IDS) {
      const box = await tile(page, id).locator("svg").boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(90);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(55);
      await expect(tile(page, id).locator("span")).toBeVisible();
    }
    // Three and two: two rows.
    const rows = new Set<number>();
    for (const id of MARKET_IDS)
      rows.add(Math.round((await tile(page, id).boundingBox())?.y ?? 0));
    expect(rows.size).toBe(2);
    // The locator keeps a size a place can be found on.
    expect((await map(page).locator(".map-locator").boundingBox())?.width ?? 0).toBeGreaterThan(
      100,
    );

    await key(page, "Singapore").click();
    await expect(panel(page).getByRole("heading", { name: "Singapore" })).toBeVisible();
    // The spotlight fills the stage instead of sitting in a corner of it.
    const frame = await stage(page).boundingBox();
    const outline = await spotlight(page).locator("svg").boundingBox();
    expect(outline!.width).toBeGreaterThanOrEqual(frame!.width * 0.85);

    const box = await key(page, "Norway").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
