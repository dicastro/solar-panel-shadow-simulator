/**
 * Colour palette assigned to panel strings within a setup.
 *
 * Intentionally distinct from SETUP_COLOURS so that string borders
 * and setup legend colours never clash visually when both are shown
 * simultaneously (e.g. in the results panel heat maps).
 *
 * Colours are assigned by the string's position in the first-appearance
 * order within the setup, making the assignment stable and deterministic.
 */
export const STRING_COLOURS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // dark orange
  '#2980b9', // dark blue
  '#27ae60', // green
  '#d35400', // burnt orange
  '#8e44ad', // dark purple
];

export const StringColoursUtils = {
  getStringColour: (index: number): string =>
    STRING_COLOURS[index % STRING_COLOURS.length],
};