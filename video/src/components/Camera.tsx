import type { ReactNode } from 'react';
import { Easing, interpolate } from 'remotion';

const K = 194; // how far the focus row drifts up as we zoom, keeps the window above the captions
export const STRIP_Y = 157;

/** Zooms around a focus point (fx, fy) in screen space; the point drifts up slightly as zoom grows. */
export function Camera({ zoom, fx, fy = STRIP_Y, children }: { zoom: number; fx: number; fy?: number; children: ReactNode }) {
  const sy = fy - (zoom - 1) * K;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${fx - zoom * fx}px, ${sy - zoom * fy}px) scale(${zoom})`, transformOrigin: '0 0', willChange: 'transform' }}>
      {children}
    </div>
  );
}

const ease = Easing.inOut(Easing.cubic);
/** Piecewise zoom curve: keyframes as [frame, zoom] pairs. */
export function zoomCurve(frame: number, keys: [number, number][]) {
  return interpolate(frame, keys.map(k => k[0]), keys.map(k => k[1]), { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
/** Same for a moving focus x. */
export const focusCurve = zoomCurve;
