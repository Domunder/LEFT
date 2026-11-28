/**
 * The host's mission list, one row at a time (`(host)/missions`).
 *
 * `MissionRow` is both an existing mission and the "Add a mission" row at the
 * end of a list — the same row, so the composer opens exactly where the new
 * mission will appear. Tap the text to edit it in place; Return, "Save" or
 * leaving the row commits — there is no Cancel (decided 2026-11-18 by the
 * user), as in Reminders.
 *
 * The row validates before it asks the server (3–140 characters, the
 * migration's `check`), and shows the server's refusal under the input when it
 * comes anyway. It never changes the list itself: the screen re-reads the list
 * after every write, so what is drawn is what the server holds.
 *
 * A blur saves. An untouched or emptied composer simply closes; a draft the
 * server or the length check refuses stays open with the reason under it.
 *
 * `MissionCard` is the bordered card the rows sit in (20's settings card), and
 * draws the dividers so a row does not need to know whether it is last.
 */

import { Feather } from '@expo/vector-icons';
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Colors, MissionsEditor as T, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { messageFor } from '@/lib/auth-errors';
import { t } from '@/i18n';

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
  if (length === 0) return t('missions.bodyRequired');
  if (length < MISSION_BODY_MIN) return t('missions.tooShort', { min: MISSION_BODY_MIN });
  if (length > MISSION_BODY_MAX) return t('missions.tooLong', { max: MISSION_BODY_MAX });
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
  /**
   * Select mode: the row is a checkbox — a tap toggles it, nothing edits or
   * deletes. Existing rows only; a composer renders nothing while selecting.
   */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  /** Told when the row opens or closes its editor (a swipe must not delete then). */
  onEditingChange?: (editing: boolean) => void;
  /** Existing rows: drawn after the text instead of the delete button. */
  trailing?: ReactNode;
  /** A composer that opens as soon as it mounts (the Guests sheet's +). */
  startOpen?: boolean;
};

