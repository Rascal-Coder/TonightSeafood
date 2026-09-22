"""把纯绿背景抠成透明 PNG。不侵蚀主体，轮廓外羽化 3 像素。"""
import collections
import pathlib
from PIL import Image

FEATHER_PX = 3
OUTSIDE_ALPHA = (0, 150, 70, 22)

ROOT = pathlib.Path(r"C:\TonightSeafood\assets\grok")
SRC = pathlib.Path(r"C:\Users\Admin\.cursor\projects\c-TonightSeafood\assets")

JOBS = [
    ("shrimp_star1.png", "shrimp_star1.png", True),
    ("crab_star1.png", "crab_star1.png", True),
    ("scallop_star1.png", "scallop_star1.png", True),
    ("fish_star1.png", "fish_star1.png", True),
    ("enemy_e001.png", "enemy_e001.png", True),
    ("enemy_e005.png", "enemy_e005.png", True),
    ("net.png", "net.png", True),
    ("bg_night_stall.png", "bg_night_stall.png", False),
]


def is_green(r, g, b):
    return g > 150 and g > r + 35 and g > b + 35 and r < 180


def despill(r, g, b):
    cap = max(r, b)
    if g > cap:
        g = cap
    return r, g, b


def cutout(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    background = bytearray(width * height)
    queue = collections.deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        index = y * width + x
        if background[index]:
            continue
        r, g, b, a = pixels[x, y]
        if not is_green(r, g, b):
            continue
        background[index] = 1
        pixels[x, y] = (0, 0, 0, 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    # 只在轮廓外补 3 像素半透明，主体像素保持不透明。
    fringe = {}
    grow = collections.deque()
    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                continue
            touched = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < width and 0 <= ny < height and background[ny * width + nx]:
                    touched = True
                    grow.append((nx, ny, x, y, 1))
            if touched:
                r, g, b, a = pixels[x, y]
                pixels[x, y] = (*despill(r, g, b), 255)
    while grow:
        x, y, sx, sy, dist = grow.popleft()
        index = y * width + x
        if not background[index] or index in fringe or dist > FEATHER_PX:
            continue
        fringe[index] = dist
        sr, sg, sb, sa = pixels[sx, sy]
        pixels[x, y] = (*despill(sr, sg, sb), OUTSIDE_ALPHA[dist])
        if dist == FEATHER_PX:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                grow.append((nx, ny, x, y, dist + 1))
    return image


def assert_png(path: pathlib.Path) -> None:
    header = path.read_bytes()[:8]
    if header != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"不是 PNG: {path}")


def main() -> None:
    for name, dest, keyed in JOBS:
        source = SRC / name
        if not source.exists():
            raise SystemExit(f"缺少原图 {source}")
        image = Image.open(source)
        if keyed:
            image = cutout(image)
            alpha = image.getchannel("A")
            if alpha.getextrema()[0] != 0:
                raise SystemExit(f"抠图后仍不透明: {name}")
        else:
            image = image.convert("RGBA")
        target = ROOT / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "PNG")
        assert_png(target)
        print(f"ok {target.name} {image.size} alpha={image.getchannel('A').getextrema()}")


if __name__ == "__main__":
    main()
