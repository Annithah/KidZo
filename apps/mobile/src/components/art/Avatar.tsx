import { View } from 'react-native';
import { ART, AVATAR_WORLD } from '@kidzo/art';
import { avatarArt, type Avatar as AvatarName } from '@kidzo/shared';
import { decorative, palette, type ColorName } from '../../theme/core';
import { Art } from './Art';

const LAYER_ORDER = { back: 0, face: 2, top: 3 } as const;

/**
 * Animal avatar on its world-colored disc. Optional wardrobe keys ("wardrobe.party-hat")
 * stack in the right order: capes behind the portrait, glasses on the face, hats on top.
 */
export function Avatar({ avatar, size = 72, wear = [], ring }: { avatar: AvatarName; size?: number; wear?: string[]; ring?: boolean }) {
  const layers = wear
    .map((k) => ART.get(k))
    .filter((a): a is NonNullable<typeof a> => !!a && a.group === 'wardrobe')
    .sort((a, b) => LAYER_ORDER[a.layer ?? 'top'] - LAYER_ORDER[b.layer ?? 'top']);
  const back = layers.filter((l) => l.layer === 'back');
  const front = layers.filter((l) => l.layer !== 'back');
  const world = (AVATAR_WORLD[avatar] ?? 'coral') as ColorName;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 3 : 0, borderColor: palette[world][400] }}
      {...decorative}
    >
      {back.map((l) => (
        <View key={l.key} style={{ position: 'absolute' }}>
          <Art art={l.key} size={size} />
        </View>
      ))}
      <Art art={avatarArt(avatar)} size={size - (ring ? 6 : 0)} />
      {front.map((l) => (
        <View key={l.key} style={{ position: 'absolute' }}>
          <Art art={l.key} size={size} />
        </View>
      ))}
    </View>
  );
}

export const avatarWorld = (avatar: AvatarName): ColorName => (AVATAR_WORLD[avatar] ?? 'coral') as ColorName;
