# Brains writing decks

Two evaluations, both against brains served by LM Studio on `localhost:1234`.

- **With the draft skill** (`skill.md`): `node eval/run.mjs <model>…` asks each model the four requests of `requests.json` (English, French, Arabic, Japanese) and keeps the replies in `replies/<model>/`. `node eval/check.mjs` finds each deck with `deckIn`'s repairs, draws it in Chromium and counts slides, layouts, slides over their box, charts and diagrams drawn, stray HTML and the language; `node eval/shots.mjs <model>:<id>…` photographs a deck's slides.
- **With no help** (`dialects/`): `node eval/dialects/run.mjs <models,comma-separated> slidev,marp,quarto` asks for the same decks naming only the dialect; `node eval/dialects/check.mjs` scores each in its own dialect's syntax (`results.json`), and `node eval/dialects/draw.mjs` draws them all with deck's lenient reading (`drawn.json`).

The replies of 25 October 2026 (Qwen 3.6 35B A3B Splash, Qwen 3.5 4B) are kept here; [docs/findings.md](../docs/findings.md) says what they showed.
