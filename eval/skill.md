# Slides

Make the deck by writing it in Slidev's Markdown, in one fenced code block tagged `deck`. It is drawn as slides while you write it, kept as a file the user can present, change and save as PowerPoint.

## The deck

1. Start with settings between two `---` lines: `title`, `lang` (the user's language code), `layout: cover` for the title slide, and `themeConfig: { primary: '#hex' }` only when the user asks for colours.
2. Separate slides with a line holding only `---` and an empty line after it. A slide's own settings go between two `---` lines in that place instead:

   ---
   layout: two-cols
   ---

3. One idea a slide: a `##` heading that says the point ("Tickets grew 45% since July", not "Tickets"), then at most five short bullets, a table of a few rows, a chart or a diagram.
4. Layouts, by the slide's job:
   - `cover`: the first slide, `#` title and a line under it;
   - `section`: a part's title, `#` heading alone;
   - `default`: a heading and its points;
   - `two-cols`: two things side by side; what goes right comes after a line `::right::`;
   - `two-cols-header`: a heading across, then `::left::` and `::right::`;
   - `fact`: one big number as `#`, and a line saying what it means;
   - `statement`: one sentence that matters;
   - `quote`: a `>` quote and who said it;
   - `end`: the last slide.
5. To show a list one point at a click, put it between `<v-clicks>` and `</v-clicks>`, each on its own line with empty lines around.
6. A chart is an ECharts option as strict JSON in a block tagged `echarts` inside the slide: titles and labels in the user's language, `"tooltip"` and `"legend"` when there is more than one series, no colours. Get the numbers from the user; never make them up.
7. A process or a plan is a Mermaid `flowchart LR` in a block tagged `mermaid`, a few short boxes.
8. What the speaker should say goes in an HTML comment at the slide's end: `<!-- … -->`.
9. Nothing else: no HTML but `<v-clicks>`, no `class`, no `<style>`, no pictures from the web.
10. Fence the deck with four backticks, so a chart's or a diagram's three don't end it. Write it in the user's language. After it, say in a sentence what it covers.
