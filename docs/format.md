# The deck file

## The page

A deck is one HTML file, named `<name>.deck.html`. Any browser opens it; the renderer draws and presents it. A host reads its Markdown as text and never runs the page.

````html
<!doctype html>
<html lang="en" dir="ltr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="deck 0.1.0">
<title>A second oven</title>
<style>#deck{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font:1rem/1.6 ui-monospace,Menlo,Consolas,monospace;max-width:72ch;margin:2rem auto;padding:0 1rem}</style>
<body>
<script type="text/markdown" id="deck">
…the Markdown…
</script>
<script src="https://cdn.jsdelivr.net/npm/@codename/deck@0.1.0/dist/deck.js"></script>
</html>
````

- **The Markdown** sits whole in one element, `<script type="text/markdown" id="deck">`, which no browser runs. Nothing inside a script element is decoded, so `R&D` stays `R&D`.
- **One escape.** `<script` and `</script`, in any case, gain a backslash after their `<`, and one more for each already there; reading takes one away. The HTML parser would otherwise end the element at `</script`, and a `<script` after `<!--` would keep it from ending. `readDeckFile(writeDeckFile(md))` gives back `md` exactly.
- **In the body.** Without the explicit `<body>`, the parser would put the element in the head, which is never shown.
- **With scripts off,** the style above shows the Markdown as plain text in the body.
- **The renderer** is linked by default, to this version of the package on jsDelivr (`rendererUrl()`). A host may link another address, or hold the renderer whole (`{ code }`, about 113 KB), its `<!--`, `<script` and `</script` written with `\x3C`. A `data-base` attribute on the renderer's script says where the libraries a slide needs come from: a CDN's npm mirror (the default) or a `node_modules/` folder.
- **Pictures** the deck names by a host's own address are held inside the file as `data:` addresses when it leaves the host (`inlinePictures`). Pictures on the web stay links unless asked for. A page opened from disk can't read back a picture beside it, so a file meant to travel holds its pictures.
- **Title, language and direction** are in the head for whatever reads the page before the renderer does.

## The Markdown

Slidev's form, as `@slidev/parser` splits it, and the parts a deck for knowledge workers needs. Every deck written this way opens in Slidev too; ECharts blocks and kits need an addon there.

### Written and read

- **Slides** between lines holding only `---`. A `---` followed by a `key:` line opens that slide's settings, YAML up to the next `---` line; a ` ```yaml ` block at a slide's top does the same.
- **The first slide's settings** are the deck's too (its headmatter): `title`, `lang`, `dir`, `colorSchema` (`auto`, `light`, `dark`), `transition`, `theme`, `themeConfig`, `kit`.
- **A slide's settings:** `layout`, `transition` (`slide-left`, `slide-right`, `slide-up`, `fade`, `view-transition`; `a | b` for forward and back), `class` (`invert`, `text-center`), `image`, `background`, `alt`, `title`, `paginate`.
- **Slots:** `::name::` alone on a line starts the slot of that name; what comes before is `default`.
- **Notes:** the last HTML comment at a slide's end.
- **Steps:** `<v-clicks>` and `</v-clicks>` around a list, each on its own line with empty lines around; `<v-click>` around a block.
- **Code** in fences, with lines marked as Slidev marks them: ` ```ts {2,4-5} `.
- **Charts:** ` ```echarts ` holding an ECharts option as JSON, data only.
- **Diagrams:** ` ```mermaid ` holding Mermaid's language.
- **Markdown** as CommonMark and GFM have it: headings, lists, task lists, tables, quotes, emphasis, links, pictures. A picture alone on its line fills what its slot leaves, whole, whatever its own size.

### Added by deck

- ` ```echarts `, `lang` and `dir`.
- `kit`: tokens and layouts as data ([kits.md](kits.md)).
- A layout chosen from what a slide holds when it names none.
- A Morph between two slides that share a heading, a picture or a list item, with `transition: view-transition`.

### Also read, as brains write it

Brains blend dialects. These are read, never rewritten:

- Pandoc's `::: notes`, `:::: columns` holding `::: column`s (slots `left`, `right`, or `left`, `middle`, `right`; what follows them `bottom`), `::: incremental`.
- remark's `???` and reveal.js's `Note:` (what follows is the notes), reveal.js's `<aside class="notes">`.
- Slides at headings of the first two levels when a deck has no `---` at all, as Pandoc splits a document.
- Steps written as `<li v-click>`.
- A `---` followed by words, which Slidev would take for settings, as a new slide.
- Names brains give layouts: `title`, `two-columns`, `comparison`, `divider`, `thanks`…

`deckIn(answer)` finds a deck in a brain's answer and mends what brains get wrong most: a deck fenced as ` ```markdown ` or with nothing, a chart's fence inside three backticks, settings after an empty line, steps without their empty lines, a chart fenced as ` ```json `, words after a slot's marker.

### Left out

Vue components and expressions, UnoCSS classes, `<style>`, imported slides, Monaco, drawing. Other HTML gives up its words alone.
