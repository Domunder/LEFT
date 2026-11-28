/**
 * A moment's menu (2026-11-21, the user) — opened by a long press on a
 * Moments card and by the album's ••• button.
 *
 *  - The host: **Event settings** (1.3.0: one sheet, `(modals)/event-settings`,
 *    for name, end, reveal and the invitation image — it replaces "Rename"
 *    and "Change image", and with them the iOS-only `Alert.prompt`) and
 *    Delete. Delete is for everyone and asks first, naming
 *    what goes ("All 142 photos are deleted for all 18 people."); a paid
 *    moment adds that the purchase is not refunded.
 *  - A guest: Remove from Moments — hidden on this phone only
 *    (`lib/hidden-moments.ts`); the invite link brings it back.
 *
 * System UI on purpose for the menu and its alerts.
 */

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { t } from '@/i18n';
import { deleteEvent, type Event } from '@/lib/events';
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
  /**
   * Unused since 1.3.0: the name is changed in the settings sheet, and the
   * screens re-read the event when they regain focus. Kept so callers compile.
   */
  onRenamed?: (name: string) => void;
  /** After a delete or a remove: the moment is gone from this user's list. */
  onGone: () => void;
};

/** Whether the host paid for this moment — only for the warning's copy. */
function wasPaid(event: MomentActionsTarget['event']): boolean {
  return tierFor(event.max_members, event.roll_size as RollSize) !== null;
}

export function useMomentActions({ onGone }: Handlers) {
  const router = useRouter();
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
            {
              label: t('library.menuSettings'),
              run: () =>
                router.push({
                  pathname: '/(modals)/event-settings',
                  params: { eventId: target.event.id },
                }),
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
    [confirmDelete, confirmRemove, router]
  );
}
