import { View } from 'react-native';
import Body, { ExtendedBodyPart } from 'react-native-body-highlighter';

import { Text } from '@/components/text';
import { HEAT_COLORS } from '@/lib/body-map';
import { useTheme } from '@/hooks/use-theme';

/** Front + back figures side by side, shared data/colors. */
export function BodyHeatmap({
  data, colors = HEAT_COLORS, scale = 0.85, onPressSlug,
}: {
  data: ExtendedBodyPart[];
  colors?: string[];
  scale?: number;
  onPressSlug?: (slug: string) => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
        {(['front', 'back'] as const).map((side) => (
          <View key={side} style={{ alignItems: 'center' }}>
            <Body
              data={data}
              side={side}
              gender="male"
              scale={scale}
              colors={colors}
              border={theme.textSecondary}
              defaultFill={theme.backgroundSelected}
              onBodyPartPress={
                onPressSlug ? (part) => part.slug && onPressSlug(part.slug) : undefined
              }
            />
            <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>{side}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
