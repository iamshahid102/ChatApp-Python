"""Generate ChatApp PWA icons. Requires Pillow (dev-only script)."""

from pathlib import Path

from PIL import Image, ImageDraw

INK = (13, 13, 13, 255)
LIME = (199, 240, 50, 255)
SIZE = 1024

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "public" / "icons"


def bubble_layer() -> Image.Image:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((252, 270, 772, 670), radius=150, fill=LIME)
    draw.polygon([(300, 610), (300, 772), (472, 668)], fill=LIME)
    for x in (390, 512, 634):
        draw.ellipse((x - 30, 440, x + 30, 500), fill=INK)
    return layer


def render(size: int, *, maskable: bool = False, opaque: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if maskable or opaque:
        draw.rectangle((0, 0, SIZE, SIZE), fill=INK)
    else:
        draw.rounded_rectangle((0, 0, SIZE, SIZE), radius=230, fill=INK)

    bubble = bubble_layer()
    if maskable:
        bubble = bubble.resize((690, 690), Image.Resampling.LANCZOS)
        canvas.alpha_composite(bubble, (167, 167))
    else:
        canvas.alpha_composite(bubble)

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    render(192).save(ICONS / "icon-192.png")
    render(512).save(ICONS / "icon-512.png")
    render(512, maskable=True).save(ICONS / "maskable-512.png")
    render(180, opaque=True).save(ICONS / "apple-touch-icon.png")
    render(192).save(ROOT / "app" / "icon.png")
    render(180, opaque=True).save(ROOT / "app" / "apple-icon.png")
    print("Wrote icons to", ICONS)


if __name__ == "__main__":
    main()
