'use client';

/**
 * Gyroscope tilt for the Legendary holo (docs/CARD_ART_GENERATION.md §3).
 *
 * iOS silently does nothing without an explicit tap-to-allow — no error, no
 * console warning, the effect just never fires. That is the single most
 * common way this feature ships broken, so permission is requested only from
 * a real tap and the pointer fallback always stays live.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TiltState {
  /** 0-100, matching the holo's background-position percentages. */
  x: number;
  y: number;
  active: boolean;
}

const CENTER: TiltState = { x: 50, y: 50, active: false };

export function useTilt(enabled: boolean) {
  const [tilt, setTilt] = useState<TiltState>(CENTER);
  const [gyroOn, setGyroOn] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const DOE = (window as any).DeviceOrientationEvent;
    if (!DOE) return;

    // iOS 13+ gates the event behind an explicit permission call.
    if (typeof DOE.requestPermission === 'function') {
      setNeedsPermission(true);
      return;
    }

    // Android and desktop-with-sensors need no prompt.
    attach();
    return detach;

    function attach() {
      window.addEventListener('deviceorientation', onOrient);
      setGyroOn(true);
    }
    function detach() {
      window.removeEventListener('deviceorientation', onOrient);
      if (frame.current) cancelAnimationFrame(frame.current);
      setGyroOn(false);
    }
    function onOrient(e: DeviceOrientationEvent) {
      // Throttle to paint rate: the sensor fires faster than we can render.
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        const gamma = e.gamma ?? 0; // left/right, -90..90
        const beta = e.beta ?? 0; // front/back, -180..180
        setTilt({
          x: clamp(50 + gamma * 1.1, 0, 100),
          y: clamp(50 + (beta - 45) * 0.9, 0, 100),
          active: true,
        });
      });
    }
  }, [enabled]);

  /** MUST be called from inside a real tap handler, or iOS rejects it. */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const DOE = (window as any).DeviceOrientationEvent;
    if (!DOE?.requestPermission) return false;
    try {
      const res = await DOE.requestPermission();
      if (res === 'granted') {
        setNeedsPermission(false);
        setGyroOn(true);
        window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
          setTilt({
            x: clamp(50 + (e.gamma ?? 0) * 1.1, 0, 100),
            y: clamp(50 + ((e.beta ?? 0) - 45) * 0.9, 0, 100),
            active: true,
          });
        });
        return true;
      }
    } catch {
      // Denied, or called outside a gesture. Pointer fallback still works.
    }
    return false;
  }, []);

  /** Pointer fallback — always available, on every platform. */
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (gyroOn) return; // gyro wins when live
      const b = e.currentTarget.getBoundingClientRect();
      setTilt({
        x: ((e.clientX - b.left) / b.width) * 100,
        y: ((e.clientY - b.top) / b.height) * 100,
        active: true,
      });
    },
    [gyroOn],
  );

  const onPointerLeave = useCallback(() => {
    if (!gyroOn) setTilt(CENTER);
  }, [gyroOn]);

  return { tilt, gyroOn, needsPermission, requestPermission, onPointerMove, onPointerLeave };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
