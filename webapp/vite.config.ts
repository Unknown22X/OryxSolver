import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
  const sentryRelease = env.VITE_APP_VERSION || 'dev';
  const sentryEnabled = Boolean(sentryAuthToken);

  return {
    plugins: [
      react(),
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: "oryxsolver",
        project: "oryxsolvererrors",
        disable: !sentryEnabled,
        telemetry: false,
        release: {
          name: sentryRelease,
        },
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
      sourcemap: sentryEnabled ? 'hidden' : false,
    }
  };
})
