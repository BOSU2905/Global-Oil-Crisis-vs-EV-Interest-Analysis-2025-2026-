import { expect, test, type Page } from "@playwright/test";

/**
 * Application-shell tests — Phase 3C step 3.
 *
 * These cover what only a browser can answer about the shell: that the sticky
 * header does not cover the heading a reader just navigated to, that the header
 * height token still matches the rendered header at both of its breakpoint
 * values, that the scrollspy marks the active section in a way assistive
 * technology can read, and that the two-row/one-row responsive switch actually
 * happens.
 *
 * The anchor-offset test is the one that earns its keep. `Section` offsets every
 * anchor by `--header-height`; if a padding change made the header taller than the
 * token, deep links would silently land with the heading hidden behind the header.
 * Nothing in a type check or a build would notice.
 */

/**
 * Nav labels, mirroring `src/content/sections.ts`.
 *
 * Duplicated rather than imported: this file runs under Playwright against a built
 * server, and importing application source into it would couple the browser suite to the
 * module graph. `tests/layout-contract.test.ts` already asserts the registry against the
 * page, so the risk this duplication carries is a stale list here — which shows up
 * immediately as a failing count.
 */
const NAV_LABELS = [
  "Scope",
  "How to Read",
  "Comparability",
  "Markets",
  "Oil vs Interest",
  "Synthesis",
  "Deep Dives",
  "Structure",
] as const;

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 375, height: 720 };

/** The resolved `--header-height` token, in px, at the current viewport. */
async function headerHeightToken(page: Page): Promise<number> {
  const raw = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
  );
  return Number.parseFloat(raw.trim());
}

/** The floating section indicator's landmark, and its toggle. */
const sectionNav = (page: Page) => page.getByRole("navigation", { name: "Sections" });
const menuToggle = (page: Page) => page.getByRole("button", { name: "Jump to section" });

/** Open the section menu and wait until its entries can be operated. */
async function openSectionMenu(page: Page): Promise<void> {
  await menuToggle(page).click();
  await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(sectionNav(page).getByRole("link").first()).toBeVisible();
  // The panel scales in from 95% over --duration-medium; geometry read mid-transition
  // is 95% of the real size, so wait until no transition is running on it.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const toggle = document.querySelector('nav[aria-label="Sections"] button');
        const panel = document.getElementById(toggle?.getAttribute("aria-controls") ?? "");
        return panel !== null && panel.getAnimations().length === 0;
      }),
    )
    .toBe(true);
}

/** A section entry by href. CSS, so it resolves while the menu is closed and hidden. */
const entry = (page: Page, id: string) =>
  page.locator(`nav[aria-label="Sections"] a[href="#${id}"]`);

