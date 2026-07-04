import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  title, onPress, kind = 'primary', disabled, style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useTheme();
  const bg = kind === 'primary' ? colors.tint : colors.backgroundElement;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const colors = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{children}</Text>;
}

/** Empty-list placeholder: emoji + a hook, not a shrug. Use for every empty list/section. */
export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  const colors = useTheme();
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
});
