// Builds dist/: deck.js, the classic script a .deck.html file links to or holds, with marked inside;
// deck.mjs, the module for a host that brings its own marked (Jean, through its import map);
// deck.bundle.mjs, the same with marked inside, for a host without one; deck.css, the stylesheet.
import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
const common = { bundle: true, minify: true, legalComments: 'none', target: ['chrome111', 'safari16.4', 'firefox115'], loader: { '.css': 'text' }, charset: 'utf8', sourcemap: true }
await build({ ...common, entryPoints: ['src/standalone.js'], outfile: 'dist/deck.js', format: 'iife' })
await build({ ...common, entryPoints: ['src/index.js'], outfile: 'dist/deck.mjs', format: 'esm', external: ['marked'] })
await build({ ...common, entryPoints: ['src/index.js'], outfile: 'dist/deck.bundle.mjs', format: 'esm' })
copyFileSync('src/deck.css', 'dist/deck.css')
for (const file of ['dist/deck.js', 'dist/deck.mjs', 'dist/deck.bundle.mjs', 'dist/deck.css']) {
  const bytes = readFileSync(file)
  console.log(file.padEnd(22), `${(bytes.length / 1024).toFixed(1)} KB, ${(gzipSync(bytes, { level: 9 }).length / 1024).toFixed(1)} KB gzipped`)
}
// A file that holds the renderer whole must not end its script early: no </script in it.
if (/<\/script/i.test(readFileSync('dist/deck.js', 'utf8'))) throw new Error('dist/deck.js holds </script')
