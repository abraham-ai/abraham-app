import {
  getAgentsFeedCursor,
  getCollectionsFeedCursorV2,
  getCreationsFeedCursorV2,
  getCreatorsFeedCursor,
  getModelsFeedCursorV2,
} from '../../controllers/v2/feedControllerV2'
import { maybeAuth } from '../../middleware/authMiddleware'
import { cursorPaginatedResponse, cursorPaginationProperties } from '../index'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const feedRoutesV2: FastifyPluginAsync = async server => {
  server.get('/v2/feed-cursor/creations', {
    schema: {
      tags: ['Feed'],
      description: 'Get creations feed',
      hide: true,
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...cursorPaginationProperties(),
        },
        required: [],
      },
      response: {
        200: cursorPaginatedResponse(Type.Any()),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) =>
      getCreationsFeedCursorV2(server, request, reply),
  })

  server.get('/v2/feed-cursor/models', {
    schema: {
      tags: ['Feed'],
      description: 'Get models feed',
      hide: true,
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...cursorPaginationProperties(),
        },
        required: [],
      },
      response: {
        200: cursorPaginatedResponse(Type.Any()),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getModelsFeedCursorV2(server, request, reply),
  })

  server.get('/v2/feed-cursor/collections', {
    schema: {
      tags: ['Feed'],
      description: 'Get collections feed',
      hide: true,
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...cursorPaginationProperties(),
        },
        required: [],
      },
      response: {
        200: cursorPaginatedResponse(Type.Any()),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) =>
      getCollectionsFeedCursorV2(server, request, reply),
  })

  server.get('/v2/feed-cursor/agents', {
    schema: {
      tags: ['Feed'],
      description: 'Get agents feed',
      hide: true,
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...cursorPaginationProperties(),
        },
        required: [],
      },
      response: {
        200: cursorPaginatedResponse(Type.Any()),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getAgentsFeedCursor(server, request, reply),
  })

  server.get('/v2/feed-cursor/creators', {
    schema: {
      tags: ['Feed'],
      description: 'Get creators feed',
      hide: true,
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...cursorPaginationProperties(),
        },
        required: [],
      },
      response: {
        200: cursorPaginatedResponse(Type.Any()),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCreatorsFeedCursor(server, request, reply),
  })
}

export default feedRoutesV2
