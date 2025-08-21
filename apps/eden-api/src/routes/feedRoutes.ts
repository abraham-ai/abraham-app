import {
  cursorPaginatedResponse,
  cursorPaginationProperties,
  paginationProperties,
} from '.'
import {
  getCharactersFeed,
  getConceptsFeed,
  getCreationsFeed,
  getCreatorsFeed,
} from '../controllers/feedController'
import { getCreationsFeedCursor } from '../controllers/feedCursorController'
import { maybeAuth } from '../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const feedRoutes: FastifyPluginAsync = async server => {
  server.get('/feed/creations', {
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
          userId: { type: ['string', 'array'] },
          characterId: { type: ['string', 'array'] },
          collectionId: { type: ['string', 'array'] },
          conceptId: { type: ['string', 'array'] },
          creationId: { type: ['string', 'array'] },
          generatorId: { type: ['string', 'array'] },
          name: { type: ['string', 'array'] },
          maxDate: { type: 'string' },
          minDate: { type: 'string' },
          outputType: { type: ['string', 'array'] },
          isPrivate: { type: 'string' },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: Type.Object({
          docs: Type.Array(Type.Any()),
          bookmarks: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
          reactions: Type.Optional(
            Type.Record(
              Type.String(),
              Type.Record(Type.String(), Type.Boolean()),
            ),
          ),
          total: Type.Number(),
          limit: Type.Number(),
          pages: Type.Number(),
          page: Type.Number(),
          pagingCounter: Type.Number(),
          hasPrevPage: Type.Boolean(),
          hasNextPage: Type.Boolean(),
          prevPage: Type.Optional(Type.Number()),
          nextPage: Type.Optional(Type.Number()),
        }),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCreationsFeed(server, request, reply),
  })

  server.get('/feed-cursor/creations', {
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
    handler: (request, reply) => getCreationsFeedCursor(server, request, reply),
  })

  // server.get('/feed-cursor/concepts', {
  //   schema: {
  //     tags: ['Feed'],
  //     description: 'Get concepts feed',
  //     hide: true,
  //     security: [
  //       {
  //         apiKey: [],
  //         // apiSecret: [],
  //       },
  //     ],
  //     querystring: {
  //       type: 'object',
  //       properties: {
  //         ...cursorPaginationProperties(),
  //       },
  //       required: [],
  //     },
  //     response: {
  //       200: Type.Object({
  //         docs: Type.Array(Type.Any()),
  //         bookmarks: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  //         reactions: Type.Optional(
  //           Type.Record(
  //             Type.String(),
  //             Type.Record(Type.String(), Type.Boolean()),
  //           ),
  //         ),
  //         nextCursor: Type.Optional(Type.String()),
  //         nextValue: Type.Optional(Type.Number()),
  //       }),
  //     },
  //   },
  //   preHandler: [(request, reply) => maybeAuth(server, request, reply)],
  //   handler: (request, reply) => getConceptsFeedCursor(server, request, reply),
  // })

  // server.get('/feed-cursor/creators', {
  //   schema: {
  //     tags: ['Feed'],
  //     description: 'Get creators feed',
  //     hide: true,
  //     security: [
  //       {
  //         apiKey: [],
  //         // apiSecret: [],
  //       },
  //     ],
  //     querystring: {
  //       type: 'object',
  //       properties: {
  //         ...cursorPaginationProperties(),
  //       },
  //       required: [],
  //     },
  //     response: {
  //       200: Type.Object({
  //         docs: Type.Array(Type.Any()),
  //         nextCursor: Type.Optional(Type.String()),
  //         nextValue: Type.Optional(Type.Number()),
  //       }),
  //     },
  //   },
  //   preHandler: [(request, reply) => maybeAuth(server, request, reply)],
  //   handler: (request, reply) => getCreatorsFeedCursor(server, request, reply),
  // })

  server.get('/feed/concepts', {
    schema: {
      tags: ['Feed'],
      description: 'Get concepts feed',
      hide: true,
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
          collectionId: { type: ['string', 'array'] },
          name: { type: 'string' },
          maxDate: { type: 'string' },
          minDate: { type: 'string' },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: Type.Object({
          docs: Type.Array(Type.Any()),
          bookmarks: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
          reactions: Type.Optional(
            Type.Record(
              Type.String(),
              Type.Record(Type.String(), Type.Boolean()),
            ),
          ),
          total: Type.Number(),
          limit: Type.Number(),
          pages: Type.Number(),
          page: Type.Number(),
          pagingCounter: Type.Number(),
          hasPrevPage: Type.Boolean(),
          hasNextPage: Type.Boolean(),
          prevPage: Type.Optional(Type.Number()),
          nextPage: Type.Optional(Type.Number()),
        }),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getConceptsFeed(request, reply),
  })

  server.get('/feed/characters', {
    schema: {
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
        200: Type.Object({
          docs: Type.Array(Type.Any()),
          bookmarks: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
          reactions: Type.Optional(
            Type.Record(
              Type.String(),
              Type.Record(Type.String(), Type.Boolean()),
            ),
          ),
          total: Type.Number(),
          limit: Type.Number(),
          pages: Type.Number(),
          page: Type.Number(),
          pagingCounter: Type.Number(),
          hasPrevPage: Type.Boolean(),
          hasNextPage: Type.Boolean(),
          prevPage: Type.Optional(Type.Number()),
          nextPage: Type.Optional(Type.Number()),
        }),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCharactersFeed(request, reply),
  })

  server.get('/feed/creators', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: Type.Object({
          docs: Type.Array(Type.Any()),
          total: Type.Number(),
          limit: Type.Number(),
          pages: Type.Number(),
          page: Type.Number(),
          pagingCounter: Type.Number(),
          hasPrevPage: Type.Boolean(),
          hasNextPage: Type.Boolean(),
          prevPage: Type.Optional(Type.Number()),
          nextPage: Type.Optional(Type.Number()),
        }),
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getCreatorsFeed(request, reply),
  })
}

export default feedRoutes
