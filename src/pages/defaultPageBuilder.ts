import type { PageModuleOutput } from '@/types/modules/page.types'

export class DefaultPageBuilder {
  buildEmptyData(): Map<string, unknown> {
    return new Map()
  }

  buildFallbackOutput(): PageModuleOutput {
    return {
      data: new Map(),
      loading: false,
      error: null,
      isVisible: false,
      isClickable: false,
    }
  }

  buildLoadingOutput(): PageModuleOutput {
    return {
      data: new Map(),
      loading: true,
      error: null,
      isVisible: false,
      isClickable: false,
    }
  }

  buildErrorOutput(error: string): PageModuleOutput {
    return {
      data: new Map(),
      loading: false,
      error,
      isVisible: true,
      isClickable: false,
    }
  }
}

export const defaultPageBuilder = new DefaultPageBuilder()