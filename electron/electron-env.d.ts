/// <reference types="electron" />

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production'
    readonly ELECTRON_WEBPACK_WDS_PORT: string
  }
}

interface Window {
  electron: {
    node: () => string
    chrome: () => string
    electron: () => string
    send: (channel: string, data: any) => void
    receive: (channel: string, func: Function) => void
  }
} 