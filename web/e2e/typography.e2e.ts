import { expect, test } from "@playwright/test";

/**
 * Typography contract — the rendered half of the type system.
 *
 * WHAT CHANGED, AND WHY THIS FILE IS NOW MOSTLY ASSERTIONS
 * This suite used to record the typeface as an ANNOTATION rather than assert it,
 * because the product shipped no font: `system-ui` resolved to Segoe UI on Windows
 * and to whatever fontconfig supplied on Linux, so pinning the face would have
 * failed every machine but the author's. That is over. Geist Sans and Geist Mono
 * now ship with the application through the `geist` npm package, so the face is as
 * deterministic as the size and the weight and is asserted like them.
 *
 * Three things this file must keep proving, because each is a decision rather than
 * a consequence:
 *
 *   1. THE FONT IS SELF-HOSTED, NOT FETCHED. The old assertion was "zero font
 *      requests, zero @font-face". Both are now false BY DESIGN, and replacing them
 *      with nothing would drop the guardrail. The correct assertion is narrower and
 *      stronger: every font request is same-origin and comes out of the build, and
 *      every `@font-face` belongs to a Geist family. A `next/font/google` import or
 *      a stray remote `@import` still fails the suite.
 *
 *   2. EVERY WEIGHT THE SCALE DECLARES IS A DISTINCT RENDERED FACE. Requesting a
 *      weight and getting one are different things — `getComputedStyle` reports what
 *      was asked for whether or not the platform can supply it, which is how the
 *      previous font strategies silently collapsed 500 into 400 or into 600. Geist is
 *      a variable font with a `100 900` axis, so this is now checkable by drawing the
 *      same string at each step and comparing pixels.
 *
 *   3. THE TWO FIGURE TREATMENTS STAY SEPARATE. `.tabular` is a human-facing figure
 *      in Geist Sans; `.numeric` is a technical identifier in Geist Mono. Both carry
 *      tabular figures. Collapsing them in either direction is a visible regression.
 *
 * Values below are the tokens resolved at a fixed viewport, computed from
 * `tokens.css` and confirmed in the browser. `clamp()` roles differ between the
 * two viewports, which is the point of testing both.
 */

/** The family Next emits for the bundled Geist Sans `.woff2`. */
const SANS_FIRST = "GeistSans";

/**
 * TWO FORMS OF THE SAME STACK, AND THE DIFFERENCE IS NOT COSMETIC.
 *
 * A custom property holds an UNPARSED token stream, so `getPropertyValue` returns
 * the author's quoting verbatim — `next/font` quotes `"GeistSans"`, and the package's
 * mono chain leaves `Roboto Mono` unquoted. A computed `font-family`, by contrast, is
 * parsed and re-serialised by the engine, which quotes exactly the families that need
 * it: multi-word names get quotes, single-word ones lose them. Comparing one against
 * the other fails for a reason that has nothing to do with the design system, so both
 * forms are written out.
 */
const SANS_TOKEN =
  '"GeistSans", "GeistSans Fallback", ui-sans-serif, system-ui, "Segoe UI", Roboto, ' +
  '"Helvetica Neue", Arial, "Noto Sans", sans-serif';
const SANS_COMPUTED =
  'GeistSans, "GeistSans Fallback", ui-sans-serif, system-ui, "Segoe UI", Roboto, ' +
  '"Helvetica Neue", Arial, "Noto Sans", sans-serif';

/** Geist Mono ships its own terminating chain in the package. */
const MONO_TOKEN =
  '"GeistMono", ui-monospace, SFMono-Regular, Roboto Mono, Menlo, Monaco, ' +
  "Liberation Mono, DejaVu Sans Mono, Courier New, monospace";
const MONO_COMPUTED =
  'GeistMono, ui-monospace, SFMono-Regular, "Roboto Mono", Menlo, Monaco, ' +
  '"Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace';

interface RoleExpectation {
  readonly role: string;
  readonly selector: string;
  readonly size: string;
  readonly line: string;
  readonly tracking: string;
  readonly weight: string;
}

