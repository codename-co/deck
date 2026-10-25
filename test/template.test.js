// A kit from a PowerPoint template: a small one made here, as PowerPoint writes its parts, with its theme, a logo on its
// master, a title slide on its accent, a title and content whose body sits where the master's does, and two contents side
// by side that hide the master; another with art: the master's band, line, words and group, a layout's picture, its own
// shapes, a gradient behind it; and a kit's tokens out as the W3C's design tokens, read back the same.
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
const layout = (/** @type {string} */ name, /** @type {string} */ shapes, background = '', hide = false) => `<p:sldLayout ${P}${hide ? ' showMasterSp="0"' : ''}><p:cSld name="${name}">${background}<p:spTree>${shapes}</p:spTree></p:cSld></p:sldLayout>`

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
  zip.file('ppt/slideLayouts/slideLayout3.xml', layout('Side by Side', ph('title') + ph('body', [838200, 1825625, 5181600, 4351338]) + ph('body', [6172200, 1825625, 5181600, 4351338]), '', true))
  zip.file('ppt/media/image1.png', PNG)
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
}

test('a template\'s theme, logo and layouts become a kit, each layout a grid of its placeholders on its paper', async () => {
  const { kit, problems } = await kitFromTemplate(await template(), { name: 'Bakery' })
  assert.deepEqual(problems, [])
  assert.equal(kit.name, 'Bakery')
  const { logo, logoAt, dark, ...tokens } = kit.tokens
  assert.deepEqual(tokens, { paper: '#fbfaf7', ink: '#1f2a2e', primary: '#c2410c', muted: '#44546a', soft: '#f3e9dc', series: ['#c2410c', '#0f766e'],
    fonts: { heading: ['Georgia', 'ui-sans-serif', 'system-ui', 'sans-serif'], body: ['Calibri', 'ui-sans-serif', 'system-ui', 'sans-serif'] } })
  assert.match(String(logo), /^data:image\/png;base64,iVBOR/)
  assert.equal(logoAt, 'bottom-end')
  // Drawn with art, the template keeps its paper and words by night.
  assert.deepEqual(dark, { paper: '#fbfaf7', ink: '#1f2a2e', muted: '#44546a', soft: '#f3e9dc' })
  // PowerPoint's own layouts take deck's place: the title slide its cover, on the accent, its title huge; the master's logo
  // is in its art, one layer the title and content shares, where the template has it, so deck draws none of its own.
  assert.deepEqual([kit.layouts.cover.label, kit.layouts.cover.paper, kit.layouts.cover.title, kit.layouts.cover.logo, kit.layouts.cover.pptx], ['Title Slide', 'fill', 'huge', 'none', 'Title Slide'])
  assert.deepEqual([kit.layouts.default.slots, kit.layouts.default.numbered, kit.layouts.default.art], [['default'], true, kit.layouts.cover.art])
  assert.deepEqual(Object.keys(kit.pictures), kit.layouts.cover.art)
  assert.match(decodeURIComponent(kit.pictures[kit.layouts.cover.art?.[0] ?? '']), /<image x="0" y="0" width="70.87" height="39.37" preserveAspectRatio="none" xlink:href="data:image\/png;base64,iVBOR/)
  // With art, its words sit where the template has them, the margins its own.
  assert.deepEqual([kit.layouts.default.areas, kit.layouts.default.columns], [[['.', '.', '.'], ['.', 'default', '.'], ['.', '.', '.']], ['0.7fr', '8.6fr', '0.7fr']])
  // One of its own, hiding the master: a heading over two boxes side by side, the margins deck's.
  const side = kit.layouts['side-by-side']
  assert.deepEqual([side.label, side.slots, side.areas, side.rows[0], side.art, side.logo], ['Side by Side', ['default', 'left', 'right'], [['default', 'default'], ['left', 'right']], 'auto', undefined, 'small'])
  // A kit's tokens out, and read back the same.
  assert.deepEqual(tokensFrom(tokensToDtcg({ ...tokens, dark: { paper: '#101010' } })), { paper: '#fbfaf7', ink: '#1f2a2e', primary: '#c2410c', muted: '#44546a', soft: '#f3e9dc', dark: { paper: '#101010' }, fonts: tokens.fonts })
})

test('a file that isn\'t a template says so', async () => {
  await assert.rejects(kitFromTemplate(new Uint8Array([1, 2, 3])), /not a PowerPoint file/)
  const zip = new JSZip()
  zip.file('word/document.xml', '<w:document/>')
  await assert.rejects(kitFromTemplate(new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))), /no slide master/)
})

