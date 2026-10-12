/**
 * 02 · Onboarding — Event
 *
 * "What are you capturing?" — the event-type picker, plus the "Name your film"
 * field that fades in once a type is chosen. First screen that writes to the
 * onboarding draft.
 *
 * Neither the ambient glow nor the step dots are rendered here; both live in
 * (onboarding)/_layout.tsx so they can travel between screens. `useGlow` and
 * `useStep` just claim this screen's place in each arc.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { ChoicePillButton } from '@/components/ui/choice-pill';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Display, Em, Label } from '@/components/ui/typography';
import { EVENT_TYPES, placeholderFor } from '@/constants/event-types';
import { Motion, Spacing } from '@/constants/theme';
import type { EventType } from '@/lib/events';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

export default function EventScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('event');
  useStep(1);

  const [eventType, setEventType] = useState<EventType | undefined>(draft.eventType);
  const [filmName, setFilmName] = useState(draft.filmName ?? '');

  const placeholder = placeholderFor(eventType);
  const trimmedName = filmName.trim();
  // Both are required: the type picks the flow, and the film is never untitled.
  // The placeholder is a suggestion, not a default — the host has to name it.
  const canContinue = eventType !== undefined && trimmedName.length > 0;

  function handleContinue() {
    if (!eventType || !trimmedName) return;
    patch({ eventType, filmName: trimmedName });
    router.push('/(onboarding)/format');
  }

  return (
    <Screen transparent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/*
            A user who has just signed in is *replaced* onto this screen, so
            there is nothing behind it — back goes to the library instead of
            doing nothing. Reached from the library's plus button it has real
            history and behaves normally.
          */}
          <ScreenHeader style={styles.header} backFallback="/(library)/films" />

          <Label style={styles.eyebrow}>Event</Label>

          <Display size="xl" style={styles.headline}>
            What are you{'\n'}
            <Em>capturing?</Em>
          </Display>

          <View style={styles.pills}>
            {EVENT_TYPES.map((option) => (
              <ChoicePillButton
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={eventType === option.value}
                onPress={() => setEventType(option.value)}
              />
            ))}
          </View>

          {/* Fades in only once a type is picked — the design's `fade-up` keyframe. */}
          {eventType !== undefined ? (
            <Animated.View
              entering={FadeInDown.duration(Motion.duration)
                .easing(Easing.bezier(...Motion.bezier).factory())}
              style={styles.field}>
              <TextField
                label="Name your film"
                value={filmName}
                onChangeText={setFilmName}
                placeholder={placeholder}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={120}
              />
            </Animated.View>
          ) : null}

          <PillButton
            label="Continue"
            icon="arrow-right"
            disabled={!canContinue}
            onPress={handleContinue}
            style={styles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: Spacing.screenBottom,
  },
  header: {
    marginBottom: 52,
  },
  eyebrow: {
    marginBottom: 14,
  },
  headline: {
    marginBottom: 44,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignContent: 'flex-start',
    // Takes the slack so the field and CTA sit at the bottom, as in the design.
    flexGrow: 1,
  },
  field: {
    marginTop: 18,
  },
  cta: {
    marginTop: 20,
  },
});
