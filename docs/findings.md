# What phase 0 measured

Measured on 25 October 2026 on a Mac (M3 Max), in Playwright's Chromium and WebKit, Microsoft PowerPoint 16.114 and Keynote 14, with two local brains through LM Studio: Qwen 3.6 35B A3B Splash and Qwen 3.5 4B.

## Size

| File | gzipped |
|---|---|
| `dist/deck.js`, the whole file renderer, `marked` inside | 37.8 KB (113 KB as held in a file) |
| `dist/deck.mjs`, for a host with its own `marked` | 21.1 KB |
| `dist/deck.css` | 3.8 KB |
| A linked 11-slide `.deck.html` | 2.7 KB, not gzipped |

## Browsers

From disk (`file://`) in Chromium and WebKit: the first slide in 150 to 460 ms; no slide over its box; no error. Steps, the Morph between two slides sharing a heading, a change on a slide going back into the Markdown, a change in the Markdown drawn on the slide, the presenter's view, all slides at once, light and dark, Arabic right to left and Japanese. With scripts off, the Markdown as text. In a host page under `style-src 'self'` and `trusted-types 'none'`: no violation.

## PowerPoint

Made in the browser in 50 to 140 ms. PowerPoint opens every file without a repair: English light and dark, Arabic (bullets, the chart's axis and the table's columns mirrored), Japanese, and a deck with its own kit, whose layouts PowerPoint lists by their labels. Fixed during phase 0: text boxes as wide as their slot, titles anchored at their foot, centred layouts centred, Arabic upright.

Left: a list beside a picture touches the slide's edge; CSS decorations (a quote's mark, a section's rule) are not exported; faces a kit names should be ones Office has.

**Keynote is not a target.** It opens the files, says the format is invalid and drops the native charts; text, tables, layouts, diagrams and notes survive.

## Brains, with a draft skill

`eval/skill.md`, four requests (a support team's numbers, a children's park for a town council, training new staff, a school trip) in English, French, Arabic and Japanese.

- Neither brain used the asked-for ` ````deck ` fence (0 of 8). With `deckIn`'s repairs, 8 of 8 decks, 55 slides, none over its box, every chart parsed and drawn, no stray HTML, the language right every time.
- The 35B brain makes real decks (sections, a big number, two columns, a chart, a timeline). The 4B makes usable, weaker ones: charts nobody needed, squeezed under bullets.

## Brains, with no help

The same requests, asking for a title slide, a section, two columns, steps and notes on every slide, naming only the dialect, scored in that dialect's own syntax (`eval/dialects/`).

| Asked in | 35B, of 5 | 4B, of 5 | HTML and CSS invented (35B / 4B) |
|---|---|---|---|
| Slidev | 2.3 | 0.8 (one reply empty) | 34 / 9 |
| Marp | 1.8 | 1.8 (7 of 8 decks without `marp: true`) | 22 / 14 |
| Quarto (Pandoc) | 3.0 | 2.0 | 2 / 88 |

Brains blend dialects: Slidev decks with Pandoc's `::: notes`, Quarto decks with remark's `???`, Marp decks with reveal.js's fragments. Read liberally, all 23 replies that held anything became decks: 144 slides, no error.

## Diagrams

Fourteen samples (`test/diagrams/`), from a flowchart to a quadrant chart, two in Japanese and Arabic.

| Renderer | gzipped | Samples drawn |
|---|---|---|
| Mermaid 12.2 | 1,567 KB | 14 |
| @mermaid-js/tiny 12.2 | 744 KB | not run (no mind maps) |
| beautiful-mermaid 1.1 | 458 KB | not run (6 kinds) |
| **Pele 1.10** | 254 KB all, 130 KB twelve kinds, 17–52 KB a kind | 14, with no DOM, 0.14–1.3 ms each |
| @crafter/mermaid 0.0.3 | 31 KB | 9, and no licence in its packages |

Pele's drawings match Mermaid's or are clearer. It was first released on 17 October 2026: deck pins its version and draws the samples in its tests.
