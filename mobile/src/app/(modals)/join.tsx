/**
 * 08 · Join a group — the QR scanner, straight away (2026-11-21, the user,
 * replacing the sheet with a "Scan QR Code" card and an inert "Shared Link"
 * row: it was not clear the card could be tapped).
 *
 * Two ways into an event, and this screen is the one for people who arrived
 * with nothing: scan the host's QR (read here, straight on to 11). The other —
 * a shared link — never passes through this screen: +native-intent.ts sends
 * a tapped link directly to 11. The scanner's bottom note says so.
 *
 * **There is no manual code entry.** Both real paths carry the code
 * themselves; nothing in the app asks anyone to type it.
 *
 * This screen never calls joinEvent(): `join_event(code, name)` needs a name,
 * and the name is screen 11's job. 08 only obtains a code and forwards it —
 * to `/(guest)/name`, group and all, because `(auth)/name` claims the bare
 * `/name` and would try to save the name with no session behind it.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { QrScanner } from '@/components/ui/qr-scanner';

export default function JoinScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  /*
    A code in the params means the guest tapped a link and expo-router happened
    to route them here rather than to 11. Nothing is left to ask, so pass it
    straight on. `replace` so Back does not land them on a scanner they never
    chose to open.
  */
  useEffect(() => {
    if (code) router.replace({ pathname: '/(guest)/name', params: { code } });
  }, [code, router]);

  const handleScan = useCallback(
    (scanned: string) => {
      router.replace({ pathname: '/(guest)/name', params: { code: scanned } });
    },
    [router]
  );

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return <QrScanner onScan={handleScan} onClose={close} />;
}
