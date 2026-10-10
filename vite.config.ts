import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Avoid native realpath calls blocked by some Windows workspace sandboxes.
  resolve: { preserveSymlinks: true },
  server: { port: 5173, strictPort: false },
});
