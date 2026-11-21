/**
 * Rename, delete and remove a moment (2026-11-21, the user) — one menu, opened
 * by a long press on a Moments card and by the album's ••• button.
 *
 *  - The host: Rename, Delete. Delete is for everyone and asks first, naming
 *    what goes ("All 142 photos are deleted for all 18 people."); a paid
 *    moment adds that the purchase is not refunded.
 *  - A guest: Remove from Moments — hidden on this phone only
 *    (`lib/hidden-moments.ts`); the invite link brings it back.
 *
 * System UI on purpose: an action sheet for the menu and, on iOS, the alert
 * with a text field for the name — the way Photos renames an album.
 * **`Alert.prompt` is iOS only**: on Android the menu leaves Rename out until
 * that build exists and gets its own field.
 */

import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { deleteEvent, renameEvent, type Event } from '@/lib/events';
import { messageFor } from '@/lib/auth-errors';
import { hideMoment } from '@/lib/hidden-moments';
import type { RollSize } from '@/lib/roll';
import { tierFor } from '@/lib/tiers';

export type MomentActionsTarget = {
  event: Pick<Event, 'id' | 'name' | 'host_id' | 'max_members' | 'roll_size'>;
  isHost: boolean;
  /** For the delete warning. */
  photoCount: number;
  memberCount: number;
};

type Handlers = {
  /** After a rename: the new name, already saved. */
  onRenamed: (name: string) => void;
  /** After a delete or a remove: the moment is gone from this user's list. */
  onGone: () => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** Whether the host paid for this moment — only for the warning's copy. */
function wasPaid(event: MomentActionsTarget['event']): boolean {
  return tierFor(event.max_members, event.roll_size as RollSize) !== null;
}

export function useMomentActions({ onRenamed, onGone }: Handlers) {
  const rename = useCallback(
    (target: MomentActionsTarget) => {
      Alert.prompt(
        'Rename moment',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            isPreferred: true,
            onPress: (value?: string) => {
              const name = (value ?? '').trim();
              if (name.length === 0 || name === target.event.name) return;
              renameEvent(target.event.id, name)
                .then(() => onRenamed(name))
                .catch((e) => Alert.alert("Couldn't rename the moment", messageFor(e)));
            },
          },
        ],
        'plain-text',
        target.event.name
      );
    },
    [onRenamed]
  );

  const confirmDelete = useCallback(
    (target: MomentActionsTarget) => {
      const photos = plural(target.photoCount, 'photo is', 'photos are');
      const people = target.memberCount === 1 ? 'you' : `all ${target.memberCount} people`;
      const lines = [
        target.photoCount > 0
          ? `All ${photos} deleted for ${people}.`
          : `The moment is deleted for ${people}.`,
        "This can't be undone.",
      ];
      if (wasPaid(target.event)) lines.push("Your purchase isn't refunded.");

      Alert.alert(`Delete “${target.event.name}”?`, lines.join(' '), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(target.event.id)
              .then(onGone)
              .catch((e) => Alert.alert("Couldn't delete the moment", messageFor(e)));
          },
        },
      ]);
    },
    [onGone]
  );

  const confirmRemove = useCallback(
    (target: MomentActionsTarget) => {
      Alert.alert(
        `Remove “${target.event.name}”?`,
        'It disappears from your Moments on this phone. Your photos stay in the group, and the invite link brings it back.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              hideMoment(target.event.id)
                .then(onGone)
                .catch((e) => Alert.alert("Couldn't remove the moment", messageFor(e)));
            },
          },
        ]
      );
    },
    [onGone]
  );

  return useCallback(
    (target: MomentActionsTarget) => {
      type Item = { label: string; destructive?: boolean; run: () => void };
      const items: Item[] = target.isHost
        ? [
            ...(Platform.OS === 'ios'
              ? [{ label: 'Rename', run: () => rename(target) }]
              : []),
            { label: 'Delete moment', destructive: true, run: () => confirmDelete(target) },
          ]
        : [{ label: 'Remove from Moments', destructive: true, run: () => confirmRemove(target) }];

      if (Platform.OS === 'ios') {
        const labels = [...items.map((item) => item.label), 'Cancel'];
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: target.event.name,
            options: labels,
            cancelButtonIndex: labels.length - 1,
            destructiveButtonIndex: items.flatMap((item, i) => (item.destructive ? [i] : [])),
            userInterfaceStyle: 'dark',
          },
          (index) => items[index]?.run()
        );
        return;
      }

      Alert.alert(target.event.name, undefined, [
        ...items.map((item) => ({
          text: item.label,
          style: item.destructive ? ('destructive' as const) : ('default' as const),
          onPress: item.run,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    },
    [confirmDelete, confirmRemove, rename]
  );
}
