'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

type SplitPaneProps = {
  /** Horizontal = left|right; vertical = top|bottom. */
  orientation: 'horizontal' | 'vertical';
  /** Primary pane size in px (horizontal: width, vertical: height). */
  primarySize: number;
  onPrimarySizeChange: (size: number) => void;
  minPrimary?: number;
  minSecondary?: number;
  primary: ReactNode;
  secondary: ReactNode;
  /** Hide the secondary pane entirely. */
  secondaryCollapsed?: boolean;
  className?: string;
  /** Accessible name for the splitter. */
  label?: string;
};

/**
 * Lightweight draggable split (no extra dependency).
 * Uses pointer events; keyboard arrows nudge primary size when focused.
 */
export function SplitPane({
  orientation,
  primarySize,
  onPrimarySizeChange,
  minPrimary = 120,
  minSecondary = 120,
  primary,
  secondary,
  secondaryCollapsed = false,
  className,
  label = 'Resize panel',
}: SplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const isHorizontal = orientation === 'horizontal';

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (isHorizontal) {
        const max = rect.width - minSecondary;
        const next = Math.min(max, Math.max(minPrimary, clientX - rect.left));
        onPrimarySizeChange(Math.round(next));
      } else {
        const max = rect.height - minSecondary;
        const next = Math.min(max, Math.max(minPrimary, clientY - rect.top));
        onPrimarySizeChange(Math.round(next));
      }
    },
    [isHorizontal, minPrimary, minSecondary, onPrimarySizeChange],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      applyPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, applyPointer]);

  const onSplitterPointerDown = (e: ReactPointerEvent) => {
    if (secondaryCollapsed) return;
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onSplitterKeyDown = (e: KeyboardEvent) => {
    if (secondaryCollapsed) return;
    const step = e.shiftKey ? 24 : 8;
    if (isHorizontal) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrimarySizeChange(primarySize - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onPrimarySizeChange(primarySize + step);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrimarySizeChange(primarySize - step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onPrimarySizeChange(primarySize + step);
    }
  };

  const primaryStyle: CSSProperties = secondaryCollapsed
    ? { flex: '1 1 auto', minWidth: 0, minHeight: 0 }
    : isHorizontal
      ? { width: primarySize, flex: '0 0 auto', minWidth: 0, minHeight: 0 }
      : { height: primarySize, flex: '0 0 auto', minWidth: 0, minHeight: 0 };

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex min-h-0 min-w-0 flex-1',
        isHorizontal ? 'flex-row' : 'flex-col',
        dragging && 'select-none',
        className,
      )}
      data-orientation={orientation}
      data-dragging={dragging || undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={primaryStyle}>
        {primary}
      </div>

      {!secondaryCollapsed && (
        <>
          <div
            role="separator"
            aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
            aria-label={label}
            aria-valuenow={primarySize}
            tabIndex={0}
            className={cn(
              'group relative z-10 shrink-0 touch-none',
              'outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50 focus-visible:ring-offset-1',
              isHorizontal
                ? 'w-[5px] cursor-col-resize'
                : 'h-[5px] cursor-row-resize',
            )}
            onPointerDown={onSplitterPointerDown}
            onKeyDown={onSplitterKeyDown}
          >
            <span
              aria-hidden
              className={cn(
                'absolute bg-pp-lineStrong transition-colors duration-150 ease-apple',
                'group-hover:bg-pp-accent/45 group-focus-visible:bg-pp-accent/55',
                dragging && 'bg-pp-accent/60',
                isHorizontal
                  ? 'inset-y-0 left-1/2 w-px -translate-x-1/2'
                  : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
              )}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {secondary}
          </div>
        </>
      )}
    </div>
  );
}

type RatioSplitPaneProps = {
  orientation: 'horizontal' | 'vertical';
  /** Primary share 0–1. */
  ratio: number;
  onRatioChange: (ratio: number) => void;
  minRatio?: number;
  maxRatio?: number;
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
  label?: string;
};

/**
 * Percentage-based split for equal-height editor columns / stacked panes.
 */
export function RatioSplitPane({
  orientation,
  ratio,
  onRatioChange,
  minRatio = 0.22,
  maxRatio = 0.78,
  primary,
  secondary,
  className,
  label = 'Resize editors',
}: RatioSplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const isHorizontal = orientation === 'horizontal';

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = isHorizontal
        ? (clientX - rect.left) / rect.width
        : (clientY - rect.top) / rect.height;
      const next = Math.min(maxRatio, Math.max(minRatio, raw));
      onRatioChange(Math.round(next * 1000) / 1000);
    },
    [isHorizontal, maxRatio, minRatio, onRatioChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      applyPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, applyPointer]);

  const primaryFlex = `${ratio} 1 0%`;
  const secondaryFlex = `${1 - ratio} 1 0%`;

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex min-h-0 min-w-0 flex-1',
        isHorizontal ? 'flex-row' : 'flex-col',
        dragging && 'select-none',
        className,
      )}
      data-orientation={orientation}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flex: primaryFlex }}
      >
        {primary}
      </div>
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        className={cn(
          'group relative z-10 shrink-0 touch-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-pp-accent/50 focus-visible:ring-offset-1',
          isHorizontal ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize',
        )}
        onPointerDown={(e) => {
          e.preventDefault();
          draggingRef.current = true;
          setDragging(true);
          document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
          document.body.style.userSelect = 'none';
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.04 : 0.02;
          if (isHorizontal) {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              onRatioChange(Math.max(minRatio, ratio - step));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              onRatioChange(Math.min(maxRatio, ratio + step));
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onRatioChange(Math.max(minRatio, ratio - step));
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onRatioChange(Math.min(maxRatio, ratio + step));
          }
        }}
      >
        <span
          aria-hidden
          className={cn(
            'absolute bg-pp-lineStrong transition-colors duration-150 ease-apple',
            'group-hover:bg-pp-accent/45 group-focus-visible:bg-pp-accent/55',
            dragging && 'bg-pp-accent/60',
            isHorizontal
              ? 'inset-y-0 left-1/2 w-px -translate-x-1/2'
              : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
          )}
        />
      </div>
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flex: secondaryFlex }}
      >
        {secondary}
      </div>
    </div>
  );
}
