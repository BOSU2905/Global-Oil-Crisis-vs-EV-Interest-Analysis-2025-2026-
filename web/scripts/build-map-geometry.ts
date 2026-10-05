/**
 * Builds the geometry the market synthesis draws, in two files from one pinned source.
 *
 *   src/components/market/map-geometry.ts        the WORLD, for the locator (1:110m)
 *   src/components/market/spotlight-geometry.ts  five SILHOUETTES, for the stage (1:10m)
 *
 * WHY A SCRIPT AND NOT A DEPENDENCY
 * The map needs a world landmass and five country outlines, once each, at fixed sizes. A
 * runtime geography stack (d3-geo, topojson-client, world-atlas) would add three
 * dependencies to draw pictures that never change. So the data is read here, projected,
 * simplified and written out as plain SVG path strings that are committed — and this
 * script is kept so the result can be reproduced byte for byte, the same standard the
 * pipeline holds.
 *
 * SOURCE
 * Natural Earth (public domain) via the `world-atlas` 2.0.2 TopoJSON build (ISC): the
 * world from the 1:110m files, the silhouettes from the 1:10m file. One package, one
 * version. Not installed: fetch it into a scratch folder.
 *
 *   npm pack world-atlas@2.0.2 && tar -xzf world-atlas-2.0.2.tgz      (outside the repo)
 *   node scripts/build-map-geometry.ts <path-to-the-unpacked-package-folder>
 *   npx prettier --write src/components/market/map-geometry.ts src/components/market/spotlight-geometry.ts
 *
 * The SHA-256 of every input file is written into the output it fed, so a rebuild from a
 * different source is visible in the diff.
 *
 * WHY THE SILHOUETTES READ 1:10m
 * 1:110m draws a market a few hundred units across and omits Singapore; 1:50m gives
 * Singapore 9 vertices, a visible polygon at silhouette size; 1:10m gives it 40.
 *
 * PROJECTIONS, AND WHY BOTH ARE EQUAL-AREA
 * The world uses Equal Earth (Šavrič, Patterson & Jenny, 2018), an equal-AREA projection
 * chosen for honesty rather than looks: on that map no market is enlarged or shrunk
 * relative to another by the projection itself. Mercator would have inflated Norway
 * several times over. Each silhouette uses a Lambert azimuthal equal-area projection
 * centred on its own market — the same guarantee, with far less shape distortion than one
 * world projection gives a single country, because the market is near the centre.
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

// --- The silhouettes (the stage) ---------------------------------------------------------

/**
 * The frame every silhouette is drawn in, in viewBox units. The outline is fitted to
 * `FIT` inside it: `FIT.x` units of margin at each side so a wide outline does not touch
 * the edge of its tile, `FIT.y` above for a beacon standing on its outline, and
 * `FRAME.height - FIT.y - FIT.height` underneath for the plate's depth and shadow.
 */
const FRAME = { width: 480, height: 320 } as const;
const FIT = { x: 24, y: 32, width: 432, height: 256 } as const;
/** Douglas–Peucker tolerance, in FRAME units: under a pixel at the largest size shown. */
const TOLERANCE_SILHOUETTE = 0.6;
/** Rings smaller than this many square FRAME units are dropped: under ~3px at that size. */
const MIN_AREA_SILHOUETTE = 4;

interface Silhouette {
  /** ISO 3166-1 numeric id in the 1:10m set. */
  readonly iso: string;
  /** Centre of the market's own equal-area projection, in degrees. */
  readonly centre: Position;
  /** Which rings of the market's geometry are drawn. */
  readonly keep: (ring: readonly Position[]) => boolean;
}

/**
 * Which parts of each market are drawn, and why.
 *
 * The United States is the contiguous states and Norway its mainland: a silhouette has
 * to be one legible shape, and Alaska, Hawaii, Svalbard and Jan Mayen are thousands of
 * kilometres from the rest, so including them would shrink the outline the reader is
 * meant to see to a fraction of the frame. The page says so in a caption. Bouvet Island,
 * which the 1:10m data counts as Norway, is Antarctic and is dropped by the same rule.
 * Singapore, Malaysia and Indonesia are drawn whole.
 */
