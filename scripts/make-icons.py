#!/usr/bin/env python3
"""Regenerate Kilo's app icons.

The mark is a weight plate: a violet disc with a rim line and a centre hole.
Every asset is that same shape at different sizes, so it's generated rather
than hand-drawn — stdlib only, no rasterizer to install.

Coverage is computed analytically (distance from centre, 1px feather) instead
of by supersampling; the shape is concentric circles, so that's exact enough
and ~10x faster.

Run: python3 scripts/make-icons.py
"""

import struct
import zlib
from pathlib import Path

BG = (0xF7, 0xF4, 0xFB)  # violet theme light background
PLATE = (0x7C, 0x3A, 0xED)  # violet theme tint

# Proportions relative to plate radius, from the chosen design.
RING_R, RING_W, HOLE_R = 0.7625, 0.075, 0.20

ROOT = Path(__file__).resolve().parent.parent


def coverage(d, r):
    """Antialiased coverage of a disc of radius r at distance d."""
    return min(1.0, max(0.0, 0.5 + (r - d)))


def ink(x, y, size, plate_r):
    """How much plate covers this pixel: disc, minus rim gap, minus hole."""
    c = size / 2.0
    d = ((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2) ** 0.5
    ring_r, ring_w, hole_r = plate_r * RING_R, plate_r * RING_W, plate_r * HOLE_R
    a = coverage(d, plate_r)
    a -= coverage(d, ring_r + ring_w / 2) - coverage(d, ring_r - ring_w / 2)
    a -= coverage(d, hole_r)
    return min(1.0, max(0.0, a))


def write_png(path, size, plate_r, *, background=None, color=PLATE):
    """background=None leaves the plate on transparent pixels."""
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type: none
        for x in range(size):
            a = 0.0 if plate_r == 0 else ink(x, y, size, plate_r)
            if background is None:
                rows += bytes((*color, round(a * 255)))
            else:
                rows += bytes(
                    (*(round(b + (f - b) * a) for b, f in zip(background, color)), 255)
                )
    raw = zlib.compress(bytes(rows), 9)

    def chunk(tag, body):
        return (
            struct.pack(">I", len(body))
            + tag
            + body
            + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", raw)
        + chunk(b"IEND", b"")
    )
    return path


img = ROOT / "assets" / "images"
fast = ROOT / "fastlane" / "metadata" / "android" / "en-US" / "images"

# Full-bleed square icons: the plate takes 75% of the canvas.
for path, size in [(img / "icon.png", 1024), (fast / "icon.png", 512), (img / "favicon.png", 48)]:
    write_png(path, size, size * 0.375, background=BG)

# Adaptive icon: the foreground must stay inside the ~66% safe zone, and the
# rim gap and hole are transparent so the background layer shows through.
write_png(img / "android-icon-foreground.png", 512, 150)
write_png(img / "android-icon-background.png", 512, 0, background=BG)

# Themed icons tint the monochrome layer, so only its alpha matters.
write_png(img / "android-icon-monochrome.png", 432, 130, color=(255, 255, 255))

# Splash: transparent, drawn at imageWidth from app.json.
write_png(img / "splash-icon.png", 512, 230)

print("wrote icons to assets/images/ and fastlane/.../images/")
