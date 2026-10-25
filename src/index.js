// deck for a host: draw a deck into an element, read and write its file. PowerPoint (./pptx.js) and the drawers a file uses
// alone (./blocks.js) are entries of their own, which a host loads only when it needs them.
export { createDeck, markdownOf } from './deck.js'
export { parseDeck } from './parse.js'
export { renderSlide } from './render.js'
export { STANDARD, CORNERS, mergeKits, layoutOf, logoOf, inferLayout, labelOf, tokensFrom } from './kit.js'
export { tokensOf, schemeOf, LOOKS, readable, contrast, rgbOf } from './look.js'
export { readDeckFile, writeDeckFile, rendererUrl, escape, unescape } from './file.js'
export { inlinePictures } from './pictures.js'
export { deckIn } from './repair.js'
export { VERSION } from './version.js'
