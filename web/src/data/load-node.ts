/**
 * Node-only filesystem loader for the generated artifacts.
 *
 * Used by the contract tests and by build-time scripts. It is deliberately
 * separate from `artifacts.ts` so the validation and accessor layer stays
 * environment-agnostic and has no `node:` imports.
 *
 * PHASE 3B: Next.js will not use this. It will `import panel from
 * "./generated/panel.json"` and pass the parsed object to
 * `createArtifactBundle`, which is the same boundary with a different transport.
 * The validator and accessors are unchanged either way.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARTIFACT_FILENAMES,
  type ArtifactBundle,
  type ArtifactName,
} from "./artifact-types.ts";
import { createArtifactBundle, type RawArtifacts } from "./artifacts.ts";

/** Absolute path to `web/src/data/generated`, resolved from this module. */
export function generatedDir(): string {
  const here = fileURLToPath(import.meta.url);
  // .../web/src/data/load-node.ts -> .../web/src/data
  const dataDir = here.slice(0, here.lastIndexOf("/"));
  return join(dataDir, "generated");
}

/** Read and JSON.parse one artifact without validating it. */
export function readRawArtifact(name: ArtifactName, dir: string = generatedDir()): unknown {
  const path = join(dir, ARTIFACT_FILENAMES[name]);
  const text = readFileSync(path, "utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${ARTIFACT_FILENAMES[name]} is not valid JSON: ${detail}`);
  }
}

export function readRawArtifacts(dir: string = generatedDir()): RawArtifacts {
  return {
    panel: readRawArtifact("panel", dir),
    countries: readRawArtifact("countries", dir),
    metrics: readRawArtifact("metrics", dir),
    claims: readRawArtifact("claims", dir),
    manifest: readRawArtifact("manifest", dir),
  };
}

/** Read, parse, validate and cross-check every artifact. Throws on violation. */
export function loadArtifactBundle(dir: string = generatedDir()): ArtifactBundle {
  return createArtifactBundle(readRawArtifacts(dir));
}
