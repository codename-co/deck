// A deck's look: a design system's few tokens (paper, ink, primary, a voice for its type), from a
// named look, then the project's, then the deck's own `themeConfig`, as Slidev names a theme's
// settings. Light and dark are both worked out from them: each colour kept at its hue, deepened or
// lightened until it reads at AA on the paper it sits on (4.5:1 for words, 3:1 for a chart's
// marks), so a brain's or a person's colours can't make a slide unreadable. Pure.

/** @typedef {{ paper: string, ink: string, primary: string, voice: string, radius: number, muted?: string, soft?: string, series?: string[], dark?: Record<string, string>, fonts?: { heading: string[], body: string[] } }} Tokens */
/** @typedef {{ paper: string, ink: string, muted: string, line: string, primary: string, onPrimary: string, soft: string, series: string[] }} Scheme */

/** Looks a deck can name (`theme:`), each a handful of tokens. */
export const LOOKS = /** @type {Record<string, Tokens>} */ ({
  default: { paper: '#fffdf8', ink: '#1d1b16', primary: '#f7c531', voice: 'calm', radius: 10 },
  ocean: { paper: '#f6fafb', ink: '#0d2530', primary: '#0f766e', voice: 'calm', radius: 6 },
  ember: { paper: '#fff8f3', ink: '#2a160c', primary: '#d9480f', voice: 'bold', radius: 2 },
  ink: { paper: '#ffffff', ink: '#111111', primary: '#3b5bdb', voice: 'elegant', radius: 0 },
})

