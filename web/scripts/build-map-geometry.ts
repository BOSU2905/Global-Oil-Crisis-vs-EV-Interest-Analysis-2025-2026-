/**
 * Builds `src/components/market/map-geometry.ts` — the base map for the market synthesis.
 *
 * WHY A SCRIPT AND NOT A DEPENDENCY
 * The map needs five country outlines and a world landmass, once, at one size. A runtime
 * geography stack (d3-geo, topojson-client, world-atlas) would add three dependencies to
 * draw a picture that never changes. So the data is read here, projected, simplified and
 * written out as plain SVG path strings that are committed — and this script is kept so
 * the result can be reproduced byte for byte, the same standard the pipeline holds.
 *
 * SOURCE
 * Natural Earth 1:110m admin-0 countries and land (public domain), via the `world-atlas`
 * 2.0.2 TopoJSON build (ISC). Not installed: fetch it into a scratch folder.
 *
 *   npm pack world-atlas@2.0.2 && tar -xzf world-atlas-2.0.2.tgz      (outside the repo)
 *   node scripts/build-map-geometry.ts <path-to-the-unpacked-package-folder>
 *   npx prettier --write src/components/market/map-geometry.ts
 *
 * The SHA-256 of both input files is written into the output, so a rebuild from a
 * different source is visible in the diff.
 *
 * PROJECTION: EQUAL EARTH
 * An equal-AREA projection (Šavrič, Patterson & Jenny, 2018), chosen for honesty rather
 * than looks: on this map no market is enlarged or shrunk relative to another by the
 * projection itself. Mercator would have inflated Norway several times over.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Input shapes — only what this script reads
// ---------------------------------------------------------------------------

type Position = readonly [number, number];

interface PolygonGeometry {
  readonly type: "Polygon";
  readonly id?: string;
  readonly arcs: readonly (readonly number[])[];
}

interface MultiPolygonGeometry {
  readonly type: "MultiPolygon";
  readonly id?: string;
  readonly arcs: readonly (readonly (readonly number[])[])[];
}

type Geometry = PolygonGeometry | MultiPolygonGeometry;

interface Topology {
  readonly type: "Topology";
  readonly transform: {
    readonly scale: readonly [number, number];
    readonly translate: readonly [number, number];
  };
  readonly arcs: readonly (readonly (readonly [number, number])[])[];
  readonly objects: Readonly<Record<string, { readonly geometries: readonly Geometry[] }>>;
}

// ---------------------------------------------------------------------------
// Parameters — every design decision about the geometry is here
// ---------------------------------------------------------------------------

/** viewBox width. The height follows from the projection and the crop. */
const WIDTH = 1000;
/** Latitude crop: Antarctica is dropped; Greenland's north coast (83.6°) is kept. */
const NORTH = 84;
const SOUTH = -58;
/** Douglas–Peucker tolerance, in viewBox units (1 unit ≈ 0.9px at the desktop size). */
const TOLERANCE_LAND = 0.9;
const TOLERANCE_MARKET = 0.35;
/** Rings smaller than this many square units are dropped as noise. */
const MIN_AREA_LAND = 2.5;
const MIN_AREA_MARKET = 0.6;

/** ISO 3166-1 numeric ids. Singapore (702) is not in the 1:110m set — see the output. */
const MARKET_IDS = {
  indonesia: "360",
  us: "840",
  malaysia: "458",
  norway: "578",
} as const;

/**
 * Where each market's beacon stands, in degrees. A representative inland point, not a
 * centroid of anything measured: the geographic centre of the contiguous United States,
 * southern Norway, peninsular Malaysia, Singapore itself, and Sulawesi for Indonesia —
 * the last chosen so its beacon is clear of Malaysia's and Singapore's.
 */
const ANCHORS = {
  indonesia: [120.2, -2.0],
  us: [-98.6, 39.8],
  singapore: [103.82, 1.35],
  malaysia: [102.0, 4.0],
  norway: [9.5, 61.0],
} as const satisfies Record<string, Position>;

/**
 * Parts of a market's geometry that are left out, because at this scale they would read
 * as a different place: the Aleutian islands west of the antimeridian (drawn at the far
 * right, beside Kamchatka), and anything of Norway's south of 50°N.
 */
const KEEP_PART: Readonly<
  Record<keyof typeof MARKET_IDS, (ring: readonly Position[]) => boolean>
> = {
  indonesia: () => true,
  us: (ring) => ring.some(([lon]) => lon < 0),
  malaysia: () => true,
  norway: (ring) => ring.every(([, lat]) => lat > 50),
};

