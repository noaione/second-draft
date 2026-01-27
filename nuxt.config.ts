const rootDir = import.meta.dirname;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/mdc',
    '@nuxt/fonts',
    '@nuxt/ui',
  ],
  css: ['~/assets/css/styles.css'],
  devtools: { enabled: true },
  compatibilityDate: '2026-01-26',
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      title: '#seconddraft',
      meta: [
        {
          "http-equiv": "x-ua-compatible",
          content: "IE=edge",
        },
        {
          name: "apple-mobile-web-app-title",
          content: '#seconddraft',
        },
        {
          name: "apple-mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "application-name",
          content: '#seconddraft',
        },
        {
          name: "theme-color",
          content: "#ff637e",
        },
        { name: 'description', content: 'simple mirroring web app for patreon posts' },
      ],
      link: [
        {
          rel: "shortcut icon",
          href: "/favicon.ico",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/assets/favicons/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/assets/favicons/base.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "512x512",
          href: "/assets/favicons/web-app-manifest-512x512.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "192x192",
          href: "/assets/favicons/web-app-manifest-192x192.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "96x96",
          href: "/assets/favicons/web-app-manifest-96x96.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/assets/favicons/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/assets/favicons/favicon-16x16.png",
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/assets/favicons/web-app-manifest-192x192.png",
        },
        {
          rel: "manifest",
          href: "/site.webmanifest",
        },
      ],
    }
  },
  runtimeConfig: {
    rootDir,
  },
  nitro: {
    preset: 'bun',
    experimental: {
      tasks: true,
    },
    // scheduledTasks: {
    //   '0 0 * * *': ['patreon:sync']
    // },
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
  },
  mdc: {
    components: {
      prose: true,
      // map: {
      //   a: 'A',
      // }
    },
    headings: {
      anchorLinks: false,
    }
  },
})
