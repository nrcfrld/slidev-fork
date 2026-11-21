/**
 * Pairs elements between two slides for the View Transitions API, so they
 * move and resize into place instead of crossfading with the rest of the slide.
 */

export const MORPH_ATTR = 'data-slidev-morph'
const NAME_PREFIX = 'slidev-morph-'
const RE_WHITESPACE = /\s+/g

const named = new Set<HTMLElement>()

/**
 * Elements a slide offers for morphing, by key. Keys used more than once in
 * the slide are left out, since a pair must be unambiguous.
 */
export function collectMorphTargets(root: Element, auto: boolean): Map<string, HTMLElement> {
  const targets = new Map<string, HTMLElement>()
  const duplicates = new Set<string>()
  function add(key: string, el: HTMLElement) {
    if (targets.has(key))
      duplicates.add(key)
    else
      targets.set(key, el)
  }

  for (const el of root.querySelectorAll<HTMLElement>(`[${MORPH_ATTR}]`))
    add(`key:${el.getAttribute(MORPH_ATTR)}`, el)

  if (auto) {
    for (const el of root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')) {
      if (el.hasAttribute(MORPH_ATTR))
        continue
      const text = el.textContent?.replace(RE_WHITESPACE, ' ').trim()
      if (text)
        add(`text:${el.tagName}:${text}`, el)
    }
    for (const el of root.querySelectorAll<HTMLImageElement>('img[src]')) {
      if (!el.hasAttribute(MORPH_ATTR))
        add(`img:${el.src}`, el)
    }
  }

  for (const key of duplicates)
    targets.delete(key)
  return targets
}

/**
 * Give the elements both slides share the same `view-transition-name`.
 * Call with the old slide before the transition starts and with the new
 * slide once it has rendered.
 */
export function nameMorphTargets(targets: Map<string, HTMLElement>, keys: string[]) {
  keys.forEach((key, index) => {
    const el = targets.get(key)
    if (!el)
      return
    el.style.viewTransitionName = `${NAME_PREFIX}${index}`
    named.add(el)
  })
}

/**
 * Remove the names given for the last transition
 */
export function clearMorphNames() {
  for (const el of named)
    el.style.viewTransitionName = ''
  named.clear()
}
