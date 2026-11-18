import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFamily } from '../../../lib/family';
import { useBedtime } from '../../../lib/queries';
import { PaletteContext, calmPalette, dayPalette } from '../../../theme';

/** Kid area. Requires a selected child and switches to the calm palette during bedtime. */
export default function KidLayout() {
  const { activeChild, isLoading } = useFamily();
  const bedtime = useBedtime(activeChild);
  if (!activeChild && !isLoading) return <Redirect href="/" />;
  const palette = bedtime ? calmPalette : dayPalette;
  return (
    <PaletteContext.Provider value={palette}>
      <StatusBar style={bedtime ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background }, gestureEnabled: true }}>
        <Stack.Screen name="play/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="complete" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </PaletteContext.Provider>
  );
}
