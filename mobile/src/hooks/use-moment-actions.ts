/**
 * Rename, delete and remove a moment (2026-11-21, the user) — one menu, opened
 * by a long press on a Moments card and by the album's ••• button.
 *
 *  - The host: Rename, Change image (`(host)/cover`, 2026-11-21), Delete. Delete is for everyone and asks first, naming
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

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { t } from '@/i18n';
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

/** Whether the host paid for this moment — only for the warning's copy. */
function wasPaid(event: MomentActionsTarget['event']): boolean {
  return tierFor(event.max_members, event.roll_size as RollSize) !== null;
}

export function useMomentActions({ onRenamed, onGone }: Handlers) {
  const router = useRouter();
  const rename = useCallback(
    (target: MomentActionsTarget) => {
      Alert.prompt(
        t('library.renameTitle'),
        undefined,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.save'),
            isPreferred: true,
            onPress: (value?: string) => {
              const name = (value ?? '').trim();
              if (name.length === 0 || name === target.event.name) return;
              renameEvent(target.event.id, name)
                .then(() => onRenamed(name))
                .catch((e) => Alert.alert(t('library.renameFailed'), messageFor(e)));
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
      const alone = target.memberCount === 1;
      const counts = { count: target.photoCount, people: target.memberCount };
      // Whole sentences, one after the other.
      const lines = [
        target.photoCount > 0
          ? t(alone ? 'library.deletePhotosForYou' : 'library.deletePhotosForAll', counts)
          : alone
            ? t('library.deleteEmptyForYou')
            : t('library.deleteEmptyForAll', counts),
        t('library.deleteNoUndo'),
      ];
      if (wasPaid(target.event)) lines.push(t('library.deleteNoRefund'));

      Alert.alert(t('library.deleteTitle', { name: target.event.name }), lines.join(' '), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteEvent(target.event.id)
              .then(onGone)
              .catch((e) => Alert.alert(t('library.deleteFailed'), messageFor(e)));
          },
        },
      ]);
    },
    [onGone]
  );

  const confirmRemove = useCallback(
    (target: MomentActionsTarget) => {
      Alert.alert(
        t('library.removeTitle', { name: target.event.name }),
        t('library.removeBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.remove'),
            style: 'destructive',
            onPress: () => {
              hideMoment(target.event.id)
                .then(onGone)
                .catch((e) => Alert.alert(t('library.removeFailed'), messageFor(e)));
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
              ? [{ label: t('library.menuRename'), run: () => rename(target) }]
              : []),
            {
              label: t('library.menuChangeImage'),
              run: () =>
                router.push({ pathname: '/(host)/cover', params: { eventId: target.event.id } }),
            },
            { label: t('library.menuDelete'), destructive: true, run: () => confirmDelete(target) },
          ]
        : [{ label: t('library.menuRemove'), destructive: true, run: () => confirmRemove(target) }];

      if (Platform.OS === 'ios') {
        const labels = [...items.map((item) => item.label), t('common.cancel')];
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
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    },
    [confirmDelete, confirmRemove, rename, router]
  );
}
