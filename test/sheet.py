# Contact sheet: the given PNGs in a grid, each scaled to a width, with a small gap.
import sys
from PIL import Image
out, cols, width, *files = sys.argv[1:]
cols, width = int(cols), int(width)
images = [Image.open(f).convert('RGB') for f in files]
scaled = [im.resize((width, round(im.height * width / im.width))) for im in images]
h = max(im.height for im in scaled)
rows = (len(scaled) + cols - 1) // cols
sheet = Image.new('RGB', (cols * width + (cols + 1) * 12, rows * h + (rows + 1) * 12), (90, 90, 90))
for i, im in enumerate(scaled):
    sheet.paste(im, (12 + (i % cols) * (width + 12), 12 + (i // cols) * (h + 12)))
sheet.save(out)
