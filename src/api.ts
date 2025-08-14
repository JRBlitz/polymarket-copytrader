const API_BASE = 'http://localhost:3001'

export interface CopyTraderConfig {
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
}

export interface PerformanceStats {
  totalTrades: number
  successRate: number
  avgExecutionTime: number
  totalVolume: number
  tradesPerSecond: number
}

export interface Trade {
  id: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  details: any
  timestamp: number
}

export interface LogMessage {
  message: string
  time: number
  level: 'info' | 'warn' | 'error' | 'success'
}

class CopyTraderAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  async health(): Promise<{ status: string; timestamp: number }> {
    const response = await fetch(`${this.baseUrl}/health`)
    return response.json()
  }

  async getStatus(): Promise<{
    isRunning: boolean
    targetAddresses: string[]
    performance: PerformanceStats
    timestamp: number
  }> {
    const response = await fetch(`${this.baseUrl}/status`)
    return response.json()
  }

  async start(config: CopyTraderConfig): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    return response.json()
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/stop`, {
      method: 'POST',
    })
    return response.json()
  }

  async test(config: { gammaBaseUrl: string; rpcUrl: string; targetAddress?: string }): Promise<{
    gammaOk: boolean
    rpcOk: boolean
    walletValid: boolean
    chosenGammaBaseUrl?: string
    gammaError?: string
  }> {
    const response = await fetch(`${this.baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    return response.json()
  }

  async getMetrics(): Promise<PerformanceStats & {
    timestamp: number
    uptime: number
    memory: any
    cpu: any
  }> {
    const response = await fetch(`${this.baseUrl}/metrics`)
    return response.json()
  }
}

export const copyTraderAPI = new CopyTraderAPI()
export default copyTraderAPI
