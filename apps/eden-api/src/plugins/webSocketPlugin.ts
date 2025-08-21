import FastifyWebSocket, { WebsocketPluginOptions } from '@fastify/websocket'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { WebSocket } from 'ws'

interface BroadcastMessage {
  event: string
  clientId: string
  payload: any
}

const registerWebSocket: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  try {
    const websocketOptions: WebsocketPluginOptions = {
      errorHandler: (error, socket, req, reply) => {
        fastify.log.error('Websocket ErrorHandler', { error, req, reply })
        socket.terminate()
      },
      options: {
        clientTracking: true,
        maxPayload: 1048576, // limit message size to 1 MiB
        verifyClient: (info, next) => {
          if (
            info.origin !== fastify.config.FRONTEND_URL &&
            info.origin !== fastify.config.EDEN2_FRONTEND_URL
          ) {
            fastify.log.warn('WebSocket connection rejected', {
              origin: info.origin,
              allowedOrigin: [
                fastify.config.FRONTEND_URL,
                fastify.config.EDEN2_FRONTEND_URL,
              ],
            })
            return next(false)
          }
          next(true)
        },
      },
    }

    // Store active connections by client ID
    const connections = new Map<string, WebSocket>()

    // Handle broadcast messages
    fastify.decorate('broadcastToClient', (clientId: string, message: any) => {
      const connection = connections.get(clientId)
      if (connection) {
        connection.send(JSON.stringify(message))
      }
    })

    // Handle WebSocket messages
    fastify.decorate(
      'handleWebSocketMessage',
      (socket: WebSocket, message: BroadcastMessage) => {
        const { clientId } = message
        connections.set(clientId, socket)

        socket.on('close', () => {
          connections.delete(clientId)
        })
      },
    )

    await fastify.register(FastifyWebSocket, websocketOptions)
    fastify.log.info('Successfully registered plugin: WebSocket')
  } catch (err) {
    fastify.log.error('Plugin: WebSocket, error on register', err)
  }
}

export default registerWebSocket
