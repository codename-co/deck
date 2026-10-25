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
| `dark` | Optional: `{ paper, ink, primary, muted, soft }` for the dark scheme, else worked out |

Or in the W3C's Design Tokens format (DTCG 2025.10): `color.light` and `color.dark` groups of `bg`, `surface`, `fg`, `muted`, `accent` (or flat colours), `font.sans`, `font.heading`, `font.body`; each `$value` a hex string or a colour object with its `hex`. `tokensFrom()` reads them.

Whatever the tokens, light and dark are each checked: words at 4.5:1 on their paper, a chart's marks at 3:1, each colour deepened or lightened at its hue until it reads.

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
| `pptx` | Title Slide, Title and Content, Section Header, Two Content, Comparison, Title Only, Blank, Content with Caption, Picture with Caption | by its slots |
| `numbered` | `false` for no slide number | `true` |
| `label` | Words, or words by language: `{ en: …, fr: … }`; PowerPoint's layout is named so | the name |
| `intent`, `use_when`, `avoid_when` | Words for the brain choosing a layout | none |
| budgets | `required`, `max_words`, `max_chars`, `items: [min, max]`, `item_max_words`, `heading_max_words`, `kind` | none |

A catalog's `types` are read as `layouts`. Budgets are kept with each layout for a linter and for the brain; deck 0.1 does not check them yet.

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
