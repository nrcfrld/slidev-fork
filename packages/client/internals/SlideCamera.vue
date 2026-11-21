<script setup lang="ts">
import type { CameraKeyframe, ClicksContext } from '@slidev/types'
import type { CSSProperties } from 'vue'
import type { CameraView } from '../logic/camera'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useNav } from '../composables/useNav'
import { fitBox, getActiveKeyframe, getCameraTransform, normalizeKeyframes, resolvePosition } from '../logic/camera'
import { toMilliseconds, TRANSITION_EASINGS } from '../logic/transitionOptions'

const props = defineProps<{
  keyframes: CameraKeyframe[]
  clicksContext: ClicksContext
}>()

const CLICKS_ID = 'slidev-camera'
const DEFAULT_DURATION = 800

const { isPrintMode } = useNav()
const el = ref<HTMLElement>()
const keyframes = computed(() => normalizeKeyframes(props.keyframes))
const active = computed(() => getActiveKeyframe(keyframes.value, props.clicksContext.current))
const view = shallowRef<CameraView>()

// Keyframes are click steps of their own, even on slides without other clicks
props.clicksContext.register(CLICKS_ID, {
  delta: 0,
  max: Math.max(0, ...keyframes.value.map(k => k.at)),
})
onUnmounted(() => props.clicksContext.unregister(CLICKS_ID))

function measure() {
  const root = el.value
  if (!root)
    return
  const width = root.offsetWidth
  const height = root.offsetHeight
  // Hidden slides have no size: measure again once shown
  if (!width || !height)
    return
  const keyframe = active.value
  // Before the first keyframe, show the whole slide
  if (!keyframe) {
    view.value = { zoom: 1, x: width / 2, y: height / 2 }
    return
  }
  const target = keyframe.target
    ? root.querySelector(keyframe.target)
    : null
  if (target) {
    // Measure without the current transform: both rects carry the same scale
    const rootRect = root.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    const scale = rootRect.width / width
    const box = {
      x: (rect.left - rootRect.left) / scale,
      y: (rect.top - rootRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }
    const fitted = fitBox(box, width, height)
    view.value = { ...fitted, zoom: keyframe.zoom ?? fitted.zoom }
  }
  else {
    view.value = {
      zoom: keyframe.zoom ?? 1,
      x: resolvePosition(keyframe.x, width),
      y: resolvePosition(keyframe.y, height),
    }
  }
}

onMounted(() => nextTick(measure))
watch(active, measure, { flush: 'post' })
useResizeObserver(el, measure)

const style = computed<CSSProperties>(() => {
  const root = el.value
  if (!view.value || !root)
    return {}
  const { zoom, translateX, translateY } = getCameraTransform(view.value, root.offsetWidth, root.offsetHeight)
  const keyframe = active.value
  const duration = keyframe?.duration == null
    ? DEFAULT_DURATION
    : toMilliseconds(keyframe.duration) ?? DEFAULT_DURATION
  const easing = keyframe?.easing ?? 'smooth'
  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
    transition: isPrintMode.value
      ? 'none'
      : `transform ${duration}ms ${TRANSITION_EASINGS[easing] ?? easing}`,
  }
})
</script>

<template>
  <div ref="el" class="slidev-camera" :style="style">
    <slot />
  </div>
</template>

<style scoped>
.slidev-camera {
  width: 100%;
  height: 100%;
  /* No will-change: it would keep the zoomed content rasterized at the original size, and blurry */
  transform-origin: 0 0;
}
</style>
