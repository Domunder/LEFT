/**
 * The mission sheets — the list on 13 and the picker in the photo viewer.
 *
 * Not in the prototype. Both are the app's `Sheet` (solid card, blurred scrim,
 * draggable through `SheetDrag`) laid over the screen that opens them, rather
 * than routes: the camera keeps running under the list, and the picker sits
 * over the viewer it belongs to. Controls inside are flat — a sheet is not
 * glass, and nothing is glass on glass.
 *
 * Leaving: a drag carries the card out with the hand's velocity; a tap on the
 * scrim (or Android's back) fades the whole sheet, since `SheetDrag` has no
 * way to be sent off without a finger.
 */

import { Feather } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';

import { PillButton } from './pill-button';
import { PressScale } from './press-scale';
import { Sheet } from './sheet';
import { Body, Display, Em, Label } from './typography';
import { Colors, MissionsCamera as M, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { Mission } from '@/lib/missions';

const plural = (n: number) => (n === 1 ? '1 for you' : `${n} for you`);

/** The intro's copy, shown once per event (`left:missions-intro:{eventId}`). */
export function missionsIntroCopy(count: number): string {
  return (
    `Small challenges from the host — ${plural(count)}. Tap Missions, pick one, then take ` +
    'the photo. Already took it? Mark it in Your shots. Nobody sees them until the film is ' +
    'developed.'
  );
}

// --- the frame ---------------------------------------------------------------

type OverlayProps = {
  onClose: () => void;
  /** Holds the sheet while a request it started runs. */
  locked?: boolean;
  children: ReactNode;
};

/** A `Sheet` over whatever screen renders it, with a fade for leaving without a drag. */
function SheetOverlay({ onClose, locked = false, children }: OverlayProps) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!locked) onClose();
      return true;
    });
    return () => subscription.remove();
  }, [locked, onClose]);

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      // A cross-fade is also what reduced motion asks for, so it always plays.
      exiting={FadeOut.duration(M.sheet.fadeMs).reduceMotion(ReduceMotion.Never)}
      accessibilityViewIsModal>
      <Sheet onDismiss={onClose} locked={locked}>
        {children}
      </Sheet>
    </Animated.View>
  );
}

/** The rows, scrolling once they outgrow half the window (large text). */
function List({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <ScrollView
      style={{ maxHeight: height * M.sheet.maxListRatio }}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {children}
    </ScrollView>
  );
}

type RowProps = {
  body: string;
  personal?: boolean;
  /** A second line under the mission. */
  detail?: string;
  trailing?: ReactNode;
  dimmed?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  selected?: boolean;
};

