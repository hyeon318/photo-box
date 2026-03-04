import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
    // MediaPipe는 IIFE 패키지 — esbuild pre-bundle 시 window.SelfieSegmentation
    // 등록이 깨질 수 있으므로 optimizeDeps에서 제외하여 원본 IIFE 그대로 로드
    optimizeDeps: {
      exclude: ['@mediapipe/selfie_segmentation'],
    },
  },
})
