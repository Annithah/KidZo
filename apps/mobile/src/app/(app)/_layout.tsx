import { Stack } from 'expo-router';
import { lightTheme } from '../../theme';

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: lightTheme.background } }} />;
}
