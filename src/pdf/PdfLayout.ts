import { jsPDF } from 'jspdf';

// ── Page geometry (A4 portrait, mm) ───────────────────────────────────────────

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 14;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const SAFE_BOTTOM = PAGE_H - 14;

// ── Colour palette ────────────────────────────────────────────────────────────

export const C_DARK = '#111111';
export const C_ACCENT = '#2e7d32';
export const C_MUTED = '#888888';
export const C_BORDER = '#cccccc';
export const C_ROW_ODD = '#f5f8f5';
export const C_PARAM_BG = '#f0f4f0';
export const C_HEADER_BG = '#e0ebe0';

// ── Typography ────────────────────────────────────────────────────────────────

export type FontStyle = 'normal' | 'bold' | 'italic';

export const font = (doc: jsPDF, size: number, style: FontStyle = 'normal', color = C_DARK): void => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color);
};

// ── Setup letter labels ───────────────────────────────────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const setupLetter = (i: number): string => LETTERS[i % LETTERS.length];

// ── Cursor ────────────────────────────────────────────────────────────────────

/**
 * Tracks the top of the next element to be drawn (Y coordinate in mm).
 *
 * Convention: `cursor.y` always points to the TOP of where the next block
 * should begin. Every drawing primitive receives `cursor.y` as its top-left
 * Y, draws downward, then calls `cursor.advance(height)` to move past it.
 * This makes layout composable and prevents overlaps.
 */
export class Cursor {
  y: number;

  constructor(private doc: jsPDF, startY = MARGIN + 2) {
    this.y = startY;
  }

  /** Advance by `delta` mm. Adds a new page if the result exceeds SAFE_BOTTOM. */
  advance(delta: number): void {
    this.y += delta;
    if (this.y > SAFE_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN + 2;
    }
  }

  /** Ensure at least `needed` mm remain before adding a new page. */
  ensureSpace(needed: number): void {
    if (this.y + needed > SAFE_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN + 2;
    }
  }

  /** Force a new page unconditionally. */
  newPage(): void {
    this.doc.addPage();
    this.y = MARGIN + 2;
  }
}