# Kits

A kit is a design system and the layouts that go with it, as data. deck checks every layout against the grammar below and drops what fails, with a reason, so no kit can do more than lay out a slide: no CSS, no addresses, no code. A person, an organisation or a brain can make one safely.

```yaml
kit:
  name: Martin's bakery
  tokens: { primary: '#c2410c', voice: elegant, radius: 4 }
  layouts:
    three-numbers:
      label: { en: Three numbers, fr: Trois chiffres }
      intent: Prove the title with three numbers.
      slots: [default, one, two, three]
      areas: default default default | one two three
      rows: auto 1fr
      align: center
      pptx: Comparison
```

## Where kits come from

Kits stack, the later over the earlier: deck's own (`STANDARD`), then what the host gives (`options.kit`: an organisation's, a person's, a project's, merged by the host), then the file's own `kit` in its headmatter. A host writes the kit a deck was drawn with into its file, so it looks the same wherever it goes.

## Tokens

Flat:

| Token | What it is |
|---|---|
| `paper`, `ink`, `primary` | Colours, as `#rgb` or `#rrggbb` |
| `muted`, `soft` | Optional: secondary words, a pale fill |
| `voice` | `calm`, `elegant`, `bold`, `friendly`: the device's own faces for headings and text |
| `fonts` | Optional: `{ heading: [...], body: [...] }`, face stacks, over the voice |
| `radius` | Corners, in pixels |
| `series` | Optional: a chart's colours, up to six (a template's accents), else the primary turned round the wheel |
| `logo` | Optional: a picture inside the kit, PNG, JPEG, GIF, WebP or SVG as a `data:` address of 512 KB at most, never an address to fetch |
| `logoAt` | The corner it sits in: `top-end` (the default), `top-start`, `bottom-end`, `bottom-start` |
| `dark` | Optional: `{ paper, ink, primary, muted, soft, logo }` for the dark scheme and dark paper, else worked out; merged with the kits' under it |

Or in the W3C's Design Tokens format (DTCG 2025.10): `color.light` and `color.dark` groups of `bg`, `surface`, `fg`, `muted`, `accent` (or flat colours), `font.sans`, `font.heading`, `font.body`; each `$value` a hex string or a colour object with its `hex`. `tokensFrom()` reads them.

Whatever the tokens, light and dark are each checked: words at 4.5:1 on their paper, a chart's marks at 3:1, each colour deepened or lightened at its hue until it reads.

A logo shows in its corner, small, or big where a layout says (`logo`: a cover, an introduction, the end); on dark paper (ink, a dark primary as a fill, the dark scheme's paper) its `dark` one shows, else the logo sits on a light plate. In PowerPoint it is on each layout's slide layout, so a slide added there has it too.

## Layouts

| Field | Grammar | Default |
|---|---|---|
| `slots` | Names (`a-z`, `0-9`, `-`), or a map of names to budgets; `title` there means the heading the default slot opens with | `[default]` |
| `areas` | Rows of slot names or `.`, split by `\|` or new lines, or a list of rows; every slot a rectangle | the slots in a row |
| `columns`, `rows` | One track a column or row: `auto`, `min-content`, `max-content`, `1fr`…`99fr`, `10%`… | `1fr` each |
| `align` | `start`, `center`, `end`: across | `start` |
| `justify` | `start`, `center`, `end`: down | `start` |
| `paper` | `paper`, `fill` (the primary), `ink`, `soft` | `paper` |
| `title` | `normal`, `large`, `huge` | `normal` |
| `logo` | `small`, `big`, `none`: how the kit's logo shows | `small`; `big` on `cover`, `intro`, `end`; `none` on `image`, `full`, `none` |
| `pptx` | Title Slide, Title and Content, Section Header, Two Content, Comparison, Title Only, Blank, Content with Caption, Picture with Caption | by its slots |
| `numbered` | `false` for no slide number | `true` |
| `label` | Words, or words by language: `{ en: …, fr: … }`; PowerPoint's layout is named so | the name |
| `intent`, `use_when`, `avoid_when` | Words for the brain choosing a layout | none |
| budgets | `required`, `max_words`, `max_chars`, `items: [min, max]`, `item_max_words`, `heading_max_words`, `kind` | none |

A catalog's `types` are read as `layouts`. A layout given as `false` turns one of deck's own off (`image: false`), but `default`. Budgets are kept with each layout for a linter and for the brain; deck does not check them yet.

## From a PowerPoint template, and out

`@codename/deck/template`, a module of its own that a host loads only when it needs it, reads a company's template (`.potx`, `.pptx`, or an Office theme, `.thmx`) into a kit: `kitFromTemplate(bytes, { name })` gives `{ kit, problems }`. Its theme's first light is `paper`, its first dark `ink`, its first accent `primary`, its second dark and light `muted` and `soft`, its six accents `series`, its heading and body faces `fonts`; the first picture on its slide master a browser draws is its `logo`, in the corner it sits in. Each slide layout is a layout of the kit by its name: PowerPoint's Title Slide, Title and Content, Section Header, Two Content, Title Only and Blank take the place of `cover`, `default`, `section`, `two-cols-header`, `center` and `none`; the others are added, slugged (`content-with-caption`). Its placeholders become a grid: the title, with the box under it across its columns, the `default` slot; the other boxes `left`, `middle` and `right` side by side, else `s1`, `s2`…, or the names deck gave them when deck wrote the file (`body-right`); the margins are deck's. Its paper is its background's colour by its role, its title `huge` for a title slide's; a layout whose placeholders make no grid is left out, with a reason.

`tokensToDtcg(tokens)` writes a kit's tokens in the W3C's Design Tokens format, which `tokensFrom()` reads back.

## deck's own layouts

| Layout | Slots | In PowerPoint |
|---|---|---|
| `cover`, `intro`, `end` | one | Title Slide |
| `default` | one | Title and Content |
| `section` | one | Section Header |
| `two-cols` | `default`, `right` | Two Content |
| `two-cols-header` | `default` across, `left`, `right`, `bottom` | Comparison |
| `three-cols` | `default` across, `left`, `middle`, `right` | Comparison |
| `center`, `statement`, `fact`, `quote` | one | Title Only |
| `image-left`, `image-right` | one, beside the slide's `image` | Picture with Caption |
| `image`, `full`, `none` | one | Blank |

## A slide that names none

As Pandoc's PowerPoint writer chooses: a slide with `middle` is `three-cols`, with `left` `two-cols-header`, with `right` `two-cols`; the first slide is `cover`; a heading alone is `section`; a number alone as its heading, a line or two under it, is `fact`; a quote alone, its author under it, is `quote`; else `default`. A layout the kit lacks falls back the same way.