function Row({
  body,
  personal,
  detail,
  trailing,
  dimmed,
  onPress,
  disabled,
  accessibilityLabel,
  selected,
}: RowProps) {
  const content = (
    <>
      <View style={styles.rowText}>
        {personal ? <Label small>Just for you</Label> : null}
        <Text style={[styles.rowBody, dimmed && styles.rowBodyDone]}>{body}</Text>
        {detail ? <Body small>{detail}</Body> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      scale={Press.cardScale}
      onPress={onPress}
      style={styles.row}>
      {content}
    </PressScale>
  );
}

const icon = (name: React.ComponentProps<typeof Feather>['name'], color: string = Colors.text) => (
  <Feather name={name} size={M.sheet.iconSize} color={color} />
);

// --- 13: the list ------------------------------------------------------------

type ListSheetProps = {
  missions: Mission[];
  /** The mission the next shot is for. */
  armedId: string | null;
  /** First time on this event: the explanation, and "Got it". */
  intro: boolean;
  /** An open mission was tapped: the next photo is for it. */
  onArm: (mission: Mission) => void;
  onClose: () => void;
};

export function MissionListSheet({ missions, armedId, intro, onArm, onClose }: ListSheetProps) {
  const done = missions.filter((mission) => mission.photoId !== null).length;

  return (
    <SheetOverlay onClose={onClose}>
      <View style={styles.block}>
        <Display size="xxs">
          Your <Em>missions.</Em>
        </Display>
        <Body small>
          {intro
            ? missionsIntroCopy(missions.length)
            : done === missions.length
              ? 'All done. Nobody sees them until the film is developed.'
              : 'Pick one, then take the photo. Already took it? Mark it in Your shots.'}
        </Body>
      </View>

      <List>
        {missions.map((mission) => {
          const isDone = mission.photoId !== null;
          const isArmed = mission.id === armedId;
          return (
            <Row
              key={mission.id}
              body={mission.body}
              personal={mission.personal}
              dimmed={isDone}
              selected={isArmed}
              accessibilityLabel={
                isDone
                  ? `${mission.body}. Done.`
                  : isArmed
                    ? `${mission.body}. Your next photo is for this.`
                    : mission.body
              }
              trailing={
                isDone ? (
                  <View style={styles.trailing}>
                    {icon('check', M.capsule.doneColor)}
                    <Text style={[styles.trailingText, styles.doneText]}>Done</Text>
                  </View>
                ) : isArmed ? (
                  <View style={styles.trailing}>
                    {icon('target')}
                    <Text style={styles.trailingText}>Next photo</Text>
                  </View>
                ) : (
                  icon('camera', Colors.textMuted)
                )
              }
              onPress={isDone ? undefined : () => onArm(mission)}
            />
          );
        })}
      </List>

      {intro ? <PillButton label="Got it" onPress={onClose} /> : null}
    </SheetOverlay>
  );
}

// --- the viewer: which mission was this photo for ------------------------------

type PickerSheetProps = {
  missions: Mission[];
  photoId: string;
  busy: boolean;
  error: string | null;
  onPick: (missionId: string | null) => void;
  onClose: () => void;
};

export function MissionPickerSheet({
  missions,
  photoId,
  busy,
  error,
  onPick,
  onClose,
}: PickerSheetProps) {
  const current = missions.find((mission) => mission.photoId === photoId) ?? null;
  const check = icon('check');

  return (
    <SheetOverlay onClose={onClose} locked={busy}>
      <View style={styles.block}>
        <Display size="xxs">
          Which <Em>mission?</Em>
        </Display>
        <Body small>
          Mark what this photo was for. Nobody sees it until the film is developed.
        </Body>
      </View>

      <List>
        {missions.map((mission) => {
          const here = mission.id === current?.id;
          const elsewhere = !here && mission.photoId !== null;
          return (
            <Row
              key={mission.id}
              body={mission.body}
              personal={mission.personal}
              detail={elsewhere ? 'Done with another photo. Picking it moves it here.' : undefined}
              selected={here}
              disabled={busy}
              accessibilityLabel={
                here
                  ? `${mission.body}. This photo.`
                  : elsewhere
                    ? `${mission.body}. Done with another photo.`
                    : mission.body
              }
              trailing={here ? check : null}
              onPress={here ? onClose : () => onPick(mission.id)}
            />
          );
        })}
        <Row
          body="Not a mission"
          selected={current === null}
          disabled={busy}
          accessibilityLabel="Not a mission"
          trailing={current === null ? check : null}
          onPress={current === null ? onClose : () => onPick(null)}
        />
      </List>

      {error ? (
        <Body small color={Colors.destructive} accessibilityLiveRegion="polite">
          {error}
        </Body>
      ) : null}
    </SheetOverlay>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: M.sheet.gap / 2,
  },
  list: {
    gap: M.sheet.rowGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: M.sheet.rowInnerGap,
    paddingVertical: M.sheet.rowPaddingY,
    paddingHorizontal: M.sheet.rowPaddingX,
    borderRadius: M.sheet.rowRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: M.sheet.rowBorder,
    backgroundColor: M.sheet.rowBg,
  },
  rowText: {
    flex: 1,
    gap: M.sheet.rowGap / 2,
  },
  rowBody: {
    ...Typography.body,
    color: Colors.text,
  },
  rowBodyDone: {
    color: M.sheet.doneTextColor,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: M.capsule.gap,
  },
  trailingText: {
    ...Typography.durationPill,
    color: Colors.text,
  },
  doneText: {
    color: M.capsule.doneColor,
  },
});
