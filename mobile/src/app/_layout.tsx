import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ClipArrivalsProvider } from '@/components/ui/clip-arrivals';
import { ToastProvider } from '@/components/ui/toast-host';
import { getSession } from '@/lib/auth';
import { OnboardingProvider } from '@/lib/onboarding-draft';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

/**
 * How long the startup session read gets before the app gives up and shows
 * Landing anyway. Generous enough for a cold AsyncStorage read on a slow phone,
 * short enough that nobody stares at a blank screen wondering if it launched.
 */
const SESSION_CHECK_TIMEOUT_MS = 4000;

/** The same idea for the font load — see `fontsSettled`. */
const FONT_LOAD_TIMEOUT_MS = 6000;

/** LEFT is dark-only — override the navigator background so no white flashes through. */
const LeftTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.card,
    text: Colors.text,
    border: Colors.hairline,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const router = useRouter();

  /**
   * Returning users skip the Landing splash and go straight to their films.
   *
   * Deliberately *not* `destinationAfterSignIn()`, which sends an account with no
   * events into the creation flow. That rule belongs to an explicit sign-in: a
   * user who merely opened the app has not asked to make anything, and dropping
   * them into onboarding would put settings and any invite they were sent behind
   * a flow they did not start. The library has an empty state that offers both.
   *
   * Resolves to `true` in every failure mode — no .env, no session, or a
   * network error — because Landing is the safe destination: it is the sign-in
   * screen, so a user whose session could not be read can simply sign in again.
   */
  const [sessionChecked, setSessionChecked] = useState(false);

  /*
    Where the session read is *remembered*, as opposed to acted on.

    The redirect cannot happen while this component is still gating: until the
    Stack below has rendered there is no navigator, and replacing a route on a
    router with nothing mounted under it makes expo-router rebuild the tree —
    which remounts this component, resets `sessionChecked`, and starts the whole
    check again. That is a mount/unmount loop at roughly 13ms a lap, and because
    the app only ever renders null while it spins, it shows as a black screen
    with no error. The destination is stored here and consumed by an effect that
    runs after the navigator exists.
  */
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (isSupabaseConfigured()) {
        try {
          /*
            Bounded, because this gate can otherwise hold the whole app.

            `auth.getSession()` reads through AsyncStorage behind a lock, and it
            does not always settle — a lock left held by a previous run, or a
            token refresh that stalls, leaves the promise pending rather than
            rejecting. Nothing below runs in that case: `sessionChecked` stays
            false, the render returns null forever, and because the splash has
            already been hidden the app sits on a bare #101010 background. A
            black screen with no error and no redbox is exactly what that looks
            like from the outside.

            Losing the race is harmless. It only costs a returning user the jump
            straight to their films — Landing is reachable either way, and the
            session is still valid once the read completes.
          */
          const session = await Promise.race([
            getSession(),
            new Promise<null>((resolve) => {
              timer = setTimeout(() => resolve(null), SESSION_CHECK_TIMEOUT_MS);
            }),
          ]);

          if (!cancelled && session) {
            setRedirectTo('/(library)/films');
          }
        } catch {
          // Offline or a bad token — fall through to Landing.
        }
      }
      if (!cancelled) setSessionChecked(true);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  /*
    The fonts gate, with the same escape hatch as the session one above.

    `useFonts` reports neither loaded nor errored while a fetch is in flight, and
    a stalled one would hold the app on the same blank background. After the
    deadline the app renders in the fallback system font rather than not at all —
    a worse-looking Landing beats no Landing.
  */
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const fontsSettled = fontsLoaded || fontError || fontsTimedOut;

  useEffect(() => {
    // Both gates must settle, or the redirect flashes Landing on the way past.
    if (fontsSettled && sessionChecked) {
      SplashScreen.hideAsync();
    }
  }, [fontsSettled, sessionChecked]);

  const ready = fontsSettled && sessionChecked;

  /*
    The redirect, run only once the Stack below is actually mounted.

    Guarded on `ready` for that reason and not for tidiness: this is the whole
    fix for the boot loop described on `redirectTo`. Cleared as it fires so a
    later re-render cannot send a returning user back to their films after they
    have navigated somewhere else.
  */
  useEffect(() => {
    if (!ready || !redirectTo) return;
    setRedirectTo(null);
    router.replace(redirectTo);
  }, [ready, redirectTo, router]);

  // Hold the splash rather than rendering headlines in a fallback font.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={LeftTheme}>
        <StatusBar style="light" />
        {/*
          The onboarding draft lives above the Stack rather than in
          (onboarding)/_layout. It had to when screen 06, in the (auth) group,
          was what consumed it; 05.1 consumes it now, and the note on
          OnboardingProvider says why it was left here. The glow and step dots
          stay in (onboarding).
        */}
        <OnboardingProvider>
          {/*
            18's toast host. Inside the providers so it has theme and insets,
            and wrapping the Stack rather than sitting in it — an overlay
            mounted inside a route would unmount the moment anyone navigated,
            and a notification cancelled by a screen change is not one.
          */}
          <ToastProvider>
            {/*
              18's subscription, inside the host so it can raise one. Here
              rather than on the camera screen: a member waiting on 12 or
              browsing their films is exactly who needs telling that the shared
              budget just shrank. Renders nothing.
            */}
            <ClipArrivalsProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.bg },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(host)" />
                <Stack.Screen name="(guest)" />
                <Stack.Screen name="(capture)" />
                <Stack.Screen name="(library)" />
                <Stack.Screen name="(legal)" />
                <Stack.Screen name="settings" />
                <Stack.Screen
                  name="(modals)"
                  options={{
                    presentation: 'transparentModal',
                    animation: 'fade',
                  }}
                />
              </Stack>
            </ClipArrivalsProvider>
          </ToastProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
