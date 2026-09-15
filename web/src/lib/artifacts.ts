/**
 * Application-side access to the generated analytical artifacts.
 *
 * WHY THIS FILE IS NOT IN src/data/
 * `tests/analytical-safety.test.ts` asserts the exact set of `.ts` files in
 * `src/data/` (artifact-types, artifacts, index, load-node, validate). That
 * assertion is a real guardrail: it makes any new module in the data layer a
 * deliberate, reviewed act rather than a quiet addition. So the app-side loader
 * lives here instead of weakening that test.
 *
 * WHY IT IS NOT load-node.ts
 * `src/data/load-node.ts` reads the artifacts with `node:fs` for the test suite.
 * Importing it from a React tree would pull `node:fs` into the module graph. Its
 * own header states the intended app-side transport: import the JSON directly
 * and hand the parsed objects to `createArtifactBundle`. That is what happens
 * below -- the same validation boundary, a different transport.
 *
 * THE ANALYTICAL RULE THIS FILE UPHOLDS
 * Nothing here computes, derives, rounds or reshapes a statistic. It imports
 * JSON, validates it, and returns it. Every number the UI renders is read from
 * these artifacts via the accessors in `src/data/index.ts`.
 */

import claims from "../data/generated/claims.json";
import countries from "../data/generated/countries.json";
import manifest from "../data/generated/manifest.json";
import metrics from "../data/generated/metrics.json";
import panel from "../data/generated/panel.json";

import { type ArtifactBundle, createArtifactBundle } from "../data/index.ts";

/**
 * Validated bundle, built once per process.
 *
 * `createArtifactBundle` runs the full boundary validator plus the
 * cross-artifact integrity checks, so a pipeline/frontend drift throws a
 * `ContractError` naming the failing path. Because this module is evaluated
 * during the build, that failure surfaces as a failed build rather than a blank
 * or wrong number in production -- which is the entire point of validating here
 * instead of trusting the JSON.
 */
let cached: ArtifactBundle | undefined;

export function getArtifacts(): ArtifactBundle {
  cached ??= createArtifactBundle({ panel, countries, metrics, claims, manifest });
  return cached;
}