// ---------------------------------------------------------------------------
// TopoJSON decoding
// ---------------------------------------------------------------------------

function decodeArcs(topology: Topology): Position[][] {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as const;
    });
  });
}

function ringOf(arcs: readonly Position[][], indices: readonly number[]): Position[] {
  const out: Position[] = [];
  indices.forEach((index, i) => {
    const source = arcs[index < 0 ? ~index : index];
    if (source === undefined) throw new Error(`arc ${String(index)} is missing`);
    const arc = index < 0 ? [...source].reverse() : source;
    out.push(...(i === 0 ? arc : arc.slice(1)));
  });
  return out;
}

/** Every ring of a geometry, outer and holes alike, as lon/lat positions. */
function ringsOf(arcs: readonly Position[][], geometry: Geometry): Position[][] {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
  return polygons.flatMap((polygon) => polygon.map((ring) => ringOf(arcs, ring)));
}

// ---------------------------------------------------------------------------
// Equal Earth, in the form d3-geo publishes it
// ---------------------------------------------------------------------------

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const RAD = Math.PI / 180;

function equalEarth(lon: number, lat: number): Position {
  const lambda = lon * RAD;
  const theta = Math.asin(M * Math.sin(lat * RAD));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  return [
    (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
    theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  ];
}

const X_EXTENT = equalEarth(180, 0)[0];
const SCALE = WIDTH / (2 * X_EXTENT);
const TOP = equalEarth(0, NORTH)[1];
const BOTTOM = equalEarth(0, SOUTH)[1];
const HEIGHT = Math.round((TOP - BOTTOM) * SCALE * 10) / 10;

/** Degrees to viewBox units, y pointing down. */
function project([lon, lat]: Position): Position {
  const [x, y] = equalEarth(lon, lat);
  return [(x + X_EXTENT) * SCALE, (TOP - y) * SCALE];
}

// ---------------------------------------------------------------------------
// Simplification
// ---------------------------------------------------------------------------

function squaredSegmentDistance(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  const ex = p[0] - (a[0] + t * dx);
  const ey = p[1] - (a[1] + t * dy);
  return ex * ex + ey * ey;
}

/** Douglas–Peucker, iterative. Keeps both ends, so a closed ring stays closed. */
function simplify(points: readonly Position[], tolerance: number): Position[] {
  if (points.length <= 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  while (stack.length > 0) {
    const [first, last] = stack.pop() ?? [0, 0];
    const a = points[first];
    const b = points[last];
    if (a === undefined || b === undefined) continue;
    let index = -1;
    let furthest = limit;
    for (let i = first + 1; i < last; i += 1) {
      const p = points[i];
      if (p === undefined) continue;
      const distance = squaredSegmentDistance(p, a, b);
      if (distance > furthest) {
        furthest = distance;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function area(ring: readonly Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === undefined || b === undefined) continue;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const fmt = (value: number): string => String(Math.round(value * 10) / 10);

/** A number for path data: one decimal, no leading zero ("-0.5" → "-.5"). */
const num = (value: number): string => fmt(value).replace(/^(-?)0\./, "$1.");

/** Numbers joined the way path data allows: a minus sign is its own separator. */
const join2 = (values: readonly number[]): string =>
  values.reduce((out, value, i) => {
    const text = num(value);
    return i === 0 || text.startsWith("-") ? out + text : `${out} ${text}`;
  }, "");

/**
 * Rings as compact path data: an absolute move, then RELATIVE line segments. The deltas
 * are taken between already-rounded points, so rounding never accumulates into drift.
 */
function pathOf(rings: readonly (readonly Position[])[], close = true): string {
  return rings
    .map((ring) => {
      const rounded = ring.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      const first = rounded[0];
      if (first === undefined) return "";
      const deltas: number[] = [];
      for (let i = 1; i < rounded.length; i += 1) {
        const a = rounded[i - 1];
        const b = rounded[i];
        if (a === undefined || b === undefined) continue;
        deltas.push((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
      }
      return `M${join2(first)}l${join2(deltas)}${close ? "z" : ""}`;
    })
    .join("");
}

function projectRings(
  rings: readonly (readonly Position[])[],
  tolerance: number,
  minArea: number,
): Position[][] {
  return rings
    .filter((ring) => ring.some(([, lat]) => lat > SOUTH + 2))
    .map((ring) => simplify(ring.map(project), tolerance))
    .filter((ring) => ring.length >= 4 && area(ring) >= minArea);
}

/** A curve through sampled latitudes on one meridian. */
function meridian(lon: number, step: number): Position[] {
  const points: Position[] = [];
  for (let lat = SOUTH; lat <= NORTH; lat += step) points.push(project([lon, lat]));
  points.push(project([lon, NORTH]));
  return points;
}

function main(): void {
  const dir = process.argv[2];
  if (dir === undefined) {
    throw new Error("usage: node scripts/build-map-geometry.ts <world-atlas package folder>");
  }
  const countriesFile = join(dir, "countries-110m.json");
  const landFile = join(dir, "land-110m.json");
  const sha = (file: string): string =>
    createHash("sha256").update(readFileSync(file)).digest("hex");

  const countries = JSON.parse(readFileSync(countriesFile, "utf8")) as Topology;
  const land = JSON.parse(readFileSync(landFile, "utf8")) as Topology;

  const landArcs = decodeArcs(land);
  const landRings = (land.objects["land"]?.geometries ?? []).flatMap((geometry) =>
    ringsOf(landArcs, geometry),
  );
  const landPath = pathOf(projectRings(landRings, TOLERANCE_LAND, MIN_AREA_LAND));

  const countryArcs = decodeArcs(countries);
  const geometries = countries.objects["countries"]?.geometries ?? [];
  const plates: string[] = [];
  for (const [market, iso] of Object.entries(MARKET_IDS) as [
    keyof typeof MARKET_IDS,
    string,
  ][]) {
    const geometry = geometries.find((entry) => entry.id === iso);
    if (geometry === undefined) throw new Error(`no geometry for ${market} (${iso})`);
    const rings = ringsOf(countryArcs, geometry).filter(KEEP_PART[market]);
    plates.push(
      `  ${market}: "${pathOf(projectRings(rings, TOLERANCE_MARKET, MIN_AREA_MARKET))}",`,
    );
  }

  const anchors = Object.entries(ANCHORS).map(([market, position]) => {
    const [x, y] = project(position);
    return `  ${market}: { x: ${fmt(x)}, y: ${fmt(y)} },`;
  });

  // The projection's own outline over the crop, and a graticule every 30°. Parallels
  // are straight in Equal Earth, so each is one segment.
  const outline = [...meridian(-180, 2), ...meridian(180, 2).reverse()];
  const graticule: Position[][] = [];
  for (let lon = -150; lon <= 150; lon += 30) graticule.push(simplify(meridian(lon, 3), 0.3));
  for (const lat of [-30, 0, 30, 60])
    graticule.push([project([-180, lat]), project([180, lat])]);
  const graticulePath = pathOf(graticule, false);

  const output = `/**
 * GENERATED by \`scripts/build-map-geometry.ts\`. Do not edit by hand — rebuild it.
 *
 * Natural Earth 1:110m (public domain) via world-atlas 2.0.2 (ISC), Equal Earth projection,
 * simplified to ${String(TOLERANCE_MARKET)} units for markets and ${String(TOLERANCE_LAND)} for land.
 *
 *   countries-110m.json  sha256 ${sha(countriesFile)}
 *   land-110m.json       sha256 ${sha(landFile)}
 *
 * Geometry only: no value from the analysis is encoded here. Singapore (728 km²) is not
 * in the 1:110m set and would be a fraction of a pixel at this size anyway, so it has an
 * anchor and no outline; every market is identified by an equal-size beacon regardless.
 */

import type { CountryId } from "../../data/artifact-types.ts";

export const MAP_VIEWBOX = { width: ${String(WIDTH)}, height: ${fmt(HEIGHT)} } as const;

/** Every landmass, merged, with no borders. The quiet ground the markets stand on. */
export const LAND_PATH =
  "${landPath}";

/** The projection's outline over the crop, and a 30° graticule. */
export const OUTLINE_PATH =
  "${pathOf([outline])}";
export const GRATICULE_PATH =
  "${graticulePath}";

/** Each market's outline, where the scale can draw one. Singapore cannot. */
export const MARKET_PLATES: Readonly<Partial<Record<CountryId, string>>> = {
${plates.join("\n")}
};

/** Where each market's beacon stands, in viewBox units. */
export const MARKET_ANCHORS: Readonly<Record<CountryId, { readonly x: number; readonly y: number }>> = {
${anchors.join("\n")}
};
`;

  const target = join(
    import.meta.dirname,
    "..",
    "src",
    "components",
    "market",
    "map-geometry.ts",
  );
  writeFileSync(target, output);
  console.log(
    `wrote ${target}: ${String(output.length)} bytes, viewBox ${String(WIDTH)}×${fmt(HEIGHT)}`,
  );
}

main();
