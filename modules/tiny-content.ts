import {
  defineNuxtModule,
  addTemplate,
} from '@nuxt/kit'
import type { ModuleOptions, NuxtTemplate } from '@nuxt/schema'
import { isAbsolute, join, relative } from 'pathe'
import defu from 'defu'
import { genDynamicImport } from 'knitwork'

interface Manifest {
  checksumStructure: Record<string, string>
  checksum: Record<string, string>
  dump: Record<string, string[]>
  components: string[]
}

const moduleTemplates = {
  types: 'content/types.d.ts',
  preview: 'content/preview.mjs',
  manifest: 'content/manifest.ts',
  components: 'content/components.ts',
  fullCompressedDump: 'content/database.compressed.mjs',
  fullRawDump: 'content/sql_dump.txt',
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'tiny-content',
    configKey: 'tinyContent',
    version: '0.1.0',
    compatibility: {
      nuxt: '>=4.1.0 || ^3.19.0',
    },
  },
  async setup(options, nuxt) {
    const manifest: Manifest = {
      checksumStructure: {},
      checksum: {},
      dump: {},
      components: [],
    }

    nuxt.options.alias = defu(nuxt.options.alias, {
      '#content/components': addTemplate(componentsManifestTemplate(manifest)).dst,
    })

    if (nuxt.options._prepare) {
      return
    }
  },
})

const proseTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 's', 'code', 'span', 'blockquote', 'pre', 'hr', 'img', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
function getMappedTag(tag: string, additionalTags: Record<string, string> = {}) {
  if (proseTags.includes(tag)) {
    return `prose-${tag}`
  }
  return additionalTags[tag] || tag
}

export const componentsManifestTemplate = (manifest: Manifest) => {
  return {
    filename: moduleTemplates.components,
    write: true,
    getContents: ({ app, nuxt, options }) => {
      const componentsMap = app.components
        .filter((c) => {
          // Ignore island components
          if (c.island) {
            return false
          }

          // Ignore css modules
          if (c.filePath.endsWith('.css')) {
            return false
          }

          return nuxt.options.dev || options.manifest.components.includes(c.pascalName) || c.global
        })
        .reduce((map, c) => {
          map[c.pascalName] = map[c.pascalName] || [
            c.pascalName,
            `${genDynamicImport(isAbsolute(c.filePath)
              ? './' + relative(join(nuxt.options.buildDir, 'content'), c.filePath).replace(/\b\.(?!vue)\w+$/g, '')
              : c.filePath.replace(/\b\.(?!vue)\w+$/g, ''), { wrapper: false, singleQuotes: true })}`,
            c.global,
          ]
          return map
        }, {} as Record<string, unknown[]>)

      const componentsList = Object.values(componentsMap)
      const globalComponents = componentsList.filter(c => c[2]).map(c => c[0])
      const localComponents = componentsList.filter(c => !c[2])
      return [
        ...localComponents.map(([pascalName, type]) => `export const ${pascalName} = () => ${type}`),
        `export const globalComponents: string[] = ${JSON.stringify(globalComponents)}`,
        `export const localComponents: string[] = ${JSON.stringify(localComponents.map(c => c[0]))}`,
      ].join('\n')
    },
    options: {
      manifest,
    },
  } satisfies NuxtTemplate
}
