// Subject-themed decoration drawn on top of the gradient and behind the
// prompt text. Each AccentKind is a tiny SVG composition — intentionally
// abstract, no per-question artwork (ADR 0003).
//
// All shapes are rendered at low alpha against the template's accentColor
// so they read as texture, not as content.

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import type { AccentKind } from '../templates/registry';

export interface AccentLayerProps {
  kind: AccentKind;
  color: string;
  width: number;
  height: number;
}

export function AccentLayer({
  kind,
  color,
  width,
  height,
}: AccentLayerProps): React.ReactElement {
  return (
    <Svg width={width} height={height} style={accentStyles.layer}>
      {renderAccent(kind, color, width, height)}
    </Svg>
  );
}

const accentStyles = StyleSheet.create({
  // Hoisted so the FlatList of cards in MVP-05 doesn't allocate a fresh
  // style object per row. The same shape applies to every accent layer.
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

function renderAccent(
  kind: AccentKind,
  color: string,
  w: number,
  h: number,
): React.ReactElement {
  switch (kind) {
    case 'grid':
      return (
        <>
          <Defs>
            <Pattern id="grid" width={32} height={32} patternUnits="userSpaceOnUse">
              <Path d="M 32 0 L 0 0 0 32" stroke={color} strokeWidth={0.6} fill="none" />
            </Pattern>
          </Defs>
          <Rect width={w} height={h} fill="url(#grid)" opacity={0.18} />
        </>
      );

    case 'numerals':
      // Faded numerals scattered as background motif. Hand-placed for a
      // looser look than a deterministic grid.
      return (
        <G opacity={0.10}>
          {NUMERAL_POSITIONS.map((p, i) => (
            <SvgText
              key={`${p.glyph}-${i}`}
              x={p.x * w}
              y={p.y * h}
              fontSize={p.size}
              fill={color}
              fontWeight="700"
            >
              {p.glyph}
            </SvgText>
          ))}
        </G>
      );

    case 'isolines':
      // Concentric topographic-style curves. Three nested ellipse-paths.
      return (
        <G opacity={0.18} stroke={color} strokeWidth={1} fill="none">
          <Path d={ellipsePath(w * 0.5, h * 0.7, w * 0.65, h * 0.35)} />
          <Path d={ellipsePath(w * 0.5, h * 0.7, w * 0.50, h * 0.27)} />
          <Path d={ellipsePath(w * 0.5, h * 0.7, w * 0.35, h * 0.20)} />
          <Path d={ellipsePath(w * 0.5, h * 0.7, w * 0.22, h * 0.13)} />
        </G>
      );

    case 'dots':
      // Latitude/longitude-style dot field.
      return (
        <G opacity={0.22} fill={color}>
          {DOT_POSITIONS.map((p, i) => (
            <Circle key={i} cx={p.x * w} cy={p.y * h} r={p.r} />
          ))}
        </G>
      );

    case 'bookshelf':
      // Horizontal lines suggesting shelves, with subtle vertical book-spines.
      return (
        <G opacity={0.18}>
          {[0.25, 0.45, 0.65, 0.85].map((y, i) => (
            <Line
              key={`shelf-${i}`}
              x1={0}
              x2={w}
              y1={y * h}
              y2={y * h}
              stroke={color}
              strokeWidth={1.2}
            />
          ))}
          {SPINE_POSITIONS.map((p, i) => (
            <Line
              key={`spine-${i}`}
              x1={p.x * w}
              x2={p.x * w}
              y1={p.y0 * h}
              y2={p.y1 * h}
              stroke={color}
              strokeWidth={0.8}
            />
          ))}
        </G>
      );

    case 'scroll':
      // Torn parchment edges top + bottom.
      return (
        <G opacity={0.20} stroke={color} strokeWidth={1.2} fill="none">
          <Path d={scallopPath(w, 0, 12, 18, 24)} />
          <Path d={scallopPath(w, h, 12, -18, 24)} />
        </G>
      );
  }
}

// ---------- helpers ----------

/** Approximated ellipse perimeter as an SVG cubic bezier path. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5522847498; // bezier handle length factor for circular arcs
  const ox = rx * k;
  const oy = ry * k;
  return [
    `M ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - oy}, ${cx - ox} ${cy - ry}, ${cx} ${cy - ry}`,
    `C ${cx + ox} ${cy - ry}, ${cx + rx} ${cy - oy}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + oy}, ${cx + ox} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - ox} ${cy + ry}, ${cx - rx} ${cy + oy}, ${cx - rx} ${cy}`,
    'Z',
  ].join(' ');
}

/** Series of half-circles along a horizontal edge, signalling a torn paper rim. */
function scallopPath(
  width: number,
  y: number,
  amp: number,
  yOffset: number,
  count: number,
): string {
  const seg = width / count;
  let d = `M 0 ${y + yOffset}`;
  for (let i = 0; i < count; i++) {
    // x0 = i * seg is the implicit start point already drawn by the
    // previous segment (or the initial M); only the control + end matter.
    const x1 = (i + 0.5) * seg;
    const x2 = (i + 1) * seg;
    const dir = i % 2 === 0 ? -1 : 1;
    d += ` Q ${x1} ${y + yOffset + dir * amp}, ${x2} ${y + yOffset}`;
  }
  return d;
}

const NUMERAL_POSITIONS: Array<{ x: number; y: number; size: number; glyph: string }> = [
  { x: 0.08, y: 0.18, size: 56, glyph: 'π' },
  { x: 0.72, y: 0.12, size: 64, glyph: '7' },
  { x: 0.18, y: 0.62, size: 80, glyph: '∑' },
  { x: 0.78, y: 0.78, size: 72, glyph: '√' },
  { x: 0.45, y: 0.40, size: 48, glyph: '∞' },
];

const DOT_POSITIONS: Array<{ x: number; y: number; r: number }> = (() => {
  const out: Array<{ x: number; y: number; r: number }> = [];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      out.push({
        x: (col + 0.5) / 8,
        y: (row + 0.5) / 12,
        r: row % 3 === 0 ? 1.6 : 1.0,
      });
    }
  }
  return out;
})();

const SPINE_POSITIONS: Array<{ x: number; y0: number; y1: number }> = [
  { x: 0.10, y0: 0.06, y1: 0.25 },
  { x: 0.22, y0: 0.06, y1: 0.25 },
  { x: 0.30, y0: 0.06, y1: 0.25 },
  { x: 0.55, y0: 0.26, y1: 0.45 },
  { x: 0.70, y0: 0.26, y1: 0.45 },
  { x: 0.15, y0: 0.46, y1: 0.65 },
  { x: 0.40, y0: 0.46, y1: 0.65 },
  { x: 0.62, y0: 0.66, y1: 0.85 },
  { x: 0.82, y0: 0.66, y1: 0.85 },
];
