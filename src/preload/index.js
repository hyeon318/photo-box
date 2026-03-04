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

  /** 사진 파일 영구 삭제 */
  deletePhoto: (filePath) => ipcRenderer.invoke('delete-photo', filePath),

  /** Window controls */
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose:    () => ipcRenderer.invoke('window-close'),

  /** Windows OS 레벨 위치 조회 (.NET GeoCoordinateWatcher) */
  getWindowsLocation: () => ipcRenderer.invoke('get-windows-location'),
  /** IP 기반 위치 조회 (메인 프로세스 경유 — CORS 없음) */
  getIpLocation: () => ipcRenderer.invoke('get-ip-location'),

  /** Windows 위치 서비스 상태 확인 */
  checkWindowsLocation: () => ipcRenderer.invoke('check-windows-location'),
  /** Windows 위치 설정 페이지 열기 */
  openLocationSettings: () => ipcRenderer.invoke('open-location-settings'),
})
