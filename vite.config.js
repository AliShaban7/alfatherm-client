import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Backend restarting (nodemon) or not running — avoid raw "socket hang up"
            if (res && !res.headersSent && res.writeHead) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                message: 'Backend əlçatan deyil. backend qovluğunda "pnpm run dev" işlədiyindən əmin olun.'
              }));
            }
          });
        }
      }
    }
  }
});
