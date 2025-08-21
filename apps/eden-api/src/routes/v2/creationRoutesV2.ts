import { paginatedResponse, paginationProperties } from '..'
import { listCreations } from '../../controllers/creationsController'
import {
  creationBulkUpdate,
  creationUpdate,
  getCreation,
  likeCreation,
  unlikeCreation,
} from '../../controllers/v2/creationControllerV2'
import { isAuth, maybeAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const creationRoutesV2: FastifyPluginAsync = async server => {
  server.get('/v2/creations', {
    schema: {
      tags: ['Creations'],
      description: 'List creations',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: ['string', 'array'] },
          name: { type: 'string' },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    handler: (request, reply) => listCreations(request, reply),
  })

  server.get('/v2/creations/:creationId', {
    schema: {
      tags: ['Creations'],
      description: 'Get a creation',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        creationId: Type.String(),
      },
      response: {
        200: {
          creation: Type.Any(),
        },
        400: {
          // error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        401: {
          // error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        404: {
          // error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        500: {
          // error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCreation(server, request, reply),
  })

  server.patch('/v2/creations/:creationId', {
    schema: {
      tags: ['Creations'],
      description: 'Update a creation',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        creationId: Type.String(),
      },
      body: Type.Object({
        public: Type.Optional(Type.Boolean()),
        deleted: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: {
          creation: Type.Any(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => creationUpdate(server, request, reply),
  })

  server.patch('/v2/creations/bulk', {
    schema: {
      tags: ['Creations'],
      description: 'Bulk update creations',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        creationIds: Type.Array(Type.String()),
        public: Type.Optional(Type.Boolean()),
        deleted: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: {
          results: Type.Array(
            Type.Object({
              creationId: Type.String(),
              status: Type.String(),
              error: Type.Optional(Type.Any()),
              creation: Type.Optional(Type.Any()),
            }),
          ),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => creationBulkUpdate(request, reply),
  })

  server.post('/v2/creations/:creationId/like', {
    schema: {
      tags: ['Creations'],
      description: 'Like a creation',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        creationId: Type.String(),
      },
      response: {
        200: {
          message: Type.String(),
        },
        400: {
          message: Type.String(),
        },
        404: {
          message: Type.String(),
        },
        500: {
          message: Type.String(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => likeCreation(server, request, reply),
  })

  server.delete('/v2/creations/:creationId/like', {
    schema: {
      tags: ['Creations'],
      description: 'Unlike a creation',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        creationId: Type.String(),
      },
      response: {
        200: {
          message: Type.String(),
        },
        400: {
          message: Type.String(),
        },
        404: {
          message: Type.String(),
        },
        500: {
          message: Type.String(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => unlikeCreation(server, request, reply),
  })
}

export default creationRoutesV2
