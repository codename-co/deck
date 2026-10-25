// Pictures held inside a deck, for a file that leaves its host: each picture the deck names by an
// address of the host's own (a project's file, a relative path) becomes a data: address holding the
// picture itself, in the Markdown's images (`![words](place)`) and in a slide's settings (`image`,
// `background`, `backgroundImage`). Pictures on the web stay links unless asked for, and nothing else
// in the text moves. Pure but for the host's `read`, which gives a picture's bytes and type.

const SETTINGS = /^(\s*(?:image|background|backgroundImage)\s*:\s*)(['"]?)([^'"\n#]+?)\2(\s*(?:#.*)?)$/gm
const IMAGE = /(!\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)\n]+)((?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\))/g

/** @param {string} place */
const held = (place) => /^data:/i.test(place)
/** @param {string} place */
const web = (place) => /^(https?:)?\/\//i.test(place)

/** @param {Uint8Array} bytes */
function base64(bytes) {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

/**
 * The deck with its pictures inside it.
 * @param {string} source
 * @param {(place: string) => Promise<{ type: string, bytes: Uint8Array } | null>} read
 * @param {{ web?: boolean, largest?: number }} [options] `web`: pictures on the web too; `largest`: bytes past which a picture stays a link
 * @returns {Promise<{ source: string, inlined: string[], missing: string[], kept: string[] }>}
 */
export async function inlinePictures(source, read, { web: fromWeb = false, largest = 8 * 1024 * 1024 } = {}) {
  /** @type {Map<string, string | null>} */
  const found = new Map()
  const places = [...source.matchAll(IMAGE)].map((m) => m[2].replace(/^<|>$/g, '')).concat([...source.matchAll(SETTINGS)].map((m) => m[3].trim()))
  const inlined = [], missing = [], kept = []
  for (const place of new Set(places)) {
    if (held(place) || (web(place) && !fromWeb) || /^(#|mailto:|javascript:)/i.test(place)) continue
    const picture = await read(place).catch(() => null)
    if (!picture || !/^image\/(png|jpeg|gif|webp|avif|svg\+xml)$/.test(picture.type)) { missing.push(place); found.set(place, null); continue }
    if (picture.bytes.length > largest) { kept.push(place); found.set(place, null); continue }
    found.set(place, `data:${picture.type};base64,${base64(picture.bytes)}`)
    inlined.push(place)
  }
  const swap = (/** @type {string} */ place) => found.get(place) ?? null
  const out = source
    .replace(IMAGE, (all, open, place, close) => { const data = swap(place.replace(/^<|>$/g, '')); return data ? `${open}${data}${close}` : all })
    .replace(SETTINGS, (all, key, quote, place, rest) => { const data = swap(place.trim()); return data ? `${key}${quote}${data}${quote}${rest}` : all })
  return { source: out, inlined, missing, kept }
}
