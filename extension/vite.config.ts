import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import manifest from './manifest.json'
import { crx } from '@crxjs/vite-plugin'

import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss() , crx({ manifest }),],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),

    },
  },
})
// https://vitejs.dev/config/
