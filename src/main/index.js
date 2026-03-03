import { app, BrowserWindow, ipcMain, shell, clipboard, nativeImage } from 'electron'
import piexif from 'piexifjs'
import { join } from 'path'
import fs from 'fs-extra'

// ─── Window ─────────────────────────────────────────────────────────────────

let mainWindow = null   // IPC 핸들러에서 안정적으로 참조하기 위해 모듈 스코프 유지

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),

      // contextIsolation: true 는 Web Share API 및 contextBridge 동작에 필수.
      // false 로 바꾸면 preload의 contextBridge가 무효화된다.
      contextIsolation: true,

      // nodeIntegration: false 는 보안 기본값. Node.js 접근은 IPC로만 허용.
      nodeIntegration: false,

      // [참고] Electron < 20 구버전에서 Web Share API를 사용하려면 아래 설정 필요:
      // enableBlinkFeatures: 'WebShare',
      // Electron 20+ (Chromium 104+) 부터는 기본 활성화되어 불필요.
    },
    backgroundColor: '#030712', // gray-950
    titleBarStyle: 'hiddenInset',
    frame: false,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Electron은 기본적으로 모든 권한 요청을 거부한다.
  // Geolocation API 사용을 위해 명시적으로 허용한다.
  const { session } = require('electron')
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const ALLOWED = ['geolocation', 'media']
    callback(ALLOWED.includes(permission))
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── File System Helpers ─────────────────────────────────────────────────────

const getPhotoBaseDir = () => join(app.getPath('documents'), 'PhotoBooth')

function getTodayFolder() {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

/**
 * Save a composite photo (base64 dataURL) to Documents/PhotoBooth/YYYY-MM-DD/
 */
// GPS 소수점 좌표 → EXIF rational (도/분/초) 변환
function toExifRational(decimal) {
  const d = Math.abs(decimal)
  const deg = Math.floor(d)
  const minFloat = (d - deg) * 60
  const min = Math.floor(minFloat)
  const sec = Math.round((minFloat - min) * 60 * 1000)
  return [[deg, 1], [min, 1], [sec, 1000]]
}

ipcMain.handle('save-photo', async (_, { dataUrl, filename, location }) => {
  try {
    const dateFolder = getTodayFolder()
    const dir = join(getPhotoBaseDir(), dateFolder)
    await fs.ensureDir(dir)

    // 위치 정보가 있으면 JPEG EXIF에 GPS 태그 삽입
    let finalDataUrl = dataUrl
    if (location?.status === 'OK' && dataUrl.startsWith('data:image/jpeg')) {
      const exifObj = {
        GPS: {
          [piexif.GPSIFD.GPSLatitudeRef]:  location.lat >= 0 ? 'N' : 'S',
          [piexif.GPSIFD.GPSLatitude]:     toExifRational(location.lat),
          [piexif.GPSIFD.GPSLongitudeRef]: location.lng >= 0 ? 'E' : 'W',
          [piexif.GPSIFD.GPSLongitude]:    toExifRational(location.lng),
        },
      }
      finalDataUrl = piexif.insert(piexif.dump(exifObj), dataUrl)
    }

    const base64 = finalDataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const filepath = join(dir, filename)
    await fs.writeFile(filepath, buffer)

    return { success: true, path: filepath, date: dateFolder }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/**
 * Scan Documents/PhotoBooth and return photos grouped by date (desc order).
 * Each photo is returned as a base64 dataURL.
 */
ipcMain.handle('get-photos', async () => {
  try {
    const baseDir = getPhotoBaseDir()
    await fs.ensureDir(baseDir)

    const entries = await fs.readdir(baseDir)
    const grouped = {}

    // Process each date folder newest-first
    const dateFolders = entries
      .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e))
      .sort()
      .reverse()

    for (const folder of dateFolders) {
      const folderPath = join(baseDir, folder)
      const stat = await fs.stat(folderPath)
      if (!stat.isDirectory()) continue

      const files = (await fs.readdir(folderPath))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .sort()

      if (files.length === 0) continue

      grouped[folder] = await Promise.all(
        files.map(async (file) => {
          const filePath = join(folderPath, file)
          const buffer = await fs.readFile(filePath)
          return {
            filename: file,
            path: filePath,
            dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
            date: folder,
          }
        })
      )
    }

    return { success: true, data: grouped }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/**
 * Copy a composite image (dataURL) to the system clipboard.
 * The user can then Ctrl+V into KakaoTalk, Slack, etc.
 */
ipcMain.handle('copy-to-clipboard', async (_, dataUrl) => {
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const image  = nativeImage.createFromBuffer(buffer)
    clipboard.writeImage(image)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/** Open a specific file with the system default viewer */
ipcMain.handle('open-file', async (_, filePath) => {
  await shell.openPath(filePath)
})

/** 사진 파일을 디스크에서 영구 삭제 */
ipcMain.handle('delete-photo', async (_, filePath) => {
  try {
    await fs.remove(filePath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/** Open the PhotoBooth root folder in Explorer/Finder */
ipcMain.handle('open-folder', async () => {
  const dir = getPhotoBaseDir()
  await fs.ensureDir(dir)
  await shell.openPath(dir)
})

// ─── Window Controls ──────────────────────────────────────────────────────────

// getFocusedWindow() 대신 mainWindow 직접 참조
// — IPC 호출 시 버튼 클릭으로 포커스가 잠깐 이동해 getFocusedWindow()가 null을 반환하는 버그 방지
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()
})

ipcMain.handle('window-close', () => {
  mainWindow?.close()
})