export function MissionRow({
  body,
  addLabel = t('missions.addMission'),
  locked = false,
  onSave,
  onDelete,
  validate = missionBodyProblem,
  maxLength = MISSION_BODY_MAX,
  placeholder = t('missions.bodyPlaceholder'),
  autoCapitalize = 'sentences',
  selecting = false,
  selected = false,
  onToggle,
  onEditingChange,
  trailing,
  startOpen = false,
}: MissionRowProps) {
  const composer = body === undefined;

  const [editing, setEditing] = useState(startOpen);

  // Read through a ref so a new callback identity is not an editing change.
  const editingListener = useRef(onEditingChange);
  editingListener.current = onEditingChange;
  useEffect(() => {
    editingListener.current?.(editing);
  }, [editing]);
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

  /** Blur and a button can land together; only one save may run. */
  const saving = useRef(false);

  /** `leaving`: the field lost focus, so a composer closes after adding. */
  const commit = async (leaving = false) => {
    if (saving.current) return;
    if (unchanged || (composer && trimmed.length === 0)) {
      close();
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }

    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(trimmed);
      if (composer && !leaving) {
        // Stay open and focused for the next one, as a list app does.
        setDraft('');
      } else {
        close();
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      saving.current = false;
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

  /*
    A list of missions (rows with a trailing assignee) and every composer get a
    leading column the width of Select's check, so the text of a mission, the
    "+ Add" label and a ticked row all start on the same line — as in Reminders.
  */
  const listed = composer || trailing !== undefined;
  const bullet = listed ? (
    <View style={styles.lead}>
      <View style={styles.bullet} />
    </View>
  ) : null;
  /** Keeps the text on the mission column where there is no bullet. */
  const spacer = listed ? <View style={styles.lead} /> : null;

  // -- read-only ------------------------------------------------------------
  if (locked) {
    if (composer) return null;
    return (
      <View style={styles.row}>
        {bullet}
        <Text style={[styles.body, styles.bodyLocked, styles.selectBody]}>{body}</Text>
        {trailing}
      </View>
    );
  }

  // -- select mode ----------------------------------------------------------
  if (selecting) {
    if (composer) return null;
    return (
      <PressScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={body}
        onPress={onToggle}
        scale={Press.cardScale}
        style={styles.row}>
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? (
            <Feather name="check" size={T.select.iconSize} color={Colors.onLight} />
          ) : null}
        </View>
        <Text style={[styles.body, styles.selectBody]}>{body}</Text>
      </PressScale>
    );
  }

  // -- editing --------------------------------------------------------------
  if (editing) {
    // Only near a mission's limit; a 60-character name never needs counting.
    const showCounter = maxLength > T.editor.counterFrom && draft.length >= T.editor.counterFrom;

    return (
      <View style={styles.editing}>
        <View style={styles.editRow}>
        {composer ? spacer : bullet}
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
          // Leaving the row saves it, as in Reminders.
          onBlur={() => void commit(true)}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          editable={!busy}
          placeholder={composer ? placeholder : undefined}
          placeholderTextColor={Colors.textGhost}
          selectionColor={Colors.text}
          accessibilityLabel={composer ? addLabel : t('missions.editMission')}
          style={[styles.body, styles.input]}
        />
        {/* The + (or ✓ when editing) is the button that adds: where the eye ends. */}
        <SubmitButton
          icon={composer ? 'plus' : 'check'}
          label={composer ? addLabel : t('missions.saveMission')}
          busy={busy}
          disabled={problem !== null || unchanged}
          onPress={() => void commit()}
        />
        </View>

        {error || showCounter ? (
          <Text
            style={[styles.meta, listed && styles.footerIndented, error ? styles.error : null]}
            accessibilityLiveRegion="polite"
            numberOfLines={3}>
            {error ?? `${draft.length}/${maxLength}`}
          </Text>
        ) : null}
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
        {spacer}
        <Text style={[styles.body, styles.addLabel]}>{addLabel}</Text>
        <View style={[styles.submit, styles.submitOn]}>
          <Feather name="plus" size={T.lead.plusIconSize} color={Colors.onLight} />
        </View>
      </PressScale>
    );
  }

  // -- an existing mission --------------------------------------------------
  return (
    <View style={styles.row}>
      {bullet}
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={body}
        accessibilityHint={t('missions.editHint')}
        onPress={open}
        disabled={busy}
        scale={Press.cardScale}
        style={styles.bodyPress}>
        <Text style={styles.body}>{body}</Text>
        {error ? <Text style={[styles.rowError, styles.error]}>{error}</Text> : null}
      </PressScale>

      {trailing !== undefined ? (
        trailing
      ) : onDelete ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t('missions.deleteMissionA11y', { body: body ?? '' })}
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

type SubmitProps = {
  icon: 'plus' | 'check';
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** The round + / ✓ at the end of an open row — the same column as the assignee chips. */
function SubmitButton({ icon, label, busy, disabled, onPress }: SubmitProps) {
  const off = disabled || busy;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      onPress={onPress}
      disabled={off}
      hitSlop={T.chip.hitSlop}
      scale={Press.iconScale}
      style={[styles.submit, off ? styles.submitOff : styles.submitOn]}>
      {busy ? (
        <ActivityIndicator size="small" color={Colors.textMuted} />
      ) : (
        <Feather
          name={icon}
          size={T.lead.plusIconSize}
          color={off ? Colors.textGhost : Colors.onLight}
        />
      )}
    </PressScale>
  );
}

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
    flex: 1,
  },
  lead: {
    width: T.lead.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullet: {
    width: T.lead.bulletSize,
    height: T.lead.bulletSize,
    borderRadius: T.lead.bulletSize / 2,
    backgroundColor: T.lead.bulletColor,
  },
  submit: {
    width: T.chip.height,
    height: T.chip.height,
    borderRadius: T.chip.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOn: {
    backgroundColor: Colors.text,
  },
  submitOff: {
    backgroundColor: Colors.surfaceSubtle,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
  },
  footerIndented: {
    paddingLeft: T.lead.size + T.row.gap,
  },
  check: {
    width: T.select.size,
    height: T.select.size,
    borderRadius: T.select.size / 2,
    borderWidth: 1.5,
    borderColor: T.select.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  selectBody: {
    flex: 1,
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
    flex: 1,
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
