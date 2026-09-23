"""Split a processed 4x4 effect sheet into four 4-frame assets.

Rows are frames top to bottom. Columns are variants left to right.
Frame files from generate2dsprite are row-major: projectile-(row*4+col+1).
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

SCRIPT = Path(r"C:\TonightSeafood\.agents\skills\generate2dsprite\scripts\generate2dsprite.py")
PACK = Path(
    __import__("os").environ.get(
        "FX_PACK", r"C:\TonightSeafood\review\asset-pack\projectiles"
    )
)
WORK = Path(r"C:\TonightSeafood\review\asset-pack\_generation\fx-sheets")


def process(raw: Path, out: Path, cell: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            sys.executable,
            str(SCRIPT),
            "process",
            "--input",
            str(raw),
            "--target",
            "asset",
            "--mode",
            "projectile",
            "--rows",
            "4",
            "--cols",
            "4",
            "--cell-size",
            str(cell),
            "--fit-scale",
            "0.78",
            "--align",
            "center",
            "--shared-scale",
            "--component-mode",
            "all",
            "--threshold",
            "160",
            "--edge-threshold",
            "200",
            "--label-prefix",
            "projectile",
            "--output-dir",
            str(out),
        ]
    )


def split(out: Path, names: list[str], cell: int) -> None:
    for col, name in enumerate(names):
        dest = PACK / name
        dest.mkdir(parents=True, exist_ok=True)
        frames: list[Image.Image] = []
        for row in range(4):
            src = out / f"projectile-{row * 4 + col + 1}.png"
            if not src.exists():
                raise SystemExit(f"missing {src}")
            prefix = __import__("os").environ.get("FX_PREFIX", "projectile")
            dst = dest / f"{prefix}-{row + 1}.png"
            shutil.copyfile(src, dst)
            frames.append(Image.open(dst).convert("RGBA"))
        sheet = Image.new("RGBA", (cell * 2, cell * 2), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            sheet.paste(frame, ((index % 2) * cell, (index // 2) * cell), frame)
        sheet.save(dest / "sheet-transparent.png")
        shutil.copyfile(dest / "sheet-transparent.png", PACK / f"{name}.png")
        print("wrote", name)


def main() -> None:
    raw = Path(sys.argv[1])
    slug = sys.argv[2]
    cell = int(sys.argv[3])
    names = sys.argv[4:]
    if len(names) != 4:
        raise SystemExit("need 4 output names")
    out = WORK / slug
    process(raw, out, cell)
    split(out, names, cell)


if __name__ == "__main__":
    main()
