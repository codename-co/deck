// A deck file, `.deck.html`: a web page any browser opens, whose Markdown sits whole in one
// element, <script type="text/markdown" id="deck">, which no browser runs. Read and written here
// as text, never parsed as HTML, so a host can read a deck without running anything in it.
// The one escape: `<script` and `</script`, in any case, gain a backslash after their `<` (and
// one more for each already there), which reading takes away again: the HTML parser ends the
// element at `</script`, and a `<script` after `<!--` would keep it from ending. Pure.

import { VERSION } from './version.js'

export const OPEN = '<script type="text/markdown" id="deck">'
const CLOSE = '</script>'

/** @param {string} markdown */
export const escape = (markdown) => markdown.replace(/<(\\*)(\/?script)/gi, '<\\$1$2')
/** @param {string} text */
export const unescape = (text) => text.replace(/<\\(\\*)(\/?script)/gi, '<$1$2')

/** @param {string} text */
const attribute = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** @param {string} text */
const content = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Code held whole in the file: `</script`, `<script` and `<!--`, which only a string or a regular
 * expression of a bundle holds, written with `\x3C` for their `<`, which reads the same there.
 * @param {string} code
 */
export function inlineCode(code) {
  if (/\\<(!--|\/?script)/i.test(code)) throw new Error('This code cannot be held in a page as it is.')
  return code.replace(/<(!--|\/?script)/gi, '\\x3C$1')
}

/**
 * A deck's Markdown, from a file's text, or null when it holds none.
 * @param {string} html @returns {string | null}
 */
export function readDeckFile(html) {
  const at = html.indexOf(OPEN)
  if (at < 0) return null
  const from = at + OPEN.length
  const end = html.slice(from).search(/<\/script/i)
  if (end < 0) return null
  return unescape(html.slice(from, from + end).replace(/^\n/, '').replace(/\n$/, ''))
}

/** Where a linked file finds its renderer: this version of the package, on jsDelivr's npm mirror. @param {string} [version] */
export const rendererUrl = (version = VERSION) => `https://cdn.jsdelivr.net/npm/@codename/deck@${version}/dist/deck.js`

/**
 * A deck file around its Markdown: its title, language and direction in the page's head for
 * whatever reads it before the renderer does, then the Markdown, in the body (the head is never shown), readable as it is when no
 * renderer comes, then the renderer: linked by default, to this version's address, or held whole;
 * `base` tells it where to load the libraries a slide needs (a CDN's npm mirror, or a node_modules).
 * @param {string} markdown
 * @param {{ title?: string, lang?: string, dir?: string, renderer?: { src: string } | { code: string }, base?: string, generator?: string }} [options]
 */
export function writeDeckFile(markdown, { title = '', lang = 'en', dir = 'auto', renderer = { src: rendererUrl() }, base, generator = `deck ${VERSION}` } = {}) {
  const data = base ? ` data-base="${attribute(base)}"` : ''
  const script = 'src' in renderer ? `<script src="${attribute(renderer.src)}"${data}></script>` : `<script${data}>${inlineCode(renderer.code)}</script>`
  return /* html */ `<!doctype html>
<html lang="${attribute(lang)}" dir="${attribute(dir)}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${attribute(generator)}">
<title>${content(title)}</title>
<style>#deck{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font:1rem/1.6 ui-monospace,Menlo,Consolas,monospace;max-width:72ch;margin:2rem auto;padding:0 1rem}</style>
<body>
${OPEN}
${escape(markdown)}
${CLOSE}
${script}
</html>
`
}
