import { useState, useRef, useCallback, useEffect } from 'react';

type PanelState = 'normal' | 'minimised' | 'fullscreen';

interface UseResizablePanelOptions {
  defaultWidth: number;
  minWidth: number;
  /**
   * Controls which direction the drag handle grows the panel.
   *
   * 'left'  — the handle is on the LEFT edge of the panel (results panel, right
   *            side of screen). Dragging left increases width, right decreases it.
   *            Delta = startX - currentX.
   *
   * 'right' — the handle is on the RIGHT edge of the panel (settings sidebar,
   *            left side of screen). Dragging right increases width, left decreases.
   *            Delta = currentX - startX.
   *
   * Defaults to 'left' to preserve existing behaviour for the results panel.
   */
  dragDirection?: 'left' | 'right';
}

interface UseResizablePanelReturn {
  width: number;
  panelState: PanelState;
  isDragging: boolean;
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
  minimise: () => void;
  restore: () => void;
  fullscreen: () => void;
  resetWidth: () => void;
}

/**
 * Manages the width and visibility state of a resizable floating panel.
 *
 * Parametrised via `defaultWidth`, `minWidth`, and `dragDirection` so the
 * same hook can drive both the results panel (right edge of screen, handle on
 * left side of panel — dragDirection 'left') and the settings sidebar (left
 * edge of screen, handle on right side of panel — dragDirection 'right').
 *
 * The drag handle works by capturing `mousemove` on the document while the
 * button is held. This pattern avoids losing the drag when the cursor moves
 * outside the handle element.
 *
 * The `width` value is the rendered CSS width in pixels. When the panel is
 * minimised, the overlay collapses to zero and the restore button appears.
 * When fullscreen, the width equals `window.innerWidth`.
 */
export function useResizablePanel({
  defaultWidth,
  minWidth,
  dragDirection = 'left',
}: UseResizablePanelOptions): UseResizablePanelReturn {
  const [width, setWidth] = useState(defaultWidth);
  const [panelState, setPanelState] = useState<PanelState>('normal');
  const [isDragging, setIsDragging] = useState(false);

  // Width saved before minimising or going fullscreen, so restore brings back
  // the user's last chosen size.
  const savedWidth = useRef(defaultWidth);

  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const delta = dragDirection === 'left'
      ? startX.current - e.clientX   // results panel: left = grow
      : e.clientX - startX.current;  // settings sidebar: right = grow
    const newWidth = Math.max(minWidth, Math.min(window.innerWidth, startWidth.current + delta));
    setWidth(newWidth);
  }, [minWidth, dragDirection]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const minimise = useCallback(() => {
    savedWidth.current = panelState === 'fullscreen' ? defaultWidth : width;
    setPanelState('minimised');
  }, [width, panelState, defaultWidth]);

  const restore = useCallback(() => {
    setWidth(savedWidth.current);
    setPanelState('normal');
  }, []);

  const fullscreen = useCallback(() => {
    if (panelState !== 'fullscreen') {
      savedWidth.current = width;
      setWidth(window.innerWidth);
      setPanelState('fullscreen');
    } else {
      setWidth(savedWidth.current);
      setPanelState('normal');
    }
  }, [width, panelState]);

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
    setPanelState('normal');
    savedWidth.current = defaultWidth;
  }, [defaultWidth]);

  const effectiveWidth = panelState === 'minimised'
    ? 0
    : panelState === 'fullscreen'
      ? window.innerWidth
      : width;

  return {
    width: effectiveWidth,
    panelState,
    isDragging,
    dragHandleProps: { onMouseDown },
    minimise,
    restore,
    fullscreen,
    resetWidth,
  };
}