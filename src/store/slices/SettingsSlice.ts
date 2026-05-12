export interface SettingsState {
  isSidebarOpen: boolean;
}

export interface SettingsActions {
  openSidebar: () => void;
  closeSidebar: () => void;
}

export type SettingsSlice = SettingsState & SettingsActions;

export const createSettingsSlice = (
  set: (partial: Partial<SettingsSlice>) => void,
): SettingsSlice => ({
  isSidebarOpen: false,

  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
});