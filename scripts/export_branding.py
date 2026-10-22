"""Export browser assets from the approved logo without redrawing the artwork.

Run from the repository root: backend/.venv/bin/python scripts/export_branding.py
Requires the project's existing Pillow dependency. No database or network access.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend/branding/Logo_AFTR.png"
DESTINATION = ROOT / "frontend/public/branding"


def main() -> None:
    with Image.open(SOURCE) as source:
        original = source.convert("RGBA")
    # Ignore alpha=1 noise when finding the visible tile, keeping its antialiased edge.
    bounds = original.getchannel("A").point(lambda alpha: 255 if alpha > 1 else 0).getbbox()
    if bounds is None:
        raise ValueError("The approved logo has no visible content.")
    tile = original.crop(bounds)
    side = max(tile.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2))
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for size, filename in [
        (16, "favicon-16.png"),
        (32, "favicon-32.png"),
        (180, "apple-touch-icon.png"),
        (192, "icon-192.png"),
        (512, "icon-512.png"),
    ]:
        icon = square.resize((size, size), Image.Resampling.LANCZOS)
        if size == 180:
            # Apple touch icons need an opaque canvas; the rounded dark tile is retained.
            canvas = Image.new("RGBA", icon.size, "#f5f1e9")
            icon = Image.alpha_composite(canvas, icon).convert("RGB")
        icon.save(DESTINATION / filename, optimize=True)
    square.resize((32, 32), Image.Resampling.LANCZOS).save(
        DESTINATION / "favicon.ico",
        sizes=[(16, 16), (32, 32)],
        append_images=[square.resize((16, 16), Image.Resampling.LANCZOS)],
    )
    print(f"Exported five PNG sizes and favicon.ico from visible bounds {bounds}.")


if __name__ == "__main__":
    main()
