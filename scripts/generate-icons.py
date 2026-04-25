#!/usr/bin/env python3
"""
Generate app icon, splash, and Android adaptive icon for rcao-quiz.

Mark: a stack of three rounded "cards" with a subtle perspective tilt,
evoking the reels-style feed. Front card carries a small accent dot
for "answer chosen". On the brand navy gradient.

Run from the repo root:

    python3 scripts/generate-icons.py

Outputs to apps/mobile/assets/.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Brand palette
INK_900 = (11, 18, 32)        # #0b1220 -- darkest
INK_800 = (33, 41, 60)        # #21293c
INK_700 = (51, 65, 90)        # #33415a
INK_300 = (163, 177, 200)     # #a3b1c8 -- soft text/foreground
WHITE   = (245, 247, 251)     # #f5f7fb
ACCENT  = (77, 208, 225)      # #4dd0e1 -- soft cyan for a small spark

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "apps" / "mobile" / "assets"


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_bg(size: int) -> Image.Image:
    """Vignette gradient: brighter near upper-left, darker bottom-right."""
    img = Image.new("RGB", (size, size), INK_900)
    px = img.load()
    cx, cy = size * 0.35, size * 0.30
    max_r = math.hypot(size, size) * 0.85
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - cx, y - cy) / max_r)
            px[x, y] = lerp(INK_700, INK_900, t)
    return img


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=0):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def card_stack(size: int, padding: float = 0.18) -> Image.Image:
    """Three stacked cards with subtle vertical offset, increasing opacity."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Layout
    inner = int(size * (1 - 2 * padding))
    cx = size // 2
    base_w = inner
    base_h = int(inner * 0.52)
    radius = int(base_h * 0.22)

    # Three layers: back (offset up + smaller + lower opacity), middle, front
    layers = [
        # (vertical offset from center, scale, alpha, fill)
        (-int(base_h * 0.55), 0.86, 90,  INK_300),
        (-int(base_h * 0.05), 0.93, 165, INK_300),
        (+int(base_h * 0.45), 1.00, 255, WHITE),
    ]

    for dy, scale, alpha, base_fill in layers:
        w = int(base_w * scale)
        h = int(base_h * scale)
        x0 = cx - w // 2
        y0 = (size - h) // 2 + dy
        x1 = x0 + w
        y1 = y0 + h
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        fill = (*base_fill, alpha)
        rounded_rect(ld, (x0, y0, x1, y1), radius, fill=fill)
        canvas = Image.alpha_composite(canvas, layer)

    # Accent dot on the front card (suggests "answer chosen")
    front_w = int(base_w * 1.00)
    front_h = int(base_h * 1.00)
    fx0 = cx - front_w // 2
    fy0 = (size - front_h) // 2 + int(base_h * 0.45)
    dot_r = int(front_h * 0.12)
    dot_cx = fx0 + int(front_w * 0.18)
    dot_cy = fy0 + front_h // 2
    accent_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ad = ImageDraw.Draw(accent_layer)
    ad.ellipse(
        (dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r),
        fill=(*ACCENT, 255),
    )
    canvas = Image.alpha_composite(canvas, accent_layer)

    # Two thin lines beside the dot, evoking text content
    line_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ll = ImageDraw.Draw(line_layer)
    line_x = dot_cx + dot_r * 2
    line_w = int(front_w * 0.50)
    line_h = int(front_h * 0.10)
    line_radius = line_h // 2
    ll.rounded_rectangle(
        (line_x, dot_cy - int(line_h * 1.05) - line_h // 2, line_x + line_w, dot_cy - int(line_h * 1.05) + line_h // 2),
        radius=line_radius,
        fill=(*INK_700, 220),
    )
    ll.rounded_rectangle(
        (line_x, dot_cy + int(line_h * 1.05) - line_h // 2, line_x + int(line_w * 0.7), dot_cy + int(line_h * 1.05) + line_h // 2),
        radius=line_radius,
        fill=(*INK_700, 180),
    )
    canvas = Image.alpha_composite(canvas, line_layer)

    return canvas


def soft_glow(rgba: Image.Image, blur: int = 28, alpha: int = 70) -> Image.Image:
    """Subtle drop glow under the front card — adds depth without literal shadow."""
    glow = rgba.copy()
    # Take the alpha channel as a glow mask
    alpha_mask = glow.split()[3]
    glow_solid = Image.new("RGBA", rgba.size, (*ACCENT, alpha))
    glow_solid.putalpha(alpha_mask)
    glow_solid = glow_solid.filter(ImageFilter.GaussianBlur(blur))
    return glow_solid


def render_mark_transparent(size: int, with_glow: bool = True) -> Image.Image:
    """Just the mark (cards + dot + lines) with optional glow, on transparent."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cards = card_stack(size)
    if with_glow:
        glow = soft_glow(cards, blur=int(size * 0.04), alpha=55)
        canvas = Image.alpha_composite(canvas, glow)
    canvas = Image.alpha_composite(canvas, cards)
    return canvas


def render_icon(size: int, with_glow: bool = True) -> Image.Image:
    bg = radial_bg(size).convert("RGBA")
    mark = render_mark_transparent(size, with_glow=with_glow)
    final = Image.alpha_composite(bg, mark)
    return final.convert("RGB")


def render_splash(width: int, height: int) -> Image.Image:
    """Splash: large mark centered vertically slightly above middle, on the splash gradient (no icon-frame seam)."""
    bg = Image.new("RGB", (width, height), INK_900)
    px = bg.load()
    cx, cy = width * 0.5, height * 0.4
    max_r = math.hypot(width, height) * 0.6
    for y in range(height):
        for x in range(width):
            t = min(1.0, math.hypot(x - cx, y - cy) / max_r)
            px[x, y] = lerp(INK_800, INK_900, t)
    bg_rgba = bg.convert("RGBA")

    mark_size = int(min(width, height) * 0.42)
    mark = render_mark_transparent(mark_size, with_glow=True)
    mx = (width - mark_size) // 2
    my = int(height * 0.40) - mark_size // 2
    bg_rgba.paste(mark, (mx, my), mark)

    return bg_rgba.convert("RGB")


def render_adaptive_foreground(size: int = 1024) -> Image.Image:
    """
    Android adaptive icon foreground. The system masks this; the safe zone is
    the center 66% of the image. We keep the design well within that.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    safe = int(size * 0.66)
    cards = card_stack(safe)
    offset = (size - safe) // 2
    canvas.paste(cards, (offset, offset), cards)
    return canvas


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    # 1) icon.png — 1024x1024, full-bleed
    icon = render_icon(1024)
    icon.save(ASSETS / "icon.png", optimize=True)
    print(f"wrote {ASSETS / 'icon.png'}  ({(ASSETS / 'icon.png').stat().st_size // 1024} KB)")

    # 2) splash.png — 1242x2436 (standard Expo splash size)
    splash = render_splash(1242, 2436)
    splash.save(ASSETS / "splash.png", optimize=True)
    print(f"wrote {ASSETS / 'splash.png'}  ({(ASSETS / 'splash.png').stat().st_size // 1024} KB)")

    # 3) adaptive-icon.png — 1024x1024, foreground only on transparent bg
    adaptive = render_adaptive_foreground(1024)
    adaptive.save(ASSETS / "adaptive-icon.png", optimize=True)
    print(f"wrote {ASSETS / 'adaptive-icon.png'}  ({(ASSETS / 'adaptive-icon.png').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
