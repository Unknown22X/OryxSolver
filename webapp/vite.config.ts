import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from 'node:path';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "oryxsolver",
      project: "oryxsolvererrors"
    })
  ],
  resolve: {
    alias: {
      'katex/dist/katex.min.css': path.resolve(__dirname, '../extension/public/assets/katex/katex.min.css'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    sourcemap: false,
  }
})
