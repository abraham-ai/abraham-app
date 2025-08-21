import {
  disconnectTikTok,
  disconnectTwitter,
  discordOAuth,
  tiktokOAuth,
  twitterOAuth,
} from '../../controllers/auth/v2/authControllerV2'
import { isAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async server => {
  server.get('/v2/auth/discord/callback', {
    schema: {
      tags: ['Auth'],
      description: 'Discord OAuth callback for v2',
      hide: true,
      querystring: Type.Object({
        code: Type.String(),
        state: Type.String(),
      }),
    },
    handler: (request, reply) => discordOAuth(server, request, reply),
  })

  server.get('/v2/auth/twitter/callback', {
    schema: {
      tags: ['Auth'],
      description: 'Twitter OAuth callback for v2',
      hide: true,
      querystring: Type.Object({
        code: Type.String(),
        state: Type.String(),
      }),
    },
    handler: (request, reply) => twitterOAuth(server, request, reply),
  })

  server.delete('/v2/auth/twitter/disconnect', {
    schema: {
      tags: ['Auth'],
      description: 'Disconnect Twitter',
    },
    handler: (request, reply) => disconnectTwitter(request, reply),
    preHandler: [(request, reply) => isAuth(server, request, reply)],
  })

  server.get('/v2/auth/tiktok/callback', {
    schema: {
      tags: ['Auth'],
      description: 'TikTok OAuth callback for v2',
      hide: true,
      querystring: Type.Object({
        code: Type.String(),
        state: Type.String(),
      }),
    },
    handler: (request, reply) => tiktokOAuth(server, request, reply),
  })

  server.delete('/v2/auth/tiktok/disconnect', {
    schema: {
      tags: ['Auth'],
      description: 'Disconnect TikTok',
      querystring: Type.Object({
        agentId: Type.String(),
      }),
    },
    handler: (request, reply) => disconnectTikTok(request, reply),
    preHandler: [(request, reply) => isAuth(server, request, reply)],
  })
}

export default authRoutes
