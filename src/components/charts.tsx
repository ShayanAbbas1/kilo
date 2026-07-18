import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
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
  const primaryPath = path(data.map((d) => d.value));
  // ponytail: primary series is always gap-free (Point[] has no nulls), so the area fill is unconditional here.
  const areaPath = `${primaryPath} L ${px(data.length - 1).toFixed(1)} ${height} L ${px(0).toFixed(1)} ${height} Z`;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {formatValue(max)}
        </Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {formatValue(last.value)}
        </Text>
      </View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="lineChartAreaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.tint} stopOpacity={0.18} />
                <Stop offset="1" stopColor={colors.tint} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {target != null && (
              <Line
                x1={0} x2={width} y1={py(target)} y2={py(target)}
                stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="4 4"
              />
            )}
            <Path d={areaPath} fill="url(#lineChartAreaFill)" stroke="none" />
            {secondary && secondary.length === data.length && (
              <Path d={path(secondary)} stroke={colors.textSecondary} strokeWidth={1.5} fill="none" />
            )}
            <Path d={primaryPath} stroke={colors.tint} strokeWidth={2.5} fill="none" />
            <Circle cx={px(data.length - 1)} cy={py(last.value)} r={4} fill={colors.tint} />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {data[0].label}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {formatValue(min)}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {last.label}
        </Text>
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
          <Text
            style={{
              color: colors.textSecondary, fontSize: 13, width: 44, textAlign: 'right',
              fontVariant: ['tabular-nums'],
            }}>
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
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
              backgroundColor:
                target != null && d.value > target ? colors.danger : colors.tint,
              opacity: d.value === 0 ? 0.25 : 1,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {data[0].label}
        </Text>
        {target != null && (
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
            target {formatValue(target)}
          </Text>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {data[data.length - 1].label}
        </Text>
      </View>
    </View>
  );
}

export type TrendSeries = {
  label: string;
  color: string;
  values: (number | null)[];
  current: string; // formatted latest value for the legend
};

/**
 * Normalized multi-series overlay — each series scaled to its own min/max so
 * kg, kcal and tonnage share one timeline. Shape comparison, not absolute values.
 */
export function TrendChart({
  series, labels, height = 170,
}: {
  series: TrendSeries[];
  labels: string[];
  height?: number;
}) {
  const colors = useTheme();
  const [width, setWidth] = useState(0);
  const n = labels.length;
  if (n === 0 || series.every((s) => s.values.every((v) => v == null))) {
    return <EmptyChart height={height} />;
  }

  const px = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * (width - 8) + 4);
  const pathFor = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v != null);
    if (present.length === 0) return '';
    let min = Math.min(...present);
    let max = Math.max(...present);
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const py = (v: number) => height - ((v - min) / (max - min)) * (height - 16) - 8;
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'} ${px(i).toFixed(1)} ${py(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginBottom: Spacing.two }}>
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {s.label}{' '}
              <Text style={{ color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {s.current}
              </Text>
            </Text>
          </View>
        ))}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {series.map((s, i) => (
              <Path
                key={s.label} d={pathFor(s.values)} stroke={s.color}
                strokeWidth={i === 0 ? 2.5 : 1.75} fill="none"
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {labels[0]}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {labels[n - 1]}
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
