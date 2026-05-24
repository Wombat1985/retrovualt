import { defineConfig } from 'vite'

export default defineConfig({
  // esbuild transform options — applied to every file during dev and build
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
    target: 'es2020',
  },

  build: {
    target: 'es2020',

    rollupOptions: {
      output: {
        // Split vendor chunks so browsers can cache them independently of app code.
        // @zxing/browser is already dynamically imported in main.ts so it auto-splits;
        // this ensures Capacitor and other deps don't get merged into the app chunk.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@zxing')) return 'vendor-barcode'
            if (id.includes('@capacitor') || id.includes('@capgo')) return 'vendor-capacitor'
            return 'vendor'
          }
        },
        // Predictable asset filenames for cache-busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },

    // Warn at 250 KB — keeps bundle bloat visible
    chunkSizeWarningLimit: 250,

    // Inline assets smaller than 4 KB directly into the bundle
    assetsInlineLimit: 4096,
  },
})
