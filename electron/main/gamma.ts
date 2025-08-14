import axios from 'axios'

export interface GammaFill {
  id: string
  marketId: string
  outcomeId: string
  side: 'buy' | 'sell'
  price: number
  size: number
  timestamp: number
  txHash?: string
  outcomeIndex?: number
}

export class GammaClient {
  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(baseUrl: string, opts?: { apiKey?: string }) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = opts?.apiKey
  }

  async fetchFillsByAddress(address: string, sinceMs?: number, limit: number = 50): Promise<GammaFill[]> {
    const sinceSec = sinceMs ? Math.floor(sinceMs / 1000) : undefined
    const attempts: Array<{
      url: string
      params: Record<string, string | number>
      normalize: (data: any) => any[]
    }> = [
      {
        url: `${this.baseUrl}/fills`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.fills ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/trades`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/v1/trades`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/v1/fills`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.fills ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/fills`,
        params: { walletAddress: address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.fills ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/v1/trades`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/v1/trades`,
        params: { walletAddress: address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/trades`,
        params: { address, limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/fills/address/${address}`,
        params: { limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.fills ?? data ?? [],
      },
      {
        url: `${this.baseUrl}/trades/wallet/${address}`,
        params: { limit, ...(sinceSec ? { since: sinceSec } : {}) },
        normalize: (data: any) => data?.trades ?? data ?? [],
      },
    ]
    let lastError: unknown
    for (const attempt of attempts) {
      try {
        const { data, status } = await axios.get(attempt.url, {
          params: attempt.params,
          timeout: 12000,
          headers: {
            'User-Agent': 'Mozilla/5.0 ElectronApp/1.0',
            ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
          },
          validateStatus: () => true,
        })
        if (status === 401) throw new Error('Unauthorized (401) from data source')
        if (status === 404) throw new Error('Not found (404)')
        const raw = attempt.normalize(data)
        return (raw as any[]).map((f: any) => {
          // Normalize Data API /trades shape
          const sideRaw = (f.side ?? f.action ?? '').toString().toUpperCase()
          const side = sideRaw === 'SELL' || sideRaw === 'sell' ? 'sell' : 'buy'
          const tsSec = Number(f.timestamp ?? f.time ?? f.block_time)
          return {
            id: String(
              f.id ?? f.fillId ?? f.tradeId ?? `${f.transactionHash ?? f.txHash ?? ''}-${f.asset ?? f.marketId ?? ''}`
            ),
            marketId: String(f.marketId ?? ''),
            // Polymarket Data API provides `asset` as the tokenId to trade
            outcomeId: String(f.asset ?? f.outcomeId ?? f.outcome_id ?? f.outcomeIndex ?? ''),
            side,
            price: Number(f.price ?? f.fill_price ?? f.execution_price ?? 0),
            size: Number(f.size ?? f.fill_amount ?? f.amount ?? f.execution_size ?? 0),
            timestamp: (tsSec ? tsSec * 1000 : Date.now()),
            txHash: f.transactionHash ?? f.txHash ?? f.transaction_hash ?? undefined,
            outcomeIndex: typeof f.outcomeIndex !== 'undefined' ? Number(f.outcomeIndex) : (typeof f.outcome_index !== 'undefined' ? Number(f.outcome_index) : undefined),
          } as GammaFill
        }) as GammaFill[]
      } catch (err) {
        lastError = err
      }
    }
    throw lastError ?? new Error('Unable to fetch fills')
  }
}


