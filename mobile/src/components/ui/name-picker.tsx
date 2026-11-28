/**
 * "Are you one of these?" — 11's names a host listed for personal missions
 * (`listUnclaimedNames()` in lib/missions.ts).
 *
 * Not in the prototype. **The names come first** (2026-11-19, the user): one
 * per row, so a guest reads the host's list before typing anything, and the
 * last row is "Add your name". Tapping it shows the name field in its place
 * (`field`, owned by 11); tapping a name again hides the field — the way back
 * for a guest who typed and then found themselves in the list. Only names
 * nobody else holds are listed; the guest's own (`mine`) is listed and chosen.
 *
 * Rows are 02's choice pills, full width: solid off-white when chosen,
 * hairline outline when not, on `PressScale` so they give on touch-down. One
 * choice at a time — radio buttons for VoiceOver.
 */

import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { PressScale } from '@/components/ui/press-scale';
import { Body, Caption } from '@/components/ui/typography';
import { Colors, MissionsJoin, Press, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';
import type { MissionName } from '@/lib/missions';

type NamePickerProps = {
  names: MissionName[];
  /** The chosen name's id; null while the guest types their own. */
  selectedId: string | null;
  /** The guest chose "Add your name": `field` replaces that row. */
  typing: boolean;
  onSelect: (name: MissionName) => void;
  onAdd: () => void;
  /** 11's name field and its helper line, shown while `typing`. */
  field: ReactNode;
  disabled?: boolean;
};

const fade = (ms: number) => FadeIn.duration(ms).reduceMotion(ReduceMotion.Never);
const fadeOut = (ms: number) => FadeOut.duration(ms).reduceMotion(ReduceMotion.Never);

export function NamePicker({
  names,
  selectedId,
  typing,
  onSelect,
  onAdd,
  field,
  disabled = false,
}: NamePickerProps) {
  return (
    /*
      Opacity only, so it is the same under reduced motion — a fade is not
      travel. A view, not glass, so fading it is fine.
    */
    <Animated.View entering={fade(MissionsJoin.fadeMs)} style={styles.section}>
      <Body color={Colors.text}>{t('guest.pickerTitle')}</Body>
      <Caption color={Colors.textFaint} style={styles.sub}>
        {t('guest.pickerSub')}
      </Caption>

      <View accessibilityRole="radiogroup" style={styles.rows}>
        {names.map((person) => (
          <Animated.View
            key={person.id}
            entering={fade(MissionsJoin.fadeMs)}
            // A name someone else took leaves the list.
            exiting={fadeOut(MissionsJoin.fadeMs)}
            layout={LinearTransition.reduceMotion(ReduceMotion.System)}>
            <NameRow
              label={person.name}
              selected={!typing && selectedId === person.id}
              disabled={disabled}
              onPress={() => onSelect(person)}
            />
          </Animated.View>
        ))}

        <Animated.View layout={LinearTransition.reduceMotion(ReduceMotion.System)}>
          {typing ? (
            <Animated.View entering={fade(MissionsJoin.fadeMs)}>{field}</Animated.View>
          ) : (
            <NameRow label={t('guest.pickerAdd')} add selected={false} disabled={disabled} onPress={onAdd} />
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function NameRow({
  label,
  selected,
  disabled,
  onPress,
  add = false,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  add?: boolean;
}) {
  const color = selected ? Colors.onLight : add ? Colors.textMuted : Colors.text;
  return (
    <PressScale
      accessibilityRole={add ? 'button' : 'radio'}
      accessibilityState={add ? { disabled } : { checked: selected, disabled }}
      accessibilityLabel={add ? t('guest.pickerAddA11y') : label}
      disabled={disabled}
      onPress={() => {
        if (!selected) haptic.select();
        onPress();
      }}
      scale={Press.pillScale}
      // Not dimmed while the join runs: the field beside it is not either.
      style={[styles.row, selected ? styles.selected : styles.unselected]}>
      {add ? <Feather name="plus" size={MissionsJoin.iconSize} color={color} /> : null}
      <Text style={[Typography.choice, styles.label, { color }]}>{label}</Text>
      {selected ? <Feather name="check" size={MissionsJoin.iconSize} color={color} /> : null}
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
  rows: {
    gap: MissionsJoin.rowGap,
    marginTop: MissionsJoin.rowsTop,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MissionsJoin.rowGap,
    paddingVertical: MissionsJoin.rowPaddingY,
    paddingHorizontal: MissionsJoin.rowPaddingX,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  label: {
    flex: 1,
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
