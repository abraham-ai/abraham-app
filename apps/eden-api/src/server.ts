import { subscribeWebSocketUpdates } from './controllers/v2/taskControllerV2'
import { dummyTaskHandlers } from './lib/taskHandlers/dummy'
import registerAssetUpload from './plugins/assetUploadPlugin'
import registerChroma from './plugins/chromaPlugin'
import registerClerk from './plugins/clerkPlugin'
import registerCloudinary from './plugins/cloudinaryPlugin'
import config from './plugins/config'
import registerEden2SessionUpdates from './plugins/eden2SessionUpdatePlugin'
import registerEden2TaskUpdates from './plugins/eden2TaskUpdatePlugin'
import registerEden2ThreadUpdates from './plugins/eden2ThreadUpdatePlugin'
import registerElevenLabs from './plugins/elevenLabsPlugin'
import registerEventEmitter from './plugins/eventEmitterPlugin'
import { registerInternalMessages } from './plugins/internalMessagesPlugin'
import registerLogos from './plugins/logosPlugin'
import registerMongo from './plugins/mongoPlugin'
import registerMultipart from './plugins/multipartPlugin'
import registerReplicate from './plugins/replicatePlugin'
import registerS3 from './plugins/s3Plugin'
import registerSentry from './plugins/sentryPlugin'
import registerSSE from './plugins/ssePlugin'
import registerStripe from './plugins/stripePlugin'
import { TaskHandlers, registerTaskHandlers } from './plugins/tasks'
import registerWebSocket from './plugins/webSocketPlugin'
import { routes } from './routes'
import { routes as routesV2 } from './routes/v2'
import fastify, { FastifyRequest } from 'fastify'

export interface CreateServerOpts {
  mongoUri?: string
  chromaUri?: string
  taskHandlers?: TaskHandlers
}

const createServer = async (
  opts: CreateServerOpts = {
    taskHandlers: dummyTaskHandlers,
  },
) => {
  const server = fastify({
    ajv: {
      customOptions: {
        keywords: ['kind', 'modifier'],
        removeAdditional: 'all',
        coerceTypes: 'array',
        allowUnionTypes: true,
        useDefaults: true,
      },
    },
    logger: {
      level: process.env.LOG_LEVEL,
    },
    pluginTimeout: 0,
    connectionTimeout: 60000, // 60 seconds
    keepAliveTimeout: 30000, // 30 seconds
    maxRequestsPerSocket: 0, // Disable max requests per socket limit
  })

  await server.register(config)

  server.register(import('@fastify/cors'), () => {
    return (req: FastifyRequest, callback: any) => {
      let corsOptions = {}
      if (req.url.startsWith('/tasks/events')) {
        corsOptions = {
          origin: ['*'],
          methods: ['GET'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'cache-control',
            'X-Api-Key',
            'X-Api-Secret',
          ],
          credentials: true,
        }
      }

      callback(null, corsOptions)
    }
  })

  if (server.config.NODE_ENV !== 'development') {
    await registerSentry(server)
  }

  await registerClerk(server)

  await server.register(import('fastify-raw-body'), {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: [],
  })

  await registerMongo(server, opts.mongoUri)
  await registerChroma(server, opts.chromaUri)
  await registerMultipart(server)
  await registerWebSocket(server, opts)
  await registerSSE(server)
  await registerEventEmitter(server)
  await registerInternalMessages(server, opts)
  await registerStripe(server)
  await registerAssetUpload(server)
  await registerS3(server)
  await registerEden2TaskUpdates(server, opts)
  await registerEden2ThreadUpdates(server, opts)
  await registerEden2SessionUpdates(server, opts)

  registerTaskHandlers(server, opts.taskHandlers)

  if (
    server.config.CLOUDINARY_API_SECRET &&
    server.config.CLOUDINARY_API_KEY &&
    server.config.CLOUDINARY_CLOUD_NAME
  ) {
    await registerCloudinary(server)
  }

  if (server.config.REPLICATE_API_TOKEN) {
    await registerReplicate(server)
  }

  if (server.config.ELEVENLABS_API_KEY) {
    await registerElevenLabs(server)
  }

  if (server.config.LOGOS_URL) {
    await registerLogos(server)
  }

  await server.register(import('@fastify/rate-limit'), {
    max: 10000,
    timeWindow: '1 minute',
  })

  await server.register(import('@fastify/swagger'), {
    swagger: {
      securityDefinitions: {
        apiKey: {
          type: 'apiKey',
          name: 'X-Api-Key',
          in: 'header',
        },
        // apiSecret: {
        //   type: 'apiKey',
        //   name: 'X-Api-Secret',
        //   in: 'header',
        // },
      },
    },
  })

  const swaggerSha = 'tG+x05Hp2iKWfyCNzcCBlraUuB6rEMjtIj/zcnbu/fk='
  const styleSha = 'RL3ie0nH+Lzz2YNqQN83mnU0J1ot4QL7b99vMdIX99w='

  await server.register(import('fastify-healthcheck'), {
    // healthcheckUrl: '/healthcheck',
    // healthcheckUrlAlwaysFail: true
  })

  await server.register(import('@fastify/swagger-ui'), {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: header => {
      header = header.replace(
        "script-src 'self'",
        `script-src 'self' 'sha256-${swaggerSha}`,
      )
      header = header.replace(
        "style-src 'self'",
        `style-src 'self' 'sha256-${styleSha}'`,
      )
      return header
    },
  })

  // Register Routes 1
  // websocket route before all others
  server.get('/ws/updates', { websocket: true }, subscribeWebSocketUpdates)

  // all other routes
  routes.map(async route => {
    await server.register(route)
  })

  // eden2 specific - routes
  routesV2.map(async route => {
    await server.register(route)
  })

  await server.ready()

  return server
}

export default createServer
