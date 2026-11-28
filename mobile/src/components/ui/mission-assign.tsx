/**
 * Who a mission is for — the host's Missions screen, Reminders-style.
 *
 * Decided 2026-11-18 by the user, after comparing how Apple Reminders and
 * Todoist assign an item: every mission row carries its assignee on the right
 * (`AssigneeChip`), a tap there opens `AssignSheet` — "Anyone", every guest,
 * and "Someone not here yet" — and the guests themselves live in
 * `GuestsSheet`, opened from the screen's "Guests" row, with a + for a name.
 *
 * **Everyone who joined is listed without the host doing anything.** On the
 * server a personal mission points at a `mission_people` row; a joined guest
 * without one is listed from the roster (`kind: 'member'`) and gets their row
 * only when a mission is first given to them (`ensurePersonFor` on the
 * screen). Named people who have not joined yet are `kind: 'named'` with no
 * holder.
 */

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { MissionCard, MissionRow } from './mission-editor';
import { SheetList, SheetOverlay } from './mission-sheet';
import { PressScale } from './press-scale';
import { Display, Label } from './typography';
import { Colors, MissionsEditor as T, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { EventMember } from '@/lib/events';
import type { EventMission, HostMissions } from '@/lib/missions';
import { t } from '@/i18n';

type Person = HostMissions['people'][number];

/** One person the host can give a mission to. */
export type Guest =
  | {
      kind: 'named';
      key: string;
      name: string;
      person: Person;
      /** The joined guest holding the name, if any. */
      member: EventMember | undefined;
    }
  | {
      kind: 'member';
      key: string;
      name: string;
      member: EventMember;
    };

/** Where a mission goes: a listed person, a joined guest, a new name, or anyone. */
export type AssignTarget =
  | { kind: 'anyone' }
  | { kind: 'person'; personId: string }
  | { kind: 'member'; member: EventMember }
  | { kind: 'new'; name: string };

const NAME_MAX = 60;

function nameProblem(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return t('missions.nameRequired');
  if (length > NAME_MAX) return t('missions.tooLong', { max: NAME_MAX });
  return null;
}

/**
 * "Add someone not here yet" — the same row as the missions list's "Add a
 * mission": grey label, round + on the right that adds, Return or leaving the
 * row saves. Sits first, so with the keyboard up it is what stays in view.
 */
function NameComposer({ onSave }: { onSave: (name: string) => Promise<void> }) {
  return (
    <MissionCard>
      <MissionRow
        key="add-name"
        addLabel={t('missions.addSomeone')}
        placeholder={t('missions.namePlaceholder')}
        autoCapitalize="words"
        maxLength={NAME_MAX}
        validate={nameProblem}
        onSave={onSave}
      />
    </MissionCard>
  );
}

/**
 * Everyone, in the order a host looks for them: you, then who joined (A–Z),
 * then names still waiting for their guest.
 */
export function buildGuests(
  people: Person[],
  members: EventMember[],
  selfId: string | null,
): Guest[] {
  const byName = (a: Guest, b: Guest) => a.name.localeCompare(b.name);

  const named: Guest[] = people.map((person) => ({
    kind: 'named',
    key: person.id,
    name: person.name,
    person,
    member: members.find((m) => m.user_id === person.claimed_by),
  }));
  const loose: Guest[] = members
    .filter((m) => !people.some((p) => p.claimed_by === m.user_id))
    .map((member) => ({
      kind: 'member',
      key: member.user_id,
      name: member.display_name,
      member,
    }));

  const joined = [...named.filter((g) => g.member), ...loose];
  const self = joined.filter((g) => g.member?.user_id === selfId);
  const others = joined.filter((g) => g.member?.user_id !== selfId).sort(byName);
  const waiting = named.filter((g) => !g.member).sort(byName);
  return [...self, ...others, ...waiting];
}

export function guestLabel(guest: Guest, selfId: string | null): string {
  return guest.member?.user_id === selfId
    ? t('missions.nameYou', { name: guest.name })
    : guest.name;
}

// ---------------------------------------------------------------------------

type ChipProps = {
  /** The person's name; undefined for a mission anyone can get. */
  name: string | undefined;
  /** Read-only after the start: the name as text, nothing to tap. */
  locked: boolean;
  onPress: () => void;
};

/** The assignee at the end of a mission row — a name, or a quiet "give to". */
export function AssigneeChip({ name, locked, onPress }: ChipProps) {
  if (locked) {
    return name ? (
      <Text style={styles.chipLockedText} numberOfLines={1}>
        {name}
      </Text>
    ) : null;
  }

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={
        name ? t('missions.assignedA11y', { name }) : t('missions.unassignedA11y')
      }
      onPress={onPress}
      hitSlop={T.chip.hitSlop}
      scale={Press.iconScale}
      style={[styles.chip, name ? styles.chipNamed : styles.chipEmpty]}>
      {name ? (
        <Text style={styles.chipText} numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <Feather name="user-plus" size={T.chip.iconSize} color={Colors.textFaint} />
      )}
    </PressScale>
  );
}

