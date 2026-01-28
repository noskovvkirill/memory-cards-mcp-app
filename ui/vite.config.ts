import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(), // Bundles everything into a single HTML file
  ],
  build: {
    // Output to dist folder
    outDir: 'dist',
    // Generate separate HTML files for each view
    rollupOptions: {
      input: {
        capture: 'capture.html',
        collection: 'collection.html',
        card: 'card.html',
      },
    },
  },
});
