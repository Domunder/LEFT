/**
 * The event image (2026-11-21), filling its parent, drawn through the
 * moment's look — the one picture that stands for a moment in every header:
 * the Moments spotlight, the album, the waiting screen and the QR. The host
 * picks it on 03.1 and changes it from the moment's menu.
 */

import { View, StyleSheet } from 'react-native';

import { LookPreview } from './look-preview';
import { useEventCover } from '@/lib/event-cover';
import type { Event } from '@/lib/events';

type EventCoverImageProps = {
  event: Pick<Event, 'id' | 'cover' | 'look'>;
};

export function EventCoverImage({ event }: EventCoverImageProps) {
  const source = useEventCover(event);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {source !== null ? <LookPreview key={String(source)} look={event.look} source={source} /> : null}
    </View>
  );
}