// ---------------------------------------------------------------------------

type OptionProps = {
  label: string;
  detail?: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  checked?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

function Option({ label, detail, icon, checked = false, onPress, disabled }: OptionProps) {
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      onPress={onPress}
      disabled={disabled}
      scale={Press.cardScale}
      style={styles.option}>
      <View style={styles.optionIcon}>
        <Feather name={icon} size={T.row.iconSize} color={Colors.textMuted} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
      {checked ? <Feather name="check" size={T.row.iconSize} color={Colors.text} /> : null}
    </PressScale>
  );
}

type AssignSheetProps = {
  mission: EventMission;
  guests: Guest[];
  selfId: string | null;
  busy: boolean;
  onAssign: (target: AssignTarget) => void;
  onClose: () => void;
};

/** "Who gets this?" — Anyone, every guest, or a name for someone not here yet. */
export function AssignSheet({
  mission,
  guests,
  selfId,
  busy,
  onAssign,
  onClose,
}: AssignSheetProps) {
  const current = mission.person_id;

  return (
    <SheetOverlay onClose={onClose} locked={busy} listLast>
      <Label small>{t('missions.whoGetsThis')}</Label>
      <Display size="xxs" numberOfLines={3}>
        {mission.body}
      </Display>

      <SheetList last>
        <NameComposer onSave={async (name) => onAssign({ kind: 'new', name })} />
        <Option
          key="anyone"
          label={t('missions.anyone')}
          detail={t('missions.dealtAtRandom')}
          icon="shuffle"
          checked={current === null}
          disabled={busy}
          onPress={() => onAssign({ kind: 'anyone' })}
        />
        {guests.map((guest) => (
          <Option
            key={guest.key}
            label={guestLabel(guest, selfId)}
            detail={guest.member ? undefined : t('missions.notHereYet')}
            icon={guest.member ? 'user' : 'user-x'}
            checked={guest.kind === 'named' && guest.person.id === current}
            disabled={busy}
            onPress={() =>
              onAssign(
                guest.kind === 'named'
                  ? { kind: 'person', personId: guest.person.id }
                  : { kind: 'member', member: guest.member },
              )
            }
          />
        ))}
      </SheetList>
    </SheetOverlay>
  );
}

// ---------------------------------------------------------------------------

type GuestsSheetProps = {
  guests: Guest[];
  selfId: string | null;
  /** Missions given to each person id, and how many a guest is dealt. */
  countFor: (guest: Guest) => number;
  perGuest: number;
  locked: boolean;
  onAddName: (name: string) => Promise<void>;
  /** Options for a listed name: link, unlink, remove. */
  onNameMenu: (guest: Extract<Guest, { kind: 'named' }>) => void;
  /** "Who is Lisa?" — linking a listed name to someone who joined. */
  linking: {
    name: string;
    members: EventMember[];
    onPick: (member: EventMember) => void;
    onCancel: () => void;
  } | null;
  onClose: () => void;
};

