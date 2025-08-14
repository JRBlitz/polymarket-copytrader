import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { LRUCache } from 'lru-cache'

// Types
interface Trade {
  id: string
  market: string
  side: 'buy' | 'sell'
  size: number
  price: number
  timestamp: number
  walletAddress: string
}

interface CopyTrade {
  id: string
  originalTrade: Trade
  copySize: number
  maxSlippage: number
  status: 'pending' | 'executing' | 'completed' | 'failed'
  executionTime?: number
  error?: string
}

interface PerformanceMetrics {
  totalTrades: number
  successRate: number
  avgExecutionTime: number
  totalVolume: number
  tradesPerSecond: number
}

// High-Performance Copy Trading Engine
export class HighPerformanceCopyTrader extends EventEmitter {
  private isRunning: boolean = false
  private targetAddresses: Set<string> = new Set()
  private copyFactor: number = 1.0
  private maxSlippageBps: number = 100
  private dryRun: boolean = true
  
  // Performance optimizations
  private useWebSocket: boolean = true
  private batchSize: number = 50
  private maxConcurrentTrades: number = 10
  
  // Caching and state management
  private tradeCache: LRUCache<string, Trade> = new LRUCache({ max: 10000 })
  private copyTradeCache: LRUCache<string, CopyTrade> = new LRUCache({ max: 5000 })
  private performanceCache: LRUCache<string, number> = new LRUCache({ max: 1000 })
  
  // Connection management
  private wsConnections: Map<string, WebSocket> = new Map()
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map()
  
  // Processing queues
  private tradeQueue: Trade[] = []
  private copyTradeQueue: CopyTrade[] = []
  private processingQueue: CopyTrade[] = []
  
  // Performance tracking
  private metrics: PerformanceMetrics = {
    totalTrades: 0,
    successRate: 0,
    avgExecutionTime: 0,
    totalVolume: 0,
    tradesPerSecond: 0
  }
  
  private lastMetricsUpdate: number = Date.now()
  private tradeCount: number = 0
  
  constructor() {
    super()
    this.startMetricsCollection()
  }
  
  // Configuration methods
  public setTargetAddresses(addresses: string[]): void {
    this.targetAddresses.clear()
    addresses.forEach(addr => this.targetAddresses.add(addr.toLowerCase()))
  }
  
  public setCopyFactor(factor: number): void {
    this.copyFactor = Math.max(0, Math.min(5, factor)) // Cap between 0-500%
  }
  
  public setMaxSlippage(slippageBps: number): void {
    this.maxSlippageBps = Math.max(10, Math.min(1000, slippageBps))
  }
  
