/**
 * 10's roster chip — an initials avatar and a name, in a rounded outline.
 *
 * The artboard's padding is asymmetric (9px left, 14px right): the avatar
 * already carries visual weight on its side, so an even inset would look
 * lopsided the other way.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Colors, Group, Radii } from '@/constants/theme';
import { FontFamily, Typography } from '@/constants/typography';
import { initialsFor } from '@/lib/events';

type MemberChipProps = {
  name: string;
};

export function MemberChip({ name }: MemberChipProps) {
  return (
    <View style={styles.chip}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initialsFor(name)}</Text>
      </View>
      {/*
        `numberOfLines` rather than the artboard's `white-space: nowrap`: a chip
        that refuses to wrap can still be wider than the screen, and a name long
        enough to do that should be truncated, not pushed off the edge.
      */}
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Group.chip.gap,
    paddingVertical: Group.chip.paddingY,
    paddingLeft: Group.chip.paddingLeft,
    paddingRight: Group.chip.paddingRight,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Group.chip.border,
    backgroundColor: Group.chip.bg,
    // Keeps one very long name from stretching a chip past the screen.
    maxWidth: '100%',
  },
  avatar: {
    width: Group.chip.avatarSize,
    height: Group.chip.avatarSize,
    borderRadius: Group.chip.avatarSize / 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Group.chip.avatarBg,
  },
  initials: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  name: {
    ...Typography.choice,
    color: Colors.textMuted,
    flexShrink: 1,
  },
});
