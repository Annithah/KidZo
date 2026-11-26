import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFamily } from '../../../lib/family';
import { useBedtime } from '../../../lib/queries';
import { ThemeContext, bedtimeTheme, lightTheme } from '../../../theme/core';

/** Kid area. Requires a selected child and switches to the bedtime theme in the evening. */
export default function KidLayout() {
  const { activeChild, isLoading } = useFamily();
  const bedtime = useBedtime(activeChild);
  if (!activeChild && !isLoading) return <Redirect href="/" />;
  const theme = bedtime ? bedtimeTheme : lightTheme;
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={bedtime ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background }, gestureEnabled: true }}>
        <Stack.Screen name="play/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="complete" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </ThemeContext.Provider>
  );
}
