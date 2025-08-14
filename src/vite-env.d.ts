/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  copyTrader: {
    savePrivateKey: (payload: { privateKey: string }) => Promise<{ ok: boolean }>
    deletePrivateKey: () => Promise<{ ok: boolean }>
    saveTradingApiKey: (payload: { apiKey: string }) => Promise<{ ok: boolean }>
    deleteTradingApiKey: () => Promise<{ ok: boolean }>
    createTradingApiKey: (payload?: { clobBaseUrl?: string }) => Promise<{ ok: boolean; address?: string }>
    checkAccessStatus: (payload?: { clobBaseUrl?: string }) => Promise<{ ok: boolean; status?: any }>
    start: (payload: {
      gammaBaseUrl: string
      rpcUrl: string
      targetAddresses: string[]
      copyFactor: number
      maxSlippageBps: number
      dryRun: boolean
      pollIntervalMs: number
      executionMode: 'percent' | 'fixed'
      fixedSize: number
      sellAllOnSell: boolean
      clobBaseUrl?: string
    }) => Promise<{ ok: boolean }>
    stop: () => Promise<{ ok: boolean }>
    hasKey: () => Promise<{ has: boolean }>
    test: (payload: { gammaBaseUrl: string; rpcUrl: string; targetAddress?: string }) => Promise<{ ok: boolean; gammaOk: boolean; rpcOk: boolean; walletValid: boolean; chosenGammaBaseUrl?: string; gammaError?: string }>
    onLog: (cb: (msg: { message: string; time: number }) => void) => void
    onError: (cb: (msg: { message: string; time: number }) => void) => void
  }
}
