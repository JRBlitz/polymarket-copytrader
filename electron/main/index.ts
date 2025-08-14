// Defer requiring 'electron' at runtime to avoid bundling the stub
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app, BrowserWindow, shell, ipcMain } = require('electron')
import type { BrowserWindow as ElectronBrowserWindow, IpcMainInvokeEvent } from 'electron'
import { savePrivateKeyToKeychain, deletePrivateKeyFromKeychain, getPrivateKeyFromKeychain, saveTradingApiKeyToKeychain, deleteTradingApiKeyFromKeychain, getTradingApiKeyFromKeychain, saveTradingCredsToKeychain, getTradingCredsFromKeychain } from './secureStore'
import { GammaClient } from './gamma'
import { CopyTraderService } from './copyTrader'
import { PolymarketClient } from './polymarket'
import { ethers } from 'ethers'
import axios from 'axios'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'

// Using CommonJS-style globals provided after bundling

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: ElectronBrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.js')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// Normalize and validate private key or mnemonic input
function parseWalletFromInput(input: string): ethers.Wallet | ethers.HDNodeWallet {
  const raw = (input ?? '').trim()
  if (!raw) throw new Error('Empty private key')
  // Strip surrounding quotes if pasted
  const unquoted = raw.replace(/^['"]|['"]$/g, '')
  const collapsed = unquoted.replace(/[\r\n\t]+/g, ' ').trim()
  // Try to extract a 0x...64 hex anywhere in the string
  const hexWith0x = collapsed.match(/0x[0-9a-fA-F]{64}/)
  if (hexWith0x) {
    try { return new ethers.Wallet(hexWith0x[0]) } catch {}
  }
  // Try to extract a bare 64-hex sequence
  const bareHex = collapsed.match(/(?<![0-9a-fA-F])[0-9a-fA-F]{64}(?![0-9a-fA-F])/)
  if (bareHex) {
    try { return new ethers.Wallet(`0x${bareHex[0]}`) } catch {}
  }
  // If it looks exactly like 64 hex chars without 0x, prefix it
  if (/^[0-9a-fA-F]{64}$/.test(collapsed)) {
    try { return new ethers.Wallet(`0x${collapsed}`) } catch {}
  }
  // Try raw (maybe already a proper 0x-prefixed key)
  try { return new ethers.Wallet(collapsed) } catch {}
  // Normalize and try mnemonic phrase
  const mnemonic = collapsed
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = mnemonic ? mnemonic.split(' ').length : 0
  if (wordCount >= 12) {
    try { return ethers.Wallet.fromPhrase(mnemonic) } catch {}
  }
  throw new Error('Invalid private key or mnemonic phrase')
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'Polymarket Copytrader',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win!.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win!.webContents.openDevTools()
  } else {
    win!.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win!.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win!.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win!)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_: IpcMainInvokeEvent, arg: string) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// CopyTrader IPC
let service: CopyTraderService | null = null

ipcMain.handle('copytrader:saveKey', async (_e: IpcMainInvokeEvent, payload: { privateKey: string }) => {
  const wallet = parseWalletFromInput(payload.privateKey)
  await savePrivateKeyToKeychain(wallet.privateKey)
  return { ok: true }
})

ipcMain.handle('copytrader:deleteKey', async () => {
  const ok = await deletePrivateKeyFromKeychain()
  return { ok }
})
// Check CLOB access flags for current wallet
ipcMain.handle('copytrader:accessStatus', async (_e: IpcMainInvokeEvent, payload: { clobBaseUrl?: string } = {}) => {
  const privateKey = await getPrivateKeyFromKeychain()
  if (!privateKey) throw new Error('No private key stored')
  const wallet = parseWalletFromInput(privateKey)
  const clob = (payload?.clobBaseUrl || 'https://clob.polymarket.com').replace(/\/$/, '')
  
  // Try different endpoint patterns
  const paths = [
    '/auth/access-status',
    '/v1/auth/access-status',
    '/access-status',
    '/auth/status',
    '/auth/ban-status/closed-only',
    '/v1/auth/ban-status/closed-only',
  ]
  
  let lastRes: any = null
  let lastError: Error | null = null
  
  for (const p of paths) {
    try {
      const res = await axios.get(`${clob}${p}`, {
        headers: { 
          'POLY_ADDRESS': wallet.address,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) ElectronApp/1.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        timeout: 10000,
        validateStatus: () => true,
      })
      
      lastRes = res
      
      // Accept 200 or any success status
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.data }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  
  // If all paths failed, return the last error
  if (lastRes) {
    const body = typeof lastRes.data === 'string' ? lastRes.data : JSON.stringify(lastRes.data)
    throw new Error(`HTTP ${lastRes.status} ${body?.slice(0, 200)}`)
  } else if (lastError) {
    throw lastError
  } else {
    throw new Error('Unable to check access status')
  }
})

// Create API key via L1 signing
ipcMain.handle('copytrader:createApiKey', async (_e: IpcMainInvokeEvent, payload: { clobBaseUrl?: string }) => {
  const privateKey = await getPrivateKeyFromKeychain()
  if (!privateKey) throw new Error('No private key stored')
  const wallet = parseWalletFromInput(privateKey)
  const chainId = 137
  const clob = (payload?.clobBaseUrl || 'https://clob.polymarket.com').replace(/\/$/, '')
  
  // Get server timestamp to avoid clock drift issues
  let timestamp = Math.floor(Date.now() / 1000).toString()
  const timeEndpoints = ['/time', '/auth/time', '/v1/time']
  for (const ep of timeEndpoints) {
    try {
      const r = await axios.get(`${clob}${ep}`, { timeout: 5000, validateStatus: () => true })
      if (r.status >= 200 && r.status < 300) {
        // Handle different response formats
        const ts = r.data?.timestamp || r.data?.serverTime || r.data
        if (ts) {
          timestamp = String(ts)
          break
        }
      }
    } catch {}
  }
  
  const nonce = 0
  const domain = { name: 'ClobAuthDomain', version: '1', chainId }
  const types = {
    ClobAuth: [
      { name: 'address', type: 'address' },
      { name: 'timestamp', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
  }
  const value = {
    address: wallet.address,
    timestamp,
    nonce,
    message: 'This message attests that I control the given wallet',
  }
  
  let sig: string
  try {
    // ethers v6
    sig = await (wallet as any).signTypedData(domain, types, value)
  } catch {
    // ethers v5 style
    sig = await (wallet as any)._signTypedData(domain, types, value)
  }
  
  // Try multiple endpoint variations
  const endpoints = ['/auth/api-key', '/v1/auth/api-key', '/api-key']
  let lastError: Error | null = null
  
  for (const endpoint of endpoints) {
    try {
      const res = await axios.post(`${clob}${endpoint}`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'POLY_ADDRESS': wallet.address,
          'POLY_SIGNATURE': sig,
          'POLY_TIMESTAMP': timestamp,
          'POLY_NONCE': String(nonce),
          'POLY_CHAIN_ID_L1': String(chainId),
          'POLY_CHAIN_ID': String(chainId),
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) ElectronApp/1.0 Safari/537.36',
        },
        timeout: 15000,
        validateStatus: () => true,
      })
      
      if (res.status >= 200 && res.status < 300) {
        const creds = res.data as { key: string; secret: string; passphrase: string }
        if (!creds?.key || !creds?.secret || !creds?.passphrase) {
          throw new Error('Invalid credentials returned')
        }
        await saveTradingCredsToKeychain(creds)
        // For backwards compatibility, also store api key string
        await saveTradingApiKeyToKeychain(creds.key)
        return { ok: true, address: wallet.address }
      }
      
      // Store error for reporting if all attempts fail
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      lastError = new Error(`HTTP ${res.status} ${body?.slice(0, 200)}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  
  // If all attempts failed, check access status for more detail
  let accessNote = ''
  try {
    const accessEndpoints = ['/auth/access-status', '/v1/auth/access-status', '/access-status']
    for (const ep of accessEndpoints) {
      try {
        const as = await axios.get(`${clob}${ep}`, { 
          headers: { 'POLY_ADDRESS': wallet.address, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) ElectronApp/1.0 Safari/537.36' }, 
          timeout: 8000, 
          validateStatus: () => true 
        })
        if (as.status === 200 && typeof as.data === 'object') {
          accessNote = ` access=${JSON.stringify(as.data)}`
          break
        }
      } catch {}
    }
  } catch {}
  
  throw new Error(`Create API key failed: ${lastError?.message || 'Unknown error'}${accessNote}`)
})
ipcMain.handle('copytrader:saveApiKey', async (_e: IpcMainInvokeEvent, payload: { apiKey: string }) => {
  await saveTradingApiKeyToKeychain(payload.apiKey)
  return { ok: true }
})

ipcMain.handle('copytrader:deleteApiKey', async () => {
  const ok = await deleteTradingApiKeyFromKeychain()
  return { ok }
})

ipcMain.handle('copytrader:start', async (_e: IpcMainInvokeEvent, payload: {
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
}) => {
  if (!win) throw new Error('Window not ready')
  const privateKey = await getPrivateKeyFromKeychain()
  const apiKey = await getTradingApiKeyFromKeychain()
  const apiCreds = await getTradingCredsFromKeychain()
  if (!privateKey) throw new Error('No private key stored')
  const parsed = parseWalletFromInput(privateKey)
  const gamma = new GammaClient(payload.gammaBaseUrl)
  const mk = new PolymarketClient(parsed.privateKey, {
    rpcUrl: payload.rpcUrl,
    maxSlippageBps: payload.maxSlippageBps,
    dryRun: payload.dryRun,
    clobApiKey: apiKey ?? undefined,
    apiCreds: apiCreds ?? undefined,
    clobBaseUrl: payload.clobBaseUrl || 'https://clob.polymarket.com',
  })
  service?.stop()
  service = new CopyTraderService(win, gamma, mk, payload)
  service.start()
  return { ok: true }
})

ipcMain.handle('copytrader:stop', async () => {
  service?.stop()
  return { ok: true }
})

// Check if a private key exists in the secure store
ipcMain.handle('copytrader:hasKey', async () => {
  const key = await getPrivateKeyFromKeychain()
  if (!key) return { has: false }
  try {
    const wallet = parseWalletFromInput(key)
    const trimmed = key.trim().replace(/^[\'\"]|[\'\"]$/g, '')
    if (wallet.privateKey !== trimmed) {
      await savePrivateKeyToKeychain(wallet.privateKey)
    }
    return { has: true }
  } catch {
    return { has: false }
  }
})

// Lightweight connection test for Gamma API and RPC endpoint
ipcMain.handle('copytrader:test', async (_e: IpcMainInvokeEvent, payload: { gammaBaseUrl: string; rpcUrl: string; targetAddress?: string }) => {
  const result: { gammaOk: boolean; rpcOk: boolean; walletValid: boolean; chosenGammaBaseUrl?: string; gammaError?: string } = { gammaOk: false, rpcOk: false, walletValid: false }
  try {
    // Try multiple likely base URLs if the provided one fails
    const candidates = [
      payload.gammaBaseUrl,
      'https://gamma-api.polymarket.com',
      'https://clob.polymarket.com',
      'https://data-api.polymarket.com',
    ].filter(Boolean)
    const pingPaths = ['', '/status', '/v1/markets', '/markets']
    for (const base of candidates) {
      const baseSanitized = base?.replace(/\/$/, '')
      let ok = false
      let lastErr: unknown
      for (const p of pingPaths) {
        try {
          await axios.get(`${baseSanitized}${p}`, {
            timeout: 6000,
            validateStatus: () => true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) ElectronApp/1.0 Safari/537.36',
              'Accept': 'application/json,text/plain,*/*',
            },
          })
          ok = true
          break
        } catch (err) { lastErr = err }
      }
      if (ok) {
        result.gammaOk = true
        result.chosenGammaBaseUrl = baseSanitized
        break
      } else if (lastErr) {
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
        result.gammaError = msg.slice(0, 200)
      }
    }
  } catch {}
  try {
    const provider = new ethers.JsonRpcProvider(payload.rpcUrl)
    await provider.getBlockNumber()
    result.rpcOk = true
  } catch {}
  try {
    // Basic wallet validity check
    // ethers v6 exports isAddress at top-level
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAddr = (ethers as any).isAddress ? (ethers as any).isAddress(payload.targetAddress ?? '') : false
    result.walletValid = Boolean(isAddr)
  } catch {}
  return { ok: result.gammaOk || result.rpcOk, ...result }
})
