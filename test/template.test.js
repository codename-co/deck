// A kit from a PowerPoint template: a small one made here, as PowerPoint writes its parts, with its theme, a logo on its
// master, a title slide on its accent, a title and content whose body sits where the master's does, and two contents side
// by side; and a kit's tokens out as the W3C's design tokens, read back the same.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { kitFromTemplate, tokensToDtcg } from '../src/template.js'
import { tokensFrom } from '../src/kit.js'

const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
/** A placeholder, where it sits when given. @param {string} type @param {number[]} [box] @param {string} [name] */
const ph = (type, box, name = 'Placeholder') => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${name}"/><p:cNvSpPr/><p:nvPr><p:ph type="${type}"/></p:nvPr></p:nvSpPr><p:spPr>${box ? `<a:xfrm><a:off x="${box[0]}" y="${box[1]}"/><a:ext cx="${box[2]}" cy="${box[3]}"/></a:xfrm>` : ''}</p:spPr></p:sp>`
const rels = (/** @type {string[][]} */ list) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`
const layout = (/** @type {string} */ name, /** @type {string} */ shapes, background = '') => `<p:sldLayout ${P}><p:cSld name="${name}">${background}<p:spTree>${shapes}</p:spTree></p:cSld></p:sldLayout>`

async function template() {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${P}><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`)
  zip.file('ppt/theme/theme1.xml', `<a:theme ${P} name="Bakery"><a:themeElements><a:clrScheme name="Bakery"><a:dk1><a:sysClr val="windowText" lastClr="1F2A2E"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FBFAF7"/></a:lt1>`
    + '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="F3E9DC"/></a:lt2><a:accent1><a:srgbClr val="C2410C"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2></a:clrScheme>'
    + '<a:fontScheme name="Bakery"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>')
  zip.file('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${P}><p:cSld><p:spTree>${ph('title', [838200, 365125, 10515600, 1325563])}${ph('body', [838200, 1825625, 10515600, 4351338])}`
    + '<p:pic><p:nvPicPr><p:cNvPr id="9" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId9"/></p:blipFill><p:spPr><a:xfrm><a:off x="10900000" y="6100000"/><a:ext cx="900000" cy="500000"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sldMaster>')
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'],
    ['rId3', 'slideLayout', '../slideLayouts/slideLayout3.xml'], ['rId8', 'theme', '../theme/theme1.xml'], ['rId9', 'image', '../media/image1.png']]))
  zip.file('ppt/slideLayouts/slideLayout1.xml', layout('Title Slide', ph('ctrTitle', [1524000, 1122363, 9144000, 2387600]) + ph('subTitle', [1524000, 3602038, 9144000, 1655762]),
    '<p:bg><p:bgRef idx="1001"><a:schemeClr val="accent1"/></p:bgRef></p:bg>'))
  zip.file('ppt/slideLayouts/slideLayout2.xml', layout('Title and Content', ph('title') + ph('body') + ph('sldNum', [8610600, 6356350, 2743200, 365125])))
  zip.file('ppt/slideLayouts/slideLayout3.xml', layout('Side by Side', ph('title') + ph('body', [838200, 1825625, 5181600, 4351338]) + ph('body', [6172200, 1825625, 5181600, 4351338])))
  zip.file('ppt/media/image1.png', PNG)
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
}

test('a template\'s theme, logo and layouts become a kit, each layout a grid of its placeholders on its paper', async () => {
  const { kit, problems } = await kitFromTemplate(await template(), { name: 'Bakery' })
  assert.deepEqual(problems, [])
  assert.equal(kit.name, 'Bakery')
  const { logo, logoAt, ...tokens } = kit.tokens
  assert.deepEqual(tokens, { paper: '#fbfaf7', ink: '#1f2a2e', primary: '#c2410c', muted: '#44546a', soft: '#f3e9dc', series: ['#c2410c', '#0f766e'],
    fonts: { heading: ['Georgia', 'ui-sans-serif', 'system-ui', 'sans-serif'], body: ['Calibri', 'ui-sans-serif', 'system-ui', 'sans-serif'] } })
  assert.match(String(logo), /^data:image\/png;base64,iVBOR/)
  assert.equal(logoAt, 'bottom-end')
  // PowerPoint's own layouts take deck's place: the title slide its cover, on the accent, its title huge and its logo big.
  assert.deepEqual([kit.layouts.cover.label, kit.layouts.cover.paper, kit.layouts.cover.title, kit.layouts.cover.logo, kit.layouts.cover.pptx], ['Title Slide', 'fill', 'huge', 'big', 'Title Slide'])
  assert.deepEqual([kit.layouts.default.slots, kit.layouts.default.numbered], [['default'], true])
  // One of its own: a heading over two boxes side by side.
  const side = kit.layouts['side-by-side']
  assert.deepEqual([side.label, side.slots, side.areas, side.rows[0]], ['Side by Side', ['default', 'left', 'right'], [['default', 'default'], ['left', 'right']], 'auto'])
  // A kit's tokens out, and read back the same.
  assert.deepEqual(tokensFrom(tokensToDtcg({ ...tokens, dark: { paper: '#101010' } })), { paper: '#fbfaf7', ink: '#1f2a2e', primary: '#c2410c', muted: '#44546a', soft: '#f3e9dc', dark: { paper: '#101010' }, fonts: tokens.fonts })
})

test('a file that isn\'t a template says so', async () => {
  await assert.rejects(kitFromTemplate(new Uint8Array([1, 2, 3])), /not a PowerPoint file/)
  const zip = new JSZip()
  zip.file('word/document.xml', '<w:document/>')
  await assert.rejects(kitFromTemplate(new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))), /no slide master/)
})
