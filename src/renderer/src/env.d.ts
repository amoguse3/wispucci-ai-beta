/// <reference types="vite/client" />

import type { AuraAPI } from '../../../shared/types'

declare global {
  interface Window {
    aura: AuraAPI
    __AURA_RUNTIME__?: 'desktop' | 'web'
  }
}
