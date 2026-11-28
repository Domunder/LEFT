/**
 * The invitation (1.3.0) — what a guest sees when they open an invite link:
 * the event image in the film's look, who invites, the event's name, when it
 * develops and how many photos everyone gets.
 *
 * Two forms of one drawing, so the host's preview cannot drift from what the
 * guest gets:
 *  - `InviteHeader` is the picture with its text. 11 puts it above the name.
 *  - `InviteCardPreview` is the whole of 11 as a still: the header, the name
 *    field and Continue, none of it touchable. The designer shows it inside
 *    the phone and full screen.
 */

import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LookPreview } from './look-preview';
import { Body, Display } from './typography';
import { Colors, Guest, InviteCard as T, Radii } from '@/constants/theme';
import { FontFamily, Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { formatTimeUntil } from '@/lib/event-end';
import type { FilmLook } from '@/lib/events';

export type InviteContent = {
  look: FilmLook;
  /** The event image: a bundled picture or a URL. */
  source: number | string;
  name: string;
  /** Left out when unknown — the chip is not drawn. */
  hostName?: string | null;
  endsAt: Date;
  /** null is the unlimited roll; undefined leaves the line out (not chosen yet). */
  rollSize?: number | null;
  /** Developed already: "Developed" instead of the time left. */
  developed?: boolean;
};

type InviteHeaderProps = InviteContent & { style?: StyleProp<ViewStyle> };

export function InviteHeader({
  look,
  source,
  name,
  hostName,
  endsAt,
  rollSize,
  developed,
  style,
}: InviteHeaderProps) {
  const until = developed ? null : formatTimeUntil(endsAt);
  const develops = until !== null ? t('guest.inviteDevelops', { until }) : t('guest.inviteDeveloped');
  const roll =
    rollSize === undefined
      ? null
      : rollSize === null
        ? t('guest.rollEachUnlimited')
        : t('guest.rollEach', { count: rollSize });

  return (
    <View style={[styles.header, style]}>
      {/* Keyed so a new picture starts a fresh decode instead of showing the last one. */}
      <LookPreview key={String(source)} look={look} source={source} />
      <LinearGradient
        colors={T.fade}
        locations={T.fadeLocations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.text}>
        {hostName ? (
          <View style={styles.chip}>
            <Feather name="mail" size={T.chip.icon} color={Colors.text} />
            <Text style={styles.chipText} numberOfLines={1}>
              {t('guest.invitedBy', { name: hostName })}
            </Text>
          </View>
        ) : null}

        <Display size="lg" numberOfLines={2} adjustsFontSizeToFit style={styles.name}>
          {name}
        </Display>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={T.meta.icon} color={Colors.textDim} />
            <Body small color={Colors.textDim}>
              {develops}
            </Body>
          </View>
          {roll ? (
            <View style={styles.metaItem}>
              <Feather name="camera" size={T.meta.icon} color={Colors.textDim} />
              <Body small color={Colors.textDim}>
                {roll}
              </Body>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** 11 as a still, filling its parent. Nothing in it can be touched. */
export function InviteCardPreview(props: InviteContent) {
  return (
    <View
      style={styles.card}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('onboarding.inviteCardA11y', { name: props.name })}>
      <InviteHeader {...props} style={styles.cardHeader} />

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.fieldText}>{t('guest.namePlaceholder')}</Text>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>{t('common.continue')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'flex-end',
    backgroundColor: Colors.surfaceFaint,
    overflow: 'hidden',
  },
  text: {
    paddingHorizontal: T.paddingX,
    paddingBottom: T.paddingBottom,
    alignItems: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.chip.gap,
    paddingVertical: T.chip.paddingY,
    paddingHorizontal: T.chip.paddingX,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.chip.border,
    backgroundColor: T.chip.bg,
    marginBottom: T.chip.marginBottom,
    maxWidth: '100%',
  },
  chipText: {
    ...Typography.labelSm,
    color: Colors.text,
    flexShrink: 1,
  },
  name: {
    marginBottom: T.nameGap,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: T.meta.gap,
    rowGap: T.meta.itemGap,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.meta.itemGap,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  cardHeader: {
    flex: T.imageShare,
  },
  form: {
    flex: 1 - T.imageShare,
    paddingHorizontal: T.paddingX,
    paddingTop: T.form.paddingTop,
    gap: T.form.gap,
  },
  field: {
    paddingVertical: Guest.field.paddingY,
    paddingHorizontal: Guest.field.paddingX,
    borderRadius: Radii.fieldLg,
    borderWidth: 1,
    borderColor: Guest.field.border,
    backgroundColor: Guest.field.bg,
  },
  fieldText: {
    fontFamily: FontFamily.regular,
    fontSize: Guest.field.fontSize,
    color: Colors.textGhost,
  },
  button: {
    height: T.form.buttonHeight,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.bg,
  },
});
