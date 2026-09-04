#!/usr/bin/env node
// Postbuild: rewrite `from "./foo.ts"` to `from "./foo.js"` in dist/*.js.
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (extname(p) === '.js') out.push(p);
  }
  return out;
}

let total = 0;
for (const f of walk('dist')) {
  const s = readFileSync(f, 'utf8');
  // Match any quoted relative path ending in .ts, with or without a
  // leading `import type` / `import { type ... } from` modifier.
  const out = s.replace(/(['"])(\.{1,2}\/[^'"]+?)\.ts\1/g, (_m, q, p) => `${q}${p}.js${q}`);
  if (out !== s) {
    writeFileSync(f, out);
    total++;
  }
}
console.log(`rewrote ${total} files`);
