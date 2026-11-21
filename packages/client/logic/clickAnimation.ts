import { toMilliseconds, TRANSITION_EASINGS } from './transitionOptions'

const RE_DURATION = /^\d+(?:\.\d+)?m?s$/
const RE_CSS_EASING = /^(?:ease|ease-in|ease-out|ease-in-out|linear|(?:cubic-bezier|steps|linear)\(.*\))$/
const RE_SEPARATOR = /[\s,]+/

export interface ClickAnimation {
  /**
   * Presets, applied as `slidev-vclick-anim-<name>` classes
   */
  names: string[]
  duration?: string
  easing?: string
}

/**
 * Parse a click animation such as `up scale 600ms expo`: preset names, then an
 * optional duration and easing in any order
 */
export function parseClickAnimation(value: string | string[] | undefined): ClickAnimation {
  const tokens = (Array.isArray(value)
    ? value
    : (value ?? '').split(RE_SEPARATOR)).filter(Boolean)
  const result: ClickAnimation = { names: [] }
  for (const token of tokens) {
    if (!result.duration && RE_DURATION.test(token))
      result.duration = `${toMilliseconds(token)}ms`
    else if (!result.easing && (token in TRANSITION_EASINGS || RE_CSS_EASING.test(token)))
      result.easing = TRANSITION_EASINGS[token] ?? token
    else
      result.names.push(token)
  }
  return result
}

/**
 * Combine an element's own animation with the slide's or the deck's.
 * Each part that the element leaves out comes from the fallback.
 */
export function mergeClickAnimation(own: ClickAnimation, fallback: ClickAnimation): ClickAnimation {
  return {
    names: own.names.length ? own.names : fallback.names,
    duration: own.duration ?? fallback.duration,
    easing: own.easing ?? fallback.easing,
  }
}
