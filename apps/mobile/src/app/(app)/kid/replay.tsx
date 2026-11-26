import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { localize, recapFromPath, type Locale } from '@kidzo/shared';
import { Art } from '../../../components/art/Art';
import { Button } from '../../../components/Button';
import { SwooshProgress } from '../../../components/Controls';
import { Avatar } from '../../../components/Kid';
import { Header, Screen } from '../../../components/Layout';
import { Text } from '../../../components/Typography';
import { Zo } from '../../../components/Zo';
import { useT } from '../../../i18n';
import { useFamily } from '../../../lib/family';
import { getLastResult } from '../../../lib/last-result';
import { speak, stopSpeaking } from '../../../lib/narration';
import { palette, radius, shadow, spacing, useTheme } from '../../../theme/core';

/**
 * Personal recap ("adventure movie"): a narrated, animated replay of the exact path the child
 * took, opening with their name, showing the choice they made in each scene, and closing with
 * a summary of their choices. Built on the device from the finished session; nothing is uploaded.
 */
export default function Replay() {
  const { t } = useT();
  const theme = useTheme();
  const { activeChild } = useFamily();
  const result = getLastResult();
  // Step 0 is the title card, 1..n are scenes, n+1 is the summary.
  const [step, setStep] = useState(0);

  const scenes = useMemo(
    () => (result && result.content.body.kind === 'branching' ? recapFromPath(result.content.body, result.path) : []),
    [result],
  );
  const locale = (activeChild?.locale ?? 'en') as Locale;
  const name = activeChild?.name ?? '';
  const scene = step >= 1 ? scenes[step - 1] : undefined;
  const done = step > scenes.length;
  const choicesMade = scenes.filter((s) => s.choice !== null);

  // Narrate each card, then move on by itself shortly after the voice finishes.
  useEffect(() => {
    if (done || !result) return;
    const line = step === 0
      ? `${t('replay.intro', { name })}. ${t('replay.introBody')}`
      : scene
        ? [localize(scene.node.text, locale), scene.choice ? t('replay.youChose', { choice: localize(scene.choice.label, locale) }) : ''].filter(Boolean).join(' ')
        : '';
    if (!line) return;
    let cancelled = false;
    void speak(line, locale, {
      calm: theme.isCalm,
      onDone: () => {
        if (!cancelled) setTimeout(() => setStep((s) => s + 1), 700);
      },
    });
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [step, scene, done, result, locale, name, theme.isCalm, t]);

  if (!result || scenes.length === 0) return <Redirect href="/kid/home" />;
  const title = localize(result.content.title, locale);

  return (
    <Screen world scroll={false}>
      <Header title={t('replay.title')} backLabel={t('common.back')} />
      <SwooshProgress done={Math.min(step, scenes.length + 1)} total={scenes.length + 1} label={t('replay.title')} />

      {step === 0 ? (
        <Animated.View key="intro" entering={FadeIn.duration(600)} style={styles.center}>
          <Animated.View entering={ZoomIn.springify()}>
            {activeChild ? <Avatar avatar={activeChild.avatar} size={140} ring /> : <Zo size={140} mood="waving" />}
          </Animated.View>
          <Text variant="display" align="center">
            {t('replay.intro', { name })}
          </Text>
          <Text variant="h3" align="center" muted>
            {title}
          </Text>
          <Text align="center" muted>
            {t('replay.introBody')}
          </Text>
          <Button label={t('player.next')} iconRight="forward" variant="ghost" onPress={() => setStep(1)} />
        </Animated.View>
      ) : done ? (
        <Animated.View key="summary" entering={ZoomIn} style={styles.summary}>
          <Art art="scene.celebrate" size={160} />
          <Text variant="display" align="center">
            {t('replay.theEnd')}
          </Text>
          {choicesMade.length > 0 ? (
            <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ gap: spacing.xs }}>
              <Text variant="kicker" muted>
                {t('replay.yourChoices')}
              </Text>
              {choicesMade.map((s, i) => (
                <Animated.View
                  key={`${s.node.id}-${i}`}
                  entering={FadeInDown.delay(i * 120)}
                  style={[styles.choiceRow, { backgroundColor: theme.surface }, shadow(1, undefined, theme)]}
                >
                  <Art art={s.choice?.art ?? 'object.sparkles'} size={40} />
                  <Text variant="bodyBold" style={{ flex: 1 }}>
                    {s.choice ? localize(s.choice.label, locale) : ''}
                  </Text>
                </Animated.View>
              ))}
            </ScrollView>
          ) : null}
          <Button label={t('complete.home')} icon="home" size="kid" fullWidth onPress={() => router.replace('/kid/home')} />
          <Button label={t('complete.watchReplay')} icon="replay" variant="ghost" onPress={() => setStep(0)} />
        </Animated.View>
      ) : scene ? (
        <Animated.View key={`${scene.node.id}-${step}`} entering={FadeIn.duration(600)} style={styles.sceneWrap}>
          <View style={[styles.scene, { backgroundColor: theme.isCalm ? theme.surface : scene.node.scene.color }, shadow(2, undefined, theme)]}>
            <Animated.View entering={ZoomIn.duration(700)}>
              <Art art={scene.node.scene.art} size={200} />
            </Animated.View>
          </View>
          <Text variant="h3" align="center">
            {localize(scene.node.text, locale)}
          </Text>
          {scene.choice ? (
            <Animated.View entering={FadeInDown.delay(400)} style={[styles.chosen, { backgroundColor: theme.isCalm ? theme.surfaceRaised : palette.star[100] }]}>
              <Art art={scene.choice.art} size={44} />
              <Text variant="bodyBold" style={{ flex: 1 }}>
                {t('replay.youChose', { choice: localize(scene.choice.label, locale) })}
              </Text>
            </Animated.View>
          ) : null}
          <Button label={t('player.next')} iconRight="forward" variant="ghost" onPress={() => setStep((s) => s + 1)} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  summary: { flex: 1, alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  sceneWrap: { flex: 1, gap: spacing.md, justifyContent: 'center' },
  scene: { height: 280, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm },
});
