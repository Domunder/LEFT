/**
 * The one idea the whole app rests on, in the two places it has to be taught.
 *
 * Everybody films into the same pool of time, and when it is gone the film is
 * finished. Extracted out of 10.1 because there are now two audiences for it and
 * neither can assume the other screen did the teaching:
 *
 *  - a **host** meets it as a sheet behind the info button on 10, by choice
 *  - a **guest** meets it on 12, unasked, because they never saw 02→05.1 — they
 *    scanned a QR and landed in somebody else's event knowing nothing about the
 *    format, and 12 is the one screen where they have nothing to do but read
 *
 * Content only: no sheet, no scrim, no dismiss. 10.1 frames it as a modal card
 * with a "Got it"; 12 sets it straight on the page. The `GroupInfo` spacing
 * tokens travel with it, since they describe this block's internal rhythm rather
 * than the sheet's.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BudgetBar } from '@/components/ui/budget-bar';
import { Body, Display, Em } from '@/components/ui/typography';
import { GroupInfo } from '@/constants/theme';

export function BudgetExplainer({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Display size="xs" style={styles.headline}>
        One film.{'\n'}
        <Em>One shared budget.</Em>
      </Display>

      <Body small style={styles.copy}>
        Everyone in the group draws from the same pool of filming time. When it runs out, the film
        is done — so make every clip count.
      </Body>

      <BudgetBar />
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginBottom: GroupInfo.headlineGap,
  },
  copy: {
    marginBottom: GroupInfo.bodyGap,
  },
});
