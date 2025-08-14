import { useEffect, useState, useMemo } from 'react'
import './App.css'

type LogMsg = { message: string; time: number }

type TestResult = {
  ok: boolean
  gammaOk: boolean
  rpcOk: boolean
  walletValid: boolean
  chosenGammaBaseUrl?: string
  gammaError?: string
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className='card' style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>{props.title}</h3>
      {props.children}
    </div>
  )
}

function App() {
  const [gammaBaseUrl, setGammaBaseUrl] = useState('https://data-api.polymarket.com')
  const [rpcUrl, setRpcUrl] = useState('https://polygon-rpc.com')
  const [clobBaseUrl, setClobBaseUrl] = useState('https://clob.polymarket.com')
  const [targets, setTargets] = useState('')
  const [copyFactor, setCopyFactor] = useState(1)
  const [maxSlippageBps, setMaxSlippageBps] = useState(100)
  const [dryRun, setDryRun] = useState(true)
  const [pollMs, setPollMs] = useState(10000)
  const [execMode, setExecMode] = useState<'percent' | 'fixed'>('percent')
  const [fixedSize, setFixedSize] = useState(1)
  const [sellAllOnSell, setSellAllOnSell] = useState(true)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [apiStatus, setApiStatus] = useState<string>('')
  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [logs, setLogs] = useState<LogMsg[]>([])
  const [running, setRunning] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    try {
      window.copyTrader.onLog((m) => setLogs(prev => [...prev.slice(-199), m]))
      window.copyTrader.onError((m) => setLogs(prev => [...prev.slice(-199), { ...m, message: `ERROR: ${m.message}` }]))
    } catch {}
    window.copyTrader.hasKey().then(r => setHasKey(r.has)).catch(() => setHasKey(false))
  }, [])

  const targetAddresses = useMemo(() => (
    targets.split(/[\,\s]+/).map(s => s.trim()).filter(Boolean)
  ), [targets])

  async function handleSaveKey() {
    const pk = (privateKeyInput || prompt('Enter private key (0x...)') || '').trim()
    if (!pk) return
    await window.copyTrader.savePrivateKey({ privateKey: pk })
    setPrivateKeyInput('')
    setHasKey(true)
  }

  async function handleDeleteKey() {
    await window.copyTrader.deletePrivateKey()
    setHasKey(false)
  }

  async function handleCreateApiKey() {
    try {
      const res = await window.copyTrader.createTradingApiKey({ clobBaseUrl: 'https://clob.polymarket.com' })
      setApiStatus(res.ok ? `API key created for ${res.address}` : 'Failed to create API key')
    } catch (e) {
      setApiStatus((e as Error).message)
    }
  }

  async function handleCheckAccess() {
    try {
      const res = await window.copyTrader.checkAccessStatus({ clobBaseUrl: 'https://clob.polymarket.com' })
      setApiStatus(res.ok ? JSON.stringify(res.status) : 'Access check failed')
    } catch (e) {
      setApiStatus((e as Error).message)
    }
  }

  async function handleStart() {
    const res = await window.copyTrader.start({
      gammaBaseUrl,
      rpcUrl,
      clobBaseUrl,
      targetAddresses,
      copyFactor,
      maxSlippageBps,
      dryRun,
      pollIntervalMs: pollMs,
      executionMode: execMode,
      fixedSize,
      sellAllOnSell,
    })
    if (res?.ok) setRunning(true)
  }

  async function handleStop() {
    await window.copyTrader.stop()
    setRunning(false)
  }

  async function handleTest() {
    const first = targetAddresses[0]
    const r = await window.copyTrader.test({ gammaBaseUrl, rpcUrl, targetAddress: first })
    setTestResult(r as TestResult)
    setApiStatus(`gamma:${r.gammaOk} rpc:${r.rpcOk} wallet:${r.walletValid} base:${r.chosenGammaBaseUrl ?? ''} ${r.gammaError ?? ''}`)
  }

  function StatusChip(props: { ok: boolean; label: string }) {
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 12,
        background: props.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        color: props.ok ? '#10b981' : '#ef4444',
        border: `1px solid ${props.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
      }}>{props.label}</span>
    )
  }

  return (
    <div className='App' style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 28, marginBottom: 4 }}>Polymarket Copytrader Pro</h2>
          <p style={{ marginTop: 0, marginBottom: 8, opacity: 0.8 }}>Configure and run copy trading from your desktop.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusChip ok={running} label={running ? 'Running' : 'Stopped'} />
          {!dryRun && <span style={{ fontSize: 12, color: '#ef4444' }}>Live trading enabled</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, marginBottom: 16, background: 'rgba(0,0,0,0.03)' }}>
        <div style={{ fontWeight: 600 }}>Quick Setup: Private Key</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={privateKeyInput} onChange={e => setPrivateKeyInput(e.target.value)} placeholder='0x...' style={{ flex: 1 }} />
          <button onClick={handleSaveKey}>{hasKey ? 'Replace' : 'Save'}</button>
          <button onClick={handleDeleteKey} disabled={!hasKey}>Delete</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Tip: If you don’t see this field for any reason, the Save button will also prompt you for the key.</div>
      </div>

      <Section title='Wallet & API'>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Private Key</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={privateKeyInput} onChange={e => setPrivateKeyInput(e.target.value)} placeholder='0x...' />
              <button onClick={handleSaveKey}>{hasKey ? 'Replace' : 'Save'}</button>
              <button onClick={handleDeleteKey} disabled={!hasKey}>Delete</button>
            </div>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Manual CLOB API Key (optional)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder='Paste existing key' />
              <button onClick={async () => { if (!apiKeyInput) return; await window.copyTrader.saveTradingApiKey({ apiKey: apiKeyInput }); setApiKeyInput(''); setApiStatus('Saved API key'); }}>Save</button>
              <button onClick={async () => { await window.copyTrader.deleteTradingApiKey(); setApiStatus('Deleted API key'); }}>Delete</button>
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <button onClick={handleCreateApiKey} disabled={!hasKey}>Create API Key (sign)</button>
          <button onClick={handleCheckAccess} disabled={!hasKey}>Check CLOB Access</button>
          <button onClick={async () => { const r = await window.copyTrader.hasKey(); setHasKey(r.has); }}>Refresh Key Status</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{apiStatus}</div>
      </Section>

      <Section title='Configuration'>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Gamma/Data API Base URL</span>
            <input value={gammaBaseUrl} onChange={e => setGammaBaseUrl(e.target.value)} placeholder='https://data-api.polymarket.com' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>CLOB Base URL</span>
            <input value={clobBaseUrl} onChange={e => setClobBaseUrl(e.target.value)} placeholder='https://clob.polymarket.com' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>RPC URL</span>
            <input value={rpcUrl} onChange={e => setRpcUrl(e.target.value)} placeholder='https://polygon-rpc.com' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Target Wallets (comma/space separated)</span>
            <input value={targets} onChange={e => setTargets(e.target.value)} placeholder='0xabc..., 0xdef...' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Copy Factor</span>
            <input type='number' step='0.1' min='0' max='5' value={copyFactor} onChange={e => setCopyFactor(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Max Slippage (bps)</span>
            <input type='number' min='10' max='1000' value={maxSlippageBps} onChange={e => setMaxSlippageBps(parseInt(e.target.value))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Poll Interval (ms)</span>
            <input type='number' min='1000' step='500' value={pollMs} onChange={e => setPollMs(parseInt(e.target.value))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Execution Mode</span>
            <select value={execMode} onChange={e => setExecMode(e.target.value as any)}>
              <option value='percent'>Percent-based</option>
              <option value='fixed'>Fixed Size</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Fixed Size</span>
            <input type='number' min='0' step='1' value={fixedSize} onChange={e => setFixedSize(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type='checkbox' checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            <span>Dry Run (no real orders)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type='checkbox' checked={sellAllOnSell} onChange={e => setSellAllOnSell(e.target.checked)} />
            <span>Sell all on sell signals</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleStart} disabled={running || targetAddresses.length === 0}>Start</button>
          <button onClick={handleStop} disabled={!running}>Stop</button>
          <button onClick={handleTest}>Test Connectivity</button>
          {testResult && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusChip ok={!!testResult.gammaOk} label={testResult.gammaOk ? 'Data API OK' : 'Data API Failed'} />
              <StatusChip ok={!!testResult.rpcOk} label={testResult.rpcOk ? 'RPC OK' : 'RPC Failed'} />
              <StatusChip ok={!!testResult.walletValid} label={testResult.walletValid ? 'Wallet OK' : 'Wallet Invalid'} />
            </div>
          )}
        </div>
        {!dryRun && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 12 }}>
            Live orders will be submitted. Double-check your settings before starting.
          </div>
        )}
      </Section>

      <Section title='Logs'>
        <div style={{ maxHeight: 280, overflow: 'auto', textAlign: 'left', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 8 }}>
          {logs.length === 0 ? <div style={{ opacity: 0.7 }}>No logs yet.</div> : logs.map((l, i) => (
            <div key={i}>
              <span style={{ opacity: 0.6 }}>{new Date(l.time).toLocaleTimeString()} </span>
              <span>{l.message}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

export default App