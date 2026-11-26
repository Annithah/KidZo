import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize, type Locale, type SongBody } from '@kidzo/shared';
import { useT } from '../../i18n';
import { API_URL } from '../../lib/config';
import { resolveMediaUrl } from '../../lib/media-url';
import { speak, stopSpeaking } from '../../lib/narration';
import { palette, radius, spacing, useTheme } from '../../theme/core';
import { Art } from '../art/Art';
import { Button } from '../Button';
import { Text } from '../Typography';

interface Props {
  body: SongBody;
  locale: Locale;
  volume: number;
  onFinish: () => void;
}

/**
 * Sing-along. Plays the recorded track when there is one; otherwise the lyrics are read
 * aloud line by line with the current line highlighted.
 */
export function SongPlayer({ body, locale, volume, onFinish }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const [line, setLine] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioUrl = resolveMediaUrl(body.audioUrl, API_URL);
  const lineCount = body.lines.length;

  // Recorded track: play it and follow progress through the lines.
  useEffect(() => {
    if (!audioUrl) return;
    const player = createAudioPlayer(audioUrl, { updateInterval: 250 });
    playerRef.current = player;
    player.volume = volume;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.duration > 0) {
        const progress = status.currentTime / status.duration;
        setLine(Math.min(lineCount - 1, Math.floor(progress * lineCount)));
        if (progress >= 0.98) setReachedEnd(true);
      }
      if (status.didJustFinish) setReachedEnd(true);
    });
    player.play();
    return () => {
      sub.remove();
      player.pause();
      player.remove();
      playerRef.current = null;
    };
  }, [audioUrl, volume, lineCount]);

  // No track: narrate each line in turn.
  useEffect(() => {
    if (audioUrl) return;
    const current = body.lines[line];
    if (!current) return;
    void speak(localize(current.text, locale), locale, {
      calm: theme.isCalm,
      onDone: () => {
        if (line + 1 < lineCount) setLine((l) => l + 1);
        else setReachedEnd(true);
      },
    });
    return () => stopSpeaking();
  }, [audioUrl, line, body.lines, lineCount, locale, theme.isCalm]);

  return (
    <View style={styles.wrap}>
      <View style={styles.lines}>
        {body.lines.map((l, i) => {
          const active = i === line;
          return (
            <View
              key={i}
              style={[styles.line, active && { backgroundColor: theme.surface, borderColor: theme.isCalm ? theme.line : palette.star[300] }]}
              accessibilityState={{ selected: active }}
            >
              <Art art={l.art} size={active ? 52 : 40} />
              <Text variant={active ? 'h3' : 'body'} muted={!active} style={{ flex: 1 }}>
                {localize(l.text, locale)}
              </Text>
            </View>
          );
        })}
      </View>
      <Button
        label={t('player.finishSong')}
        icon="song"
        size="kid"
        fullWidth
        variant={theme.isCalm ? 'moon' : 'star'}
        disabled={!reachedEnd}
        onPress={() => {
          stopSpeaking();
          playerRef.current?.pause();
          onFinish();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  lines: { gap: spacing.xs, flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent' },
});
