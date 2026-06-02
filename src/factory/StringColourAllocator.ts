import { STRING_COLOURS } from '../utils/StringColourUtils';

/**
 * Assigns colour indices to panel strings by first-appearance order.
 *
 * One instance is created per setup in PanelSetupFactory. As panels are
 * built in deterministic order (array 0, row 0, col 0 first), each new
 * string identifier encountered receives the next available index in the
 * STRING_COLOURS palette.
 *
 * The total number of distinct strings is available via `stringCount` so
 * callers can detect palette exhaustion after construction.
 */
export class StringColourAllocator {
  private readonly map = new Map<string, number>();

  getIndex(string: string): number {
    if (!this.map.has(string)) {
      this.map.set(string, this.map.size);
    }
    return this.map.get(string)!;
  }

  get stringCount(): number {
    return this.map.size;
  }

  get maxColours(): number {
    return STRING_COLOURS.length;
  }
}