export interface SettingsState {
  isSidebarOpen: boolean;
  /**
   * True when the application has been initialised with the built-in default
   * configuration because no user-saved configuration was found in OPFS.
   * Used to open the settings sidebar automatically and display an
   * introductory message in the Configuration section on first launch.
   * Reset to false as soon as the user saves or loads a configuration.
   */
  isFirstLaunch: boolean;
}

export interface SettingsActions {
  openSidebar: () => void;
  closeSidebar: () => void;
  setIsFirstLaunch: (value: boolean) => void;
}

export type SettingsSlice = SettingsState & SettingsActions;

export const createSettingsSlice = (
  set: (partial: Partial<SettingsSlice>) => void,
): SettingsSlice => ({
  isSidebarOpen: false,
  isFirstLaunch: false,

  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  setIsFirstLaunch: (isFirstLaunch) => set({ isFirstLaunch }),
});