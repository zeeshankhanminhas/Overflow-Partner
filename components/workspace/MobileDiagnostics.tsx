'use client';

import { useEffect, useRef, useState } from 'react';

type DebugState = {
  width: number;
  height: number;
  visualWidth: number;
  scrollY: number;
  docHeight: number;
  bodyHeight: number;
  shellHeight: number;
  mainHeight: number;
  contentHeight: number;
  htmlOverflowY: string;
  bodyOverflowY: string;
  shellOverflowY: string;
  mainOverflowY: string;
  contentOverflowY: string;
  bodyPosition: string;
  hit: string;
  hitPointer: string;
  hitTouch: string;
  hitPosition: string;
  hitZ: string;
  starts: number;
  moves: number;
  bubbleMoves: number;
  ends: number;
  dy: number;
  prevented: boolean;
};

const empty: DebugState = {
  width: 0,
  height: 0,
  visualWidth: 0,
  scrollY: 0,
  docHeight: 0,
  bodyHeight: 0,
  shellHeight: 0,
  mainHeight: 0,
  contentHeight: 0,
  htmlOverflowY: '',
  bodyOverflowY: '',
  shellOverflowY: '',
  mainOverflowY: '',
  contentOverflowY: '',
  bodyPosition: '',
  hit: 'none',
  hitPointer: '',
  hitTouch: '',
  hitPosition: '',
  hitZ: '',
  starts: 0,
  moves: 0,
  bubbleMoves: 0,
  ends: 0,
  dy: 0,
  prevented: false,
};

function describe(el: Element | null) {
  if (!el) return 'none';
  const id = el.id ? `#${el.id}` : '';
  const classes = Array.from(el.classList).slice(0, 3).map(c => `.${c}`).join('');
  const href = el instanceof HTMLAnchorElement ? `→${el.getAttribute('href') || ''}` : '';
  return `${el.tagName.toLowerCase()}${id}${classes}${href}`;
}

export default function MobileDiagnostics() {
  const [state, setState] = useState<DebugState>(empty);
  const counters = useRef({ starts: 0, moves: 0, bubbleMoves: 0, ends: 0, startY: 0, dy: 0, prevented: false });
  const lastHit = useRef<Element | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    function sample(hit?: Element | null) {
      const htmlEl = document.documentElement;
      const bodyEl = document.body;
      const shellEl = document.querySelector<HTMLElement>('.workspace');
      const mainEl = document.querySelector<HTMLElement>('.op-main');
      const contentEl = document.querySelector<HTMLElement>('.op-content');
      const html = getComputedStyle(htmlEl);
      const body = getComputedStyle(bodyEl);
      const shell = shellEl ? getComputedStyle(shellEl) : null;
      const main = mainEl ? getComputedStyle(mainEl) : null;
      const content = contentEl ? getComputedStyle(contentEl) : null;
      const centerHit = hit ?? lastHit.current ?? document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight / 2, 360));
      lastHit.current = centerHit;
      const hitStyle = centerHit ? getComputedStyle(centerHit) : null;
      const c = counters.current;
      setState({
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: Math.round(window.visualViewport?.width ?? window.innerWidth),
        scrollY: Math.round(window.scrollY),
        docHeight: htmlEl.scrollHeight,
        bodyHeight: bodyEl.scrollHeight,
        shellHeight: shellEl?.scrollHeight ?? 0,
        mainHeight: mainEl?.scrollHeight ?? 0,
        contentHeight: contentEl?.scrollHeight ?? 0,
        htmlOverflowY: html.overflowY,
        bodyOverflowY: body.overflowY,
        shellOverflowY: shell?.overflowY ?? 'none',
        mainOverflowY: main?.overflowY ?? 'none',
        contentOverflowY: content?.overflowY ?? 'none',
        bodyPosition: body.position,
        hit: describe(centerHit),
        hitPointer: hitStyle?.pointerEvents ?? 'none',
        hitTouch: hitStyle?.touchAction ?? 'none',
        hitPosition: hitStyle?.position ?? 'none',
        hitZ: hitStyle?.zIndex ?? 'none',
        starts: c.starts,
        moves: c.moves,
        bubbleMoves: c.bubbleMoves,
        ends: c.ends,
        dy: Math.round(c.dy),
        prevented: c.prevented,
      });
    }

    function schedule(hit?: Element | null) {
      if (hit !== undefined) lastHit.current = hit;
      if (raf.current !== null) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = null;
        sample();
      });
    }

    const onScroll = () => schedule();
    const onResize = () => schedule();
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      counters.current.starts += 1;
      counters.current.startY = touch?.clientY ?? 0;
      counters.current.dy = 0;
      counters.current.prevented = event.defaultPrevented;
      schedule(touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null);
    };
    const onTouchMoveCapture = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      counters.current.moves += 1;
      counters.current.dy = (touch?.clientY ?? counters.current.startY) - counters.current.startY;
      counters.current.prevented = counters.current.prevented || event.defaultPrevented;
      schedule(touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null);
    };
    const onTouchMoveBubble = (event: TouchEvent) => {
      counters.current.bubbleMoves += 1;
      counters.current.prevented = counters.current.prevented || event.defaultPrevented;
      schedule();
    };
    const onTouchEnd = (event: TouchEvent) => {
      counters.current.ends += 1;
      counters.current.prevented = counters.current.prevented || event.defaultPrevented;
      schedule();
    };

    sample();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMoveCapture, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMoveBubble, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });

    return () => {
      if (raf.current !== null) window.cancelAnimationFrame(raf.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMoveCapture, true);
      window.removeEventListener('touchmove', onTouchMoveBubble);
      document.removeEventListener('touchend', onTouchEnd, true);
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
        font: '600 9px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <div>DBG mobile-20260810-1512 · vw {state.width}/{state.visualWidth} · vh {state.height} · y {state.scrollY}</div>
      <div>height doc/body/shell/main/content {state.docHeight}/{state.bodyHeight}/{state.shellHeight}/{state.mainHeight}/{state.contentHeight}</div>
      <div>overflow h/b/s/m/c {state.htmlOverflowY}/{state.bodyOverflowY}/{state.shellOverflowY}/{state.mainOverflowY}/{state.contentOverflowY} · body {state.bodyPosition}</div>
      <div>touch start/move/bubble/end {state.starts}/{state.moves}/{state.bubbleMoves}/{state.ends} · dy {state.dy} · prevented {String(state.prevented)}</div>
      <div>hit {state.hit}</div>
      <div>hit pe/touch/pos/z {state.hitPointer}/{state.hitTouch}/{state.hitPosition}/{state.hitZ}</div>
    </div>
  );
}
