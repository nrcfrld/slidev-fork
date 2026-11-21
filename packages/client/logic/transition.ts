import type { SlideRoute } from '@slidev/types'
import type { TransitionGroupProps } from 'vue'
import type { ParsedTransition } from './transitionOptions'
import { configs } from '../env'
import { getTransitionStyle, parseTransitionString, toMilliseconds } from './transitionOptions'

const transitionResolveMap: Record<string, string | undefined> = {
  'slide-left': 'slide-left | slide-right',
  'slide-right': 'slide-right | slide-left',
  'slide-up': 'slide-up | slide-down',
  'slide-down': 'slide-down | slide-up',
  'zoom-in': 'zoom-in | zoom-out',
  'zoom-out': 'zoom-out | zoom-in',
  'wipe-left': 'wipe-left | wipe-right',
  'wipe-right': 'wipe-right | wipe-left',
  'wipe-up': 'wipe-up | wipe-down',
  'wipe-down': 'wipe-down | wipe-up',
}

export type ResolvedTransition = TransitionGroupProps & {
  style?: Record<string, string>
}

export function resolveTransition(transition?: string | Partial<ParsedTransition> | TransitionGroupProps, isBackward = false): ResolvedTransition | undefined {
  if (!transition)
    return undefined
  const parsed: Partial<ParsedTransition> = typeof transition === 'string'
    ? parseTransitionString(transition)
    : transition
  if (!parsed.name)
    return undefined

  const { easing: _easing, duration, name: rawName, ...props } = parsed
  let name = rawName.includes('|')
    ? rawName
    : (transitionResolveMap[rawName] || rawName)

  if (name.includes('|')) {
    const [forward, backward] = name.split('|').map(i => i.trim())
    name = isBackward ? backward : forward
  }

  if (!name)
    return undefined

  const durationMs = typeof duration === 'object'
    ? duration
    : duration == null
      ? undefined
      : toMilliseconds(duration)
  const style = getTransitionStyle(parsed as ParsedTransition)
  return {
    ...props,
    name,
    ...(durationMs == null
      ? {}
      : { duration: durationMs }),
    ...(style
      ? { style }
      : {}),
  }
}

export function getCurrentTransition(direction: number, currentRoute?: SlideRoute, prevRoute?: SlideRoute) {
  let transition: Parameters<typeof resolveTransition>[0] = direction > 0
    ? prevRoute?.meta?.transition
    : currentRoute?.meta?.transition
  if (!transition)
    transition = configs.transition || undefined

  return resolveTransition(transition, direction < 0)
}
