import { contextBridge, ipcRenderer } from 'electron'

/**
 * Exposes a safe, minimal API to the renderer process.
 * All file-system operations are proxied through IPC to the main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Save composite photo to Documents/PhotoBooth/YYYY-MM-DD/ */
  savePhoto: (data) => ipcRenderer.invoke('save-photo', data),

  /** Get all saved photos grouped by date */
  getPhotos: () => ipcRenderer.invoke('get-photos'),

  /** Open a file with the OS default application */
  openFile: (path) => ipcRenderer.invoke('open-file', path),

  /** Open the PhotoBooth folder in Explorer/Finder */
  openFolder: () => ipcRenderer.invoke('open-folder'),

  /** Copy image (dataURL) to the OS clipboard — paste anywhere with Ctrl+V */
  copyToClipboard: (dataUrl) => ipcRenderer.invoke('copy-to-clipboard', dataUrl),
})
