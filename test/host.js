// A host page under with policies: no inline style, no inline script, Trusted Types with no policy at all.
import { createDeck } from '/dist/deck.bundle.mjs'
const violations = []
document.addEventListener('securitypolicyviolation', (event) => violations.push(`${event.violatedDirective} ${event.blockedURI}`))
const source = await (await fetch('/examples/en.md')).text()
let drawnCharts = 0
const view = createDeck(/** @type {HTMLElement} */ (document.getElementById('root')), {
  source, headings: 'aria',
  // The host's own drawers: here a stand-in that draws with the DOM alone.
  blocks: { echarts: (box) => { drawnCharts++; box.append(Object.assign(document.createElement('div'), { className: 'deck-chart', textContent: 'chart' })) }, mermaid: (box) => { box.append(Object.assign(document.createElement('div'), { className: 'deck-diagram', textContent: 'diagram' })) } },
  resolve: (src) => (src.startsWith('./') ? `/examples/${src.slice(2)}` : src),
})
for (let i = 0; i < view.deck.slides.length; i++) view.go(i, 9)
Object.assign(window, { hostResult: () => ({ violations, drawnCharts, slides: view.slides().length }) })
