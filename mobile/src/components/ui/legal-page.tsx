/**
 * Shared shell for the Terms and Privacy screens.
 *
 * Neither is in the prototype — they are required by the app stores rather than
 * drawn by the design — so they follow the app's tokens instead of an artboard.
 * One component for both keeps them from drifting apart, and keeps the documents
 * themselves as plain data.
 *
 * Content is a section list rather than markdown: there is no markdown renderer
 * in the project, and adding one to draw two static documents would be a large
 * dependency for no gain.
 */

import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, Label } from '@/components/ui/typography';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, LegalPage as Token, Spacing } from '@/constants/theme';

/** A paragraph, or a bulleted list of them. */
export type LegalBlock = string | { bullets: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

type LegalPageProps = {
  title: string;
  /** ISO date the document last changed, e.g. '2026-08-19'. */
  updated: string;
  /** Shown above the first section — what the document is, in one or two lines. */
  intro?: string;
  sections: LegalSection[];
};

export function LegalPageView({ title, updated, intro, sections }: LegalPageProps) {
  return (
    <Screen edges={['top']}>
      <ScreenHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        // The document is the whole screen; let the scroll position survive a
        // rotation or a keyboard rather than snapping back to the top.
        contentInsetAdjustmentBehavior="automatic">
        <Display size="sm">{title}</Display>
        <Caption style={styles.updated}>Last updated {formatUpdated(updated)}</Caption>

        {intro ? (
          <Body color={Colors.textMuted} style={styles.intro}>
            {intro}
          </Body>
        ) : null}

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Label style={styles.heading}>{section.heading}</Label>
            {section.blocks.map((block, i) => (
              <LegalBlockView key={i} block={block} />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') {
    return (
      <Body color={Colors.textMuted} style={styles.paragraph}>
        {block}
      </Body>
    );
  }

  return (
    <View style={styles.paragraph}>
      {block.bullets.map((bullet) => (
        // A Text-with-bullet-prefix would let the glyph wrap into the text on a
        // long line; two columns keep the hanging indent.
        <View key={bullet} style={styles.bulletRow}>
          <Body color={Colors.textFaint} style={styles.bulletGlyph}>
            •
          </Body>
          <Body color={Colors.textMuted} style={styles.bulletText}>
            {bullet}
          </Body>
        </View>
      ))}
    </View>
  );
}

/** "19 August 2026" — spelled out, since a numeric date is read differently per region. */
function formatUpdated(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Token.paddingBottom,
  },
  updated: {
    marginTop: Token.headlineGap,
  },
  intro: {
    marginTop: Spacing.lg,
    lineHeight: Token.lineHeight,
  },
  section: {
    marginTop: Token.sectionGap,
  },
  heading: {
    marginBottom: Token.headingGap,
  },
  paragraph: {
    marginBottom: Token.paragraphGap,
    lineHeight: Token.lineHeight,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Token.bulletGap,
    marginBottom: Spacing.xs,
  },
  bulletGlyph: {
    lineHeight: Token.lineHeight,
  },
  bulletText: {
    flex: 1,
    lineHeight: Token.lineHeight,
  },
});
