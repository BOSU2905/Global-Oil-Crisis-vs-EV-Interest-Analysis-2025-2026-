/**
 * TEMPORARY stand-in for `@types/node`.
 *
 * WHY THIS EXISTS
 * The build environment has no package-registry access, so `@types/node` cannot
 * be installed. Without it `tsc` cannot resolve `node:test`, `node:assert/strict`,
 * `node:fs` or `node:path`, and the test files would have to be excluded from type
 * checking entirely. Excluding them would mean the data-contract tests are never
 * type-checked, which is a worse outcome than a small hand-written declaration.
 *
 * WHAT THIS IS NOT
 * This is not a vendored copy of any package. It declares only the handful of
 * Node API surfaces this project actually calls, written from the documented
 * behaviour of those APIs. It contains no third-party source.
 *
 * PHASE 3B: delete this file and add `@types/node` to devDependencies. Nothing
 * else needs to change -- the declarations here are a strict subset of the real
 * types, so removing the file cannot break correct code.
 */

declare module "node:test" {
  type TestFn = () => void | Promise<void>;
  interface TestApi {
    (name: string, fn: TestFn): void;
    skip(name: string, fn?: TestFn): void;
  }
  export const test: TestApi;
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: TestFn): void;
}

declare module "node:assert/strict" {
  interface Assert {
    /** Assertion signature so `assert(x instanceof T)` narrows `x`, as it does at runtime. */
    (value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    /** Assertion signature: narrows the asserted expression for the caller. */
    ok(value: unknown, message?: string): asserts value;
    throws(fn: () => unknown, expected?: RegExp | ((error: unknown) => boolean)): void;
    doesNotThrow(fn: () => unknown): void;
    fail(message?: string): never;
    match(value: string, pattern: RegExp, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
}

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

/** Minimal `import.meta.url` support for ES modules. */
interface ImportMeta {
  readonly url: string;
}

/**
 * Structured cloning, available globally in Node 17+ and all modern browsers.
 * Declared here because it lives in `@types/node` / DOM lib, neither of which is
 * installable offline. Tests use it to deep-clone artifacts before mutating them.
 */
declare function structuredClone<T>(value: T): T;
