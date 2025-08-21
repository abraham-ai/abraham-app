import { paginatedResponse, paginationProperties } from '.'
import {
  followCreator,
  getCreator,
  getCreatorMe,
  listCreatorFollowers,
  listCreatorFollowing,
  listCreators,
  unfollowCreator,
  updateCreator,
} from '../controllers/creatorsController'
import { isAuth, maybeAuth } from '../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const creatorRoutes: FastifyPluginAsync = async server => {
  server.get('/creators', {
    schema: {
      tags: ['Creators'],
      description: 'List creators',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
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

  server.get('/creators/:userId/followers', {
    schema: {
      tags: ['Creators'],
      description: 'List creator followers',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => listCreatorFollowers(request, reply),
  })

  server.get('/creators/:userId/following', {
    schema: {
      tags: ['Creators'],
      description: 'List creator following',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => listCreatorFollowing(request, reply),
  })

  server.get('/creators/:userId', {
    schema: {
      tags: ['Creators'],
      description: 'Get a creator',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
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

  server.post('/creators/update', {
    schema: {
      tags: ['Creators'],
      description: 'Update a creator',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      request: {
        body: Type.Object({
          username: Type.Optional(Type.String()),
          userImage: Type.Optional(Type.String()),
          instagramHandle: Type.Optional(Type.String()),
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

  server.post('/creators/follow', {
    schema: {
      tags: ['Creators'],
      description: 'Follow a creator',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: Type.Object({
        userId: Type.String(),
      }),
      response: {
        200: {
          success: Type.Boolean(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => followCreator(request, reply),
  })

  server.post('/creators/unfollow', {
    schema: {
      tags: ['Creators'],
      description: 'Unfollow a creator',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: Type.Object({
        userId: Type.String(),
      }),
      response: {
        200: {
          success: Type.Boolean(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => unfollowCreator(request, reply),
  })

  server.get('/creators/me', {
    schema: {
      tags: ['Creators'],
      description: 'Get your own info',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
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
}

export default creatorRoutes
