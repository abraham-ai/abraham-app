import {
  claimDailyLoginBonus,
  disconnectDiscord,
  discordOAuth,
} from '../controllers/auth/authController'
import { receiveUserUpdate } from '../controllers/auth/clerkController'
import { isAuth } from '../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async server => {
  server.post('/auth/clerk/update', {
    schema: {
      tags: ['Auth'],
      description: 'Receive user update from Clerk',
      hide: true,
    },

    handler: (request, reply) => receiveUserUpdate(server, request, reply),
  })
  server.get('/auth/discord/callback', {
    schema: {
      tags: ['Auth'],
      description: 'Discord OAuth callback',
      hide: true,
      querystring: Type.Object({
        code: Type.String(),
        state: Type.String(),
      }),
    },
    handler: (request, reply) => discordOAuth(server, request, reply),
  })
  server.get('/auth/discord/disconnect', {
    schema: {
      tags: ['Auth'],
      description: 'Disconnect Discord',
      hide: true,
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => disconnectDiscord(request, reply),
  })
  server.post('/auth/daily-login', {
    schema: {
      tags: ['Auth'],
      description: 'Set daily login bonus',
      hide: true,
      response: {
        200: Type.Object({
          claimed: Type.Number(),
          lastDailyLogin: Type.Optional(Type.String()),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => claimDailyLoginBonus(server, request, reply),
  })
}

export default authRoutes
