// Each zero-shot reply, scored in its own dialect's real syntax on the five things asked for (a
// title slide, a section divider, two columns, a list revealed point by point, notes on every slide),
// with the HTML and CSS it invented counted apart: a renderer without HTML can't draw those.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { parseDeck } from '../../src/parse.js'
import { deckIn } from '../../src/repair.js'

const here = new URL('.', import.meta.url)
/** The first fenced block that looks like a deck, with three or four backticks, whatever its tag. @param {string} answer */
function blockOf(answer) {
  const text = answer.replace(/<think>[\s\S]*?<\/think>/g, '')
  const found = deckIn(text)
  if (found) return found.source
  const m = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1\s*$/m.exec(text)
  return m ? m[2] : text
}
const invented = (/** @type {string} */ s, /** @type {RegExp} */ allowed) => {
  const body = s.replace(/^```[\s\S]*?^```/gm, '')
  return (body.match(/<(?!!--)\/?[a-z][^>]*>/gi) ?? []).filter((tag) => !allowed.test(tag)).length + (body.match(/<style\b/gi) ?? []).length * 3
}

const SCORE = {
  slidev(/** @type {string} */ s) {
    const { slides } = parseDeck(s)
    const layout = (/** @type {any} */ x) => String(x.settings.layout ?? '')
    const asText = slides.some((x) => x.slots.some((slot) => /^\s*(layout|class|transition)\s*:/m.test(slot.text)))
    return {
      slides: slides.length,
      title: /cover|intro|center/.test(layout(slides[0] ?? { settings: {} })) || /^#\s/m.test(slides[0]?.slots[0]?.text ?? ''),
      section: slides.some((x) => layout(x) === 'section'),
      columns: slides.some((x) => /two-cols/.test(layout(x)) && x.slots.some((slot) => ['right', 'left'].includes(slot.name) && slot.text.trim())),
      steps: /<v-clicks?>|\bv-click\b/.test(s),
      // Strictly Slidev's: the last comment at the slide's end, not the other dialects' notes deck also reads.
      notes: slides.filter((x) => /<!--[\s\S]*?-->\s*$/.test(s.replace(/\r\n?/g, '\n').slice(x.start, x.end + 1))).length / Math.max(1, slides.length),
      invented: invented(s, /^<\/?(v-clicks?|v-after|br)\b/i) + (s.match(/\bclass\s*=/g) ?? []).length,
      foreign: (s.match(/^:{3,}|^\?\?\?$|^Notes?:|<!-- \.(element|slide)/gm) ?? []).length,
      broken: asText,
    }
  },
  marp(/** @type {string} */ s) {
    const front = /^---\s*\n([\s\S]*?)\n---/.exec(s)
    const body = front ? s.slice(front[0].length) : s
    const slides = body.split(/^---\s*$/m).filter((x) => x.trim())
    const directives = (/** @type {string} */ x) => [...x.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)].map((m) => m[1])
    const isDirective = (/** @type {string} */ d) => /^_?(class|paginate|header|footer|backgroundColor|color|backgroundImage|theme|style)\s*:/.test(d)
    return {
      slides: slides.length,
      title: /_?class\s*:\s*lead/.test(slides[0] ?? '') || /^#\s/m.test(slides[0] ?? ''),
      section: slides.slice(1).some((x) => /_class\s*:\s*(lead|invert)/.test(x) && x.replace(/<!--[\s\S]*?-->/g, '').trim().split('\n').filter((l) => l.trim()).length <= 2),
      columns: slides.some((x) => /!\[bg (left|right)/.test(x)),
      steps: slides.some((x) => /^\s*\*\s+\S/m.test(x.replace(/<!--[\s\S]*?-->/g, ''))),
      notes: slides.filter((x) => directives(x).some((d) => !isDirective(d))).length / Math.max(1, slides.length),
      invented: invented(s, /^$/) + (front && /^style:/m.test(front[1]) ? 3 : 0),
      foreign: (s.match(/^:{3,}|^\?\?\?$|^Notes?:|<!-- \.(element|slide|notes|column|section)|^layout:|^::\w+::/gm) ?? []).length,
      broken: !front || !/marp:\s*true/.test(front[1]),
    }
  },
  quarto(/** @type {string} */ s) {
    const front = /^---\s*\n([\s\S]*?)\n---/.exec(s)
    const body = (front ? s.slice(front[0].length) : s).replace(/^```[\s\S]*?^```/gm, '')
    const slides = body.split(/^(?=##?\s)|^---\s*$/m).filter((x) => x.trim())
    return {
      slides: slides.length,
      title: Boolean(front && /^title:/m.test(front[1])),
      section: /^#\s+\S/m.test(body),
      columns: /^:{3,}\s*\{?\s*\.columns/m.test(body) && /^:{3,}\s*\{\s*\.column\b/m.test(body),
      steps: /^:{3,}\s*\{?\s*\.?incremental/m.test(body) || Boolean(front && /incremental:\s*true/.test(front[1])) || /^\. \. \.\s*$/m.test(body),
      notes: slides.filter((x) => /^:{3,}\s*\{?\s*\.?notes/m.test(x)).length / Math.max(1, slides.filter((x) => /^##?\s/.test(x)).length),
      invented: invented(s, /^$/),
      foreign: (s.match(/^\?\?\?$|^Notes?:|<!-- \.(element|slide)|^layout:|^::\w+::|<v-clicks?>/gm) ?? []).length,
      broken: false,
    }
  },
}

const rows = []
for (const dialect of Object.keys(SCORE)) {
  const base = new URL(`replies/${dialect}/`, here)
  if (!existsSync(base)) continue
  for (const model of readdirSync(base)) for (const file of readdirSync(new URL(`${model}/`, base)).sort()) {
    const answer = readFileSync(new URL(`${model}/${file}`, base), 'utf8')
    if (!answer.trim()) { rows.push({ dialect, model, id: file.replace('.md', ''), empty: true, features: 0, slides: 0, notes: 0, invented: 0, foreign: 0, title: false, section: false, columns: false, steps: false, broken: false }); continue }
    const s = blockOf(answer)
    const r = SCORE[/** @type {'slidev'} */ (dialect)](s)
    const features = ['title', 'section', 'columns', 'steps'].filter((k) => r[/** @type {'title'} */ (k)]).length + (r.notes >= 0.8 ? 1 : 0)
    rows.push({ dialect, model, id: file.replace('.md', ''), features, ...r, notes: Math.round(r.notes * 100) / 100, tokens: Math.round(s.length / 4) })
  }
}
writeFileSync(new URL('results.json', here), JSON.stringify(rows, null, 1))
const groups = Object.groupBy(rows, (r) => `${r.dialect} · ${r.model}`)
for (const [key, list] of Object.entries(groups)) {
  const avg = (/** @type {(r: any) => number} */ f) => (list.reduce((a, r) => a + f(r), 0) / list.length)
  console.log(key.padEnd(42), `features ${avg((r) => r.features).toFixed(1)}/5`, `| title ${list.filter((r) => r.title).length} section ${list.filter((r) => r.section).length} columns ${list.filter((r) => r.columns).length} steps ${list.filter((r) => r.steps).length} notes≥80% ${list.filter((r) => r.notes >= 0.8).length} of ${list.length}`, `| invented HTML/CSS ${list.reduce((a, r) => a + r.invented, 0)}`, `| other dialects' syntax ${list.reduce((a, r) => a + r.foreign, 0)}`, `| broken ${list.filter((r) => r.broken).length}`, `| ~${Math.round(avg((r) => r.tokens))} tokens`)
}
