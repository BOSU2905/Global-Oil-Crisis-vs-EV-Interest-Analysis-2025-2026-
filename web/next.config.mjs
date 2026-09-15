// Next.js configuration.
//
// Deliberately small. Every option below is here for a stated reason; this file
// is not a place to accumulate defaults.

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Surfaces double-invoked effects and unsafe lifecycles in development. The
  // chart adapter (product-architecture.md §4) will own IntersectionObserver,
  // ResizeObserver and an ECharts `dispose()` on unmount, which is exactly the
  // class of code that strict mode catches when it is written incorrectly.
  reactStrictMode: true,

  // Fail the production build on a type error instead of shipping it. This is
  // Next's default; it is stated explicitly because silently flipping it to
  // `true` is the usual way a type guardrail stops being enforced.
  //
  // There is no `eslint` key: Next 16 removed built-in lint-on-build, so linting
  // is owned by `npm run lint` / `npm run verify` instead. Adding one back would
  // only produce an "Unrecognized key" warning.
  typescript: { ignoreBuildErrors: false },

  // The analytical artifacts are committed JSON imported at build time, so there
  // is no image pipeline, no rewrites, no redirects and no runtime data source to
  // configure. If any of those appear later they need their own justification.
};

export default nextConfig;
