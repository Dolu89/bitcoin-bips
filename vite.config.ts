import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['resources/css/app.scss', 'resources/js/app.js'],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  server: {
    /**
     * The app is served per project domain (bips.xyz, nips.nostr.com, local
     * aliases like *.frise.io). Allow any host on the Vite dev server so those
     * domains reach the app in development. Dev-only — Vite is not used in prod.
     */
    allowedHosts: true,
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})
