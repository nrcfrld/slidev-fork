import type { ResolvedSlidevOptions } from '@slidev/types'
import type { ShikiTransformer } from 'shiki'
import { isTruthy } from '@antfu/utils'
import { fromAsyncCodeToHtml } from '@shikijs/markdown-it/async'

// Same trigger as Twoslash's `explicitTrigger`
const RE_TWOSLASH = /\btwoslash\b/

export default async function MarkdownItShiki({ data: { config }, mode, utils: { shiki, shikiOptions } }: ResolvedSlidevOptions) {
  async function getTwoslashTransformer() {
    const [, , { transformerTwoslash }] = await Promise.all([
      // trigger shiki to load the langs
      shiki.codeToHast('', { lang: 'js', ...shikiOptions }),
      shiki.codeToHast('', { lang: 'ts', ...shikiOptions }),

      import('@shikijs/vitepress-twoslash'),
    ])
    return transformerTwoslash({
      explicitTrigger: true,
      twoslashOptions: {
        compilerOptions: {
          ignoreDeprecations: '6.0',
        },
        handbookOptions: {
          noErrorValidation: true,
        },
      },
    })
  }

  const twoslashEnabled = config.twoslash === true || config.twoslash === mode
  // Twoslash loads TypeScript, so it is set up on the first code block that asks for it
  let twoslashTransformers: Promise<ShikiTransformer[]> | undefined

  const slidevCodeTransformer: ShikiTransformer = {
    pre(pre) {
      this.addClassToHast(pre, 'slidev-code')
      delete pre.properties.tabindex
    },
  }

  return fromAsyncCodeToHtml(async (code, options) => {
    const twoslash = twoslashEnabled && RE_TWOSLASH.test(String(options.meta?.__raw ?? ''))
      ? await (twoslashTransformers ??= getTwoslashTransformer().then(t => [
          t,
          transformerTwoslashConditional(),
        ]))
      : []
    return shiki.codeToHtml(code, {
      ...options,
      transformers: [
        ...options.transformers || [],
        ...twoslash,
        slidevCodeTransformer,
      ],
    })
  }, {
    ...shikiOptions,
    transformers: shikiOptions.transformers?.filter(isTruthy),
  })
}

// Fix #2202
function transformerTwoslashConditional(): ShikiTransformer {
  return {
    name: 'slidev:twoslash-conditional',
    code: function applyConditionalFlag(this: any, node) {
      if (node.tagName === 'v-menu') {
        if (node.properties[':shown'] === 'true')
          node.properties[':shown'] = '$nav.currentPage === $page'
      }
      else {
        for (const child of node.children) {
          if (child.type === 'element')
            applyConditionalFlag(child)
        }
      }
    },
  }
}
