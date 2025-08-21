import { paginatedResponse, paginationProperties } from '.'
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  interactCharacter,
  listCharacters,
  testCharacter,
  updateCharacter,
} from '../controllers/characterController'
import { createTask } from '../controllers/taskController'
import { isAuth, isCharacter, maybeAuth } from '../middleware/authMiddleware'
import { configType } from '../types/routeTypes'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const logosType = Type.Optional(
  Type.Object({
    abilities: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
    capabilities: Type.Optional(Type.Array(Type.String())),
    identity: Type.Optional(Type.String()),
    knowledge: Type.Optional(Type.String()),
    knowledgeSummary: Type.Optional(Type.String()),
    concept: Type.Optional(Type.String()),
    chatModel: Type.Optional(Type.String()),
  }),
)

const characterRoutes: FastifyPluginAsync = async server => {
  server.post('/characters', {
    schema: {
      tags: ['Characters'],
      description: 'Create a character',
      body: Type.Object({
        name: Type.String(),
        image: Type.Optional(Type.String()),
        voice: Type.Optional(Type.String()),
        greeting: Type.Optional(Type.String()),
        dialogue: Type.Optional(
          Type.Array(
            Type.Object({
              sender: Type.String(),
              message: Type.String(),
            }),
          ),
        ),
        logosData: Type.Optional(logosType),
        isPrivate: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          characterId: Type.String(),
          slug: Type.String(),
        }),
      },
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createCharacter(request, reply),
  })

  server.patch('/characters/:characterId', {
    schema: {
      tags: ['Characters'],
      description: 'Update a character',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: {
        characterId: Type.String(),
      },
      body: Type.Object({
        name: Type.Optional(Type.String()),
        image: Type.Optional(Type.String()),
        voice: Type.Optional(Type.String()),
        greeting: Type.Optional(Type.String()),
        dialogue: Type.Optional(
          Type.Array(
            Type.Object({
              sender: Type.String(),
              message: Type.String(),
            }),
          ),
        ),
        logosData: Type.Optional(logosType),
        isPrivate: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateCharacter(request, reply),
  })

  server.post('/characters/delete', {
    schema: {
      tags: ['Characters'],
      description: 'Delete a character',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      body: {
        characterId: Type.String(),
      },
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteCharacter(request, reply),
  })

  server.get('/characters/:characterId', {
    schema: {
      tags: ['Characters'],
      description: 'Get a character',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      params: Type.Object({
        characterId: Type.String(),
      }),
      response: {
        200: Type.Object({
          character: Type.Object({
            _id: Type.String(),
            user: Type.Object({
              userId: Type.String(),
              username: Type.String(),
              userImage: Type.String(),
            }),
            name: Type.String(),
            slug: Type.String(),
            image: Type.Optional(Type.String()),
            voice: Type.Optional(Type.String()),
            creationCount: Type.Optional(Type.Number()),
            greeting: Type.Optional(Type.String()),
            dialogue: Type.Optional(
              Type.Array(
                Type.Object({
                  sender: Type.String(),
                  message: Type.String(),
                }),
              ),
            ),
            logosData: Type.Optional(logosType),
            isPrivate: Type.Optional(Type.Boolean()),
          }),
        }),
      },
    },
    preHandler: [async request => maybeAuth(server, request)],
    handler: (request, reply) => getCharacter(request, reply),
  })

  server.get('/characters', {
    schema: {
      tags: ['Characters'],
      description: 'List characters',
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
        200: paginatedResponse(
          Type.Object({
            _id: Type.String(),
            user: Type.Object({
              userId: Type.String(),
              username: Type.String(),
              userImage: Type.String(),
            }),
            name: Type.String(),
            slug: Type.String(),
            image: Type.Optional(Type.String()),
            voice: Type.Optional(Type.String()),
            creationCount: Type.Optional(Type.Number()),
            greeting: Type.Optional(Type.String()),
            dialogue: Type.Optional(
              Type.Array(
                Type.Object({
                  sender: Type.String(),
                  message: Type.String(),
                }),
              ),
            ),
            logosData: Type.Optional(logosType),
            isPrivate: Type.Optional(Type.Boolean()),
          }),
        ),
      },
    },
    preHandler: [async request => maybeAuth(server, request)],
    handler: (request, reply) => listCharacters(request, reply),
  })

  server.post('/characters/test', {
    schema: {
      tags: ['Characters'],
      description: 'Test a character',
      hide: true,
      body: Type.Object({
        name: Type.String(),
        identity: Type.String(),
        message: Type.String(),
        knowledge: Type.Optional(Type.String()),
        knowledge_summary: Type.Optional(Type.String()),
        attachments: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
          config: Type.Optional(Type.Any()),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => testCharacter(server, request, reply),
  })

  server.post('/characters/interact', {
    schema: {
      tags: ['Characters'],
      description: 'Interact with a character',
      hide: true,
      body: {
        character_id: Type.String(),
        session_id: Type.String(),
        message: Type.String(),
        attachments: Type.Optional(Type.Array(Type.String())),
      },
      response: {
        200: Type.Object({
          message: Type.String(),
          config: Type.Optional(Type.Any()),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => interactCharacter(server, request, reply),
  })

  server.post('/characters/tasks/create', {
    schema: {
      tags: ['Characters'],
      description: 'Create a task as character',
      hide: true,
      body: {
        generatorName: Type.String(),
        versionId: Type.Optional(Type.String()),
        config: Type.Optional(configType),
        webhooks: Type.Optional(Type.Array(Type.String())),
        attributes: Type.Optional(
          Type.Object({
            discordId: Type.Optional(Type.String()),
            delegateUserId: Type.Optional(Type.String()),
          }),
        ),
      },
      response: {
        200: Type.Object({
          taskId: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isCharacter(server, request, reply)],
    handler: (request, reply) => createTask(server, request, reply),
  })
}

export default characterRoutes
