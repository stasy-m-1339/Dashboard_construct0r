import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'rename-viewer-html',
      closeBundle() {
        const dir = path.resolve(__dirname, 'dist-viewer');
        const from = path.join(dir, 'viewer.html');
        const to = path.join(dir, 'index.html');
        if (fs.existsSync(from)) {
          fs.renameSync(from, to);
        }
      },
    },
  ],
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(__dirname, 'viewer.html'),
    },
  },
});
