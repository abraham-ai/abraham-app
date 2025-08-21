import {
  getModel,
  likeModel,
  modelUpdate,
  unlikeModel,
} from '../../controllers/v2/modelControllerV2'
import { isAuth, maybeAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const modelRoutesV2: FastifyPluginAsync = async server => {
  server.get('/v2/models/:modelId', {
    schema: {
      tags: ['Models'],
      description: 'Get a Model',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        modelId: Type.String(),
      },
      response: {
        200: {
          model: Type.Any(),
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
    handler: (request, reply) => getModel(server, request, reply),
  })

  server.patch('/v2/models/:modelId', {
    schema: {
      tags: ['Models'],
      description: 'Update a model',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        modelId: Type.String(),
      },
      body: Type.Object({
        public: Type.Optional(Type.Boolean()),
        deleted: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: {
          model: Type.Any(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => modelUpdate(request, reply),
  })

  server.post('/v2/models/:modelId/like', {
    schema: {
      tags: ['Models'],
      description: 'Like a model',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        modelId: Type.String(),
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
    handler: (request, reply) => likeModel(server, request, reply),
  })

  server.delete('/v2/models/:modelId/like', {
    schema: {
      tags: ['Models'],
      description: 'Unlike a model',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        modelId: Type.String(),
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
    handler: (request, reply) => unlikeModel(server, request, reply),
  })
}

export default modelRoutesV2