/** Everyone in the group and every name the host listed, with a + for one more. */
export function GuestsSheet({
  guests,
  selfId,
  countFor,
  perGuest,
  locked,
  onAddName,
  onNameMenu,
  linking,
  onClose,
}: GuestsSheetProps) {
  const joined = guests.filter((g) => g.member).length;

  if (linking) {
    return (
      <SheetOverlay onClose={onClose} listLast>
        <Label small>{t('missions.linkName')}</Label>
        <Display size="xxs">{t('missions.whoIs', { name: linking.name })}</Display>
        <SheetList last>
          {linking.members.map((member) => (
            <Option
              key={member.user_id}
              label={
                member.user_id === selfId
                  ? t('missions.nameYou', { name: member.display_name })
                  : member.display_name
              }
              icon="user"
              onPress={() => linking.onPick(member)}
            />
          ))}
          <Option label={t('common.cancel')} icon="x" onPress={linking.onCancel} />
        </SheetList>
      </SheetOverlay>
    );
  }

  return (
    <SheetOverlay onClose={onClose} listLast>
      <View style={styles.sheetHeader}>
        <View style={styles.optionText}>
          <Display size="xxs">{t('missions.guests')}</Display>
          <Text style={styles.optionDetail}>
            {guests.length > joined
              ? t('missions.joinedAndWaiting', { joined, waiting: guests.length - joined })
              : t('missions.joined', { joined })}
          </Text>
        </View>
      </View>

      <SheetList last>
        {!locked ? <NameComposer onSave={onAddName} /> : null}

        {guests.length === 0 ? (
          <Text style={styles.optionDetail}>
            {t('missions.guestsEmpty')}
          </Text>
        ) : null}

        {guests.map((guest) => {
          const count = countFor(guest);
          const detail = [
            guest.member
              ? guest.kind === 'named' && guest.member.display_name !== guest.name
                ? t('missions.joinedAs', { name: guest.member.display_name })
                : t('missions.joinedStatus')
              : t('missions.notHereYetPicks'),
            count > 0
              ? count > perGuest && perGuest > 0
                ? t('missions.guestMissionsCapped', { count, limit: perGuest })
                : t('missions.guestMissions', { count })
              : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <View key={guest.key} style={styles.option}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: guest.member ? Colors.green : T.person.waitingDot,
                  },
                ]}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel} numberOfLines={1}>
                  {guestLabel(guest, selfId)}
                </Text>
                <Text style={styles.optionDetail}>{detail}</Text>
              </View>
              {guest.kind === 'named' && !locked ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={t('missions.optionsFor', { name: guest.name })}
                  onPress={() => onNameMenu(guest)}
                  scale={Press.iconScale}
                  style={styles.more}>
                  <Feather name="more-horizontal" size={T.row.iconSize} color={Colors.textMuted} />
                </PressScale>
              ) : null}
            </View>
          );
        })}
      </SheetList>
    </SheetOverlay>
  );
}

const styles = StyleSheet.create({
  // Both sit at the row's right edge, the same height, so the column of
  // assignees lines up whether a row has a name or not.
  chip: {
    height: T.chip.height,
    borderRadius: T.chip.height / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNamed: {
    maxWidth: T.chip.maxWidth,
    paddingHorizontal: T.chip.paddingX,
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.hairlineStrong,
  },
  chipEmpty: {
    width: T.chip.height,
    borderColor: Colors.hairline,
    borderStyle: 'dashed',
  },
  chipText: {
    ...Typography.metaMd,
    color: Colors.text,
  },
  chipLockedText: {
    ...Typography.metaMd,
    color: Colors.textMuted,
    maxWidth: T.chip.maxWidth,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
  },
  // Plain rows under the add row, columned like a mission row: lead, text, trailing.
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
    minHeight: T.row.actionSize,
    paddingHorizontal: T.row.paddingX,
  },
  optionIcon: {
    width: T.lead.size,
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: T.person.statusGap,
  },
  optionLabel: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  optionDetail: {
    ...Typography.metaMd,
    color: Colors.textFaint,
  },
  dot: {
    width: T.person.dotSize,
    height: T.person.dotSize,
    borderRadius: T.person.dotSize / 2,
    marginHorizontal: (T.lead.size - T.person.dotSize) / 2,
  },
  more: {
    width: T.row.actionSize,
    height: T.row.actionSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.row.actionInset,
  },
});
