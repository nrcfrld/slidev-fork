<script setup lang="ts">
import type { SlideRoute } from '@slidev/types'
import { recomputeAllPoppers } from 'floating-vue'
import { computed, shallowRef, TransitionGroup, watch, watchEffect } from 'vue'
import { GlobalBottom, GlobalTop } from '#slidev/global-layers'
import { createFixedClicks } from '../composables/useClicks'
import { useNav } from '../composables/useNav'
import { usePreloadImages } from '../composables/usePreloadImages'
import { useViewTransition } from '../composables/useViewTransition'
import { CLICKS_MAX } from '../constants'
import { activeDragElement, disableTransition, hmrSkipTransition } from '../state'
import DragControl from './DragControl.vue'
import SlideWrapper from './SlideWrapper.vue'

defineProps<{
  renderContext: 'slide' | 'presenter'
}>()

const {
  currentSlideRoute,
  currentTransition,
  getPrimaryClicks,
  prevRoute,
  nextRoute,
  slides,
  isPrintMode,
  isPrintWithClicks,
  clicksDirection,
  printRange,
} = useNav()

// The content of slides further than this from the current one is unmounted
// (their code stays loaded), so embeds, diagrams and editors on them don't keep
// running hidden. `preload: true` in a slide's frontmatter keeps it mounted.
const MOUNT_DISTANCE = 2

function isNearby(route: SlideRoute) {
  return Math.abs(route.no - currentSlideRoute.value.no) <= MOUNT_DISTANCE
}

// The slide being left keeps its content until its leave transition is done
const leavingRoute = shallowRef<SlideRoute>()
watch(currentSlideRoute, (_, from) => leavingRoute.value = from)

function isMounted(route: SlideRoute) {
  return isPrintMode.value
    || route === currentSlideRoute.value
    || route === leavingRoute.value
    || route.meta.preload === true
    || isNearby(route)
}

function preloadRoute(route: SlideRoute) {
  if (route.meta.preload !== false) {
    route.meta.__preloaded = true
    route.load()
  }
}
// preload the slides around the current one
watchEffect(() => {
  slides.value.filter(isNearby).forEach(preloadRoute)
})
// load the code of all slides after 3s, and mount the ones that ask for it
watchEffect((onCleanup) => {
  const routes = slides.value
  const timeout = setTimeout(() => {
    for (const route of routes) {
      if (route.meta.preload === true)
        preloadRoute(route)
      else if (route.meta.preload !== false)
        route.load()
    }
  }, 3000)
  onCleanup(() => clearTimeout(timeout))
})

// preload images for nearby slides
usePreloadImages(currentSlideRoute, prevRoute, nextRoute, slides)

const hasViewTransition = useViewTransition()

const DrawingLayer = shallowRef<any>()
if (__SLIDEV_FEATURE_DRAWINGS__ || __SLIDEV_FEATURE_DRAWINGS_PERSIST__)
  import('./DrawingLayer.vue').then(v => DrawingLayer.value = v.default)

const loadedRoutes = computed(() => isPrintMode.value
  ? printRange.value.map(no => slides.value[no - 1])
  : slides.value.filter(r => r.meta?.__preloaded || r === currentSlideRoute.value),
)

function onAfterLeave() {
  leavingRoute.value = undefined
  // After transition, we disable it so HMR won't trigger it again
  // We will turn it back on `nav.go` so the normal navigation would still work
  hmrSkipTransition.value = true
  // recompute poppers after transition
  recomputeAllPoppers()
}
</script>

<template>
  <!-- Global Bottom -->
  <GlobalBottom />

  <!-- Slides -->
  <component
    :is="(hasViewTransition && !isPrintMode && !hmrSkipTransition && !disableTransition) ? 'div' : TransitionGroup"
    v-bind="(hmrSkipTransition || disableTransition || isPrintMode) ? {} : currentTransition"
    id="slideshow"
    tag="div"
    :class="{
      'slidev-nav-go-forward': clicksDirection > 0,
      'slidev-nav-go-backward': clicksDirection < 0,
    }"
    @after-leave="onAfterLeave"
  >
    <template v-for="route of loadedRoutes" :key="route.no">
      <SlideWrapper
        v-show="route === currentSlideRoute"
        :clicks-context="isPrintMode && !isPrintWithClicks ? createFixedClicks(route, CLICKS_MAX) : getPrimaryClicks(route)"
        :route="route"
        :render-context="renderContext"
        :mounted="isMounted(route)"
      />
    </template>
  </component>

  <DragControl v-if="activeDragElement" :data="activeDragElement" />

  <!-- Global Top -->
  <GlobalTop />

  <template v-if="(__SLIDEV_FEATURE_DRAWINGS__ || __SLIDEV_FEATURE_DRAWINGS_PERSIST__) && DrawingLayer">
    <DrawingLayer />
  </template>
</template>

<style scoped>
#slideshow {
  height: 100%;
}
</style>
