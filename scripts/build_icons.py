"""從 app-icon.png 產生各平台需要的實心方形圖示。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "app-icon.png").convert("RGBA")
art = source.crop(source.getbbox())


def vertical_gradient(size, top, bottom):
    canvas = Image.new("RGBA", size)
    pixels = canvas.load()
    width, height = size
    for y in range(height):
        t = y / max(height - 1, 1)
        colour = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(width):
            pixels[x, y] = colour
    return canvas


# 原圖的四角是透明圓角，直接取樣可能得到 RGBA 的 (0, 0, 0, 0)；
# 以專案既定的白到極淺水藍作為平台底色，避免 iOS 把透明區填成黑色。
top = (250, 252, 253)
bottom = (224, 242, 254)
side = max(art.size)
square = vertical_gradient((side, side), top, bottom)
square.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))
square = square.convert("RGB")

for name, size in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
    square.resize((size, size), Image.LANCZOS).save(ROOT / name, optimize=True)

maskable = vertical_gradient((512, 512), top, bottom)
inner = art.resize((410, round(410 * art.height / art.width)), Image.LANCZOS)
maskable.alpha_composite(inner, ((512 - inner.width) // 2, (512 - inner.height) // 2))
maskable.convert("RGB").save(ROOT / "icon-maskable-512.png", optimize=True)
source.resize((144, 144), Image.LANCZOS).save(ROOT / "app-icon-144.png", optimize=True)
print("done")