/** 1280px — `--text-display` and `--text-h2` sit at their clamp maxima here. */
const DESKTOP: readonly RoleExpectation[] = [
  {
    role: "body",
    selector: "body",
    size: "16px",
    line: "26.88px",
    tracking: "normal",
    weight: "400",
  },
  {
    role: "display (h1)",
    selector: "h1",
    size: "60px",
    line: "63.6px",
    tracking: "-1.68px",
    weight: "500",
  },
  {
    role: "h2",
    selector: "#scope-title",
    size: "32px",
    line: "37.76px",
    tracking: "-0.576px",
    weight: "600",
  },
  {
    role: "label (eyebrow)",
    selector: "p.text-label",
    size: "12px",
    line: "16.2px",
    tracking: "0.9px",
    weight: "500",
  },
  {
    role: "label (country badge)",
    selector: "#scope span.text-label",
    size: "12px",
    line: "16.2px",
    tracking: "0.9px",
    weight: "500",
  },
  {
    role: "lead",
    selector: "p.text-lead",
    size: "19px",
    line: "30.78px",
    tracking: "normal",
    weight: "400",
  },
  {
    role: "small (nav link)",
    selector: 'nav[aria-label="Sections"] a',
    size: "15px",
    line: "24px",
    tracking: "normal",
    weight: "400",
  },
  {
    role: "stat-small (metric figure)",
    selector: "#scope ul li .tabular",
    size: "17px",
    line: "22.1px",
    tracking: "normal",
    weight: "500",
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
    weight: "400",
  },
  {
    role: "meta (metric label)",
    selector: "#scope ul li p.text-meta",
    size: "13px",
    line: "19.5px",
    tracking: "normal",
    weight: "400",
  },
];

/** 375px — the two fluid roles fall to their clamp minima; fixed roles do not move. */
const MOBILE: readonly RoleExpectation[] = [
  {
    role: "body",
    selector: "body",
    size: "16px",
    line: "26.88px",
    tracking: "normal",
    weight: "400",
  },
  {
    role: "display (h1)",
    selector: "h1",
    size: "36px",
    line: "38.16px",
    tracking: "-1.008px",
    weight: "500",
  },
  {
    role: "h2",
    selector: "#scope-title",
    size: "24px",
    line: "28.32px",
    tracking: "-0.432px",
    weight: "600",
  },
  {
    role: "label (eyebrow)",
    selector: "p.text-label",
    size: "12px",
    line: "16.2px",
    tracking: "0.9px",
    weight: "500",
  },
  {
    role: "lead",
    selector: "p.text-lead",
    size: "19px",
    line: "30.78px",
    tracking: "normal",
    weight: "400",
  },
];

