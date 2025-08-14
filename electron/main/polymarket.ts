import { ethers } from 'ethers'
import axios from 'axios'
import { ClobClient, Side, OrderType } from '@polymarket/clob-client'
import { createRequire } from 'node:module'
// Safely access WalletClient across different module shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveWalletClientCtor = (pkg: any): any => {
  if (!pkg) return undefined
  if (typeof pkg.WalletClient === 'function') return pkg.WalletClient
  if (pkg.default && typeof pkg.default.WalletClient === 'function') return pkg.default.WalletClient
  if (pkg.clients && typeof pkg.clients.WalletClient === 'function') return pkg.clients.WalletClient
  return undefined
}
// Try to load the optional SDK at runtime; app works without it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WalletClientCtor: any
try {
  const req = createRequire(__filename)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PolymarketSdkPkg: any = req('@polymarket/sdk')
  WalletClientCtor = resolveWalletClientCtor(PolymarketSdkPkg)
} catch {
  WalletClientCtor = undefined
}

export interface ExecutionSettings {
  rpcUrl: string
  maxSlippageBps: number
  dryRun: boolean
  clobBaseUrl?: string
  clobApiKey?: string
  apiCreds?: { key: string; secret: string; passphrase: string }
}

export interface MirrorOrderRequest {
  marketId: string
  outcomeId: string
  side: 'buy' | 'sell'
  price: number
  size: number
  outcomeIndex?: number
}

export class PolymarketClient {
  private readonly provider: ethers.JsonRpcProvider
  private readonly wallet: ethers.Wallet
  private readonly sdk: any
  private readonly dryRun: boolean
  private readonly maxSlippageBps: number
  private readonly clobBaseUrl: string
  private readonly clobApiKey?: string
  private clob?: ClobClient

  constructor(privateKey: string, settings: ExecutionSettings) {
    this.provider = new ethers.JsonRpcProvider(settings.rpcUrl)
    this.wallet = new ethers.Wallet(privateKey, this.provider)
    // Construct Polymarket SDK client with signer/wallet, if available
    let constructed: any = null
    try {
      if (WalletClientCtor) {
        constructed = new WalletClientCtor({ signer: this.wallet as any })
      }
    } catch {
      constructed = null
    }
    this.sdk = constructed
    this.dryRun = settings.dryRun
    this.maxSlippageBps = settings.maxSlippageBps
    this.clobBaseUrl = (settings.clobBaseUrl || 'https://clob.polymarket.com').replace(/\/$/, '')
    this.clobApiKey = settings.clobApiKey
    try {
      const client = new ClobClient(this.clobBaseUrl, this.wallet as any)
      const anyClient: any = client
      // Prefer explicit setters when available across versions
      if (settings.apiCreds) {
        if (typeof anyClient.setApiCreds === 'function') {
          anyClient.setApiCreds(settings.apiCreds)
        } else if (typeof anyClient.configure === 'function') {
          anyClient.configure({ apiCreds: settings.apiCreds })
        }
      }
      this.clob = client
    } catch {
      this.clob = undefined
    }
  }

  async ensureApprovals(): Promise<void> {
    if (this.dryRun) return
    if (!this.sdk || typeof this.sdk.ensureApprovals !== 'function') return
    // Implement token approvals as required by Polymarket SDK
    await this.sdk.ensureApprovals()
  }

  async mirrorOrder(order: MirrorOrderRequest): Promise<string | undefined> {
    // Map to SDK order schema; adjust as per SDK API
    const slippage = this.maxSlippageBps / 10000
    if (this.dryRun) {
      return `dry-run:${order.marketId}:${order.outcomeId}:${order.side}:${order.size}@${order.price}~slip:${slippage}`
    }
    try {
      if (!this.clob) {
        // last-resort axios fallback
        const res = await axios.post(
          `${this.clobBaseUrl}/orders`,
          {
            marketId: order.marketId,
            outcomeId: order.outcomeId,
            side: order.side,
            price: order.price,
            size: order.size,
            slippage,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(this.clobApiKey ? { 'x-api-key': this.clobApiKey } : {}),
            },
            timeout: 15000,
          },
        )
        const tx = res.data
        return tx?.hash ?? tx?.transactionHash ?? 'submitted'
      }

      // Ensure we have API creds; try to derive if not provided
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClob: any = this.clob
      const hasGetter = typeof anyClob.getApiCreds === 'function'
      const existingCreds = hasGetter ? anyClob.getApiCreds() : undefined
      if (!existingCreds && typeof anyClob.createOrDeriveApiCreds === 'function') {
        try {
          const creds = await anyClob.createOrDeriveApiCreds()
          if (typeof anyClob.setApiCreds === 'function') anyClob.setApiCreds(creds)
          else if (typeof anyClob.configure === 'function') anyClob.configure({ apiCreds: creds })
        } catch {}
      }

      const side = order.side === 'sell' ? (Side as any).SELL : (Side as any).BUY
      const built = await (this.clob as any).createOrder({
        tokenID: order.outcomeId,
        price: Number(order.price),
        side,
        size: Number(order.size),
        feeRateBps: 0,
      })
      const resp = await (this.clob as any).postOrder(built, OrderType.GTC)
      return resp?.orderId ?? resp?.hash ?? 'submitted'
    } catch (err) {
      throw new Error(`Order failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}


