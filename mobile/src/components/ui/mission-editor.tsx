/**
 * The host's mission list, one row at a time (`(host)/missions`).
 *
 * `MissionRow` is both an existing mission and the "Add a mission" row at the
 * end of a list — the same row, so the composer opens exactly where the new
 * mission will appear. Tap the text to edit it in place; Return or "Save"
 * commits, "Cancel" puts the old text back.
 *
 * The row validates before it asks the server (3–140 characters, the
 * migration's `check`), and shows the server's refusal under the input when it
 * comes anyway. It never changes the list itself: the screen re-reads the list
 * after every write, so what is drawn is what the server holds.
 *
 * A blur keeps the draft. Leaving a half-written mission by scrolling must not
 * throw it away — the row stays open, with its Cancel and Save, until one of
 * them is pressed. An untouched draft simply closes.
 *
 * `MissionCard` is the bordered card the rows sit in (20's settings card), and
 * draws the dividers so a row does not need to know whether it is last.
 */

import { Feather } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Colors, MissionsEditor as T, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { messageFor } from '@/lib/auth-errors';

/**
 * The bounds `event_missions.body` is checked against
 * (`char_length(btrim(body)) between 3 and 140`). Mirrored here only so the
 * row can say so before a round trip; the server stays the authority.
 */
export const MISSION_BODY_MIN = 3;
export const MISSION_BODY_MAX = 140;

/** Null when the text can be saved, else what to say under the input. */
export function missionBodyProblem(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return 'Write the mission first.';
  if (length < MISSION_BODY_MIN) return `At least ${MISSION_BODY_MIN} characters.`;
  if (length > MISSION_BODY_MAX) return `At most ${MISSION_BODY_MAX} characters.`;
  return null;
}

// ---------------------------------------------------------------------------

type MissionCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The hairline card a list of rows sits in, with a divider between rows. */
export function MissionCard({ children, style }: MissionCardProps) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.card, style]}>
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

