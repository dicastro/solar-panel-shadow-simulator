import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/solar-panel-shadow-simulator/',
  define: {
    // Exposes the version field from package.json as a compile-time constant.
    // Components read __APP_VERSION__ directly; no runtime fetch or environment
    // variable lookup is needed.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})