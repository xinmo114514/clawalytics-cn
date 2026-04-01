export interface ElectronAPI {
  getWindowsAccentColor: () => Promise<string | null>;
  onWindowsAccentColorChanged: (callback: (color: string) => void) => () => void;
  selectFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
