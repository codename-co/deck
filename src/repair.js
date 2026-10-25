// What brains get wrong when they write a deck, mended before it is read:
// - a deck fenced as ```markdown, ```md, ```slidev or with nothing, three backticks around a
//   chart's three (an inner block is closed by the next bare fence);
// - a slide's settings written after an empty line (`---`, ``, `layout: fact`, `---`), which
//   Slidev would show as words;
// - <v-clicks> and </v-clicks> without the empty lines that keep the list a list;
// - a chart fenced as ```json (an ECharts option: it has `series`);
// - a slot's marker with words after it on its line (`::right:: The canal`).
// Pure. Returns the deck and what was mended, so a test set can count both.

const OUTER = /^(`{3,}|~{3,})[ \t]*(deck|slidev|markdown|md)?[ \t]*$/
const KEYS = 'layout|transition|class|image|background|clicks|title|level|hide|zoom|theme|colorSchema|lang|themeConfig|paginate|alt'

/** The deck an answer holds, or null. @param {string} answer @returns {{ source: string, mended: string[] } | null} */
export function deckIn(answer) {
  const lines = answer.replace(/\r\n?/g, '\n').split('\n')
  /** @type {{ tag: string, body: string[] }[]} */
  const found = []
  for (let i = 0; i < lines.length; i++) {
    const open = OUTER.exec(lines[i])
    if (!open) continue
    const fence = open[1]
    let j = i + 1, inner = false
    const body = []
    for (; j < lines.length; j++) {
      const line = lines[j].trimEnd()
      if (!inner && line === fence) break
      if (/^(`{3,}|~{3,})\s*\S/.test(line) && !inner) inner = true
      else if (inner && /^(`{3,}|~{3,})\s*$/.test(line)) inner = false
      body.push(lines[j])
    }
    found.push({ tag: open[2] ?? '', body })
    i = j
  }
  const deck = found.find((f) => f.tag === 'deck') ?? found.find((f) => f.body.filter((l) => /^---\s*$/.test(l)).length >= 2)
  if (!deck) return null
  /** @type {string[]} */
  const mended = []
  if (deck.tag !== 'deck') mended.push(`fenced as ${deck.tag || 'nothing'}`)
  let source = deck.body.join('\n')
  const mend = (/** @type {string} */ what, /** @type {RegExp} */ pattern, /** @type {string} */ by) => {
    const next = source.replace(pattern, by)
    if (next !== source) { mended.push(what); source = next }
  }
  mend('settings after an empty line', new RegExp(`^---[ \\t]*\\n\\s*\\n((?:(?:${KEYS})\\s*:.*\\n(?:[ \\t]+\\S.*\\n)*)+)---[ \\t]*$`, 'gm'), '---\n$1---')
  mend('steps without empty lines', /^[ \t]*(<\/?v-clicks?>)[ \t]*$/gm, '\n$1\n')
  const charts = source.replace(/^```json[ \t]*\n([\s\S]*?)^```/gm, (block, body) => (body.includes('"series"') ? `\`\`\`echarts\n${body}\`\`\`` : block))
  if (charts !== source) { mended.push('a chart fenced as json'); source = charts }
  mend('words after a slot marker', /^::([\w-]+)::[ \t]+(\S.*)$/gm, '::$1::\n\n$2')
  return { source, mended }
}
