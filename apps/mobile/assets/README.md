# Mobile assets

`icon.png`, `splash.png`, and `adaptive-icon.png` are generated procedurally by [`scripts/generate-icons.py`](../../../scripts/generate-icons.py). They are committed to the repo so a fresh clone can `expo start` without extra steps.

## Mark

A stack of three rounded "cards" with subtle perspective offset, evoking the reels-style feed. The front card carries a small cyan accent dot (suggesting "answer chosen") and two short horizontal lines (suggesting question text). The mark sits on the brand navy gradient (`#0b1220` → `#1a2540`) with a soft cyan (`#4dd0e1`) glow.

## Files

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024 × 1024 | App icon, full-bleed gradient + mark + glow. |
| `splash.png` | 1242 × 2436 | Launch screen. Mark centred at ~40% height on a continuous splash gradient (no visible icon-frame). |
| `adaptive-icon.png` | 1024 × 1024 | Android adaptive foreground. Transparent background; mark fits inside the 66% safe zone so any system mask shape (circle / squircle / rounded square) renders cleanly on the `#0b1220` background configured in `app.json`. |

## Regenerating

```bash
python3 scripts/generate-icons.py
```

Re-runs are deterministic. If the design changes (palette, layout, accent), edit the script and re-run; commit the resulting PNGs.

## When to replace

These are placeholder-quality but production-passable for an MVP. Before App Store / Play Store submission, swap in artwork from a designer if you want — keep the `1024 × 1024` / `1242 × 2436` / `1024 × 1024` sizes and the `assets/` filenames.
