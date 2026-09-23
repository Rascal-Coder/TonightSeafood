from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1] / "asset-pack"
EXPECTED = {
    "maps/bg_night_stall.png": (750, 1334),
    "maps/pond_water.png": (612, 160),
    "maps/pond_caustic.png": (256, 256),
    "maps/stall_pot.png": (256, 256),
    "characters/net/net.png": (256, 256),
    "characters/seafood/shrimp_star1.png": (256, 256),
    "characters/seafood/shrimp_star2.png": (256, 256),
    "characters/seafood/shrimp_star3.png": (256, 256),
    "characters/seafood/crab_star1.png": (256, 256),
    "characters/seafood/crab_star2.png": (256, 256),
    "characters/seafood/scallop_star1.png": (256, 256),
    "characters/seafood/fish_star1.png": (256, 256),
    "characters/enemies/enemy_e001.png": (256, 256),
    "characters/enemies/enemy_e002.png": (256, 256),
    "characters/enemies/enemy_e005.png": (256, 256),
    "characters/bosses/boss_s001.png": (512, 512),
    "projectiles/proj_pellet.png": (64, 64),
    "projectiles/proj_claw.png": (128, 128),
    "projectiles/proj_fan.png": (256, 128),
    "projectiles/proj_blade.png": (64, 256),
    "projectiles/proj_chili.png": (64, 64),
    "ui/ui_wood_bar.png": (750, 100),
    "ui/ui_tray.png": (700, 160),
    "ui/ui_card.png": (200, 280),
    "ui/ui_btn.png": (160, 64),
    "ui/ui_lantern.png": (128, 128),
    "ui/ui_coin.png": (128, 128),
    "fx/fx_bubble.png": (128, 128),
    "fx/fx_merge.png": (128, 128),
    "fx/fx_hit.png": (128, 128),
    "fx/fx_blob_shadow.png": (128, 128),
}


def checkerboard(width: int, height: int, cell: int = 12) -> Image.Image:
    image = Image.new("RGB", (width, height), "#f5efe4")
    draw = ImageDraw.Draw(image)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#d9e1e5")
    return image


def main() -> None:
    report = {"asset_count": len(EXPECTED), "passed": True, "assets": []}
    thumb_w, thumb_h, label_h = 180, 180, 42
    cols = 5
    rows = (len(EXPECTED) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + label_h)), "#14324A")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, (relative, expected_size) in enumerate(EXPECTED.items()):
        path = ROOT / relative
        item = {"path": relative, "expected_size": list(expected_size), "exists": path.exists()}
        if path.exists():
            with Image.open(path) as source:
                image = source.convert("RGBA")
                item["actual_size"] = list(image.size)
                item["mode"] = source.mode
                alpha = image.getchannel("A")
                amin, amax = alpha.getextrema()
                item["alpha_range"] = [amin, amax]
                item["has_transparency"] = amin < 255
                item["size_ok"] = image.size == expected_size
                item["nonempty"] = image.getbbox() is not None
                item["passed"] = item["size_ok"] and item["nonempty"]

                background = checkerboard(thumb_w, thumb_h)
                preview = image.copy()
                preview.thumbnail((thumb_w - 16, thumb_h - 16), Image.Resampling.LANCZOS)
                background.paste(preview, ((thumb_w - preview.width) // 2, (thumb_h - preview.height) // 2), preview)
        else:
            item["passed"] = False
            background = Image.new("RGB", (thumb_w, thumb_h), "#E23D3D")
        report["passed"] = report["passed"] and item["passed"]
        report["assets"].append(item)

        x = (index % cols) * thumb_w
        y = (index // cols) * (thumb_h + label_h)
        sheet.paste(background, (x, y))
        label = Path(relative).name
        draw.text((x + 6, y + thumb_h + 5), label, font=font, fill="#FFF6E8")
        draw.text((x + 6, y + thumb_h + 21), f"{expected_size[0]}x{expected_size[1]}", font=font, fill="#FFC15A")

    (ROOT / "qc-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    sheet.save(ROOT / "P0-review-sheet.png", optimize=True)


if __name__ == "__main__":
    main()
