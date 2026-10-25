// Writes each example deck twice, as .deck.html files beside its Markdown: linked to ../dist/deck.js,
// and with the renderer held whole; both load the libraries a slide needs from ../node_modules/, so
// the tests run offline.
import { readFileSync, writeFileSync } from 'node:fs'
import { writeDeckFile, readDeckFile } from '../src/file.js'
import { parseDeck } from '../src/parse.js'
const code = readFileSync(new URL('../dist/deck.js', import.meta.url), 'utf8')
for (const name of ['en', 'ar', 'ja', 'tricky', 'kit', 'layouts']) {
  const markdown = readFileSync(new URL(`${name}.md`, import.meta.url), 'utf8')
  const { settings, slides } = parseDeck(markdown)
  const options = { title: String(settings.title ?? ''), lang: String(settings.lang ?? 'en'), dir: settings.lang === 'ar' ? 'rtl' : 'ltr', }
  for (const [suffix, renderer] of [['', { src: '../dist/deck.js' }], ['.embedded', { code }]]) {
    const file = writeDeckFile(markdown, { ...options, renderer, base: '../node_modules/' })
    if (readDeckFile(file) !== markdown.replace(/\r\n?/g, '\n')) throw new Error(`${name}${suffix} doesn't read back as written`)
    writeFileSync(new URL(`${name}${suffix}.deck.html`, import.meta.url), file)
    console.log(`${name}${suffix}.deck.html`, slides.length, 'slides', (file.length / 1024).toFixed(1), 'KB')
  }
}