const SILHOUETTES = {
  indonesia: { iso: "360", centre: [118, -2.5], keep: () => true },
  us: {
    iso: "840",
    centre: [-96, 38],
    keep: (ring) => ring.every(([lon, lat]) => lon > -126 && lon < -66 && lat > 24 && lat < 50),
  },
  singapore: { iso: "702", centre: [103.82, 1.35], keep: () => true },
  malaysia: { iso: "458", centre: [109.7, 4.2], keep: () => true },
  norway: {
    iso: "578",
    centre: [16, 64.5],
    keep: (ring) => ring.every(([lon, lat]) => lon > 3 && lon < 32 && lat > 57 && lat < 72),
  },
} as const satisfies Record<keyof typeof ANCHORS, Silhouette>;

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

// ---------------------------------------------------------------------------
// Silhouettes: a local equal-area projection per market, fitted to one frame
// ---------------------------------------------------------------------------

/**
 * Lambert azimuthal equal-area projection centred on `[lon0, lat0]`, on the unit sphere.
 * Closed form (Snyder, *Map Projections — A Working Manual*, eq. 24-2). y points UP here;
 * `fitSilhouette` flips it. Equal-area, so the market's own parts keep their true area
 * ratios — Sumatra against Borneo, the peninsula against Sabah.
 */
function azimuthalEqualArea([lon0, lat0]: Position): (point: Position) => Position {
  const lambda0 = lon0 * RAD;
  const sinPhi0 = Math.sin(lat0 * RAD);
  const cosPhi0 = Math.cos(lat0 * RAD);
  return ([lon, lat]) => {
    const dLambda = lon * RAD - lambda0;
    const sinPhi = Math.sin(lat * RAD);
    const cosPhi = Math.cos(lat * RAD);
    const k = Math.sqrt(2 / (1 + sinPhi0 * sinPhi + cosPhi0 * cosPhi * Math.cos(dLambda)));
    return [
      k * cosPhi * Math.sin(dLambda),
      k * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(dLambda)),
    ];
  };
}

interface FittedSilhouette {
  readonly rings: Position[][];
  readonly anchor: Position;
  /** Tight bounding box of what is drawn, in FRAME units. */
  readonly width: number;
  readonly height: number;
}

function extentOf(rings: readonly (readonly Position[])[]): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Project a market's rings, scale them to fill `FIT` in ONE dimension (the other is
 * centred), drop the specks and simplify.
 *
 * EVERY MARKET FILLS THE SAME BOX. That is the point and also the limit: an outline's
 * drawn size says nothing about the market, so the page captions it. Fitting happens
 * twice because the specks are dropped by AREA IN FRAME UNITS, which needs a scale, and
 * the scale should come from what survives (otherwise one remote islet would set the box
 * and leave the main shape short of it).
 */
function fitSilhouette(
  rings: readonly (readonly Position[])[],
  centre: Position,
  anchor: Position,
): FittedSilhouette {
  const project = azimuthalEqualArea(centre);
  const projected = rings.map((ring) => ring.map(project));

  const fitTo = (
    source: readonly (readonly Position[])[],
  ): {
    readonly scale: number;
    readonly place: (point: Position) => Position;
  } => {
    const { minX, maxX, minY, maxY } = extentOf(source);
    const scale = Math.min(FIT.width / (maxX - minX), FIT.height / (maxY - minY));
    const left = FIT.x + (FIT.width - (maxX - minX) * scale) / 2;
    const top = FIT.y + (FIT.height - (maxY - minY) * scale) / 2;
    return { scale, place: ([x, y]) => [left + (x - minX) * scale, top + (maxY - y) * scale] };
  };

  const rough = fitTo(projected);
  const survivors = projected.filter(
    (ring) => area(ring.map(rough.place)) >= MIN_AREA_SILHOUETTE,
  );
  if (survivors.length === 0)
    throw new Error("a silhouette lost every ring to the noise floor");

  const fitted = fitTo(survivors);
  const drawn = survivors
    .map((ring) => simplify(ring.map(fitted.place), TOLERANCE_SILHOUETTE))
    .filter((ring) => ring.length >= 4);
  const box = extentOf(drawn);
  return {
    rings: drawn,
    anchor: fitted.place(project(anchor)),
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
  };
}

