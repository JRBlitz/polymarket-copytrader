import { BrowserWindow } from 'electron'
import { GammaClient, GammaFill } from './gamma'
import { PolymarketClient, ExecutionSettings } from './polymarket'

export interface CopySettings {
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
}

export class CopyTraderService {
  private running = false
  private intervalId: NodeJS.Timeout | null = null
  private readonly lastTimestampMsByAddress: Record<string, number> = {}
  private readonly seenFillIdsByAddress = new Map<string, Set<string>>()

  constructor(
    private readonly win: BrowserWindow,
    private readonly gamma: GammaClient,
    private readonly mk: PolymarketClient,
    private readonly settings: CopySettings,
  ) {}

  start() {
    if (this.running) return
    this.running = true
    this.intervalId = setInterval(() => this.tick().catch(err => this.reportError(err)), this.settings.pollIntervalMs)
    this.log(`CopyTrader started. Watching ${this.settings.targetAddresses.length} wallet(s).`)
    // Trigger an immediate check so the user sees output right away
    this.tick().catch(err => this.reportError(err))
  }

  stop() {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.log('CopyTrader stopped')
  }

  private async tick(): Promise<void> {
    if (!this.running) return
    const aggregated: Array<{ fill: GammaFill; address: string }> = []
    for (const address of this.settings.targetAddresses) {
      const since = this.lastTimestampMsByAddress[address] ?? 0
      const seen = this.seenFillIdsByAddress.get(address) ?? new Set<string>()
      this.seenFillIdsByAddress.set(address, seen)
      this.log(`Checking ${address.slice(0, 6)}… for new trades since ${since ? new Date(since).toLocaleTimeString() : 'start'}`)
      let fills: GammaFill[] = []
      try {
        fills = await this.gamma.fetchFillsByAddress(address, since)
      } catch (err) {
        this.reportError(err)
        continue
      }
      this.log(`Found ${fills.length} trade(s) for ${address.slice(0, 6)}…`)
      for (const f of fills) {
        if (!seen.has(f.id)) {
          seen.add(f.id)
          aggregated.push({ fill: f, address })
        }
        this.lastTimestampMsByAddress[address] = Math.max(this.lastTimestampMsByAddress[address] ?? 0, f.timestamp)
      }
    }
    if (aggregated.length === 0) {
      this.log('No new trades found this round')
      return
    }
    await this.mk.ensureApprovals()
    for (const { fill: f, address } of aggregated) {
      const baseSize = this.settings.executionMode === 'fixed' ? this.settings.fixedSize : (f.size * this.settings.copyFactor)
      const size = f.side === 'sell' && this.settings.sellAllOnSell ? 1 : baseSize
      const txHash = await this.mk.mirrorOrder({
        marketId: f.marketId,
        outcomeId: f.outcomeId,
        side: f.side,
        price: f.price,
        size,
      })
      if (txHash === 'skipped:client-unavailable') {
        this.log(`[${address.slice(0, 6)}…] Simulated ${f.side} ${size} @ ${f.price} (real trading not enabled in this build)`)
      } else {
        this.log(`[${address.slice(0, 6)}…] Mirrored ${f.side} ${size} @ ${f.price} on market ${f.marketId} outcome ${f.outcomeId} -> ${txHash ?? 'ok'}`)
      }
    }
  }

  private reportError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.win.webContents.send('copytrader:error', { message, time: Date.now() })
  }

  private log(message: string) {
    this.win.webContents.send('copytrader:log', { message, time: Date.now() })
  }
}


