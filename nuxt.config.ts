// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@nuxt/fonts',
    '@nuxt/ui',
  ],
  css: ['~/assets/css/styles.css'],
  devtools: { enabled: true },
  compatibilityDate: '2026-01-26',
  nitro: {
    preset: 'bun',
    experimental: {
      tasks: true
    },
    scheduledTasks: {
      '0 0 * * *': ['patreon:sync']
    },
  },
  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
      styles: ['normal', 'italic'],
    }
  },
  icon: {
    mode: 'svg',
    provider: 'none',
    serverBundle: false,
    clientBundle: {
      scan: {
        // note that when you specify those values, the default behavior will be overridden
        globInclude: ['app/components/**/*.vue', 'app/pages/**/*.vue'],
        globExclude: ['node_modules', 'dist', /* ... */],
      },
      sizeLimitKb: 20
    }
  }
})
