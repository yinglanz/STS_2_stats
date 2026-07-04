/**
 * Browser stub for Node's `fs`. The shared analysis modules `import fs`, but the
 * functions we call in the browser never touch the filesystem. If anything does
 * call through, fail loudly rather than silently returning garbage.
 */
function unavailable(name: string): never {
  throw new Error(`fs.${name} is not available in the browser build`);
}

const fs = {
  existsSync: () => false,
  readFileSync: () => unavailable("readFileSync"),
  writeFileSync: () => unavailable("writeFileSync"),
  readdirSync: () => unavailable("readdirSync"),
  mkdirSync: () => unavailable("mkdirSync"),
};

export default fs;
export const existsSync = fs.existsSync;
export const readFileSync = fs.readFileSync;
export const writeFileSync = fs.writeFileSync;
export const readdirSync = fs.readdirSync;
export const mkdirSync = fs.mkdirSync;
