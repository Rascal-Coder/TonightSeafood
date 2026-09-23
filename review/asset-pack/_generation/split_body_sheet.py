"""Cut a big body sheet into one folder per column.

Rows are frames top to bottom. Columns are different actors left to right.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

SCRIPT = Path(r"C:\TonightSeafood\.agents\skills\generate2dsprite\scripts\generate2dsprite.py")
WORK = Path(r"C:\TonightSeafood\review\asset-pack\_generation\body-sheets")


def process(raw: Path, out: Path, rows: int, cols: int, action: str, cell: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            sys.executable,
            str(SCRIPT),
            "process",
            "--input",
            str(raw),
            "--target",
            "creature",
            "--mode",
            "idle",
            "--rows",
            str(rows),
            "--cols",
            str(cols),
            "--cell-size",
            str(cell),
            "--fit-scale",
            "0.78",
            "--align",
            "center",
            "--shared-scale",
            "--component-mode",
            "largest",
            "--threshold",
            "160",
            "--edge-threshold",
            "200",
            "--label-prefix",
            action,
            "--output-dir",
            str(out),
        ]
    )


def split(out: Path, pack: Path, names: list[str], rows: int, cols: int, action: str, cell: int) -> None:
    grid_cols = 2
    grid_rows = (rows + 1) // 2
    for col, name in enumerate(names):
        dest = pack / name
        dest.mkdir(parents=True, exist_ok=True)
        frames: list[Image.Image] = []
        for row in range(rows):
            src = out / f"{action}-{row * cols + col + 1}.png"
            if not src.exists():
                raise SystemExit(f"missing {src}")
            dst = dest / f"{action}-{row + 1}.png"
            shutil.copyfile(src, dst)
            frames.append(Image.open(dst).convert("RGBA"))
        sheet = Image.new("RGBA", (cell * grid_cols, cell * grid_rows), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            sheet.paste(frame, ((index % grid_cols) * cell, (index // grid_cols) * cell), frame)
        sheet.save(dest / "sheet-transparent.png")
        review = pack / f"{name}.png"
        shutil.copyfile(dest / "sheet-transparent.png", review)
        print("wrote", name)


def main() -> None:
    raw = Path(sys.argv[1])
    slug = sys.argv[2]
    cell = int(sys.argv[3])
    rows = int(sys.argv[4])
    cols = int(sys.argv[5])
    action = sys.argv[6]
    pack = Path(sys.argv[7])
    names = sys.argv[8:]
    if len(names) != cols:
        raise SystemExit(f"need {cols} names, got {len(names)}")
    out = WORK / slug
    process(raw, out, rows, cols, action, cell)
    split(out, pack, names, rows, cols, action, cell)


if __name__ == "__main__":
    main()
