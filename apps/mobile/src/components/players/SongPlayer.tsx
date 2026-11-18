import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize, type Locale, type SongBody } from '@kidzo/shared';
import { useT } from '../../i18n';
import { speak, stopSpeaking } from '../../lib/narration';
import { radii, spacing, usePalette } from '../../theme';
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
  const palette = usePalette();
  const [line, setLine] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioUrl = body.audioUrl;
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
      calm: palette.isCalm,
      onDone: () => {
        if (line + 1 < lineCount) setLine((l) => l + 1);
        else setReachedEnd(true);
      },
    });
    return () => stopSpeaking();
  }, [audioUrl, line, body.lines, lineCount, locale, palette.isCalm]);

  return (
    <View style={styles.wrap}>
      <View style={styles.lines}>
        {body.lines.map((l, i) => {
          const active = i === line;
          return (
            <View key={i} style={[styles.line, active && { backgroundColor: palette.surface }]}>
              <Text style={styles.emoji}>{l.emoji}</Text>
              <Text variant={active ? 'h3' : 'body'} muted={!active} style={{ flex: 1 }}>
                {localize(l.text, locale)}
              </Text>
            </View>
          );
        })}
      </View>
      <Button
        label={`🎵  ${t('player.finishSong')}`}
        size="kid"
        fullWidth
        variant={palette.isCalm ? 'moon' : 'yellow'}
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
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md },
  emoji: { fontSize: 32, lineHeight: 40 },
});