function buildSpotlight(dir: string): void {
  const countriesFile = join(dir, "countries-10m.json");
  const sha = createHash("sha256").update(readFileSync(countriesFile)).digest("hex");
  const countries = JSON.parse(readFileSync(countriesFile, "utf8")) as Topology;
  const arcs = decodeArcs(countries);
  const geometries = countries.objects["countries"]?.geometries ?? [];

  const plates: string[] = [];
  const anchors: string[] = [];
  const extents: string[] = [];
  for (const [market, spec] of Object.entries(SILHOUETTES) as [
    keyof typeof SILHOUETTES,
    Silhouette,
  ][]) {
    const geometry = geometries.find((entry) => entry.id === spec.iso);
    if (geometry === undefined)
      throw new Error(`no 1:10m geometry for ${market} (${spec.iso})`);
    const fitted = fitSilhouette(
      ringsOf(arcs, geometry).filter(spec.keep),
      spec.centre,
      ANCHORS[market],
    );
    plates.push(`  ${market}: "${pathOf(fitted.rings)}",`);
    anchors.push(`  ${market}: { x: ${fmt(fitted.anchor[0])}, y: ${fmt(fitted.anchor[1])} },`);
    extents.push(
      `  ${market}: { width: ${fmt(fitted.width)}, height: ${fmt(fitted.height)} },`,
    );
  }

  const output = `/**
 * GENERATED by \`scripts/build-map-geometry.ts\`. Do not edit by hand — rebuild it.
 *
 * Natural Earth 1:10m (public domain) via world-atlas 2.0.2 (ISC). Each outline is drawn
 * in a Lambert azimuthal equal-area projection centred on its own market, fitted to one
 * frame and simplified to ${String(TOLERANCE_SILHOUETTE)} units; parts under ${String(MIN_AREA_SILHOUETTE)} square units are dropped.
 *
 *   countries-10m.json  sha256 ${sha}
 *
 * Shapes only: no value from the analysis is encoded here. Every outline fills the SAME
 * frame in at least one dimension, so drawn size carries no information about a market —
 * the world locator (\`map-geometry.ts\`, equal-area) is where relative size can be read.
 * The United States is its contiguous states and Norway its mainland.
 */

import type { CountryId } from "../../data/artifact-types.ts";

export const SPOTLIGHT_VIEWBOX = { width: ${String(FRAME.width)}, height: ${String(FRAME.height)} } as const;

/** The box every outline is fitted to inside the frame: each fills it in at least one dimension. */
export const SPOTLIGHT_FIT = { x: ${String(FIT.x)}, y: ${String(FIT.y)}, width: ${String(FIT.width)}, height: ${String(FIT.height)} } as const;

/** Each market's outline, in the frame above, ready to stack into a raised plate. */
export const SPOTLIGHT_PLATES: Readonly<Record<CountryId, string>> = {
${plates.join("\n")}
};

/** Where each market's beacon stands on its own outline, in frame units. */
export const SPOTLIGHT_ANCHORS: Readonly<Record<CountryId, { readonly x: number; readonly y: number }>> = {
${anchors.join("\n")}
};

/** The bounding box of each outline, in frame units: what fills the frame, and how. */
export const SPOTLIGHT_EXTENTS: Readonly<Record<CountryId, { readonly width: number; readonly height: number }>> = {
${extents.join("\n")}
};
`;

  const target = join(
    import.meta.dirname,
    "..",
    "src",
    "components",
    "market",
    "spotlight-geometry.ts",
  );
  writeFileSync(target, output);
  console.log(`wrote ${target}: ${String(output.length)} bytes`);
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

  buildSpotlight(dir);
}

main();
