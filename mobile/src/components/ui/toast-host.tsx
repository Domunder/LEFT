/**
 * Where a toast lives, and how a screen raises one.
 *
 * Mounted once in the root layout, outside the Stack — inside it, the overlay
 * would unmount on every navigation, and a notification that dies because
 * somebody changed screens is not a notification. Being outside also means any
 * route can raise one without each of them mounting their own host.
 *
 * **One at a time, and a second replaces the first.** `Toast.maxVisible` is 1.
 * Two people filming within a few seconds of each other is ordinary at the
 * events this app is for, and a queue would hold the older banner on screen
 * saying "42s of budget left" after the newer arrival had already made that
 * false. Replacing keeps the number on screen true, which matters more than
 * seeing every name.
 *
 * The visible/exiting split exists because the card animates out: `show` sets
 * the content and flips `visible`, the card plays its exit when that goes false,
 * and only its `onExited` drops the node. Unmounting directly would skip the
 * animation entirely.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToastCard, type ToastContent } from '@/components/ui/toast';
import { Toast as T } from '@/constants/theme';

/** Lets a caller retract a toast it raised — e.g. on navigating away. */
export type ToastHandle = { dismiss: () => void };

type ToastContextValue = {
  show: (content: ToastContent) => ToastHandle;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Raise a toast from anywhere under the provider.
 *
 * Throws outside one rather than returning a no-op: a screen that silently fails
 * to notify is a wiring bug that would only be found by not seeing something.
 */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside a ToastProvider');
  return value;
}

type Current = { id: number; content: ToastContent };

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  const [current, setCurrent] = useState<Current | null>(null);
  const [visible, setVisible] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** Start the exit. The node is dropped by `onExited`, not here. */
  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const show = useCallback(
    (content: ToastContent): ToastHandle => {
      clearTimer();

      const id = ++nextId.current;
      setCurrent({ id, content });
      setVisible(true);

      timer.current = setTimeout(() => {
        timer.current = null;
        setVisible(false);
      }, T.autoDismissMs);

      return {
        /*
          Scoped to the toast it was handed out for. Without the id check, a
          stale handle from a replaced toast would dismiss whatever is on screen
          now — which is exactly the case replacement makes common.
        */
        dismiss: () => {
          if (nextId.current === id) hide();
        },
      };
    },
    [clearTimer, hide]
  );

  const handleExited = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        `box-none` so the screen underneath stays fully interactive — the camera
        is still a camera while a banner is up. The card itself takes touches so
        its dismiss button works, which the previous stub's `pointerEvents="none"`
        on the whole overlay would have made impossible.
      */}
      <View
        pointerEvents="box-none"
        style={[
          styles.host,
          { top: insets.top + T.topOffset, left: T.insetX, right: T.insetX },
        ]}>
        {current ? (
          <ToastCard
            // Keyed so a replacement mounts fresh and replays the entry rather
            // than swapping its text mid-animation.
            key={current.id}
            {...current.content}
            visible={visible}
            onDismiss={hide}
            onExited={handleExited}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
  },
});
