import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { localize, type Locale } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/Controls';
import { Header, Screen } from '../../../components/Layout';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { useFamily } from '../../../lib/family';
import { getLastResult } from '../../../lib/last-result';
import { speak, stopSpeaking } from '../../../lib/narration';
import { colors, radii, spacing, usePalette } from '../../../theme';

/** "Adventure movie": replays the scenes the child chose, narrated, as an animated slideshow. */
export default function Replay() {
  const { t } = useT();
  const palette = usePalette();
  const { activeChild } = useFamily();
  const result = getLastResult();
  const [step, setStep] = useState(0);

  const scenes = useMemo(() => {
    if (!result || result.content.body.kind !== 'branching') return [];
    const byId = new Map(result.content.body.nodes.map((n) => [n.id, n]));
    return result.path.flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    });
  }, [result]);

  const locale = (activeChild?.locale ?? 'en') as Locale;
  const scene = scenes[step];
  const done = step >= scenes.length;

  useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    void speak(localize(scene.text, locale), locale, {
      calm: palette.isCalm,
      onDone: () => {
        if (!cancelled) setTimeout(() => setStep((s) => s + 1), 600);
      },
    });
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [scene, locale, palette.isCalm]);

  if (!result || scenes.length === 0) return <Redirect href="/kid/home" />;

  return (
    <Screen scroll={false}>
      <Header title={t('replay.title')} backLabel={t('common.back')} />
      <ProgressBar value={Math.min(1, step / scenes.length)} color={colors.lavender} />
      {done ? (
        <Animated.View entering={ZoomIn} style={styles.center}>
          <Text style={styles.bigEmoji}>🎬</Text>
          <Text variant="display">{t('replay.theEnd')}</Text>
          <Button label={t('complete.home')} size="kid" onPress={() => router.replace('/kid/home')} />
          <Button label={`↺  ${t('complete.watchReplay')}`} variant="ghost" textColor={palette.text} onPress={() => setStep(0)} />
        </Animated.View>
      ) : scene ? (
        <Animated.View key={`${scene.id}-${step}`} entering={FadeIn.duration(600)} style={styles.sceneWrap}>
          <View style={[styles.scene, { backgroundColor: scene.scene.color }]}>
            <Animated.Text entering={ZoomIn.duration(700)} style={styles.bigEmoji}>
              {scene.scene.emoji}
            </Animated.Text>
          </View>
          <Text variant="h3" align="center">
            {localize(scene.text, locale)}
          </Text>
          <Button label={`${t('player.next')}  ›`} variant="ghost" textColor={palette.text} onPress={() => setStep((s) => s + 1)} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  sceneWrap: { flex: 1, gap: spacing.md, justifyContent: 'center' },
  scene: { height: 300, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
  bigEmoji: { fontSize: 130, lineHeight: 150 },
});
