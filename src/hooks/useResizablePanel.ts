import { useState, useRef, useCallback, useEffect } from 'react';

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;

type PanelState = 'normal' | 'minimised' | 'fullscreen';

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
 * Manages the width and visibility state of the floating results panel.
 *
 * The drag handle works by capturing `mousemove` on the document while the
 * button is held, computing the new width from the cursor's distance to the
 * right edge of the viewport. This pattern avoids losing the drag when the
 * cursor moves outside the handle element.
 *
 * The `width` value is the rendered CSS width in pixels. When the panel is
 * minimised, the overlay collapses to zero and the restore button appears.
 * When fullscreen, the width equals `window.innerWidth`.
 */
export function useResizablePanel(): UseResizablePanelReturn {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [panelState, setPanelState] = useState<PanelState>('normal');
  const [isDragging, setIsDragging] = useState(false);

  // Width saved before minimising or going fullscreen, so restore brings back
  // the user's last chosen size.
  const savedWidth = useRef(DEFAULT_WIDTH);

  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const delta = startX.current - e.clientX;
    const newWidth = Math.max(MIN_WIDTH, Math.min(window.innerWidth, startWidth.current + delta));
    setWidth(newWidth);
  }, []);

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

  // Clean up listeners if the component unmounts while dragging.
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const minimise = useCallback(() => {
    savedWidth.current = panelState === 'fullscreen' ? DEFAULT_WIDTH : width;
    setPanelState('minimised');
  }, [width, panelState]);

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
    setWidth(DEFAULT_WIDTH);
    setPanelState('normal');
    savedWidth.current = DEFAULT_WIDTH;
  }, []);

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