type MissionRowProps = {
  /** The mission's text. Absent: this is the "Add a mission" row. */
  body?: string;
  /** The composer's label — "Add a mission", "Add a mission for Tom". */
  addLabel?: string;
  /** After the start: drawn as text, nothing to tap. */
  locked?: boolean;
  /**
   * Save the text (already trimmed and validated). Throws to refuse — the row
   * shows `messageFor(error)` under the input and keeps the draft.
   */
  onSave: (body: string) => Promise<void>;
  /** Existing rows only. Throws to refuse, as `onSave`. */
  onDelete?: () => Promise<void>;
  /**
   * For a composer that adds something other than a mission — the screen's
   * "Type a name" row. Defaults are a mission's.
   */
  validate?: (text: string) => string | null;
  maxLength?: number;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

export function MissionRow({
  body,
  addLabel = 'Add a mission',
  locked = false,
  onSave,
  onDelete,
  validate = missionBodyProblem,
  maxLength = MISSION_BODY_MAX,
  placeholder = 'A photo with…',
  autoCapitalize = 'sentences',
}: MissionRowProps) {
  const composer = body === undefined;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(body ?? '');
    setError(null);
    setEditing(true);
  };

  const close = () => {
    setEditing(false);
    setDraft('');
    setError(null);
  };

  const trimmed = draft.trim();
  const unchanged = !composer && trimmed === body?.trim();
  const problem = validate(draft);

  const commit = async () => {
    if (busy) return;
    if (unchanged) {
      close();
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave(trimmed);
      if (composer) {
        // Stay open and focused for the next one, as a list app does.
        setDraft('');
      } else {
        close();
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      // On success the screen's re-read removes this row.
    } catch (e) {
      setError(messageFor(e));
      setBusy(false);
    }
  };

  // -- read-only ------------------------------------------------------------
  if (locked) {
    if (composer) return null;
    return (
      <View style={styles.row}>
        <Text style={[styles.body, styles.bodyLocked]}>{body}</Text>
      </View>
    );
  }

  // -- editing --------------------------------------------------------------
  if (editing) {
    // Only near a mission's limit; a 60-character name never needs counting.
    const showCounter = maxLength > T.editor.counterFrom && draft.length >= T.editor.counterFrom;

    return (
      <View style={styles.editing}>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (error) setError(null);
          }}
          autoFocus
          multiline
          // Return saves; a mission is one line of thought.
          submitBehavior="submit"
          returnKeyType={composer ? 'next' : 'done'}
          onSubmitEditing={() => void commit()}
          onBlur={() => {
            // An untouched draft closes; anything typed waits for Save or Cancel.
            if (composer ? trimmed.length === 0 : unchanged) close();
          }}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          editable={!busy}
          placeholder={composer ? placeholder : undefined}
          placeholderTextColor={Colors.textGhost}
          selectionColor={Colors.text}
          accessibilityLabel={composer ? addLabel : 'Edit mission'}
          style={[styles.body, styles.input]}
        />

        <View style={styles.footer}>
          <Text
            style={[styles.meta, error ? styles.error : null]}
            accessibilityLiveRegion="polite"
            numberOfLines={3}>
            {error ?? (showCounter ? `${draft.length}/${maxLength}` : '')}
          </Text>

          <View style={styles.footerButtons}>
            <TextButton label="Cancel" onPress={close} disabled={busy} />
            <TextButton
              label={busy ? 'Saving…' : composer ? 'Add' : 'Save'}
              onPress={() => void commit()}
              disabled={busy || problem !== null || unchanged}
              strong
            />
          </View>
        </View>
      </View>
    );
  }

  // -- the composer, closed -------------------------------------------------
  if (composer) {
    return (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        onPress={open}
        scale={Press.cardScale}
        style={styles.row}>
        <Feather name="plus" size={T.row.iconSize} color={Colors.textMuted} />
        <Text style={[styles.body, styles.addLabel]}>{addLabel}</Text>
      </PressScale>
    );
  }

  // -- an existing mission --------------------------------------------------
  return (
    <View style={styles.row}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={body}
        accessibilityHint="Edits the mission"
        onPress={open}
        disabled={busy}
        scale={Press.cardScale}
        style={styles.bodyPress}>
        <Text style={styles.body}>{body}</Text>
        {error ? <Text style={[styles.rowError, styles.error]}>{error}</Text> : null}
      </PressScale>

      {onDelete ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Delete mission: ${body}`}
          onPress={() => void remove()}
          disabled={busy}
          scale={Press.iconScale}
          style={styles.action}>
          <Feather
            name="trash-2"
            size={T.row.iconSize}
            color={busy ? Colors.textGhost : Colors.textFaint}
          />
        </PressScale>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

type TextButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The committing action — brighter than its neighbour. */
  strong?: boolean;
};

/** Cancel / Save under an open row. Small text buttons: the row is the surface. */
export function TextButton({ label, onPress, disabled = false, strong = false }: TextButtonProps) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={T.editor.hitSlop}
      scale={Press.iconScale}>
      <Text
        style={[
          styles.textButton,
          strong ? styles.textButtonStrong : null,
          disabled ? styles.textButtonDisabled : null,
        ]}>
        {label}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: T.card.radius,
    borderWidth: 1,
    borderColor: T.card.border,
    backgroundColor: T.card.bg,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.card.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
    paddingVertical: T.row.paddingY,
    paddingHorizontal: T.row.paddingX,
  },
  bodyPress: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    ...Typography.body,
    color: Colors.textStrong,
    flexShrink: 1,
  },
  bodyLocked: {
    color: Colors.textMuted,
  },
  addLabel: {
    color: Colors.textMuted,
  },
  action: {
    width: T.row.actionSize,
    height: T.row.actionSize,
    // The target is 44pt; the glyph sits where the row's padding was.
    marginVertical: T.row.actionInset,
    marginRight: T.row.actionInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editing: {
    paddingVertical: T.row.paddingY,
    paddingHorizontal: T.row.paddingX,
    gap: T.editor.footerGap,
  },
  input: {
    color: Colors.text,
    padding: 0,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.editor.buttonGap,
  },
  meta: {
    ...Typography.metaMd,
    color: Colors.textFaint,
    flex: 1,
  },
  rowError: {
    ...Typography.metaMd,
    marginTop: T.editor.footerGap,
  },
  /** As on 10 and 11: errors are brighter copy, not red — red is Log Out's. */
  error: {
    color: Colors.textMuted,
  },
  textButton: {
    ...Typography.titleSm,
    color: Colors.textMuted,
  },
  textButtonStrong: {
    color: Colors.text,
  },
  textButtonDisabled: {
    color: Colors.textGhost,
  },
});
