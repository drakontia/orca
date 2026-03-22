import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco to use the locally bundled editor instead of CDN
loader.config({ monaco })

// Re-export for convenience
export { monaco }
