'use client';

import { useEffect, useState } from 'react';

type DebugState = {
  width: number;
  height: number;
  visualWidth: number;
  scrollY: number;
  htmlOverflowY: string;
  bodyOverflowY: string;
  shellOverflowY: string;
  bodyPosition: string;
  touchAction: string;
  hit: string;
};

const empty: DebugState = {
  width: 0,
  height: 0,
  visualWidth: 0,
  scrollY: 0,
  htmlOverflowY: '',
  bodyOverflowY: '',
  shellOverflowY: '',
  bodyPosition: '',
  touchAction: '',
  hit: 'none',
};

function describe(el: Element | null) {
  if (!el) return 'none';
  const id = el.id ? `#${el.id}` : '';
  const classes = Array.from(el.classList).slice(0, 3).map(c => `.${c}`).join('');
  return `${el.tagName.toLowerCase()}${id}${classes}`;
}

export default function MobileDiagnostics() {
  const [state, setState] = useState<DebugState>(empty);

  useEffect(() => {
    function sample(hit?: Element | null) {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const shellEl = document.querySelector<HTMLElement>('.workspace');
      const shell = shellEl ? getComputedStyle(shellEl) : null;
      const centerHit = hit ?? document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight / 2, 360));
      setState({
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: Math.round(window.visualViewport?.width ?? window.innerWidth),
        scrollY: Math.round(window.scrollY),
        htmlOverflowY: html.overflowY,
        bodyOverflowY: body.overflowY,
        shellOverflowY: shell?.overflowY ?? 'none',
        bodyPosition: body.position,
        touchAction: shell?.touchAction ?? 'none',
        hit: describe(centerHit),
      });
    }

    const onScroll = () => sample();
    const onResize = () => sample();
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      sample(touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null);
    };

    sample();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('touchstart', onTouch, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('touchstart', onTouch, true);
    };
  }, []);

  if (state.width > 1000) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 6,
        right: 6,
        bottom: 'calc(64px + env(safe-area-inset-bottom))',
        zIndex: 2147483647,
        pointerEvents: 'none',
        background: 'rgba(255, 227, 0, .96)',
        color: '#111',
        border: '1px solid #111',
        padding: '6px 8px',
        font: '600 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <div>DBG mobile-20260810-1503 · vw {state.width}/{state.visualWidth} · vh {state.height} · y {state.scrollY}</div>
      <div>overflow html/body/shell {state.htmlOverflowY}/{state.bodyOverflowY}/{state.shellOverflowY} · body {state.bodyPosition} · touch {state.touchAction}</div>
      <div>hit {state.hit}</div>
    </div>
  );
}
