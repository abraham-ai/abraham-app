import {
  addThreadMessageReaction,
  createThreadMessage,
  deleteThread,
  getThread,
  listThreads,
  pinThreadMessage,
  renameThread,
  unpinThreadMessage,
} from '../../controllers/v2/threadController'
import { isAuth, maybeAuth } from '../../middleware/authMiddleware'
import { paginatedResponse, paginationProperties } from '../index'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const threadRoutes: FastifyPluginAsync = async server => {
  server.post('/v2/threads', {
    schema: {
      tags: ['Threads'],
      description: 'Add a thread message ',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        thread_id: Type.Optional(Type.String()),
        agent_id: Type.String(),
        content: Type.Optional(Type.String()),
        attachments: Type.Optional(Type.Array(Type.String())),
      },
      response: {
        200: Type.Object({
          thread_id: Type.String(),
        }),
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
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createThreadMessage(server, request, reply),
  })

  server.post('/v2/threads/react', {
    schema: {
      tags: ['Threads'],
      description: 'Add a reaction to a thread message ',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        message_id: Type.String(),
        reaction: Type.String(),
      },
      response: {
        200: Type.Any(),
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
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) =>
      addThreadMessageReaction(server, request, reply),
  })

  server.post('/v2/threads/pin', {
    schema: {
      tags: ['Threads'],
      description: 'Pin a thread message ',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        message_id: Type.String(),
      },
      response: {
        200: Type.Any(),
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
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => pinThreadMessage(server, request, reply),
  })

  server.post('/v2/threads/unpin', {
    schema: {
      tags: ['Threads'],
      description: 'Unpin a thread message ',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        message_id: Type.String(),
      },
      response: {
        200: Type.Any(),
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
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => unpinThreadMessage(server, request, reply),
  })

  server.get('/v2/threads', {
    schema: {
      tags: ['Threads'],
      description: 'List threads',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          agent_id: Type.Optional(Type.String()),
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => listThreads(server, request, reply),
  })

  server.get('/v2/threads/:thread_id', {
    schema: {
      tags: ['Threads'],
      description: 'Get a thread',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        thread_id: Type.String(),
      },
      response: {
        200: Type.Object({
          thread: Type.Any(),
        }),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getThread(server, request, reply),
  })

  server.patch('/v2/threads/:thread_id', {
    schema: {
      tags: ['Threads'],
      description: 'Rename a thread',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        thread_id: Type.String(),
      },
      body: {
        title: Type.String(),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
        }),
        400: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        401: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => renameThread(request, reply),
  })

  server.delete('/v2/threads/:thread_id', {
    schema: {
      tags: ['Threads'],
      description: 'Delete a thread',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        thread_id: Type.String(),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
        }),
      },
      400: {
        error: Type.Optional(Type.String()),
        message: Type.Optional(Type.String()),
      },
      401: {
        error: Type.Optional(Type.String()),
        message: Type.Optional(Type.String()),
      },
      404: {
        error: Type.Optional(Type.String()),
        message: Type.Optional(Type.String()),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteThread(request, reply),
  })
}

export default threadRoutes
