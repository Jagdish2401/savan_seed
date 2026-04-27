import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
    'process.env': {},
  },
  build: {
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Keep the main app chunk smaller by grouping heavy deps.
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) return 'router';

          if (id.includes('xlsx-js-style')) return 'xlsx-style';
          if (id.includes('/xlsx/')) return 'xlsx';
          if (id.includes('html2canvas')) return 'html2canvas';

          if (id.includes('/jspdf/') || id.includes('jspdf-autotable')) return 'pdf';

          if (id.includes('/axios/')) return 'axios';
          if (id.includes('/date-fns/')) return 'date-fns';

          // Recharts pulls in a lot of d3 modules.
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts';

          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('dompurify')) return 'purify';

          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      './dist/cpexcel.js': '',
      path: './src/shims/empty.js',
      fs: './src/shims/empty.js',
      stream: './src/shims/empty.js',
    },
  },
  optimizeDeps: {
    // Let Vite handle the conversion
  },
});







