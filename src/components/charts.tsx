import { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Point = { label: string; value: number };

/**
 * Minimal line chart: primary series, optional smoothed secondary series,
 * dashed target line, first/last x labels, min/max y labels.
 */
export function LineChart({
  data, secondary, target, height = 160, formatValue = (v) => String(Math.round(v)),
}: {
  data: Point[];
  secondary?: number[];
  target?: number;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const colors = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) return <EmptyChart height={height} />;

  const values = data.map((d) => d.value)
    .concat(secondary ?? [])
    .concat(target != null ? [target] : []);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;

  const px = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - 8) + 4);
  const py = (v: number) => height - ((v - min) / (max - min)) * (height - 8) - 4;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');

  const last = data[data.length - 1];

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formatValue(max)}</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
          {formatValue(last.value)}
        </Text>
      </View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {target != null && (
              <Line
                x1={0} x2={width} y1={py(target)} y2={py(target)}
                stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="4 4"
              />
            )}
            {secondary && secondary.length === data.length && (
              <Path d={path(secondary)} stroke={colors.textSecondary} strokeWidth={1.5} fill="none" />
            )}
            <Path d={path(data.map((d) => d.value))} stroke={colors.tint} strokeWidth={2.5} fill="none" />
            <Circle cx={px(data.length - 1)} cy={py(last.value)} r={4} fill={colors.tint} />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{data[0].label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formatValue(min)}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{last.label}</Text>
      </View>
    </View>
  );
}

/** Horizontal bars — plain Views, no SVG needed. */
export function BarList({
  data, formatValue = (v) => String(v),
}: {
  data: Point[];
  formatValue?: (v: number) => string;
}) {
  const colors = useTheme();
  if (data.length === 0) return <EmptyChart height={60} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 6 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Text style={{ color: colors.text, fontSize: 13, width: 92 }} numberOfLines={1}>
            {d.label}
          </Text>
          <View style={{ flex: 1, height: 16, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{
              width: `${Math.max(2, (d.value / max) * 100)}%`,
              height: '100%', borderRadius: 4, backgroundColor: colors.tint,
            }} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, width: 44, textAlign: 'right' }}>
            {formatValue(d.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Vertical columns with optional target line — plain Views. */
export function ColumnChart({
  data, target, height = 120, formatValue = (v) => String(Math.round(v)),
}: {
  data: Point[];
  target?: number;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const colors = useTheme();
  if (data.length === 0) return <EmptyChart height={height} />;
  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1);
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {target != null && (
          <View style={{
            position: 'absolute', left: 0, right: 0,
            bottom: (target / max) * height, height: 1,
            borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.textSecondary,
          }} />
        )}
        {data.map((d, i) => (
          <View
            key={`${d.label}-${i}`}
            style={{
              flex: 1,
              height: Math.max(2, (d.value / max) * height),
              borderRadius: 3,
              backgroundColor:
                target != null && d.value > target ? colors.danger : colors.tint,
              opacity: d.value === 0 ? 0.25 : 1,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{data[0].label}</Text>
        {target != null && (
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            target {formatValue(target)}
          </Text>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
          {data[data.length - 1].label}
        </Text>
      </View>
    </View>
  );
}

function EmptyChart({ height }: { height: number }) {
  const colors = useTheme();
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No data yet</Text>
    </View>
  );
}
