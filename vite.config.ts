import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src')
      },
    },
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
        },
        preload: {
          input: {
            index: 'electron/preload/index.ts',
          },
        },
      }),
      renderer(),
    ],
    server: {
      port: 5173,
      host: '0.0.0.0'
    },
    clearScreen: false,
  }
})
