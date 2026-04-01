import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getWindowsAccentColor: () => ipcRenderer.invoke('get-windows-accent-color'),
  onWindowsAccentColorChanged: (callback) => {
    const handler = (event, color) => callback(color);
    ipcRenderer.on('windows-accent-color-changed', handler);
    return () => ipcRenderer.removeListener('windows-accent-color-changed', handler);
  },
  selectFolder: () => ipcRenderer.invoke('select-folder'),
});
