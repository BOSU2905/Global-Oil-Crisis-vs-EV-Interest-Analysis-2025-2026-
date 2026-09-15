// PostCSS configuration — the single piece of wiring that makes the installed
// `@tailwindcss/postcss` dependency functional rather than dead weight in the
// committed lockfile.
//
// Tailwind v4 ships its entire pipeline as one PostCSS plugin; there is no
// tailwind.config.js and no separate autoprefixer entry. Theme configuration is
// done in CSS via `@theme`, which is why no JS theme object appears here.
//
// Scope note (Phase 3B bootstrap): this file only registers the plugin. The
// `@theme` mapping from web/src/styles/tokens.css onto Tailwind utilities is
// step 1 of docs/product-architecture.md §10 and belongs to the UI phase, along
// with the CSS entrypoint that will `@import "tailwindcss"`. Until that entry
// point exists, Tailwind is installed and wired but processes nothing.
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
