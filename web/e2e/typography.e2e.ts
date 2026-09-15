import { expect, test } from "@playwright/test";

/**
 * Typography contract — the deterministic half of the type system.
 *
 * WHY THIS FILE EXISTS
 * The project renders in a SYSTEM font stack by design (`tokens.css` §4,
 * `docs/design-system.md` §3: no `next/font`, no webfont, no build-time network
 * dependency). The consequence is that the *typeface* is chosen by the operating
 * system and therefore differs between machines — Segoe UI on Windows, whatever
 * fontconfig resolves on Linux. That is a documented decision, not a defect, and
 * it is not something a test can or should pin.
 *
 * Everything else about the type system IS the project's own and IS deterministic:
 * the declared stacks, the absence of any downloaded font, and the size,
 * line-height, tracking and weight of every role at a given viewport. This file
 * asserts exactly that set, so the parts that must not drift between machines are
 * checked by the suite rather than by eye. What is platform-dependent is recorded
 * as a test annotation instead of asserted — visible on every run, on any machine,
 * without making the suite fail for being on Windows.
 *
 * Values below are the tokens resolved at a fixed viewport, computed by hand from
 * `tokens.css` and confirmed in the browser. `clamp()` roles differ between the
 * two viewports, which is the point of testing both.
 */

const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ' +
  '"Helvetica Neue", Arial, "Noto Sans", sans-serif';
const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", ' +
  '"Courier New", monospace';

interface RoleExpectation {
  readonly role: string;
  readonly selector: string;
  readonly size: string;
  readonly line: string;
  readonly tracking: string;
  /** Only where a token or an authored utility declares the weight. */
  readonly weight?: string;
}

/** 1280px — `--text-display` and `--text-h2` sit at their clamp maxima here. */
const DESKTOP: readonly RoleExpectation[] = [
  { role: "body", selector: "body", size: "16px", line: "26.88px", tracking: "normal" },
  {
    role: "display (h1)",
    selector: "h1",
    size: "60px",
    line: "63.6px",
    tracking: "-1.68px",
    weight: "600",
  },
  { role: "h2", selector: "#scope-title", size: "32px", line: "37.76px", tracking: "-0.576px" },
  {
    role: "label (eyebrow)",
    selector: "p.text-label",
    size: "12px",
    line: "16.2px",
    tracking: "0.9px",
    weight: "500",
  },
  { role: "lead", selector: "p.text-lead", size: "19px", line: "30.78px", tracking: "normal" },
  {
    role: "stat-small (numeric)",
    selector: "#scope ul li .numeric",
    size: "17px",
    line: "22.1px",
    tracking: "normal",
  },
  {
    role: "header identity",
    selector: "header span.text-h4",
    size: "17px",
    line: "23.8px",
    tracking: "-0.425px",
    weight: "500",
  },
  {
    role: "meta (footer)",
    selector: "footer li",
    size: "13px",
    line: "19.5px",
    tracking: "normal",
  },
];

/** 375px — the two fluid roles fall to their clamp minima; fixed roles do not move. */
const MOBILE: readonly RoleExpectation[] = [
  { role: "body", selector: "body", size: "16px", line: "26.88px", tracking: "normal" },
  {
    role: "display (h1)",
    selector: "h1",
    size: "36px",
    line: "38.16px",
    tracking: "-1.008px",
    weight: "600",
  },
  { role: "h2", selector: "#scope-title", size: "24px", line: "28.32px", tracking: "-0.432px" },
  {
    role: "label (eyebrow)",
    selector: "p.text-label",
    size: "12px",
    line: "16.2px",
    tracking: "0.9px",
    weight: "500",
  },
  { role: "lead", selector: "p.text-lead", size: "19px", line: "30.78px", tracking: "normal" },
];

test.describe("the type system is declared once, in tokens.css", () => {
  test("the font stacks on :root are exactly the design-system stacks", async ({ page }) => {
    await page.goto("/");

    const declared = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        sans: cs.getPropertyValue("--font-sans").trim(),
        mono: cs.getPropertyValue("--font-mono").trim(),
        numeric: cs.getPropertyValue("--font-numeric").trim(),
      };
    });

    expect(declared.sans).toBe(SANS_STACK);
    expect(declared.mono).toBe(MONO_STACK);
    // --font-numeric is an alias of --font-mono, so statistics and code share one
    // face and tabular figures need no second stack.
    expect(declared.numeric).toBe(MONO_STACK);
  });

  test("body copy uses the sans stack and numbers use the numeric stack", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toHaveCSS("font-family", SANS_STACK);

    const numeric = page.locator("#scope ul li .numeric").first();
    await expect(numeric).toHaveCSS("font-family", MONO_STACK);
    // Tabular figures are non-negotiable for a data product (design-system §3).
    await expect(numeric).toHaveCSS("font-variant-numeric", "tabular-nums");
  });

  test("uppercase appears only on eyebrow labels", async ({ page }) => {
    await page.goto("/");

    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => getComputedStyle(el).textTransform === "uppercase")
        .filter((el) => !el.classList.contains("text-label"))
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );

    expect(offenders).toEqual([]);
  });
});

