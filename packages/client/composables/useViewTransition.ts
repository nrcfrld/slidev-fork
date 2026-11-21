import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { configs } from '../env'
import { clearMorphNames, collectMorphTargets, nameMorphTargets } from '../logic/morph'
import { getSlide } from '../logic/slides'
import { resolveTransition } from '../logic/transition'
import { TRANSITION_EASINGS } from '../logic/transitionOptions'

// `morph` also pairs headings and images that both slides share
const VIEW_TRANSITIONS = ['view-transition', 'morph']
const MORPH_DEFAULTS = { duration: '600ms', easing: TRANSITION_EASINGS.smooth }

/**
 * The shown copy of a slide, since the presenter renders slides more than once
 */
function findShownSlide(no: number) {
  return [
    ...document.querySelectorAll<HTMLElement>(`.slidev-page-${no}`),
  ]
    .filter(el => el.getClientRects().length)
    .sort((a, b) => b.offsetWidth - a.offsetWidth)[0]
}

function setViewTransitionTiming(duration?: string, easing?: string) {
  const style = document.documentElement.style
  for (const [name, value] of [
    ['--slidev-view-transition-duration', duration],
    ['--slidev-view-transition-easing', easing],
  ] as const) {
    if (value)
      style.setProperty(name, value)
    else
      style.removeProperty(name)
  }
}

export function useViewTransition() {
  const router = useRouter()
  const isViewTransition = ref(false)

  let viewTransitionFinish: undefined | (() => void)
  let viewTransitionAbort: undefined | (() => void)
  // Names the new slide's elements once it has rendered
  let nameNewSlide: undefined | (() => void)

  const supportViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document

  router.beforeResolve((to, from) => {
    const fromMeta = getSlide(from.params.no as string)?.meta
    const toMeta = getSlide(to.params.no as string)?.meta
    const fromNo = fromMeta?.slide?.no
    const toNo = toMeta?.slide?.no
    // Navigating within the same slide (only `clicks` changed): keep the current mode.
    // Resetting it swaps the wrapper in SlidesShow and remounts every slide.
    if (fromNo != null && fromNo === toNo)
      return
    const transition = fromNo != null && toNo != null && fromNo !== toNo
      ? resolveTransition((fromNo < toNo
          ? fromMeta?.transition
          : toMeta?.transition) ?? configs.transition ?? undefined, fromNo > toNo)
      : undefined
    if (!transition?.name || !VIEW_TRANSITIONS.includes(transition.name)) {
      isViewTransition.value = false
      return
    }

    if (!supportViewTransition) {
      isViewTransition.value = false
      console.warn('View transition is not supported in your browser, fallback to normal transition.')
      return
    }

    isViewTransition.value = true

    const auto = transition.name === 'morph'
    // Called once the slides are in their final wrapper: switching from `TransitionGroup` remounts them
    function nameOldSlide() {
      const fromEl = findShownSlide(fromNo!)
      const toEl = fromEl?.parentElement?.querySelector<HTMLElement>(`.slidev-page-${toNo}`)
      if (!fromEl || !toEl)
        return
      const oldTargets = collectMorphTargets(fromEl, auto)
      const keys = [
        ...collectMorphTargets(toEl, auto).keys(),
      ].filter(key => oldTargets.has(key))
      nameMorphTargets(oldTargets, keys)
      nameNewSlide = () => nameMorphTargets(collectMorphTargets(toEl, auto), keys)
    }
    setViewTransitionTiming(
      transition.style?.['--slidev-transition-duration'] ?? (auto ? MORPH_DEFAULTS.duration : undefined),
      transition.style?.['--slidev-transition-easing'] ?? (auto ? MORPH_DEFAULTS.easing : undefined),
    )

    const promise = new Promise<void>((resolve, reject) => {
      viewTransitionFinish = resolve
      viewTransitionAbort = reject
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    // Wait for `TransitionGroup` to become normal `div`
    setTimeout(() => {
      nameOldSlide()
      document.startViewTransition(() => {
        changeRoute()
        return promise
      }).finished.finally(() => {
        clearMorphNames()
        setViewTransitionTiming()
      })
    }, 50)

    return ready
  })

  if (supportViewTransition) {
    router.afterEach(async () => {
      if (nameNewSlide) {
        await nextTick()
        nameNewSlide()
        nameNewSlide = undefined
      }
      viewTransitionFinish?.()
      viewTransitionAbort?.()
    })
  }

  return isViewTransition
}