test.describe("the type system is declared once, in tokens.css", () => {
  test("the font stacks on :root are exactly the design-system stacks", async ({ page }) => {
    await page.goto("/");

    const declared = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        display: cs.getPropertyValue("--font-display").trim(),
        sans: cs.getPropertyValue("--font-sans").trim(),
        mono: cs.getPropertyValue("--font-mono").trim(),
        numeric: cs.getPropertyValue("--font-numeric").trim(),
        geistSans: cs.getPropertyValue("--font-geist-sans").trim(),
        geistMono: cs.getPropertyValue("--font-geist-mono").trim(),
      };
    });

    // The package's own variables must be in scope on `:root`. They are declared by
    // the class names on <html>; on <body> they would be invisible to these tokens.
    expect(declared.geistSans).toContain(SANS_FIRST);
    expect(declared.geistMono).toContain("GeistMono");

    expect(declared.sans).toBe(SANS_TOKEN);
    // Geist ships one optical size, so display and prose resolve to the same family.
    // The token split is kept because the roles differ, not the face.
    expect(declared.display).toBe(SANS_TOKEN);
    expect(declared.mono).toBe(MONO_TOKEN);
    // --font-numeric is an alias of --font-mono, so identifiers and code share one
    // face and tabular figures need no second stack.
    expect(declared.numeric).toBe(MONO_TOKEN);

    // The package's sans chain is only `GeistSans, "GeistSans Fallback"` and does not
    // terminate in a generic family, so tokens.css appends one. Without it a failed
    // font load falls through to the UA default serif.
    expect(declared.sans.endsWith("sans-serif")).toBe(true);
    expect(declared.mono.endsWith("monospace")).toBe(true);
  });

  test("prose takes Geist Sans and technical identifiers take Geist Mono", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toHaveCSS("font-family", SANS_COMPUTED);
    await expect(page.locator("h1")).toHaveCSS("font-family", SANS_COMPUTED);

    // A FRED series id is a string a reader transcribes exactly. It is the one class
    // of value that earns the monospace face.
    const identifier = page.locator("footer li span.numeric").first();
    await expect(identifier).toHaveCSS("font-family", MONO_COMPUTED);
    await expect(identifier).toHaveCSS("font-variant-numeric", "tabular-nums");
  });

  test("human-facing figures stay in Geist Sans, with tabular figures", async ({ page }) => {
    await page.goto("/");

    // Not every number is monospace: an observation period, a count and an ordinal
    // are values a reader reads, so they keep the prose face and take only the digit
    // alignment. Tabular figures are non-negotiable regardless (design-system §3).
    for (const selector of [
      "#scope ul li .tabular", // metric-card figure
      "header span.tabular", // observation period in the header
      "#structure ol li span.tabular", // narrative ordinal
      "#provisional-weeks span[aria-label]", // inline StatHighlight
    ]) {
      const element = page.locator(selector).first();
      await expect(element, `${selector} font-family`).toHaveCSS("font-family", SANS_COMPUTED);
      await expect(element, `${selector} tabular figures`).toHaveCSS(
        "font-variant-numeric",
        "tabular-nums",
      );
    }
  });

  test("tabular figures are load-bearing, not decorative", async ({ page }) => {
    await page.goto("/");

    // Geist Sans's figures are PROPORTIONAL by default, so without `tabular-nums` a
    // column of metric cards would visibly misalign. Measured rather than assumed,
    // because "the font probably has tabular figures" is how this silently breaks.
    const widths = await page.evaluate(() => {
      const family = getComputedStyle(document.body).fontFamily;
      const probe = (variant: string) => {
        const span = document.createElement("span");
        span.style.cssText = `position:absolute;font:400 40px ${family};font-variant-numeric:${variant};white-space:pre`;
        span.textContent = "111111";
        document.body.append(span);
        const ones = span.getBoundingClientRect().width;
        span.textContent = "000000";
        const zeros = span.getBoundingClientRect().width;
        span.remove();
        return { ones, zeros };
      };
      return { proportional: probe("normal"), tabular: probe("tabular-nums") };
    });

    expect(widths.proportional.ones).not.toBeCloseTo(widths.proportional.zeros, 0);
    expect(widths.tabular.ones).toBeCloseTo(widths.tabular.zeros, 1);
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

test.describe("the typeface is self-hosted from the npm dependency", () => {
  test("every font request is same-origin and served out of the build", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(request.url())) fontRequests.push(request.url());
    });

    const response = await page.goto("/", { waitUntil: "networkidle" });
    const origin = new URL(response!.url()).origin;

    // The previous assertion was "zero font requests", which was correct while the
    // product shipped no typeface. Geist ships with the application, so the rule is
    // now about WHERE the bytes come from: `/_next/static/media/` on this origin,
    // never a third party.
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) {
      expect(url.startsWith(`${origin}/_next/static/media/`), url).toBe(true);
    }
  });

  test("nothing is requested from a font provider", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).host;
      if (/fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny\.net/i.test(host)) {
        remote.push(request.url());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    expect(remote).toEqual([]);
  });

  test("every @font-face belongs to a Geist family and the real faces loaded", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const faces = await page.evaluate(() =>
      [...document.fonts].map((face) => ({
        family: face.family,
        weight: face.weight,
        status: face.status,
      })),
    );

    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face.family, `unexpected @font-face family: ${face.family}`).toMatch(/^Geist/);
    }

    // The two real variable faces must be loaded, and each must expose the full
    // `100 900` axis — that range is what makes every weight step below a genuine
    // instance rather than something the browser has to synthesize.
    for (const family of ["GeistSans", "GeistMono"]) {
      const real = faces.find((face) => face.family === family);
      expect(real, `${family} is not among the loaded faces`).toBeDefined();
      expect(real!.status).toBe("loaded");
      expect(real!.weight).toBe("100 900");
    }
  });
});

