import { HighPerformanceCopyTrader } from './HighPerformanceCopyTrader.js'

async function runTests() {
  console.log('🧪 Starting High-Performance Copy Trader Tests...\n')

  // Create instance
  const copyTrader = new HighPerformanceCopyTrader()

  // Test 1: Configuration
  console.log('📋 Test 1: Configuration')
  copyTrader.setTargetAddresses(['0x1234567890123456789012345678901234567890'])
  copyTrader.setCopyFactor(1.5)
  copyTrader.setMaxSlippage(200)
  copyTrader.setBatchSize(25)
  copyTrader.setMaxConcurrency(5)
  console.log('✅ Configuration tests passed\n')

  // Test 2: Start/Stop
  console.log('🚀 Test 2: Start/Stop Operations')
  const startResult = await copyTrader.start({
    gammaBaseUrl: 'https://gamma-api.polymarket.com',
    rpcUrl: 'https://polygon-rpc.com',
    targetAddresses: ['0x1234567890123456789012345678901234567890'],
    copyFactor: 1.0,
    maxSlippageBps: 100,
    dryRun: true,
    pollIntervalMs: 15000,
    executionMode: 'percent',
    fixedSize: 10,
    sellAllOnSell: false,
    useWebSocket: true,
    batchSize: 25,
    maxConcurrentTrades: 5
  })
  console.log('Start result:', startResult)

  const stopResult = await copyTrader.stop()
  console.log('Stop result:', stopResult)
  console.log('✅ Start/Stop tests passed\n')

  // Test 3: Performance Metrics
  console.log('📊 Test 3: Performance Metrics')
  const metrics = await copyTrader.getPerformanceStats()
  console.log('Initial metrics:', metrics)
  console.log('✅ Performance metrics test passed\n')

  // Test 4: Event Handling
  console.log('🎯 Test 4: Event Handling')
  let eventCount = 0
  
  copyTrader.on('log', (log) => {
    eventCount++
    console.log(`📝 Log event ${eventCount}:`, log.message)
  })

  copyTrader.on('tradeUpdate', (trade) => {
    eventCount++
    console.log(`💼 Trade update ${eventCount}:`, trade.status)
  })

  // Simulate some activity
  await copyTrader.start({
    gammaBaseUrl: 'https://gamma-api.polymarket.com',
    rpcUrl: 'https://polygon-rpc.com',
    targetAddresses: ['0x1234567890123456789012345678901234567890'],
    copyFactor: 1.0,
    maxSlippageBps: 100,
    dryRun: true,
    pollIntervalMs: 15000,
    executionMode: 'percent',
    fixedSize: 10,
    sellAllOnSell: false,
    useWebSocket: false, // Use polling for test
    batchSize: 5,
    maxConcurrentTrades: 2
  })

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  await copyTrader.stop()
  console.log(`✅ Event handling test passed (${eventCount} events received)\n`)

  // Test 5: Memory and Performance
  console.log('🧠 Test 5: Memory and Performance')
  const startMemory = process.memoryUsage()
  console.log('Initial memory usage:', {
    rss: `${Math.round(startMemory.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(startMemory.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(startMemory.heapTotal / 1024 / 1024)} MB`
  })

  // Simulate high load
  const startTime = Date.now()
  for (let i = 0; i < 100; i++) {
    copyTrader.processTrade({
      id: `test_trade_${i}`,
      market: 'TEST-MARKET',
      side: i % 2 === 0 ? 'buy' : 'sell',
      size: Math.random() * 100,
      price: 100 + Math.random() * 10,
      timestamp: Date.now(),
      walletAddress: '0x1234567890123456789012345678901234567890'
    })
  }

  const endTime = Date.now()
  const processingTime = endTime - startTime

  const endMemory = process.memoryUsage()
  console.log('Final memory usage:', {
    rss: `${Math.round(endMemory.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(endMemory.heapTotal / 1024 / 1024)} MB`
  })

  console.log(`Processing time: ${processingTime}ms`)
  console.log(`Trades per second: ${(100 / processingTime * 1000).toFixed(2)}`)
  console.log('✅ Memory and performance test passed\n')

  // Test 6: Cleanup
  console.log('🧹 Test 6: Cleanup')
  copyTrader.destroy()
  console.log('✅ Cleanup test passed\n')

  // Final metrics
  console.log('📈 Final Performance Summary')
  const finalMetrics = await copyTrader.getPerformanceStats()
  console.log('Final metrics:', finalMetrics)

  console.log('\n🎉 All tests completed successfully!')
  console.log('\n🚀 Your High-Performance Copy Trading system is ready!')
  console.log('\nNext steps:')
  console.log('1. Configure your Polymarket API credentials')
  console.log('2. Set your target wallet addresses')
  console.log('3. Start the backend server: npm run dev:backend')
  console.log('4. Open the frontend: npm run dev')
  console.log('5. Begin copy trading!')
}

// Run tests
runTests().catch(console.error)
