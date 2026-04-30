/**
 * Colour palette assigned to setups across all charts and the legend.
 *
 * The palette is designed to be visually distinct and accessible on both
 * light (results panel) and dark (ECharts tooltips) backgrounds.
 * Colours are assigned by the setup's position in the results group, so
 * "setup 0" is always the same colour regardless of which simulation run
 * is selected.
 */
export const SETUP_COLOURS = [
  '#2ecc71', // green
  '#3498db', // blue
  '#e74c3c', // red
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // dark orange
  '#2980b9', // dark blue
];

export const SetupColoursUtils = {
  getSetupColour: (index: number): string =>
    SETUP_COLOURS[index % SETUP_COLOURS.length],
}