test.describe("every type role resolves to its token value", () => {
  for (const [label, viewport, roles] of [
    ["desktop", { width: 1280, height: 720 }, DESKTOP],
    ["mobile", { width: 375, height: 667 }, MOBILE],
  ] as const) {
    test(`${label} (${viewport.width}px): size, line-height, tracking and weight`, async ({
      page,
    }) => {
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
        await expect(element, `${role.role} font-weight`).toHaveCSS("font-weight", role.weight);
      }
    });
  }

  test("the size hierarchy holds", async ({ page }) => {
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

  test("no small role is heavier than the section heading except by decision", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // The audit's finding, kept as a rule: uppercase 12px at 600 is denser per unit
    // area than the 60px hero, so an eyebrow or a badge at 600 reads as heavier than
    // the title above it.
    //
    // The bound is `< 20px`, not `<= 20px`. `--text-h3-weight` has been 600 at
    // 1.25rem (20px) since before the Geist pass — it is a heading role, not a label,
    // and at 20px the optical-sizing logic runs the other way: small type needs more
    // weight, not less. The earlier `<= 20` bound was asserting something the token
    // scale never agreed to, and it went unnoticed only because nothing on the page
    // rendered `text-h3` until the chart frame did. Everything the audit actually
    // measured — label 12px, meta 13px, small 15px, h4 and stat-small 17px — is still
    // covered.
    const heavySmallRoles = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .map((el) => {
          const cs = getComputedStyle(el);
          return {
            tag: `${el.tagName.toLowerCase()}.${el.className}`,
            size: Number.parseFloat(cs.fontSize),
            weight: Number.parseInt(cs.fontWeight, 10),
          };
        })
        .filter((entry) => entry.size < 20 && entry.weight > 500)
        .map((entry) => `${entry.tag} (${String(entry.size)}px @ ${String(entry.weight)})`),
    );

    expect(heavySmallRoles).toEqual([]);
  });
});

test.describe("the variable weight axis is real, not synthesized", () => {
  /**
   * Rendering the same string at each declared step and hashing the pixels is the
   * only reliable way to know whether a weight is a real instance:
   * `getComputedStyle` reports the *requested* weight whether or not the platform
   * can supply it.
   *
   * This is why the rule "no role may use weight 500" existed and why it no longer
   * applies. With an OS-supplied face 500 was pixel-identical to 600 on Segoe UI and
   * collapsed to 400 on a face shipping only 400/700 — the hierarchy was decided by
   * the operating system. A bundled variable font with a `100 900` axis interpolates
   * every step from the same file on every machine, and this test proves it rather
   * than trusting it.
   */
  for (const [label, selector] of [
    ["Geist Sans", "body"],
    ["Geist Mono", "footer li span.numeric"],
  ] as const) {
    test(`${label}: 400, 500, 600 and 700 are four distinct faces`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);

      const rendered = await page.evaluate((target) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 90;
        const ctx = canvas.getContext("2d")!;
        const family = getComputedStyle(document.querySelector(target)!).fontFamily;
        const sample = "Handgloves 0123456789";

        const draw = (weight: number) => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#000";
          ctx.textBaseline = "top";
          ctx.font = `${weight} 64px ${family}`;
          ctx.fillText(sample, 0, 4);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let digest = 5381;
          let ink = 0;
          for (let i = 3; i < data.length; i += 4) {
            digest = ((digest * 33) ^ data[i]!) >>> 0;
            if (data[i]! > 96) ink += 1;
          }
          return { weight, digest: digest.toString(16), ink };
        };

        return [400, 500, 600, 700].map(draw);
      }, selector);

      // Four requests, four distinct renderings.
      const digests = new Set(rendered.map((entry) => entry.digest));
      expect(digests.size, JSON.stringify(rendered)).toBe(4);

      // And they must be ordered: heavier requests put more ink on the page. A
      // non-monotonic result would mean the axis is not being traversed.
      for (let i = 1; i < rendered.length; i += 1) {
        expect(rendered[i]!.ink, `${String(rendered[i]!.weight)} vs previous`).toBeGreaterThan(
          rendered[i - 1]!.ink,
        );
      }
    });
  }

  test("no element requests a weight outside the declared scale", async ({ page }) => {
    await page.goto("/");

    // The rendered half of the source-level rule in `tests/typography-contract.test.ts`.
    // That test reads the declarations; this one reads what the browser computed, so a
    // weight arriving through a utility, an inherited value or a future component is
    // caught too. 100-300 and 800-900 exist on the axis but are not design decisions
    // this product has made.
    const allowed = new Set(["400", "500", "600", "700"]);
    const offenders = await page.evaluate(
      (permitted) =>
        [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => !permitted.includes(getComputedStyle(el).fontWeight))
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${el.className}: ${getComputedStyle(el).fontWeight}`,
          ),
      [...allowed],
    );

    expect(offenders).toEqual([]);
  });

  test("weight 700 is on the scale but unused by every role", async ({ page }) => {
    await page.goto("/");

    // The audit measured 700 at 34.71% ink on the hero string against 23.72% for
    // prose weight, which is the "excessively bold" end the visual direction forbids.
    // It stays declared so a future role can reach for it deliberately.
    const bold = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => getComputedStyle(el).fontWeight === "700")
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );

    expect(bold).toEqual([]);
  });
});
