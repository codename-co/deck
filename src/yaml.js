// Front matter as brains and Slidev write it: the YAML a deck needs, maps by their indent, lists
// in blocks and in brackets, quoted and plain scalars, block scalars (| and >) and comments. What
// it can't read stays a string, so a deck never fails to open over its settings. Pure.

/** @param {string} text @returns {Record<string, any>} */
export function parseYaml(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((raw) => ({ indent: raw.length - raw.trimStart().length, text: uncomment(raw).trimEnd(), raw }))
  const at = { i: 0 }
  const value = block(lines, at, 0)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/** A line without its comment: a # at its start or after a space, outside quotes. @param {string} line */
function uncomment(line) {
  let quote = ''
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) { if (c === quote) quote = '' }
    else if (c === '"' || c === "'") quote = c
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i)
  }
  return line
}

/** @param {{ indent: number, text: string, raw: string }[]} lines @param {{ i: number }} at @param {number} min @returns {any} */
function block(lines, at, min) {
  while (at.i < lines.length && !lines[at.i].text.trim()) at.i++
  if (at.i >= lines.length || lines[at.i].indent < min) return null
  const indent = lines[at.i].indent
  if (/^-(\s|$)/.test(lines[at.i].text.trim())) {
    const list = []
    while (at.i < lines.length) {
      const line = lines[at.i]
      if (!line.text.trim()) { at.i++; continue }
      if (line.indent !== indent || !/^-(\s|$)/.test(line.text.trim())) break
      const rest = line.text.trim().slice(1).trim()
      at.i++
      if (!rest) list.push(block(lines, at, indent + 1))
      else if (/^[^'"[{][^:]*:(\s|$)/.test(rest)) {
        // A map that starts on the dash's line: its first key there, the rest below it.
        const width = line.raw.indexOf(rest)
        lines.splice(at.i, 0, { indent: width, text: ' '.repeat(width) + rest, raw: ' '.repeat(width) + rest })
        list.push(block(lines, at, width))
      } else list.push(scalar(rest))
    }
    return list
  }
  /** @type {Record<string, any>} */
  const map = {}
  while (at.i < lines.length) {
    const line = lines[at.i]
    if (!line.text.trim()) { at.i++; continue }
    if (line.indent !== indent) break
    const entry = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:]+?)\s*:(?:\s+(.*))?$/.exec(line.text.trim())
    at.i++
    if (!entry) continue
    const key = String(scalar(entry[1]))
    const rest = (entry[2] ?? '').trim()
    if (rest === '|' || rest === '>' || /^[|>][+-]$/.test(rest)) map[key] = blockScalar(lines, at, indent, rest[0] === '>')
    else if (rest) map[key] = scalar(rest)
    else map[key] = block(lines, at, indent + 1)
  }
  return map
}

/** @param {{ indent: number, text: string, raw: string }[]} lines @param {{ i: number }} at @param {number} indent @param {boolean} folded */
function blockScalar(lines, at, indent, folded) {
  const taken = []
  while (at.i < lines.length && (!lines[at.i].raw.trim() || lines[at.i].indent > indent)) taken.push(lines[at.i++].raw)
  while (taken.length && !taken.at(-1)?.trim()) taken.pop()
  const width = Math.min(...taken.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length))
  const text = taken.map((line) => line.slice(width)).join('\n')
  return folded ? text.replace(/([^\n])\n(?=[^\n])/g, '$1 ') : text
}

/** A scalar, or a list or map in brackets. @param {string} text @returns {any} */
function scalar(text) {
  const t = text.trim()
  if (t.startsWith('[') || t.startsWith('{')) {
    const read = flow(t, { i: 0 })
    if (read !== undefined) return read
  }
  if (/^"(?:[^"\\]|\\.)*"$/.test(t)) {
    try { return JSON.parse(t) } catch { return t.slice(1, -1) }
  }
  if (/^'(?:[^']|'')*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'")
  if (/^(true|yes|on)$/i.test(t)) return true
  if (/^(false|no|off)$/i.test(t)) return false
  if (/^(null|~)$/i.test(t) || t === '') return null
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return Number(t)
  return t
}

/** A list or map in brackets, or undefined when it isn't one. @param {string} text @param {{ i: number }} at @returns {any} */
function flow(text, at) {
  const space = () => { while (/\s/.test(text[at.i] ?? '')) at.i++ }
  const item = () => {
    space()
    if (text[at.i] === '[' || text[at.i] === '{') return flow(text, at)
    const start = at.i
    if (text[at.i] === '"' || text[at.i] === "'") {
      const q = text[at.i++]
      while (at.i < text.length && !(text[at.i] === q && text[at.i - 1] !== '\\')) at.i++
      at.i++
    } else while (at.i < text.length && !/[,\]}]/.test(text[at.i]) && !(text[at.i] === ':' && /^[\s,\]}]?$/.test(text[at.i + 1] ?? ''))) at.i++
    return scalar(text.slice(start, at.i))
  }
  const open = text[at.i++]
  space()
  if (open === '[') {
    const list = []
    while (at.i < text.length && text[at.i] !== ']') {
      list.push(item())
      space()
      if (text[at.i] === ',') at.i++
      else if (text[at.i] !== ']') return undefined
      space()
    }
    at.i++
    return list
  }
  /** @type {Record<string, any>} */
  const map = {}
  while (at.i < text.length && text[at.i] !== '}') {
    const key = item()
    space()
    if (text[at.i] !== ':') return undefined
    at.i++
    map[String(key)] = item()
    space()
    if (text[at.i] === ',') at.i++
    else if (text[at.i] !== '}') return undefined
    space()
  }
  at.i++
  return map
}
