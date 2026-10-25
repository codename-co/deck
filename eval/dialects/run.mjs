// Zero-shot: each brain asked for each request in each dialect, naming the dialect only, no syntax given.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
const requests = JSON.parse(readFileSync(new URL('../requests.json', import.meta.url), 'utf8'))
const ASK = {
  en: 'Include a title slide, a section divider slide, one slide with two columns side by side, one list revealed one point at a time, and speaker notes on every slide.',
  fr: 'Inclus une diapositive de titre, une diapositive de section, une diapositive à deux colonnes côte à côte, une liste qui apparaît point par point, et des notes pour l’orateur sur chaque diapositive.',
  ar: 'أضف شريحة عنوان، وشريحة فاصلة لقسم، وشريحة بعمودين متجاورين، وقائمة تظهر نقطة بعد نقطة، وملاحظات للمتحدث في كل شريحة.',
  ja: 'タイトルスライド、セクション区切りのスライド、2段組のスライドを1枚、1項目ずつ表示されるリストを1つ、そしてすべてのスライドに発表者ノートを入れてください。',
}
const DIALECTS = { slidev: "Slidev's Markdown", marp: "Marp's Markdown", quarto: "Quarto's Markdown for reveal.js slides (Pandoc's Markdown)" }
const [models, dialects] = [process.argv[2].split(','), process.argv[3].split(',')]
for (const model of models) for (const dialect of dialects) {
  const dir = new URL(`replies/${dialect}/${model.replace(/[^\w.-]+/g, '_')}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  for (const request of requests) {
    const file = new URL(`${request.id}.md`, dir)
    if (existsSync(file)) continue
    const t0 = Date.now()
    const res = await fetch('http://localhost:1234/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      model, temperature: 0.4, max_tokens: 7000,
      messages: [{ role: 'system', content: `You are a helpful assistant who makes slide decks. Write the deck in ${DIALECTS[dialect]}, in one fenced code block, in the user's language.` }, { role: 'user', content: `${request.text}\n\n${ASK[request.id]}` }],
    }) })
    const data = await res.json()
    writeFileSync(file, data.choices?.[0]?.message?.content ?? JSON.stringify(data))
    console.log(dialect, model, request.id, `${((Date.now() - t0) / 1000).toFixed(0)} s`, data.usage?.completion_tokens)
  }
}
