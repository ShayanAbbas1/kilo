import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { Spacing, Type } from '@/constants/theme';
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
  const fg = kind === 'primary' ? colors.onTint : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          // hairline keeps secondary buttons visible on same-fill cards
          borderColor: kind === 'primary' ? 'transparent' : colors.border,
        },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 16, letterSpacing: 0.2 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        style,
      ]}>
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
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    ...Type.label,
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