test.describe("no font is loaded from anywhere", () => {
  test("the page requests no font file and no font provider", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /\.(woff2?|ttf|otf|eot)(\?|$)|fonts\.(googleapis|gstatic)\.com/i.test(request.url())
      ) {
        fontRequests.push(request.url());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // design-system.md §3: system stacks only, no build-time network dependency.
    // Asserting it here means an accidental `next/font` import or a stray
    // `@import url(fonts.googleapis...)` fails the suite instead of shipping.
    expect(fontRequests).toEqual([]);
  });

  test("no stylesheet declares an @font-face rule", async ({ page }) => {
    await page.goto("/");

    const faces = await page.evaluate(() =>
      [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules]
            .filter((rule) => rule instanceof CSSFontFaceRule)
            .map((rule) => rule.cssText);
        } catch {
          // Cross-origin sheet: unreadable, and there are none in this product.
          return [];
        }
      }),
    );

    expect(faces).toEqual([]);
  });
});

test.describe("every type role resolves to its token value", () => {
  for (const [label, viewport, roles] of [
    ["desktop", { width: 1280, height: 720 }, DESKTOP],
    ["mobile", { width: 375, height: 667 }, MOBILE],
  ] as const) {
    test(`${label} (${viewport.width}px): size, line-height and tracking`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      for (const role of roles) {
        const element = page.locator(role.selector).first();
        await expect(element, `${role.role} font-size`).toHaveCSS("font-size", role.size);
        await expect(element, `${role.role} line-height`).toHaveCSS("line-height", role.line);
        await expect(element, `${role.role} letter-spacing`).toHaveCSS(
          "letter-spacing",
          role.tracking,
        );
        if (role.weight !== undefined) {
          await expect(element, `${role.role} font-weight`).toHaveCSS(
            "font-weight",
            role.weight,
          );
        }
      }
    });
  }

  test("the size hierarchy holds regardless of which face the OS supplies", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    const sizes = await page.evaluate(() => {
      const px = (selector: string) =>
        Number.parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
      return {
        display: px("h1"),
        h2: px("#scope-title"),
        body: px("body"),
        label: px("p.text-label"),
      };
    });

    expect(sizes.display).toBeGreaterThan(sizes.h2);
    expect(sizes.h2).toBeGreaterThan(sizes.body);
    expect(sizes.body).toBeGreaterThan(sizes.label);
  });
});

test.describe("weight availability in the OS-supplied face", () => {
  /**
   * Rendering the same string at two weights and hashing the pixels is the only
   * reliable way to know whether a weight is a real face: `getComputedStyle`
   * reports the *requested* weight whether or not the platform has it.
   *
   * 400 vs 600 is asserted, because the display heading's emphasis depends on it
   * and a machine where they render identically has lost the type hierarchy.
   * 500 vs 600 is only recorded: on Windows/Segoe UI the two are pixel-identical,
   * which is a property of the OS font, not of this repository.
   */
  test("regular and semibold are distinct faces; medium is reported, not required", async ({
    page,
  }, testInfo) => {
    await page.goto("/");

    const rendered = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 90;
      const ctx = canvas.getContext("2d")!;
      const family = getComputedStyle(document.body).fontFamily;
      const sample = "Handgloves 0123456789";

      const hash = (weight: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        ctx.textBaseline = "top";
        ctx.font = `${weight} 64px ${family}`;
        ctx.fillText(sample, 0, 4);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let digest = 5381;
        for (let i = 3; i < data.length; i += 4) digest = ((digest * 33) ^ data[i]!) >>> 0;
        return digest.toString(16);
      };

      return { w400: hash(400), w500: hash(500), w600: hash(600), family };
    });

    testInfo.annotations.push(
      { type: "resolved font stack", description: rendered.family },
      {
        type: "weight 500 vs 600",
        description:
          rendered.w500 === rendered.w600
            ? "IDENTICAL on this machine — the OS face has no distinct medium"
            : "distinct faces on this machine",
      },
    );

    expect(rendered.w400).not.toBe(rendered.w600);
  });
});
