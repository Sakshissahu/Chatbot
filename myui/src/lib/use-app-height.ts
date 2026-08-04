import { useEffect } from 'react';

/*
  Keyboard-aware viewport height.

  Problem: on mobile, `100dvh` (and `vh`) track the *layout* viewport, which on
  iOS Safari does NOT shrink when the on-screen keyboard opens. The browser then
  scrolls the page to reveal the focused input, shoving the composer behind the
  keyboard and pushing the greeting / latest message off-screen.

  Fix: mirror `window.visualViewport.height` (the genuinely visible area, minus
  the keyboard) into the `--app-height` CSS variable. The shell uses the `.h-app`
  / `.min-h-app` utilities (see index.css), so it resizes to the visible region
  and the bottom-pinned composer stays just above the keyboard. Combined with
  `body { overflow: hidden }`, the page itself never scrolls.

  `onResize` lets a screen react to the keyboard opening/closing (e.g. re-scroll
  the latest message into view). It receives the current visible height.
*/
export function useAppHeight(onResize?: (height: number) => void): void {
  useEffect(() => {
    const vv = window.visualViewport;

    const apply = () => {
      const height = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
      onResize?.(height);
    };

    apply();

    if (vv) {
      // `resize` fires as the keyboard animates; `scroll` fires when the page is
      // nudged (offsetTop changes) — both can alter the visible height.
      vv.addEventListener('resize', apply);
      vv.addEventListener('scroll', apply);
    }
    window.addEventListener('orientationchange', apply);
    window.addEventListener('resize', apply);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', apply);
        vv.removeEventListener('scroll', apply);
      }
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('resize', apply);
    };
    // onResize is read fresh each call; callers pass a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResize]);
}
