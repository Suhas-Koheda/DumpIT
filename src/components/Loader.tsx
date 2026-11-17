import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

/** Minimal Material 3 loading state. */
export default function Loader({ message = 'Opening the vault' }: { message?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: theme.colors.background }}>
      <ActivityIndicator size={44} color={theme.colors.primary} />
      <Text style={{ color: theme.colors.onBackground, fontSize: 15 }}>{message}…</Text>
    </View>
  );
}
