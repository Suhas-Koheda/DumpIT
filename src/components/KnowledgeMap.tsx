import { View, Text } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

import type { ExtractedEntity } from '@/lib/types';

/**
 * Knowledge map — the dump at the center, extracted entities orbiting.
 * Material 3 tones: on-surface text, surface containers, tonal fills.
 */
export default function KnowledgeMap({
  title,
  entities,
}: {
  title: string;
  entities: ExtractedEntity[];
}) {
  const theme = useTheme();
  const c = theme.colors;
  const nodes = entities.slice(0, 8);
  if (nodes.length === 0) return null;

  const W = 320;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = 110;

  const titleLines = wrap(title.toUpperCase(), 20, 2);
  const centerH = 24 + titleLines.length * 13;

  return (
    <View style={{
      borderTopWidth: 1,
      borderTopColor: c.outlineVariant,
      paddingTop: 12,
      gap: 8,
    }}>
      <Text style={{ fontSize: 10, letterSpacing: 2, color: c.onSurfaceVariant }}>
        KNOWLEDGE MAP
      </Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {nodes.map((_, i) => {
          const { x, y } = satellitePos(i, nodes.length, cx, cy, R);
          return <Line key={`l${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={c.outlineVariant} strokeWidth={1.5} />;
        })}

        <Rect
          x={cx - 72}
          y={cy - centerH / 2}
          width={144}
          height={centerH}
          rx={10}
          fill={c.primary}
        />
        {titleLines.map((line, i) => (
          <SvgText
            key={i}
            x={cx}
            y={cy - centerH / 2 + 15 + i * 13}
            fill={c.onPrimary}
            fontSize={9}
            fontWeight="bold"
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}

        {nodes.map((node, i) => {
          const { x, y } = satellitePos(i, nodes.length, cx, cy, R);
          const boxW = 92;
          const boxH = 38;
          const valueLines = wrap(node.value, 13, 2);
          return (
            <G key={`n${i}`}>
              <Rect
                x={x - boxW / 2}
                y={y - boxH / 2}
                width={boxW}
                height={boxH}
                rx={10}
                fill={c.surfaceVariant}
                stroke={c.outlineVariant}
                strokeWidth={1}
              />
              <SvgText
                x={x}
                y={y - 9}
                fill={c.onSurfaceVariant}
                fontSize={7}
                textAnchor="middle"
              >
                {node.type.toUpperCase().slice(0, 12)}
              </SvgText>
              {valueLines.map((line, li) => (
                <SvgText
                  key={li}
                  x={x}
                  y={y + 4 + li * 10}
                  fill={c.onSurface}
                  fontSize={8.5}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {line}
                </SvgText>
              ))}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function satellitePos(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function wrap(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, maxCharsPerLine);
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.join(' ').length > lines.join(' ').length && lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxCharsPerLine - 1) + '…';
  }
  return lines.slice(0, maxLines);
}
