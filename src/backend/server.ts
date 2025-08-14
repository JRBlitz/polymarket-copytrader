import Fastify from 'fastify'
import { HighPerformanceCopyTrader } from './HighPerformanceCopyTrader'

// Environment configuration
const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001
const HOST = process.env['HOST'] || '0.0.0.0'

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info'
  },
  trustProxy: true
})

// Create copy trading engine
const copyTrader = new HighPerformanceCopyTrader()

// Register plugins
async function registerPlugins() {
  // Basic CORS
  fastify.addHook('preHandler', (_, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type')
    done()
  })
}

// WebSocket support will be added later

// API Routes
fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: Date.now() }
})

fastify.get('/status', async (_, reply) => {
  try {
    const stats = await copyTrader.getPerformanceStats()
    return {
      isRunning: copyTrader['isRunning'],
      targetAddresses: Array.from(copyTrader['targetAddresses']),
      performance: stats,
      timestamp: Date.now()
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get status' })
    return
  }
})

fastify.post('/start', async (request, reply) => {
  try {
    const config = request.body as any
    
    // Validate required fields
    if (!config.targetAddresses || !Array.isArray(config.targetAddresses)) {
      reply.status(400).send({ error: 'targetAddresses is required and must be an array' })
      return
    }
    
    if (!config.gammaBaseUrl || !config.rpcUrl) {
      reply.status(400).send({ error: 'gammaBaseUrl and rpcUrl are required' })
      return
    }
    
    const result = await copyTrader.start(config)
    
    if (result.ok) {
      return { success: true, message: 'Copy trading started' }
    } else {
      reply.status(500).send({ error: 'Failed to start copy trading' })
      return
    }
  } catch (error) {
    console.error('Failed to start copy trading:', String(error))
    reply.status(500).send({ error: 'Internal server error' })
    return
  }
})

fastify.post('/stop', async (_, reply) => {
  try {
    const result = await copyTrader.stop()
    
    if (result.ok) {
      return { success: true, message: 'Copy trading stopped' }
    } else {
      reply.status(500).send({ error: 'Failed to stop copy trading' })
      return
    }
  } catch (error) {
    console.error('Failed to stop copy trading:', String(error))
    reply.status(500).send({ error: 'Internal server error' })
    return
  }
})

fastify.post('/test', async (request, reply) => {
  try {
    const { gammaBaseUrl, rpcUrl, targetAddress } = request.body as any
    
    if (!gammaBaseUrl || !rpcUrl) {
      reply.status(400).send({ error: 'gammaBaseUrl and rpcUrl are required' })
      return
    }
    
    // Simulate connection test
    const testResult = {
      gammaOk: true,
      rpcOk: true,
      walletValid: targetAddress ? targetAddress.length === 42 : false,
      chosenGammaBaseUrl: gammaBaseUrl,
      gammaError: null
    }
    
    return testResult
  } catch (error) {
    console.error('Connection test failed:', String(error))
    reply.status(500).send({ error: 'Internal server error' })
    return
  }
})

fastify.get('/metrics', async (_, reply) => {
  try {
    const stats = await copyTrader.getPerformanceStats()
    return {
      ...stats,
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get metrics' })
    return
  }
})

// Error handling
fastify.setErrorHandler((error, _, reply) => {
  fastify.log.error(error)
  
  if (error.statusCode) {
    reply.status(error.statusCode).send({ error: error.message })
  } else {
    reply.status(500).send({ error: 'Internal server error' })
  }
})

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Shutting down gracefully...')
  
  try {
    await copyTrader.destroy()
    await fastify.close()
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', String(error))
    process.exit(1)
  }
})

process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, shutting down gracefully...')
  
  try {
    await copyTrader.destroy()
    await fastify.close()
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', String(error))
    process.exit(1)
  }
})

// Start server
async function start() {
  try {
    await registerPlugins()
    
    await fastify.listen({
      port: PORT,
      host: HOST
    })
    
    fastify.log.info(`🚀 High-Performance Copy Trading Server running on ${HOST}:${PORT}`)
    fastify.log.info(`📊 Metrics available at http://${HOST}:${PORT}/metrics`)
    fastify.log.info(`🔌 REST API endpoints available`)
    
  } catch (error) {
    console.error('Failed to start server:', String(error))
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  start()
}

export { fastify, copyTrader }
