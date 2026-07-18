import { Text as RNText, TextProps, StyleSheet } from 'react-native';

// Android ignores numeric fontWeight on custom font families — every weight needs its
// own font file. This wrapper maps the style's fontWeight to the right Space Grotesk
// file so screens keep writing plain `fontWeight: '600'`.
const FAMILY: Record<string, string> = {
  '300': 'SpaceGrotesk_300Light',
  '400': 'SpaceGrotesk_400Regular',
  normal: 'SpaceGrotesk_400Regular',
  '500': 'SpaceGrotesk_500Medium',
  '600': 'SpaceGrotesk_600SemiBold',
  '700': 'SpaceGrotesk_700Bold',
  '800': 'SpaceGrotesk_700Bold', // 700 is the heaviest cut
  '900': 'SpaceGrotesk_700Bold',
  bold: 'SpaceGrotesk_700Bold',
};

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontFamily = FAMILY[String(flat.fontWeight ?? '400')] ?? FAMILY['400'];
  // fontWeight cleared so Android doesn't faux-bold on top of the real cut
  return <RNText {...props} style={[style, { fontFamily, fontWeight: undefined }]} />;
}
