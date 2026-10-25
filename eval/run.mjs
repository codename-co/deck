// Asks each brain for each request with the draft skill, keeps the replies in replies/<model>/<id>.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
const skill = readFileSync(new URL('skill.md', import.meta.url), 'utf8')
const requests = JSON.parse(readFileSync(new URL('requests.json', import.meta.url), 'utf8'))
const models = process.argv.slice(2)
if (!models.length) { console.log('Usage: node eval/run.mjs <model> [<model>…], the models as LM Studio names them on localhost:1234'); process.exit(1) }
for (const model of models) {
  const dir = new URL(`replies/${model.replace(/[^\w.-]+/g, '_')}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  for (const request of requests) {
    const file = new URL(`${request.id}.md`, dir)
    if (existsSync(file)) continue
    const t0 = Date.now()
    const res = await fetch('http://localhost:1234/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      model, temperature: 0.4, max_tokens: 6000,
      messages: [{ role: 'system', content: `You are a helpful assistant. Today is 25 October 2026.\n\n<skill name="slides">\n${skill}\n</skill>` }, { role: 'user', content: request.text }],
    }) })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? JSON.stringify(data)
    writeFileSync(file, text)
    console.log(model, request.id, `${((Date.now() - t0) / 1000).toFixed(0)} s`, data.usage?.completion_tokens, 'tokens')
  }
}