/** A template with art: a band, a line, words and a group on its master; a photo layout with its own shapes and light words; a gradient layout; one hiding the master. */
async function withArt() {
  const zip = new JSZip()
  const sp = (/** @type {string} */ name, /** @type {number[]} */ box, /** @type {string} */ geometry, /** @type {string} */ fill, extra = '') => `<p:sp><p:nvSpPr><p:cNvPr id="3" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${box[0]}" y="${box[1]}"/><a:ext cx="${box[2]}" cy="${box[3]}"/></a:xfrm>${geometry}${fill}</p:spPr>${extra}</p:sp>`
  const rect = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
  zip.file('ppt/presentation.xml', `<p:presentation ${P}><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`)
  zip.file('ppt/theme/theme1.xml', `<a:theme ${P} name="Plain"><a:themeElements><a:clrScheme name="Plain"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>`
    + '<a:dk2><a:srgbClr val="222244"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="1155CC"/></a:accent1><a:accent2><a:srgbClr val="EE7711"/></a:accent2></a:clrScheme>'
    + '<a:fontScheme name="Plain"><a:majorFont><a:latin typeface="Avenir Next"/></a:majorFont><a:minorFont><a:latin typeface="Avenir"/></a:minorFont></a:fontScheme>'
    + '<a:fmtScheme name="Plain"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>')
  zip.file('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${P}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${ph('title', [838200, 365125, 10515600, 1325563])}${ph('body', [838200, 1825625, 10515600, 4351338])}`
    + sp('Band', [0, 0, 12192000, 254000], rect, '<a:solidFill><a:schemeClr val="accent2"/></a:solidFill>')
    + '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="4" name="Rule"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm flipH="1"><a:off x="838200" y="1700000"/><a:ext cx="10515600" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom></p:spPr><p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef></p:style></p:cxnSp>'
    + sp('Tag', [10000000, 6300000, 1500000, 300000], '<a:prstGeom prst="round1Rect"><a:avLst/></a:prstGeom>', '<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill>',
      '<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="1000" b="1" cap="all"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr><a:t>Internal &amp; you</a:t></a:r></a:p></p:txBody>')
    + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Dots"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="100000" y="6300000"/><a:ext cx="600000" cy="300000"/><a:chOff x="0" y="0"/><a:chExt cx="1200000" cy="600000"/></a:xfrm></p:grpSpPr>`
    + sp('Dot', [0, 0, 600000, 600000], '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>', '<a:solidFill><a:srgbClr val="00AA00"><a:alpha val="50000"/></a:srgbClr></a:solidFill>')
    + sp('Odd', [600000, 0, 600000, 600000], '<a:prstGeom prst="cloud"><a:avLst/></a:prstGeom>', '<a:solidFill><a:srgbClr val="00AA00"/></a:solidFill>') + '</p:grpSp>'
    + '</p:spTree></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle></p:txStyles></p:sldMaster>')
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'],
    ['rId3', 'slideLayout', '../slideLayouts/slideLayout3.xml'], ['rId4', 'slideLayout', '../slideLayouts/slideLayout4.xml'], ['rId8', 'theme', '../theme/theme1.xml']]))
  // A photo, cropped, and a shape of the layout's own, under words set light.
  const photo = '<p:pic><p:nvPicPr><p:cNvPr id="6" name="Photo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"><a:alphaModFix amt="80000"/></a:blip><a:srcRect l="10000" r="10000"/><a:stretch/></p:blipFill>'
    + '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
  const wave = sp('Wave', [0, 5000000, 12192000, 1858000], '<a:custGeom><a:pathLst><a:path w="1000" h="100"><a:moveTo><a:pt x="0" y="50"/></a:moveTo><a:cubicBezTo><a:pt x="300" y="0"/><a:pt x="700" y="100"/><a:pt x="1000" y="50"/></a:cubicBezTo><a:lnTo><a:pt x="1000" y="100"/></a:lnTo><a:lnTo><a:pt x="0" y="100"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>',
    '<a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"/></a:gs><a:gs pos="100000"><a:schemeClr val="accent2"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>')
  const light = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="838200" y="2500000"/><a:ext cx="10515600" cy="1325563"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:defRPr></a:lvl1pPr></a:lstStyle><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>`
  zip.file('ppt/slideLayouts/slideLayout1.xml', layout('Photo', photo + light + wave))
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'], ['rId2', 'image', '../media/photo.png'], ['rId3', 'image', '../media/old.emf']]))
  zip.file('ppt/slideLayouts/slideLayout2.xml', layout('Title and Content', ph('title') + ph('body') + '<p:pic><p:nvPicPr><p:cNvPr id="7" name="Old"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId3"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:pic>'))
  zip.file('ppt/slideLayouts/_rels/slideLayout2.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'], ['rId3', 'image', '../media/old.emf']]))
  zip.file('ppt/slideLayouts/slideLayout3.xml', layout('Gradient', light, '<p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="000033"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"/></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill></p:bgPr></p:bg>'))
  zip.file('ppt/slideLayouts/slideLayout4.xml', layout('Blank', '', '', true))
  zip.file('ppt/media/photo.png', PNG)
  zip.file('ppt/media/old.emf', new Uint8Array([1, 0, 0, 0]))
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
}

test("a template's art is drawn behind each layout as it shows: the master's shapes, the layout's own, its background, as SVG layers kept once", async () => {
  const { kit, problems } = await kitFromTemplate(await withArt())
  assert.deepEqual(problems, ['the shape cloud is left out', 'the picture old.emf is in a format browsers don\'t draw'])
  const svg = (/** @type {string} */ name) => decodeURIComponent(kit.pictures[name].replace(/^data:image\/svg\+xml,/, ''))
  const photo = kit.layouts.photo, [master] = /** @type {string[]} */ (kit.layouts.default.art)
  // The master's layer, the same under each layout that shows it: its band in the second accent, its rule in the style's line,
  // its tag in a darker first accent with its words in capitals, centred, its group's dots scaled into place, see-through.
  assert.deepEqual(photo.art?.slice(1, 2), [master])
  const under = svg(master)
  assert.match(under, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink" width="960" height="540" viewBox="0 0 960 540" preserveAspectRatio="none">/)
  assert.match(under, /<path d="M0 0L960 0L960 20L0 20Z" fill="#ee7711"\/>/)
  assert.match(under, /<g transform="translate\(66 133\.86\) matrix\(-1 0 0 1 828 0\)"><path d="M0 0L828 0" fill="none" stroke="#1155cc" stroke-width="1"\/><\/g>/)
  assert.match(under, /fill="#0d4099"\/>/)
  assert.match(under, /<text x="59\.06" y="[\d.]+" font-size="10" font-family="Avenir, ui-sans-serif, system-ui, sans-serif" fill="#ffffff" text-anchor="middle" font-weight="bold" xml:space="preserve">INTERNAL &amp; YOU<\/text>/)
  assert.match(under, /<g transform="translate\(7\.87 496\.06\) scale\(0\.5 0\.5\) translate\(0 0\)">.*fill="#00aa00" fill-opacity="0\.5"/)
  // The photo layout's own: its light words read on ink, over its paper drawn first; its photo cropped, see-through; its wave filled with a gradient.
  assert.equal(photo.art?.length, 3)
  assert.match(svg(photo.art?.[0] ?? ''), /^<svg[^>]*><rect width="960" height="540" fill="#ffffff"\/><\/svg>$/)
  const own = svg(photo.art?.[2] ?? '')
  assert.match(own, /opacity="0\.8"><g><svg width="960" height="540"><image x="-120" y="0" width="1200" height="540" preserveAspectRatio="none" xlink:href="data:image\/png;base64,/)
  assert.match(own, /<linearGradient id="a1" x1="0" y1="0\.5" x2="1" y2="0\.5"><stop offset="0" stop-color="#1155cc"\/><stop offset="1" stop-color="#ee7711"\/><\/linearGradient><g transform="translate\(0 393\.7\)"><path d="M0 73\.15C288 0 672 146\.3 960 73\.15L960 146\.3L0 146\.3Z" fill="url\(#a1\)"\/>/)
  assert.deepEqual([photo.paper, photo.logo, photo.align], ['ink', 'small', 'center'])
  // A gradient behind, its light words on ink; a layout hiding the master has its own art only, here none.
  assert.match(svg(kit.layouts.gradient.art?.[0] ?? ''), /<radialGradient id="a1" cx="0\.5" cy="0\.5" r="0\.71">/)
  assert.equal(kit.layouts.gradient.paper, 'ink')
  assert.equal(kit.layouts.none.art, undefined)
  assert.equal(Object.keys(kit.pictures).length, 4)
})
