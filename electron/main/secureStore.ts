// keytar is a native module; require at runtime to avoid bundler packing
// eslint-disable-next-line @typescript-eslint/no-var-requires
const keytar = require('keytar') as typeof import('keytar')

const SERVICE_NAME = 'PolymarketCopytrader'
const ACCOUNT_NAME = 'default-wallet'
const TRADING_API_ACCOUNT = 'trading-api-key'
const TRADING_CREDS_ACCOUNT = 'trading-api-creds'

export async function savePrivateKeyToKeychain(privateKey: string): Promise<void> {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Invalid private key')
  }
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, privateKey)
}

export async function getPrivateKeyFromKeychain(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
}

export async function deletePrivateKeyFromKeychain(): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
}

export async function saveTradingApiKeyToKeychain(apiKey: string): Promise<void> {
  if (!apiKey || typeof apiKey !== 'string') throw new Error('Invalid API key')
  await keytar.setPassword(SERVICE_NAME, TRADING_API_ACCOUNT, apiKey)
}

export async function getTradingApiKeyFromKeychain(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, TRADING_API_ACCOUNT)
}

export async function deleteTradingApiKeyFromKeychain(): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, TRADING_API_ACCOUNT)
}

export type TradingCreds = { key: string; secret: string; passphrase: string }

export async function saveTradingCredsToKeychain(creds: TradingCreds): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, TRADING_CREDS_ACCOUNT, JSON.stringify(creds))
}

export async function getTradingCredsFromKeychain(): Promise<TradingCreds | null> {
  const v = await keytar.getPassword(SERVICE_NAME, TRADING_CREDS_ACCOUNT)
  if (!v) return null
  try { return JSON.parse(v) as TradingCreds } catch { return null }
}

export async function deleteTradingCredsFromKeychain(): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, TRADING_CREDS_ACCOUNT)
}