/** Type for each voice: the device's faces, so a deck needs nothing to download to look right. */
export const VOICES = /** @type {Record<string, { heading: string, body: string }>} */ ({
  calm: { heading: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif', body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif' },
  elegant: { heading: 'ui-serif, "Iowan Old Style", Georgia, "Noto Serif", serif', body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif' },
  bold: { heading: '"Avenir Next Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif', body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif' },
  friendly: { heading: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif', body: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' },
})

/**
 * The tokens a deck's settings give, over the project's look and a named one.
 * @param {Record<string, any>} settings @param {Partial<Tokens>} [project]
 * @returns {Tokens}
 */
export function tokensOf(settings, project = {}) {
  const named = LOOKS[String(settings.theme ?? '')] ?? LOOKS.default
  const own = typeof settings.themeConfig === 'object' && settings.themeConfig ? settings.themeConfig : {}
  /** @type {Tokens} */
  const tokens = { ...named, ...clean(project), ...clean(own) }
  if (!VOICES[tokens.voice]) tokens.voice = 'calm'
  return tokens
}

/** @param {Record<string, any>} given @returns {Partial<Tokens>} */
function clean(given) {
  /** @type {Partial<Tokens>} */
  const kept = {}
  for (const key of /** @type {const} */ (['paper', 'ink', 'primary', 'muted', 'soft'])) if (typeof given[key] === 'string' && rgbOf(given[key])) kept[key] = given[key]
  if (given.dark && typeof given.dark === 'object') kept.dark = Object.fromEntries(Object.entries(given.dark).filter(([, v]) => typeof v === 'string' && rgbOf(v)))
  if (given.fonts && Array.isArray(given.fonts.heading) && Array.isArray(given.fonts.body)) kept.fonts = { heading: given.fonts.heading.map(String), body: given.fonts.body.map(String) }
  if (typeof given.voice === 'string') kept.voice = given.voice
  if (typeof given.radius === 'number') kept.radius = given.radius
  if (Array.isArray(given.series) && given.series.length && given.series.every((/** @type {unknown} */ c) => typeof c === 'string' && rgbOf(c))) kept.series = given.series.slice(0, 6)
  return kept
}

/**
 * Light or dark, worked out from the tokens: dark swaps paper and ink and lifts the primary.
 * @param {Tokens} tokens @param {'light' | 'dark'} scheme @returns {Scheme}
 */
export function schemeOf(tokens, scheme) {
  // A see-through colour is seen over the paper it is on.
  const light = rgbOf(tokens.paper) ?? [255, 253, 248], dark = rgbOf(tokens.ink, light) ?? [29, 27, 22]
  // A kit's own dark colours where it gives them (a design system's dark mode), else worked out.
  const own = scheme === 'dark' ? tokens.dark ?? {} : {}
  const paper = round(rgbOf(own.paper ?? '', scheme === 'dark' ? [0, 0, 0] : [255, 255, 255]) ?? (scheme === 'dark' ? mix(dark, [0, 0, 0], 0.35) : light))
  const ink = round(rgbOf(own.ink ?? '', paper) ?? (scheme === 'dark' ? mix(light, [255, 255, 255], 0.2) : dark))
  const primary = rgbOf(own.primary ?? tokens.primary, paper) ?? [247, 197, 49]
  // The primary as a fill keeps its own colour; as words or marks it is made to read on the paper.
  const text = readable(primary, paper, 4.5)
  const onPrimary = contrast(ink, primary) >= contrast(paper, primary) ? ink : paper
  // A chart's colours: the kit's own (a template's accents), else the primary turned round the wheel; each made to read at 3:1.
  const given = (tokens.series ?? []).map((c) => rgbOf(c, paper)).filter((c) => c !== null)
  const series = [0, 1, 2, 3, 4, 5].map((n) => readable(/** @type {number[]} */ (given[n % (given.length || 1)] ?? rotate(primary, n * 57)), paper, 3))
  return {
    paper: css(paper), ink: css(ink), muted: css(readable(round(rgbOf(own.muted ?? (scheme === 'light' ? tokens.muted ?? '' : ''), paper) ?? mix(ink, paper, 0.38)), paper, 4.5)), line: css(mix(ink, paper, 0.82)),
    primary: css(text), onPrimary: css(onPrimary), soft: css(rgbOf(own.soft ?? (scheme === 'light' ? tokens.soft ?? '' : ''), paper) ?? mix(primary, paper, 0.78)), series: series.map(css),
  }
}

/**
 * A colour as deck reads one, as red, green and blue: `#rgb` or `#rrggbb` (`#rgba`, `#rrggbbaa` with an alpha), `rgb()` or
 * `rgba()` as CSS writes them, by commas or spaces, the alpha after a comma or a slash; one see-through is seen over `under`,
 * white unless said. @param {string} value @param {number[]} [under] @returns {[number, number, number] | null}
 */
export function rgbOf(value, under = [255, 255, 255]) {
  const text = String(value).trim(), digits = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(text)?.[1], css = /^rgba?\(([^)]*)\)$/i.exec(text)?.[1].split(/[\s,/]+/).filter(Boolean)
  const share = (/** @type {string} */ part, /** @type {number} */ whole) => (part.endsWith('%') ? (parseFloat(part) / 100) * whole : Number(part))
  const [r, g, b, a = 1] = digits ? (digits.length < 5 ? [...digits].map((c) => c + c) : /** @type {string[]} */ (digits.match(/../g))).map((h, i) => parseInt(h, 16) / (i > 2 ? 255 : 1))
    : css?.length === 3 || css?.length === 4 ? css.map((part, i) => share(part, i > 2 ? 1 : 255)) : []
  return r !== undefined && [r, g, b].every((c) => c >= 0 && c <= 255) && a >= 0 && a <= 1 ? round(mix(under, [r, g, b], a)) : null
}

/** @param {number[]} rgb */
export const css = (rgb) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`

/** A colour as it will be written: whole numbers, so that it reads at the ratio checked. @param {number[]} c */
const round = (c) => /** @type {[number, number, number]} */ (c.map((v) => Math.round(Math.max(0, Math.min(255, v)))))

/** @param {number[]} a @param {number[]} b @param {number} t */
const mix = (a, b, t) => /** @type {[number, number, number]} */ (a.map((c, i) => c + (b[i] - c) * t))

/** @param {number[]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG's contrast ratio. @param {number[]} a @param {number[]} b */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/**
 * The colour, its hue kept, deepened or lightened toward black or white until it reads at the
 * ratio on the paper. @param {number[]} colour @param {number[]} paper @param {number} ratio
 */
export function readable(colour, paper, ratio) {
  const toward = luminance(paper) > 0.18 ? [0, 0, 0] : [255, 255, 255]
  let t = 0, out = round(colour)
  while (contrast(out, paper) < ratio && t < 1) out = round(mix(colour, toward, (t = Math.min(1, t + 0.02))))
  return out
}

/** The colour turned round the colour wheel. @param {number[]} rgb @param {number} degrees */
function rotate(rgb, degrees) {
  const [r, g, b] = rgb.map((c) => c / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + degrees + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * Math.max(s, 0.55), x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2
  const [p, q, u] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [p + m, q + m, u + m].map((v) => v * 255)
}
