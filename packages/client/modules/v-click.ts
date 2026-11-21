import type { ClicksElement, RawAtValue } from '@slidev/types'
import type { App, DirectiveBinding } from 'vue'
import { computed, watchEffect } from 'vue'
import {
  CLASS_VCLICK_ANIMATION_PREFIX,
  CLASS_VCLICK_CURRENT,
  CLASS_VCLICK_HIDDEN,
  CLASS_VCLICK_HIDDEN_EXP,
  CLASS_VCLICK_PRIOR,
  CLASS_VCLICK_TARGET,
  injectionClicksContext,
  injectionFrontmatter,
} from '../constants'
import { configs } from '../env'
import { mergeClickAnimation, parseClickAnimation } from '../logic/clickAnimation'
import { toMilliseconds } from '../logic/transitionOptions'
import { directiveInject } from '../utils'

export const resolvedClickMap = new Map<ClicksElement, ReturnType<typeof resolveClick>>()

type ResolvedClick = NonNullable<ReturnType<typeof resolveClick>>

function setStyleVar(el: HTMLElement, name: string, value: string | undefined) {
  if (value)
    el.style.setProperty(name, value)
  else
    el.style.removeProperty(name)
}

/**
 * Position of an element among the elements of the same slide that appear on the same click
 */
function getStaggerIndex(el: HTMLElement, resolved: ResolvedClick) {
  const peers: Element[] = []
  for (const [other, info] of resolvedClickMap) {
    if (info?.clicksContext === resolved.clicksContext && info.start === resolved.start && other instanceof Element && other.isConnected)
      peers.push(other)
  }
  peers.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1)
  return Math.max(0, peers.indexOf(el))
}

function syncAnimation(el: HTMLElement, resolved: ResolvedClick) {
  const { names, duration, easing } = resolved.animation.value
  const targetClasses = names.map(a => `${CLASS_VCLICK_ANIMATION_PREFIX}${a}`)
  el.classList.forEach((c) => {
    if (c.startsWith(CLASS_VCLICK_ANIMATION_PREFIX) && !targetClasses.includes(c))
      el.classList.remove(c)
  })
  targetClasses.forEach(c => el.classList.add(c))

  setStyleVar(el, '--slidev-vclick-duration', duration)
  setStyleVar(el, '--slidev-vclick-easing', easing)
  const stagger = resolved.stagger.value
  setStyleVar(el, '--slidev-vclick-delay', stagger && resolved.isShown.value
    ? `${getStaggerIndex(el, resolved) * stagger}ms`
    : undefined)
}

