/**
 * A guest book entry as an instant print (1.3.0, step 9): a square picture in
 * a paper frame with the note and the author's name on the wide bottom edge —
 * or, for an entry without a picture, the same paper with only the words.
 *
 * Everything scales with `width`, so the grid's small prints and the large one
 * in the detail view are the same drawing. The one light surface in a dark
 * app, on purpose: it is a paper object lying on the page.
 */

import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Guestbook as T } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type PolaroidProps = {
  width: number;
  photoUri: string | null;
  note: string | null;
  author?: string | null;
  /** Degrees. The grid lays its prints down slightly askew. */
  tilt?: number;
  /** Lines of the note shown; the detail view shows all of it. */
  noteLines?: number;
  style?: StyleProp<ViewStyle>;
};

export function Polaroid({
  width,
  photoUri,
  note,
  author,
  tilt = 0,
  noteLines,
  style,
}: PolaroidProps) {
  const frame = width * T.frame;
  const inner = width - 2 * frame;
  const textOnly = photoUri === null;
  const noteSize = width * (textOnly ? T.textOnly.noteSize : T.noteSize);
  const authorSize = Math.max(T.authorMin, width * T.authorSize);

  return (
    <View
      style={[
        styles.paper,
        {
          width,
          padding: frame,
          paddingBottom: frame * T.footPadding,
          minHeight: textOnly ? width * T.textOnly.minHeight : undefined,
          transform: [{ rotate: `${tilt}deg` }],
        },
        style,
      ]}>
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={[styles.photo, { width: inner, height: inner }]}
          contentFit="cover"
          transition={T.fadeMs}
        />
      ) : null}

      <View
        style={[
          styles.foot,
          { gap: frame / 2 },
          textOnly ? styles.footTextOnly : { minHeight: width * T.foot, paddingTop: frame },
        ]}>
        {note ? (
          <Text
            numberOfLines={noteLines}
            maxFontSizeMultiplier={T.maxFontScale}
            style={[styles.note, { fontSize: noteSize, lineHeight: noteSize * T.noteLine }]}>
            {note}
          </Text>
        ) : null}
        {author ? (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={T.maxFontScale}
            style={[styles.author, { fontSize: authorSize }]}>
            {author}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: T.paper,
    borderRadius: T.radius,
    shadowColor: T.shadow.color,
    shadowOpacity: T.shadow.opacity,
    shadowRadius: T.shadow.radius,
    shadowOffset: T.shadow.offset,
    elevation: T.shadow.elevation,
  },
  photo: {
    backgroundColor: T.photoBg,
  },
  foot: {
    justifyContent: 'center',
  },
  footTextOnly: {
    flex: 1,
    justifyContent: 'space-between',
  },
  note: {
    ...Typography.displayItalic,
    color: T.ink,
  },
  author: {
    ...Typography.labelSm,
    color: T.inkSoft,
  },
});
