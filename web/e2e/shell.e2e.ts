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

const NAV_LABELS = ["Scope", "Comparability", "Structure"] as const;

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 375, height: 720 };

/** The resolved `--header-height` token, in px, at the current viewport. */
async function headerHeightToken(page: Page): Promise<number> {
  const raw = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
  );
  return Number.parseFloat(raw.trim());
}

test.describe("navigation structure", () => {
  test("exposes a named nav landmark with one link per section", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav).toBeVisible();

    const links = nav.getByRole("link");
    await expect(links).toHaveCount(NAV_LABELS.length);
    for (const label of NAV_LABELS) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("every nav link targets a section that exists on the page", async ({ page }) => {
    await page.goto("/");

    const hrefs = await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

    expect(hrefs.length).toBe(NAV_LABELS.length);
    for (const href of hrefs) {
      expect(href.startsWith("#")).toBe(true);
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test("nav links are keyboard reachable after the skip link", async ({ page }) => {
    await page.goto("/");

    // Skip link first, then the section rail. No focus trap, no custom key handling.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Scope" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Comparability" })).toBeFocused();
  });

  test("nav links meet the 44px minimum tap target", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");

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

    await page.getByRole("link", { name: "Structure" }).click();
    await expect(page).toHaveURL(/#structure$/);

    const heading = page.getByRole("heading", { name: "Narrative structure" });

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
  test("marks the active section with aria-current, not colour alone", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await page.getByRole("link", { name: "Comparability" }).click();
    await expect(page.getByRole("link", { name: "Comparability" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await page.getByRole("link", { name: "Structure" }).click();
    await expect(page.getByRole("link", { name: "Structure" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("link", { name: "Comparability" })).not.toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("follows the scroll position, not just clicks", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    // Nothing is current while the reader is still in the hero.
    for (const label of NAV_LABELS) {
      await expect(page.getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current",
        "true",
      );
    }

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
    for (const [id, label] of [
      ["scope", "Scope"],
      ["comparability", "Comparability"],
      ["structure", "Structure"],
      ["comparability", "Comparability"],
      ["scope", "Scope"],
    ] as const) {
      await scrollToSectionTop(id);
      await expect(page.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "true",
      );
      for (const other of NAV_LABELS.filter((candidate) => candidate !== label)) {
        await expect(page.getByRole("link", { name: other })).not.toHaveAttribute(
          "aria-current",
          "true",
        );
      }
    }
  });
});

test.describe("responsive shell", () => {
  test("header is one row on desktop and two rows on mobile", async ({ page }) => {
    await page.goto("/");

    await page.setViewportSize(DESKTOP);
    const desktopHeader = await page.getByRole("banner").boundingBox();
    const desktopNav = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
    const desktopIdentity = await page
      .getByText("Oil Prices", { exact: false })
      .first()
      .boundingBox();
    expect(desktopHeader).not.toBeNull();
    expect(desktopNav).not.toBeNull();
    expect(desktopIdentity).not.toBeNull();
    // Same row: the nav's vertical centre sits within the identity's line box.
    expect(Math.abs((desktopNav?.y ?? 0) - (desktopIdentity?.y ?? 0))).toBeLessThan(40);

    await page.setViewportSize(MOBILE);
    const mobileNav = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
    const mobileIdentity = await page
      .getByText("Oil Prices", { exact: false })
      .first()
      .boundingBox();
    // Stacked: the nav begins below the identity row.
    expect(mobileNav?.y ?? 0).toBeGreaterThan(mobileIdentity?.y ?? 0);
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

    // --width-reading is 68ch. The lead paragraph is the widest prose on the page;
    // if a container variant regressed to `page`, this would catch it.
    const lead = page.getByText("An interactive analysis of Brent crude prices", {
      exact: false,
    });
    const box = await lead.boundingBox();
    const readingPx = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.width = "var(--width-reading)";
      probe.style.position = "absolute";
      document.body.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.ceil(readingPx) + 1);
  });
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
