import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import manifest from './manifest.json'
import { crx } from '@crxjs/vite-plugin'

import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
  const sentryRelease = env.VITE_APP_VERSION || 'dev';
  const sentryEnabled = Boolean(sentryAuthToken);

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: "oryxsolver",
        project: "oryxsolvererrors",
        disable: !sentryEnabled,
        telemetry: false,
        sourcemaps: {
          disable: true,
        },
        release: {
          name: sentryRelease,
          // CRX expects manifest.json to stay valid JSON.
          // The modern Sentry source map flow injects debug-id code into bundles,
          // which can corrupt manifest handling, so use the legacy upload flow here.
          inject: false,
          uploadLegacySourcemaps: sentryEnabled ? ['dist'] : undefined,
        },
        // CRXJS clobbers the manifest if Sentry touches it.
        // Keep bundle tweaks only; let CRX own the manifest.
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
      sourcemap: sentryEnabled,
      // Chrome can lock files inside dist while the unpacked extension is loaded.
      // Avoid wiping the whole folder before each build on Windows.
      emptyOutDir: false,
    }
  };
})
// https://vitejs.dev/config/