test.describe("navigation structure", () => {
  test("exposes a named nav landmark with one link per section", async ({ page }) => {
    await page.goto("/");

    const nav = sectionNav(page);
    await expect(nav).toBeVisible();

    // Collapsed by default: the indicator is visible, the entries are not.
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link")).toHaveCount(0);

    await openSectionMenu(page);
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(NAV_LABELS.length);
    for (const label of NAV_LABELS) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("every nav link targets a section that exists on the page", async ({ page }) => {
    await page.goto("/");

    const hrefs = await page
      .locator('nav[aria-label="Sections"] a')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

    expect(hrefs.length).toBe(NAV_LABELS.length);
    for (const href of hrefs) {
      expect(href.startsWith("#")).toBe(true);
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test("the keyboard reaches the header, then the indicator, then the sections", async ({
    page,
  }) => {
    await page.goto("/");

    // Skip link, the identity (home), the Creator entry, then the section indicator —
    // the first stop inside main. No focus trap anywhere.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("banner").getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Creator" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(menuToggle(page)).toBeFocused();

    // Enter opens the menu and moves focus into it; arrows move between entries.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Scope" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: "How to Read" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("link", { name: "Structure" })).toBeFocused();

    // Escape closes it and gives focus back to the toggle.
    await page.keyboard.press("Escape");
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(menuToggle(page)).toBeFocused();
  });

  test("the indicator and every entry meet the 44px minimum tap target", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");

    const toggle = await menuToggle(page).boundingBox();
    expect(toggle?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(toggle?.width ?? 0).toBeGreaterThanOrEqual(44);

    await openSectionMenu(page);
    for (const label of NAV_LABELS) {
      const box = await page.getByRole("link", { name: label }).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("sticky header and anchor offset", () => {
  for (const [name, viewport] of [
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ] as const) {
    test(`the header-height token clears the rendered header (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const box = await page.getByRole("banner").boundingBox();
      expect(box).not.toBeNull();
      const token = await headerHeightToken(page);

      // The token may exceed the header; it must never be smaller, or a
      // deep-linked heading would end up underneath it.
      expect(
        token,
        `--header-height (${token}px) must be >= the rendered header (${box?.height ?? 0}px)`,
      ).toBeGreaterThanOrEqual(box?.height ?? 0);
    });
  }

  test("a deep-linked section heading is not covered by the sticky header", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await openSectionMenu(page);
    await page.getByRole("link", { name: "Structure" }).click();
    await expect(page).toHaveURL(/#structure$/);
    // Choosing a section closes the menu.
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");

    const heading = page.getByRole("heading", { name: "Narrative Structure" });

    // scroll-behavior is smooth, so poll until the scroll settles.
    await expect
      .poll(
        async () => {
          const headerBox = await page.getByRole("banner").boundingBox();
          const headingBox = await heading.boundingBox();
          if (headerBox === null || headingBox === null) return -1;
          // Positive means the heading starts below the header's bottom edge.
          return Math.round(headingBox.y - (headerBox.y + headerBox.height));
        },
        { timeout: 4000 },
      )
      .toBeGreaterThanOrEqual(0);
  });

  test("the header stays fixed while the page scrolls", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await page.evaluate(() => {
      window.scrollTo({ top: 1200, behavior: "instant" });
    });
    const box = await page.getByRole("banner").boundingBox();
    expect(box?.y ?? -1).toBe(0);
  });
});

test.describe("scrollspy", () => {
  test("marks the active section with aria-current and a shape, not colour alone", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await openSectionMenu(page);
    await page.getByRole("link", { name: "Comparability" }).click();
    await expect(entry(page, "comparability")).toHaveAttribute("aria-current", "true");
    await expect(sectionNav(page)).toHaveAttribute("data-active-section", "comparability");

    await openSectionMenu(page);
    await page.getByRole("link", { name: "Structure" }).click();
    await expect(entry(page, "structure")).toHaveAttribute("aria-current", "true");
    await expect(entry(page, "comparability")).not.toHaveAttribute("aria-current", "true");

    // The indicator's own cue is shape: exactly one dot is drawn elongated.
    const dots = sectionNav(page).locator("button [data-active]");
    await expect(dots).toHaveCount(NAV_LABELS.length);
    await expect(sectionNav(page).locator('button [data-active="true"]')).toHaveCount(1);
    const sizes = await dots.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return Math.round(Math.max(box.width, box.height));
      }),
    );
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes));
    // And the toggle describes where the reader is, for a screen reader.
    await expect(menuToggle(page)).toHaveAccessibleDescription("Current section: Structure");
  });

  test("follows the scroll position, not just clicks", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    // Nothing is current while the reader is still in the hero.
    await expect(sectionNav(page)).toHaveAttribute("data-active-section", "");
    await expect(page.locator('nav[aria-label="Sections"] a[aria-current="true"]')).toHaveCount(
      0,
    );

    /** Scroll so the given section's top sits exactly on the reading line. */
    const scrollToSectionTop = async (id: string): Promise<void> => {
      await page.evaluate((sectionId) => {
        const element = document.getElementById(sectionId);
        if (element === null) return;
        const line = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
        );
        const top = element.getBoundingClientRect().top + window.scrollY - line;
        window.scrollTo({ top, behavior: "instant" });
      }, id);
    };

    // Walking forward, then back. The earlier implementation decided from whichever
    // entries an IntersectionObserver callback happened to carry, which left the
    // previous section highlighted when the active one merely scrolled out of the
    // observed band — a ~10% flake. This asserts the decision follows geometry.
    for (const id of ["scope", "comparability", "structure", "comparability", "scope"]) {
      await scrollToSectionTop(id);
      // Asserted with the menu CLOSED: the indicator must track the reader on its own.
      await expect(entry(page, id)).toHaveAttribute("aria-current", "true");
      await expect(
        page.locator('nav[aria-label="Sections"] a[aria-current="true"]'),
      ).toHaveCount(1);
    }
  });
});

test.describe("section indicator behaviour", () => {
  test("an outside click and a second toggle both collapse the menu", async ({ page }) => {
    for (const viewport of [DESKTOP, MOBILE]) {
      await page.setViewportSize(viewport);
      await page.goto("/");

      await openSectionMenu(page);
      // Well clear of the panel, which sits beside the rail or above the pill.
      await page.mouse.click(8, 200);
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(sectionNav(page).getByRole("link")).toHaveCount(0);

      await openSectionMenu(page);
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("hovering an entry scales it subtly, within the 1.08 ceiling", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await openSectionMenu(page);

    const link = page.getByRole("link", { name: "Synthesis" });
    await link.hover();
    await expect
      .poll(async () => Number(await link.evaluate((node) => getComputedStyle(node).scale)))
      .toBeGreaterThan(1);
    const scale = Number(await link.evaluate((node) => getComputedStyle(node).scale));
    expect(scale).toBeLessThanOrEqual(1.08);
    await expect(link).toHaveCSS("cursor", "pointer");
    await expect(menuToggle(page)).toHaveCSS("cursor", "pointer");
  });

  test("under reduced motion the entries do not scale", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await openSectionMenu(page);

    const link = page.getByRole("link", { name: "Synthesis" });
    await link.hover();
    await page.waitForTimeout(100);
    const scale = await link.evaluate((node) => getComputedStyle(node).scale);
    expect(["none", "1"]).toContain(scale);
    await context.close();
  });

  for (const width of [1280, 1536, 1920] as const) {
    test(`from xl the rail sits in the margin, clear of content, at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const rail = await menuToggle(page).boundingBox();
      // The frame's content box: a section spans it exactly.
      const content = await page.locator("section#scope").boundingBox();
      expect(rail).not.toBeNull();
      expect(content).not.toBeNull();
      expect(rail!.x).toBeGreaterThan(content!.x + content!.width);
      expect(rail!.x + rail!.width).toBeLessThanOrEqual(width);
    });
  }
});

test.describe("responsive shell", () => {
  test("header is one row at every width, with the Creator entry top right", async ({
    page,
  }) => {
    await page.goto("/");

    for (const viewport of [DESKTOP, MOBILE]) {
      await page.setViewportSize(viewport);
      const header = await page.getByRole("banner").boundingBox();
      const identity = await page.locator("header span.text-h4").boundingBox();
      const creator = await page.getByRole("link", { name: "Creator" }).boundingBox();
      expect(header).not.toBeNull();
      expect(identity).not.toBeNull();
      expect(creator).not.toBeNull();

      // Same row: their vertical centres agree, and the header is one control tall.
      const centre = (box: { y: number; height: number }) => box.y + box.height / 2;
      expect(Math.abs(centre(identity!) - centre(creator!))).toBeLessThan(4);
      expect(header!.height).toBeLessThanOrEqual(await headerHeightToken(page));
      // Top right: the entry ends at the frame's right edge, after the identity.
      expect(creator!.x).toBeGreaterThan(identity!.x + identity!.width);
      expect(creator!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("no horizontal page overflow at 375px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("prose never exceeds the reading measure", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    // --width-reading is 68ch, and `ch` resolves against the ELEMENT's own font
    // size rather than the root's. The probe therefore has to be measured in the
    // lead's own font: at 19px the measure is ~696px, while the same token on 16px
    // body copy is ~586px. An earlier version of this test probed a bare div on
    // document.body and compared that against the lead, which asserted the wrong
    // number — it passed only because the measure used to be applied to a 16px
    // wrapper, and it started failing the moment the measure moved onto the lead
    // itself. The rule being checked is "prose stays within 68 characters", and
    // this is what that means.
    const lead = page.getByText("An interactive analysis of Brent crude prices", {
      exact: false,
    });
    const box = await lead.boundingBox();
    const readingPx = await lead.evaluate((element) => {
      const probe = document.createElement("div");
      probe.style.font = getComputedStyle(element).font;
      probe.style.width = "var(--width-reading)";
      probe.style.position = "absolute";
      element.parentElement?.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.ceil(readingPx) + 1);
  });

  /**
   * THE ALIGNMENT SPINE.
   *
   * The shell and the page body must share one frame. Before this was fixed the
   * header used `--width-page` (1440px) while the body used `--width-content`
   * (1120px); both were centred, so the body's content sat 80px inside the header's
   * left edge at 1280px and 160px inside it at 1440px and 1920px. Nothing failed —
   * it simply read as a narrow column floating inside a wider frame, which is the
   * kind of defect only a measurement or a screenshot finds.
   *
   * Asserting the shared left edge is what makes that unrepeatable. It runs at four
   * widths because the frame is banded: `--width-content` up to `2xl`,
   * `--width-chart` above it, and full-width minus gutters on mobile.
   */
  for (const width of [375, 1280, 1440, 1920] as const) {
    test(`header, body and footer share one left edge at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const identity = await page.locator("header span.text-h4").boundingBox();
      const eyebrow = await page.locator("main p.text-label").first().boundingBox();
      const heading = await page.locator("h1").boundingBox();
      // The footer's "Sources" eyebrow is an h2 carrying `text-label`, not a p.
      const sources = await page.locator("footer .text-label").first().boundingBox();

      for (const box of [identity, eyebrow, heading, sources]) expect(box).not.toBeNull();

      const spine = Math.round(identity?.x ?? -1);
      expect(Math.round(eyebrow?.x ?? -1), "body eyebrow is inset from the header").toBe(spine);
      expect(Math.round(heading?.x ?? -1), "h1 is inset from the header").toBe(spine);
      expect(Math.round(sources?.x ?? -1), "footer is inset from the header").toBe(spine);
    });
  }

  /**
   * The frame is banded, and that band is why a 1920px viewport no longer reads as a
   * narrow column: it grows from `--width-content` to `--width-chart` at `2xl`, so
   * an analytical visual can take the full frame while prose stays at the measure.
   *
   * Asserted as a relationship between viewports rather than as pixel values, so
   * retuning the tokens does not require editing the test.
   */
  test("the frame grows once on large desktop and never exceeds the chart width", async ({
    page,
  }) => {
    await page.goto("/");

    const frameAt = async (width: number): Promise<{ frame: number; chart: number }> => {
      await page.setViewportSize({ width, height: 900 });
      return page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.position = "absolute";
        document.body.append(probe);
        probe.style.width = "var(--width-page)";
        const frame = probe.getBoundingClientRect().width;
        probe.style.width = "var(--width-chart)";
        const chart = probe.getBoundingClientRect().width;
        probe.remove();
        return { frame, chart };
      });
    };

    const desktop = await frameAt(1280);
    const large = await frameAt(1920);

    expect(large.frame).toBeGreaterThan(desktop.frame);
    // A frame wider than the widest permitted chart would be space that no content
    // variant can ever fill.
    expect(large.frame).toBeLessThanOrEqual(large.chart);
    expect(desktop.frame).toBeLessThanOrEqual(desktop.chart);
  });

  /** Overflow is checked at every audited width, not only at 375px. */
  for (const width of [1280, 1440, 1920] as const) {
    test(`no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("landmark naming", () => {
  test("each section is named by its own heading", async ({ page }) => {
    await page.goto("/");

    for (const id of ["scope", "comparability", "structure"]) {
      const section = page.locator(`section#${id}`);
      await expect(section).toHaveCount(1);
      await expect(section).toHaveAttribute("aria-labelledby", `${id}-title`);
      await expect(page.locator(`#${id}-title`)).toHaveCount(1);
    }
  });

  test("heading levels do not skip: one h1, then h2s", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveCount(1);
    const levels = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));

    expect(levels[0]).toBe(1);
    let previous = levels[0] ?? 1;
    for (const level of levels) {
      expect(level - previous).toBeLessThanOrEqual(1);
      previous = level;
    }
  });
});

test.describe("creator entry", () => {
  test("the header's Creator entry leads to the creator page and back", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    const creator = page.getByRole("link", { name: "Creator" });
    await expect(creator).toBeVisible();
    await expect(creator).toHaveCSS("cursor", "pointer");
    await expect(creator).not.toHaveAttribute("aria-current", "page");
    await creator.click();

    await expect(page).toHaveURL(/\/creator$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Benedictus Alfred Djaja");
    // The entry says where the reader is, in a way assistive technology can read.
    await expect(page.getByRole("link", { name: "Creator" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // No section indicator here: the creator page has no sections to navigate.
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);

    await page.getByRole("link", { name: /Back to the report/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("EV Interest Analysis");
  });

  test("the creator page keeps the shell's landmarks and fits at 375px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/creator");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