  public setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(100, size))
  }
  
  public setMaxConcurrency(concurrency: number): void {
    this.maxConcurrentTrades = Math.max(1, Math.min(50, concurrency))
  }
  
  public setWebSocketEnabled(enabled: boolean): void {
    this.useWebSocket = enabled
    if (enabled) {
      this.establishWebSocketConnections()
    } else {
      this.closeWebSocketConnections()
    }
  }
  
  // Main execution methods
  public async start(config: {
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
    useWebSocket: boolean
    batchSize: number
    maxConcurrentTrades: number
  }): Promise<{ ok: boolean }> {
    try {
      // Apply configuration
      this.setTargetAddresses(config.targetAddresses)
      this.setCopyFactor(config.copyFactor)
      this.setMaxSlippage(config.maxSlippageBps)
      this.dryRun = config.dryRun
      this.setBatchSize(config.batchSize)
      this.setMaxConcurrency(config.maxConcurrentTrades)
      this.setWebSocketEnabled(config.useWebSocket)
      
      if (this.useWebSocket) {
        await this.establishWebSocketConnections()
      } else {
        this.startPolling(config.pollIntervalMs)
      }
      
      this.isRunning = true
      this.emit('log', { message: 'Copy trading started', time: Date.now(), level: 'success' })
      
      return { ok: true }
    } catch (error) {
      this.emit('error', { message: `Failed to start: ${error}`, time: Date.now() })
      return { ok: false }
    }
  }
  
  public async stop(): Promise<{ ok: boolean }> {
    try {
      this.isRunning = false
      this.closeWebSocketConnections()
      this.clearQueues()
      this.emit('log', { message: 'Copy trading stopped', time: Date.now(), level: 'info' })
      return { ok: true }
    } catch (error) {
      this.emit('error', { message: `Failed to stop: ${error}`, time: Date.now() })
      return { ok: false }
    }
  }
  
  // WebSocket management
  private async establishWebSocketConnections(): Promise<void> {
    // This would connect to Polymarket's WebSocket endpoints
    // For now, we'll simulate the connection
    this.emit('log', { message: 'Establishing WebSocket connections...', time: Date.now(), level: 'info' })
    
    // Simulate connection establishment
    setTimeout(() => {
      this.emit('log', { message: 'WebSocket connections established', time: Date.now(), level: 'success' })
    }, 1000)
  }
  
  private closeWebSocketConnections(): void {
    this.wsConnections.forEach((ws, key) => {
      ws.close()
      this.wsConnections.delete(key)
    })
    
    this.reconnectIntervals.forEach((interval) => {
      clearInterval(interval)
    })
    this.reconnectIntervals.clear()
  }
  
  // Polling fallback
  private startPolling(intervalMs: number): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }
    
    this.pollingInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.pollForNewTrades()
      }
    }, intervalMs)
  }
  
  private async pollForNewTrades(): Promise<void> {
    // Simulate polling for new trades
    // In reality, this would call Polymarket's API
    this.emit('log', { message: 'Polling for new trades...', time: Date.now(), level: 'info' })
  }
  
  // Trade processing pipeline
  public async processTrade(trade: Trade): Promise<void> {
    if (!this.isRunning || !this.targetAddresses.has(trade.walletAddress.toLowerCase())) {
      return
    }
    
    // Cache the trade
    this.tradeCache.set(trade.id, trade)
    
    // Create copy trade
    const copyTrade: CopyTrade = {
      id: `copy_${trade.id}_${Date.now()}`,
      originalTrade: trade,
      copySize: trade.size * this.copyFactor,
      maxSlippage: this.maxSlippageBps,
      status: 'pending'
    }
    
    // Add to processing queue
    this.copyTradeQueue.push(copyTrade)
    
    // Process in batches
    if (this.copyTradeQueue.length >= this.batchSize) {
      await this.processBatch()
    }
    
    this.emit('tradeUpdate', copyTrade)
  }
  
  private async processBatch(): Promise<void> {
    if (this.copyTradeQueue.length === 0) return
    
    const batch = this.copyTradeQueue.splice(0, this.batchSize)
    this.processingQueue.push(...batch)
    
    // Process with concurrency control
    await this.processWithConcurrency(batch)
  }
  
  private async processWithConcurrency(trades: CopyTrade[]): Promise<void> {
    const chunks = this.chunkArray(trades, this.maxConcurrentTrades)
    
    for (const chunk of chunks) {
      const promises = chunk.map(trade => this.executeCopyTrade(trade))
      await Promise.allSettled(promises)
    }
  }
  
  private async executeCopyTrade(copyTrade: CopyTrade): Promise<void> {
    const startTime = Date.now()
    
    try {
      copyTrade.status = 'executing'
      this.emit('tradeUpdate', copyTrade)
      
      if (this.dryRun) {
        // Simulate execution delay
        await this.delay(Math.random() * 100 + 50)
        copyTrade.status = 'completed'
      } else {
        // Real execution would happen here
        await this.executeRealTrade(copyTrade)
        copyTrade.status = 'completed'
      }
      
      copyTrade.executionTime = Date.now() - startTime
      this.updateMetrics(copyTrade)
      
    } catch (error) {
      copyTrade.status = 'failed'
      copyTrade.error = error instanceof Error ? error.message : String(error)
      copyTrade.executionTime = Date.now() - startTime
    }
    
    this.emit('tradeUpdate', copyTrade)
    
    // Remove from processing queue
    const index = this.processingQueue.findIndex(t => t.id === copyTrade.id)
    if (index > -1) {
      this.processingQueue.splice(index, 1)
    }
  }
  
  private async executeRealTrade(_copyTrade: CopyTrade): Promise<void> {
    // This would execute the actual trade on Polymarket
    // For now, we'll simulate it
    await this.delay(Math.random() * 200 + 100)
    
    // Simulate potential failure
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated trade execution failure')
    }
  }
  
  // Performance monitoring
  private startMetricsCollection(): void {
    // Metrics are updated automatically in updateMetrics method
  }
  
  private updateMetrics(copyTrade: CopyTrade): void {
    this.tradeCount++
    
    if (copyTrade.status === 'completed') {
      this.metrics.totalTrades++
      this.metrics.totalVolume += copyTrade.copySize
      
      if (copyTrade.executionTime) {
        const currentAvg = this.metrics.avgExecutionTime
        const totalTrades = this.metrics.totalTrades
        this.metrics.avgExecutionTime = (currentAvg * (totalTrades - 1) + copyTrade.executionTime) / totalTrades
      }
    }
    
    // Calculate success rate
    const totalProcessed = this.metrics.totalTrades + this.copyTradeCache.size
    this.metrics.successRate = totalProcessed > 0 ? this.metrics.totalTrades / totalProcessed : 0
    
    // Calculate trades per second
    const now = Date.now()
    const timeDiff = (now - this.lastMetricsUpdate) / 1000
    if (timeDiff > 0) {
      this.metrics.tradesPerSecond = this.tradeCount / timeDiff
      this.tradeCount = 0
      this.lastMetricsUpdate = now
    }
  }
  
  public async getPerformanceStats(): Promise<PerformanceMetrics> {
    return { ...this.metrics }
  }
  
  // Utility methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  private clearQueues(): void {
    this.tradeQueue.length = 0
    this.copyTradeQueue.length = 0
    this.processingQueue.length = 0
  }
  
  // Cleanup
  public destroy(): void {
    this.stop()
    this.removeAllListeners()
    this.tradeCache.clear()
    this.copyTradeCache.clear()
    this.performanceCache.clear()
  }
  
  // Private properties
  private pollingInterval?: NodeJS.Timeout
}

// Export the class
export default HighPerformanceCopyTrader
