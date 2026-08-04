import { useEffect, useRef } from 'react';

/*
  Device / browser Back button, without a router.

  The app is a single screen with no URL routes, so the hardware/browser Back
  button would otherwise exit straight away. This hook lets Back step back
  through the in-app depth the user perceives (close an open overlay, then leave
  an active chat for the empty new-chat state) before it finally exits.

  Mechanism — a single tagged history "guard" entry, kept in sync with `active`:

    • `active` true  → there is something Back should intercept. We keep exactly
      one guard entry pushed on top of the app's own entry.
    • Pressing Back pops that guard → `popstate` → we run `onBack()` to consume
      ONE level of depth. The resulting state change re-runs the reconcile below,
      which re-arms the guard if the app is *still* interceptable (so the next
      Back is caught too) or leaves it disarmed so a further Back exits normally.
    • `active` false → no guard, so Back pops the app's own entry and the browser
      leaves (the "allow normal exit" case).
    • Leaving the interceptable state by other means (tapping a drawer's own close
      control, signing out, unmount) removes our guard with a tagged self-pop, so
      we never strand a phantom entry that would swallow a later Back press.

  Properties this guarantees: exactly one level consumed per Back press (no
  double-fire), the history stack never grows past one guard (no leak), and the
  base state always exits. It only ever touches history state we tagged ourselves
  and the view/nav callbacks passed in — never the URL path, never auth.

  Reduced-motion safe: the hook animates nothing; `onBack` simply drives existing
  view state whose transitions already honour `prefers-reduced-motion`.
*/
export function useBackButton(active: boolean, onBack: () => void): void {
  const armedRef = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Set just before a programmatic history.back() so the resulting popstate is
  // recognised as our own cleanup and does not consume a depth level.
  const selfPopRef = useRef(false);

  // One popstate listener for the hook's lifetime.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      if (selfPopRef.current) {
        selfPopRef.current = false; // our own cleanup pop — swallow it
        return;
      }
      if (armedRef.current) {
        // The user pressed Back and consumed our guard entry. Disarm, then
        // consume one level; the reconcile effect re-arms if still interceptable.
        armedRef.current = false;
        onBackRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Reconcile the guard with `active` after every commit. Idempotent: it only
  // acts on a mismatch, so it costs nothing on a steady-state render but still
  // re-arms after an onBack() that consumed a level yet kept `active` true.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (active && !armedRef.current) {
      window.history.pushState({ __backGuard: true }, '');
      armedRef.current = true;
    } else if (!active && armedRef.current) {
      armedRef.current = false;
      // Only pop when we're actually sitting on our own guard, so a real history
      // entry is never navigated away.
      if (window.history.state?.__backGuard) {
        selfPopRef.current = true;
        window.history.back();
      }
    }
  });

  // Remove any dangling guard on unmount (e.g. sign-out unmounts the screen).
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (armedRef.current && window.history.state?.__backGuard) {
        armedRef.current = false;
        selfPopRef.current = true;
        window.history.back();
      }
    };
  }, []);
}
