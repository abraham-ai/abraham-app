import { paginatedResponse, paginationProperties } from '.'
import {
  addCharactersToSession,
  addUsersToSession,
  createSession,
  deleteSession,
  getSession,
  getSessionEvents,
  interactSession,
  listSessions,
} from '../controllers/sessionController'
import { isAdmin, isAuth } from '../middleware/authMiddleware'
import { sessionType } from '../types/routeTypes'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const sessionRoutes: FastifyPluginAsync = async server => {
  server.post('/sessions/create', {
    schema: {
      tags: ['Sessions'],
      description: 'Create a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      response: {
        200: Type.Object({
          sessionId: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createSession(request, reply),
  })

  server.post('/sessions/delete', {
    schema: {
      tags: ['Sessions'],
      description: 'Delete a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: Type.Object({
        sessionId: Type.String(),
      }),
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteSession(request, reply),
  })

  server.post('/sessions/users/add', {
    schema: {
      tags: ['Sessions'],
      description: 'Add users to a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      hide: true,
      body: Type.Object({
        sessionId: Type.String(),
        userIds: Type.Array(Type.String()),
      }),
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAdmin(server, request, reply)],
    handler: (request, reply) => addUsersToSession(request, reply),
  })

  server.post('/sessions/characters/add', {
    schema: {
      tags: ['Sessions'],
      description: 'Add characters to a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      hide: true,
      body: Type.Object({
        sessionId: Type.String(),
        characterIds: Type.Array(Type.String()),
      }),
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAdmin(server, request, reply)],
    handler: (request, reply) => addCharactersToSession(request, reply),
  })

  server.post('/sessions/interact', {
    schema: {
      tags: ['Sessions'],
      description: 'Interact with a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      hide: true,
      body: Type.Object({
        character_id: Type.String(),
        session_id: Type.String(),
        message: Type.String(),
        attachments: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
          config: Type.Optional(Type.Any()),
        }),
      },
    },
    preHandler: [(request, reply) => isAdmin(server, request, reply)],
    handler: (request, reply) => interactSession(server, request, reply),
  })

  server.get('/sessions', {
    schema: {
      tags: ['Sessions'],
      description: 'List sessions',
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
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(sessionType),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => listSessions(request, reply),
  })

  server.get('/sessions/:sessionId', {
    schema: {
      tags: ['Sessions'],
      description: 'Get a session',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: Type.Object({
        sessionId: Type.String(),
      }),
      response: {
        200: Type.Object({
          session: sessionType,
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getSession(request, reply),
  })

  server.get('/sessions/:sessionId/events', {
    schema: {
      tags: ['Sessions'],
      description: 'Get session events',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: Type.Object({
        sessionId: Type.String(),
      }),
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
    handler: (request, reply) => getSessionEvents(request, reply),
  })
}

export default sessionRoutes
