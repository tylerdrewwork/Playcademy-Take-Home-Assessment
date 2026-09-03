import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    // Firebase Hosting's `public` dir can't point outside the directory
    // containing firebase.json (../dist is rejected as "outside of project
    // directory"), so the build output lives under firebase/ instead.
    outDir: 'firebase/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        knowledgeGraph: fileURLToPath(new URL('./knowledge-graph.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.js', 'src/**/*.test.ts'],
  },
})
