/**
 * Minimal browser stub for Node's `path`. Only the pieces the shared modules
 * reference at import time / in pure helpers are implemented. Paths are never
 * used for real I/O in the browser build.
 */
function join(...parts: string[]): string {
  return parts
    .filter((p) => p != null && p !== "")
    .join("/")
    .replace(/\/+/g, "/");
}
function basename(p: string, ext?: string): string {
  const base = p.split(/[\\/]/).pop() ?? "";
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}
function dirname(p: string): string {
  const parts = p.split(/[\\/]/);
  parts.pop();
  return parts.join("/") || ".";
}
function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i) : "";
}

const path = { join, basename, dirname, extname, sep: "/" };
export default path;
export { join, basename, dirname, extname };
