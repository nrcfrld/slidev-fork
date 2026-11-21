import type { App, DirectiveBinding } from 'vue'
import { MORPH_ATTR } from '../logic/morph'

function setKey(el: HTMLElement, binding: DirectiveBinding<string | undefined>) {
  const key = binding.value ?? binding.arg
  if (key)
    el.setAttribute(MORPH_ATTR, String(key))
  else
    el.removeAttribute(MORPH_ATTR)
}

/**
 * `v-morph="'key'"` or `v-morph:key`: elements with the same key on two
 * slides move into each other with the `morph` and `view-transition` transitions
 */
export function createVMorphDirective() {
  return {
    install(app: App) {
      app.directive<HTMLElement, string | undefined>('morph', {
        // @ts-expect-error extra prop
        name: 'v-morph',
        mounted: setKey,
        updated: setKey,
      })
    },
  }
}
