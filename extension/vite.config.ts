import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import manifest from './manifest.json'
import { crx } from '@crxjs/vite-plugin'

import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: "oryxsolver",
      project: "oryxsolvererrors",
      disable: true, // process.env.NODE_ENV !== 'production',
      sourcemaps: {
        disable: true,
      },
      // CRXJS clobbers the manifest if Sentry touches it. 
      // We disable auto-injection into the manifest.
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
      },
      reactComponentAnnotation: { enabled: true },
    }),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
  }
})
// https://vitejs.dev/config/
