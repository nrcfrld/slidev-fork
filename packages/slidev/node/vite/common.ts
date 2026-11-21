export const regexSlideReqPath = /^\/__slidev\/slides\/(\d+)\.json$/
export const regexSlideFacadeId = /^\/@slidev\/slides\/(\d+)\/(md|frontmatter)($|\?)/
export const regexSlideSourceId = /__slidev_(\d+)\.(md|frontmatter)$/

// In dev, a slide's markdown module is keyed by a number that stays the same
// when other slides are inserted, removed or moved, so its compiled module can
// be kept. Without keys (build), the number is the slide's position.
const slideMdKeys = new WeakMap<object, Map<number, number>>()

export function setSlideMdKeys(data: object, keys: number[]) {
  slideMdKeys.set(data, new Map(keys.map((key, index) => [key, index])))
}

/**
 * Index of the slide a `__slidev_<n>.md` or `__slidev_<n>.frontmatter` module belongs to
 */
export function getSlideIndexFromSourceId(data: object, id: string | undefined): number | undefined {
  const match = id?.match(regexSlideSourceId)
  if (!match)
    return undefined
  const keys = slideMdKeys.get(data)
  if (match[2] === 'md' && keys)
    return keys.get(+match[1])
  return +match[1] - 1
}

export const templateInjectionMarker = '/* @slidev-injection */'
export const templateImportContextUtils = `import { useSlideContext as _useSlideContext, frontmatterToProps as _frontmatterToProps } from "@slidev/client/context.ts"`
export const templateInitContext = `const { $slidev, $nav, $clicksContext, $clicks, $page, $renderContext, $frontmatter } = _useSlideContext()`
