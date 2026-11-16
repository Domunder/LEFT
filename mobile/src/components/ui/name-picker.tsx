/**
 * "Are you one of these?" — 11's pick of a name the host listed for personal
 * missions (`listUnclaimedNames()` in lib/missions.ts).
 *
 * Not in the prototype. Drawn as 02's choice pills (`ChoicePill` metrics, solid
 * off-white when chosen, hairline outline when not) so it reads as part of the
 * same page, but built on `PressScale` rather than `ChoicePillButton`: a chip
 * gives under the finger on touch-down, where 02's pill only dims once lifted.
 *
 * One choice at a time, and "None of these" is a real choice — the default —
 * so the group behaves as radio buttons for VoiceOver.
 *
 * The chips wrap, and a chip's label wraps inside it, so a long name under the
 * largest Dynamic Type sizes still fits the width instead of being cut.
 */

import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { PressScale } from '@/components/ui/press-scale';
import { Body, Caption } from '@/components/ui/typography';
import { ChoicePill, Colors, MissionsJoin, Press, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { MissionName } from '@/lib/missions';

type NamePickerProps = {
  names: MissionName[];
  /** The chosen name's id; null is "None of these". */
  selectedId: string | null;
  onSelect: (name: MissionName | null) => void;
  disabled?: boolean;
};

export function NamePicker({ names, selectedId, onSelect, disabled = false }: NamePickerProps) {
  return (
    /*
      Opacity only, so it is the same under reduced motion — a fade is not
      travel. A view, not glass, so fading it is fine.
    */
    <Animated.View
      entering={FadeIn.duration(MissionsJoin.fadeMs).reduceMotion(ReduceMotion.Never)}
      exiting={FadeOut.duration(MissionsJoin.fadeMs).reduceMotion(ReduceMotion.Never)}
      style={styles.section}>
      <Body color={Colors.text}>Are you one of these?</Body>
      <Caption color={Colors.textFaint} style={styles.sub}>
        The host planned something for you.
      </Caption>

      <View accessibilityRole="radiogroup" style={styles.chips}>
        {names.map((person) => (
          <NameChip
            key={person.id}
            label={person.name}
            selected={selectedId === person.id}
            disabled={disabled}
            onPress={() => onSelect(person)}
          />
        ))}
        <NameChip
          label="None of these"
          selected={selectedId === null}
          disabled={disabled}
          onPress={() => onSelect(null)}
        />
      </View>
    </Animated.View>
  );
}

function NameChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      scale={Press.pillScale}
      // Not dimmed while the join runs: the field beside it is not either.
      style={[styles.chip, selected ? styles.selected : styles.unselected]}>
      <Text style={[Typography.choice, { color: selected ? Colors.onLight : Colors.text }]}>
        {label}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: MissionsJoin.sectionTop,
    marginBottom: MissionsJoin.sectionBottom,
  },
  sub: {
    marginTop: MissionsJoin.subGap,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MissionsJoin.chipGap,
    marginTop: MissionsJoin.chipsTop,
  },
  chip: {
    maxWidth: '100%',
    paddingVertical: ChoicePill.paddingY,
    paddingHorizontal: ChoicePill.paddingX,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderColor: Colors.hairlineStrong,
  },
});
