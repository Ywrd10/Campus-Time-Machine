import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Avoid native realpath calls blocked by some Windows workspace sandboxes.
  resolve: { preserveSymlinks: true },
  // /api goes to the local relay (relay/server.mjs) when VITE_GENERATION_PROVIDER=http.
  server: { port: 5173, strictPort: false, proxy: { '/api': 'http://127.0.0.1:8000' } },
});
