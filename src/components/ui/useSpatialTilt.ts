'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface SpatialTiltOptions {
  enabled?: boolean;
  maxRotateX?: number; // degrees, default 2.5
  maxRotateY?: number; // degrees, default 2.5
  maxTranslateZ?: number; // px, default 3
  pressTranslateY?: number; // px, default 1.5
  damping?: number; // lerp factor (0.10 - 0.18), default 0.14
}

export function useSpatialTilt<T extends HTMLElement = HTMLElement>(options: SpatialTiltOptions = {}) {
  const {
    enabled = true,
    maxRotateX = 2.5,
    maxRotateY = 2.5,
    maxTranslateZ = 3,
    pressTranslateY = 1.5,
    damping = 0.14,
  } = options;

  const ref = useRef<T | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Animation values stored in ref to avoid re-renders during rAF
  const animRef = useRef({
    targetX: 0,
    targetY: 0,
    currX: 0,
    currY: 0,
    rafId: 0 as number,
    active: false,
    reducedMotion: false,
    coarsePointer: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMedia = () => {
      animRef.current.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      animRef.current.coarsePointer =
        window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640;
    };

    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  const updateStyle = useCallback(
    (rx: number, ry: number, tz: number, ty: number) => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty('--spatial-rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--spatial-ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--spatial-tz', `${tz.toFixed(2)}px`);
      el.style.setProperty('--spatial-ty', `${ty.toFixed(2)}px`);
    },
    []
  );

  const stopLoop = useCallback(() => {
    if (animRef.current.rafId) {
      cancelAnimationFrame(animRef.current.rafId);
      animRef.current.rafId = 0;
    }
    animRef.current.active = false;
  }, []);

  const startLoop = useCallback(() => {
    if (animRef.current.active) return;
    animRef.current.active = true;

    const tick = () => {
      const state = animRef.current;
      // Damped lerp
      state.currX += (state.targetX - state.currX) * damping;
      state.currY += (state.targetY - state.currY) * damping;

      const isStationary =
        Math.abs(state.targetX - state.currX) < 0.002 &&
        Math.abs(state.targetY - state.currY) < 0.002;

      const rotX = -state.currY * maxRotateX;
      const rotY = state.currX * maxRotateY;

      updateStyle(rotX, rotY, isHovered && !isPressed ? maxTranslateZ : 0, isPressed ? pressTranslateY : isHovered ? -1 : 0);

      if (!isHovered && isStationary) {
        // Returned to rest position, shut off rAF loop
        updateStyle(0, 0, 0, 0);
        state.currX = 0;
        state.currY = 0;
        state.active = false;
        state.rafId = 0;
        return;
      }

      state.rafId = requestAnimationFrame(tick);
    };

    animRef.current.rafId = requestAnimationFrame(tick);
  }, [damping, isHovered, isPressed, maxRotateX, maxRotateY, maxTranslateZ, pressTranslateY, updateStyle]);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<T>) => {
      if (!enabled) return;
      setIsHovered(true);

      // On touch / small screens / reduced motion, omit 3D tilt
      if (animRef.current.reducedMotion || animRef.current.coarsePointer || e.pointerType !== 'mouse') {
        updateStyle(0, 0, 0, -1);
        return;
      }

      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const halfW = rect.width / 2 || 1;
      const halfH = rect.height / 2 || 1;
      animRef.current.targetX = Math.max(-1, Math.min(1, (e.clientX - (rect.left + halfW)) / halfW));
      animRef.current.targetY = Math.max(-1, Math.min(1, (e.clientY - (rect.top + halfH)) / halfH));

      startLoop();
    },
    [enabled, startLoop, updateStyle]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (!enabled) return;
      if (animRef.current.reducedMotion || animRef.current.coarsePointer || e.pointerType !== 'mouse') {
        return;
      }

      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const halfW = rect.width / 2 || 1;
      const halfH = rect.height / 2 || 1;
      animRef.current.targetX = Math.max(-1, Math.min(1, (e.clientX - (rect.left + halfW)) / halfW));
      animRef.current.targetY = Math.max(-1, Math.min(1, (e.clientY - (rect.top + halfH)) / halfH));

      if (!animRef.current.active) {
        startLoop();
      }
    },
    [enabled, startLoop]
  );

  const onPointerLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
    animRef.current.targetX = 0;
    animRef.current.targetY = 0;

    if (animRef.current.reducedMotion || animRef.current.coarsePointer) {
      updateStyle(0, 0, 0, 0);
      return;
    }

    if (!animRef.current.active) {
      startLoop();
    }
  }, [startLoop, updateStyle]);

  const onPointerDown = useCallback(() => {
    if (!enabled) return;
    setIsPressed(true);
    const ty = pressTranslateY;
    if (animRef.current.reducedMotion || animRef.current.coarsePointer) {
      updateStyle(0, 0, 0, ty);
    }
  }, [enabled, pressTranslateY, updateStyle]);

  const onPointerUp = useCallback(() => {
    if (!enabled) return;
    setIsPressed(false);
    if (animRef.current.reducedMotion || animRef.current.coarsePointer) {
      updateStyle(0, 0, 0, isHovered ? -1 : 0);
    }
  }, [enabled, isHovered, updateStyle]);

  const onPointerCancel = useCallback(() => {
    setIsPressed(false);
    setIsHovered(false);
    animRef.current.targetX = 0;
    animRef.current.targetY = 0;
    updateStyle(0, 0, 0, 0);
    stopLoop();
  }, [stopLoop, updateStyle]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<T>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        setIsPressed(true);
        updateStyle(0, 0, 0, pressTranslateY);
      }
    },
    [pressTranslateY, updateStyle]
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<T>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        setIsPressed(false);
        updateStyle(0, 0, 0, 0);
      }
    },
    [updateStyle]
  );

  // Cleanup on unmount
  useEffect(() => {
    const anim = animRef.current;
    return () => {
      if (anim.rafId) {
        cancelAnimationFrame(anim.rafId);
      }
    };
  }, []);

  return {
    ref,
    isHovered,
    isPressed,
    handlers: {
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
    },
  };
}
