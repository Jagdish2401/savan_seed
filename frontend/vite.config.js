import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const emptyShim = fileURLToPath(new URL('./src/shims/empty.js', import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
    'process.env': {},
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('xlsx-js-style')) return 'xlsx-style';
          if (id.includes('/xlsx/')) return 'xlsx';
          if (id.includes('html2canvas')) return 'html2canvas';
          if (id.includes('/jspdf/') || id.includes('jspdf-autotable')) return 'pdf';
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      './dist/cpexcel.js': '',
      path: emptyShim,
      fs: emptyShim,
      stream: emptyShim,
    },
  },
  optimizeDeps: {
    // Let Vite handle the conversion
  },
});







