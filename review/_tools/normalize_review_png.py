from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def contain_alpha(source: Image.Image, width: int, height: int, margin: float) -> Image.Image:
    image = source.convert("RGBA")
    bbox = image.getbbox()
    if bbox is None:
        return Image.new("RGBA", (width, height), (0, 0, 0, 0))
    subject = image.crop(bbox)
    max_w = max(1, round(width * margin))
    max_h = max(1, round(height * margin))
    scale = min(max_w / subject.width, max_h / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((width - size[0]) // 2, (height - size[1]) // 2))
    return canvas


def cover(source: Image.Image, width: int, height: int) -> Image.Image:
    image = source.convert("RGBA")
    scale = max(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(size, Image.Resampling.LANCZOS)
    left = (image.width - width) // 2
    top = (image.height - height) // 2
    return image.crop((left, top, left + width, top + height))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("width", type=int)
    parser.add_argument("height", type=int)
    parser.add_argument("--mode", choices=("contain-alpha", "cover"), default="contain-alpha")
    parser.add_argument("--margin", type=float, default=0.92)
    args = parser.parse_args()

    with Image.open(args.input) as image:
        result = cover(image, args.width, args.height) if args.mode == "cover" else contain_alpha(
            image, args.width, args.height, args.margin
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
