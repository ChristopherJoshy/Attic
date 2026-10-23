import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Plugin to generate version.json on build
function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      const version = {
        version: '1.0.0',
        buildTime: new Date().toISOString()
      }
      writeFileSync(
        resolve(__dirname, 'public/version.json'),
        JSON.stringify(version, null, 2)
      )
      console.log('Generated version.json:', version.buildTime)
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
