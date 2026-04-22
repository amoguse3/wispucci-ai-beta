import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import tailwindcss from '@tailwindcss/postcss'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'web-local': resolve('src/main/web-local.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          overlay: resolve('src/preload/overlay.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          overlay: resolve('src/renderer/overlay.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    }
  }
})
