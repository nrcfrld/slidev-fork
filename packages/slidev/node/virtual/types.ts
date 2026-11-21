import type { Awaitable } from '@antfu/utils'
import type { ResolvedSlidevOptions } from '@slidev/types'
import type { Rolldown } from 'vite'
import type { MakeAbsoluteImportGlob } from '../utils'

export interface VirtualModuleContext extends Pick<Rolldown.PluginContext, 'resolve'> {
  makeAbsoluteImportGlob: MakeAbsoluteImportGlob
  /**
   * Module ids of each slide's markdown and frontmatter, by slide index
   */
  slideSourceIds: {
    md: string[]
    frontmatter: string[]
  }
}

export interface VirtualModuleTemplate {
  id: string
  getContent: (this: VirtualModuleContext, options: ResolvedSlidevOptions) => Awaitable<string>
}
