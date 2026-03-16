import { Colors } from '../src/constants/Colors';
import { useTheme } from '../src/context/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { mode, colors } = useTheme();
  // Determine if we should use light or dark tokens based on current mode
  // Note: 'system' logic is handled inside ThemeContext, so here we can just use colors[colorName]
  // BUT useThemeColor is designed to take a property list.
  
  const theme = mode === 'system' ? (colors.text === '#FFFFFF' ? 'dark' : 'light') : mode; // fallback logic
  const colorFromProps = props[theme as 'light' | 'dark'];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return (colors as any)[colorName];
  }
}
