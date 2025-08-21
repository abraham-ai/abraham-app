import { paginatedResponse, paginationProperties } from '.'
import {
  conceptDelete,
  conceptReact,
  conceptUnreact,
  conceptUpdate,
  getConcept,
  listConcepts,
} from '../controllers/conceptsController'
import { isAuth, maybeAuth } from '../middleware/authMiddleware'
import { ReactionType } from '@edenlabs/eden-sdk'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const conceptRoutes: FastifyPluginAsync = async server => {
  server.get('/concepts', {
    schema: {
      tags: ['Concepts'],
      description: 'List concepts',
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
          name: { type: 'string' },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    handler: (request, reply) => listConcepts(request, reply),
  })

  server.get('/concepts/:conceptId', {
    schema: {
      tags: ['Concepts'],
      description: 'Get a concept',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: {
        conceptId: Type.String(),
      },
      response: {
        200: {
          concept: Type.Any(),
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
    handler: (request, reply) => getConcept(request, reply),
  })

  server.patch('/concepts/:conceptId', {
    schema: {
      tags: ['Concepts'],
      description: 'Update a concept',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: {
        conceptId: Type.String(),
      },
      body: Type.Object({
        isPrivate: Type.Optional(Type.Boolean()),
        description: Type.Optional(Type.String()),
      }),
      response: {
        200: {
          concept: Type.Any(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => conceptUpdate(request, reply),
  })

  server.delete('/concepts/:conceptId', {
    schema: {
      tags: ['Concepts'],
      description: 'Delete a concept',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: {
        conceptId: Type.String(),
      },
      response: {
        200: {
          success: Type.Boolean(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => conceptDelete(request, reply),
  })

  server.post('/concepts/reactions/add', {
    schema: {
      tags: ['Concepts'],
      description: 'React to a concept',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: Type.Object({
        conceptId: Type.String(),
        reaction: Type.Enum(ReactionType),
      }),
      response: {
        200: {
          success: Type.Boolean(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => conceptReact(request, reply),
  })

  server.post('/concepts/reactions/remove', {
    schema: {
      tags: ['Concepts'],
      description: 'Unreact to a concept',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: Type.Object({
        conceptId: Type.String(),
        reaction: Type.Enum(ReactionType),
      }),
      response: {
        200: {
          success: Type.Boolean(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => conceptUnreact(request, reply),
  })
}

export default conceptRoutes