export function createVClickDirectives() {
  return {
    install(app: App) {
      app.directive<HTMLElement, RawAtValue>('click', {
        // @ts-expect-error extra prop
        name: 'v-click',

        mounted(el, dir) {
          const resolved = resolveClick(el, dir, dir.value)
          if (resolved == null)
            return

          el.classList.toggle(CLASS_VCLICK_TARGET, true)

          // Expose the resolved clicks info to the element to make it easier to understand and debug
          el.dataset.slidevClicksStart = String(resolved.start)
          if (Number.isFinite(resolved.end))
            el.dataset.slidevClicksEnd = String(resolved.end)

          // @ts-expect-error extra prop
          el.watchStopHandle = watchEffect(() => {
            const active = resolved.isActive.value
            const current = resolved.isCurrent.value
            const prior = active && !current

            if (resolved.flagHide) {
              el.classList.toggle(CLASS_VCLICK_HIDDEN, active)
              el.classList.toggle(CLASS_VCLICK_HIDDEN_EXP, active)
            }
            else {
              el.classList.toggle(CLASS_VCLICK_HIDDEN, !active)
            }

            syncAnimation(el, resolved)

            el.classList.toggle(CLASS_VCLICK_CURRENT, current)
            el.classList.toggle(CLASS_VCLICK_PRIOR, prior)
          })
        },
        unmounted,
      })

      app.directive<HTMLElement, RawAtValue>('after', {
        // @ts-expect-error extra prop
        name: 'v-after',

        mounted(el, dir) {
          const resolved = resolveClick(el, dir, '+0')
          if (resolved == null)
            return

          el.classList.toggle(CLASS_VCLICK_TARGET, true)

          // @ts-expect-error extra prop
          el.watchStopHandle = watchEffect(() => {
            const active = resolved.isActive.value
            const current = resolved.isCurrent.value
            const prior = active && !current

            if (resolved.flagHide) {
              el.classList.toggle(CLASS_VCLICK_HIDDEN, active)
              el.classList.toggle(CLASS_VCLICK_HIDDEN_EXP, active)
            }
            else {
              el.classList.toggle(CLASS_VCLICK_HIDDEN, !active)
            }

            syncAnimation(el, resolved)

            el.classList.toggle(CLASS_VCLICK_CURRENT, current)
            el.classList.toggle(CLASS_VCLICK_PRIOR, prior)
          })
        },
        unmounted,
      })

      app.directive<HTMLElement, RawAtValue>('click-hide', {
        // @ts-expect-error extra prop
        name: 'v-click-hide',

        mounted(el, dir) {
          const resolved = resolveClick(el, dir, dir.value, true)
          if (resolved == null)
            return

          el.classList.toggle(CLASS_VCLICK_TARGET, true)

          // @ts-expect-error extra prop
          el.watchStopHandle = watchEffect(() => {
            const active = resolved.isActive.value
            const current = resolved.isCurrent.value
            const prior = active && !current

            el.classList.toggle(CLASS_VCLICK_HIDDEN, active)
            el.classList.toggle(CLASS_VCLICK_HIDDEN_EXP, active)

            syncAnimation(el, resolved)

            el.classList.toggle(CLASS_VCLICK_CURRENT, current)
            el.classList.toggle(CLASS_VCLICK_PRIOR, prior)
          })
        },
        unmounted,
      })
    },
  }
}

export function resolveClick(el: Element | string, dir: DirectiveBinding<any>, value: RawAtValue, explicitHide = false) {
  const ctx = directiveInject(dir, injectionClicksContext)?.value
  const frontmatter = directiveInject(dir, injectionFrontmatter)

  if (!el || !ctx)
    return null

  const flagHide = explicitHide || (dir.modifiers.hide !== false && dir.modifiers.hide != null)

  /**
   * Resolves the animation presets for this element.
   * Priority: directive modifiers (stacked) > slide frontmatter > global config.
   * Modifiers allow composition, e.g., v-click.fade.up.scale.
   */
  const elAnimation = parseClickAnimation(Object.keys({ ...dir.modifiers }).filter(m => m !== 'hide'))
  const animation = computed(() => mergeClickAnimation(
    elAnimation,
    parseClickAnimation(frontmatter?.clickAnimation || configs.clickAnimation),
  ))
  const flagAnimations = computed(() => animation.value.names)
  // Delay between elements that appear on the same click
  const stagger = computed(() => {
    const value = frontmatter?.clickStagger ?? configs.clickStagger
    return value == null || value === ''
      ? 0
      : toMilliseconds(value) ?? 0
  })

  const info = ctx.calculate(value)
  if (!info)
    return null

  ctx.register(el, info)

  const isShown = computed(() => flagHide
    ? !info.isActive.value
    : info.isActive.value)
  const visibilityState = computed(() => {
    if (isShown.value)
      return 'shown'
    if (Number.isFinite(info.end)) {
      return ctx.current < info.start
        ? 'before'
        : 'after'
    }
    else {
      return flagHide ? 'after' : 'before'
    }
  })

  const resolved = {
    ...info,
    isShown,
    visibilityState,
    flagHide,
    flagAnimations,
    animation,
    stagger,
    clicksContext: ctx,
  }
  resolvedClickMap.set(el, resolved)
  return resolved
}

function unmounted(el: HTMLElement, dir: DirectiveBinding<any>) {
  el.classList.toggle(CLASS_VCLICK_TARGET, false)
  resolvedClickMap.delete(el)
  const ctx = directiveInject(dir, injectionClicksContext)?.value
  ctx?.unregister(el)
  // @ts-expect-error extra prop
  el.watchStopHandle?.()
}
