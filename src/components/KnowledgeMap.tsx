import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/lib/theme';
import type { ExtractedEntity } from '@/lib/types';

/**
 * RawBlock knowledge map — the dump at the center, extracted entities orbiting.
 * Square nodes, hard black borders, no curves, monochrome on white.
 */
export default function KnowledgeMap({
  title,
  entities,
}: {
  title: string;
  entities: ExtractedEntity[];
}) {
  const nodes = entities.slice(0, 8);
  if (nodes.length === 0) return null;

  const W = 320;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const R = 118;

  const titleLines = wrap(title.toUpperCase(), 22, 2);
  const centerH = 26 + titleLines.length * 15;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>KNOWLEDGE MAP</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* connectors */}
        {nodes.map((node, i) => {
          const { x, y } = satellitePos(i, nodes.length, cx, cy, R);
          return <Line key={`l${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#000" strokeWidth={2} />;
        })}

        {/* center */}
        <Rect
          x={cx - 78}
          y={cy - centerH / 2}
          width={156}
          height={centerH}
          fill="#000"
          stroke="#000"
          strokeWidth={3}
        />
        {titleLines.map((line, i) => (
          <SvgText
            key={i}
            x={cx}
            y={cy - centerH / 2 + 16 + i * 15}
            fill="#FFFFFF"
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="SpaceMono_400Regular"
          >
            {line}
          </SvgText>
        ))}

        {/* satellites */}
        {nodes.map((node, i) => {
          const { x, y } = satellitePos(i, nodes.length, cx, cy, R);
          const boxW = 92;
          const boxH = 40;
          const valueLines = wrap(node.value, 13, 2);
          return (
            <g key={`n${i}`}>
              <Rect
                x={x - boxW / 2}
                y={y - boxH / 2}
                width={boxW}
                height={boxH}
                fill="#FFFFFF"
                stroke="#000"
                strokeWidth={2.5}
              />
              <SvgText
                x={x}
                y={y - 10}
                fill="#767676"
                fontSize={7}
                textAnchor="middle"
                fontFamily="SpaceMono_400Regular"
                letterSpacing={1}
              >
                {node.type.toUpperCase().slice(0, 12)}
              </SvgText>
              {valueLines.map((line, li) => (
                <SvgText
                  key={li}
                  x={x}
                  y={y + 3 + li * 10}
                  fill="#000000"
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="WorkSans_600SemiBold"
                >
                  {line}
                </SvgText>
              ))}
            </g>
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
  // Start at the top, space evenly, full circle.
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
  // Truncate the last line if text didn't fit.
  if (words.join(' ').length > lines.join(' ').length && lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxCharsPerLine - 1) + '…';
  }
  return lines.slice(0, maxLines);
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.faint,
  },
});
