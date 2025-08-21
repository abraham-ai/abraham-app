import { paginatedResponse, paginationProperties } from '..'
import {
  getCreator,
  getCreatorMe,
  listCreators,
  updateCreator,
} from '../../controllers/creatorsController'
import { isAuth, maybeAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const creatorRoutes: FastifyPluginAsync = async server => {
  server.get('/v2/creators', {
    schema: {
      tags: ['Creators'],
      description: 'List creators',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: ['string', 'array'] },
          discordId: { type: ['string', 'array'] },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    handler: (request, reply) => listCreators(request, reply),
  })

  server.get('/v2/creators/me', {
    schema: {
      tags: ['Creators'],
      description: 'Get your own info',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Object({
          creator: Type.Optional(Type.Any()),
          balance: Type.Number(),
          subscriptionBalance: Type.Number(),
          foreverBalance: Type.Number(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getCreatorMe(request, reply),
  })

  server.get('/v2/creators/:userId', {
    schema: {
      tags: ['Creators'],
      description: 'Get a creator',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: {
          creator: Type.Any(),
        },
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCreator(request, reply),
  })

  server.post('/v2/creators/update', {
    schema: {
      tags: ['Creators'],
      description: 'Update a creator',
      security: [
        {
          apiKey: [],
        },
      ],
      request: {
        body: Type.Object({
          username: Type.Optional(Type.String()),
          userImage: Type.Optional(Type.String()),
          preferences: Type.Optional(
            Type.Object({
              agent_spend_threshold: Type.Optional(Type.Number()),
            }),
          ),
        }),
      },
      response: {
        200: {
          creator: Type.Any(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateCreator(request, reply),
  })
}

export default creatorRoutes
