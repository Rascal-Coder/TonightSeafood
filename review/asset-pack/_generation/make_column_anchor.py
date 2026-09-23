"""Place existing stills into a magenta sheet, one character per column, repeated down the rows."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    if box is None:
        raise SystemExit("still has no visible pixels")
    return box


def main() -> None:
    rows = int(sys.argv[1])
    cols = int(sys.argv[2])
    cell_w = int(sys.argv[3])
    cell_h = int(sys.argv[4])
    out = Path(sys.argv[5])
    stills = [Path(p) for p in sys.argv[6:]]
    if len(stills) != cols:
        raise SystemExit(f"need {cols} stills")
    canvas = Image.new("RGBA", (cols * cell_w, rows * cell_h), (255, 0, 255, 255))
    for col, path in enumerate(stills):
        image = Image.open(path).convert("RGBA")
        subject = image.crop(bbox(image))
        scale = min((cell_w * 0.70) / subject.width, (cell_h * 0.70) / subject.height)
        size = (max(1, int(subject.width * scale)), max(1, int(subject.height * scale)))
        subject = subject.resize(size, Image.Resampling.LANCZOS)
        paste_x = col * cell_w + (cell_w - subject.width) // 2
        paste_y_in_cell = (cell_h - subject.height) // 2
        for row in range(rows):
            canvas.alpha_composite(subject, (paste_x, row * cell_h + paste_y_in_cell))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out)
    print(out, canvas.size)


if __name__ == "__main__":
    main()
