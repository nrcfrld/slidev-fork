import type { TransitionGroupProps } from '@slidev/types'

/**
 * Named easing curves, usable wherever a transition takes an easing
 */
export const TRANSITION_EASINGS: Record<string, string> = {
  smooth: 'cubic-bezier(0.65, 0, 0.35, 1)',
  expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  snappy: 'cubic-bezier(0.2, 0, 0, 1)',
}

const RE_DURATION = /^(\d+(?:\.\d+)?)(ms|s)$/
const RE_CSS_EASING = /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|(?:cubic-bezier|steps|linear)\(.*\))$/
const RE_WHITESPACE = /\s+/

export interface ParsedTransition extends Omit<TransitionGroupProps, 'duration'> {
  name: string
  duration?: TransitionGroupProps['duration'] | string
  easing?: string
}

/**
 * Parse `name [duration] [easing]`, for example `zoom-in 800ms expo`.
 * The name may itself be a `forward | backward` pair.
 */
export function parseTransitionString(value: string): ParsedTransition {
  const parts = value.trim().split(RE_WHITESPACE)
  let duration: string | undefined
  let easing: string | undefined
  // Duration and easing come last, so read them from the end
  while (parts.length > 1) {
    const last = parts[parts.length - 1]
    if (!duration && RE_DURATION.test(last))
      duration = last
    else if (!easing && (last in TRANSITION_EASINGS || RE_CSS_EASING.test(last)))
      easing = last
    else
      break
    parts.pop()
  }
  return {
    name: parts.join(' '),
    ...(duration
      ? { duration }
      : {}),
    ...(easing
      ? { easing }
      : {}),
  }
}

export function toMilliseconds(duration: number | string): number | undefined {
  if (typeof duration === 'number')
    return duration
  const match = duration.match(RE_DURATION)
  if (!match)
    return undefined
  return match[2] === 's'
    ? +match[1] * 1000
    : +match[1]
}

/**
 * CSS variables that set the duration and easing of slide transitions
 */
export function getTransitionStyle(transition: ParsedTransition): Record<string, string> | undefined {
  const style: Record<string, string> = {}
  const duration = transition.duration
  if (duration != null) {
    const ms = typeof duration === 'object'
      ? Math.max(duration.enter, duration.leave)
      : toMilliseconds(duration)
    if (ms != null)
      style['--slidev-transition-duration'] = `${ms}ms`
  }
  if (transition.easing)
    style['--slidev-transition-easing'] = TRANSITION_EASINGS[transition.easing] ?? transition.easing
  return Object.keys(style).length
    ? style
    : undefined
}
