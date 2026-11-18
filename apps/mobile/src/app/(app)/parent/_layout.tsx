import { Stack } from 'expo-router';
import { ParentGate } from '../../../components/ParentGate';
import { useParentGate } from '../../../lib/parent-gate';
import { colors } from '../../../theme';

/** Everything under /parent requires passing the grown-ups gate. */
export default function ParentLayout() {
  const { unlocked, touch } = useParentGate();
  if (!unlocked) return <ParentGate />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
      screenListeners={{ focus: touch, state: touch }}
    />
  );
}
