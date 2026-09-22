// Temporary visual-verification script. Deleted after the check.
import { chromium } from "@playwright/test";

const widths = [
  { label: "1920", width: 1920, height: 1080 },
  { label: "1280", width: 1280, height: 800 },
  { label: "375", width: 375, height: 800 },
];

const sections = [
  "ev-interest-markets",
  "oil-vs-interest",
  "market-synthesis",
  "country-deep-dives",
  "how-to-read",
];

const browser = await chromium.launch();
for (const size of widths) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`${size.label}: horizontal overflow = ${overflow}`);

  for (const id of sections) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);
    await el.screenshot({ path: `/tmp/shot-${size.label}-${id}.png` });
  }

  // Report the entrance state of every chart wrapper.
  const entrance = await page.evaluate(() =>
    [...document.querySelectorAll("[data-chart-canvas]")].map((el) => ({
      entrance: el.getAttribute("data-entrance"),
      layout: el.getAttribute("data-layout"),
      zoom: `${el.getAttribute("data-zoom-start")}-${el.getAttribute("data-zoom-end")}`,
      canvas: el.querySelectorAll("canvas").length,
      box: el.getBoundingClientRect().width,
    })),
  );
  console.log(`${size.label}: charts =`, JSON.stringify(entrance));
  await page.close();
}
await browser.close();
