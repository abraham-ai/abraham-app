import { getTaskCost } from '../../controllers/taskController'
import {
  cancelTask,
  createTask,
  getTask,
  listTasks,
  subscribeTaskUpdates,
} from '../../controllers/v2/taskControllerV2'
import { isAuth } from '../../middleware/authMiddleware'
import { argsType, taskV2Type } from '../../types/routeTypes'
import { paginatedResponse, paginationProperties } from '../index'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const taskRoutesV2: FastifyPluginAsync = async server => {
  server.post('/v2/tasks/cost', {
    schema: {
      tags: ['Tasks'],
      description: 'Get task cost',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        tool: Type.String(),
        args: Type.Optional(argsType),
      },
      response: {
        200: Type.Object({
          cost: Type.Number(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getTaskCost(server, request, reply),
  })

  server.post('/v2/tasks/create', {
    schema: {
      tags: ['Tasks'],
      description: 'Create a task',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        tool: Type.String(),
        args: Type.Optional(argsType),
        makePublic: Type.Optional(Type.Boolean()),
      },
      response: {
        200: Type.Object({
          task: Type.Optional(Type.Any()),
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
    handler: (request, reply) => createTask(server, request, reply),
  })

  server.get('/v2/tasks', {
    schema: {
      tags: ['Tasks'],
      description: 'List tasks',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          status: Type.Optional(Type.Any()), //{ type: ['string', 'array'] },
          taskId: Type.Optional(Type.Any()), //{ type: ['string', 'array'] },
          type: Type.Optional(Type.String()),
          output_type: Type.Optional(Type.String()),
          cost: Type.Optional(Type.Number()),
          tool: Type.Optional(Type.Any()),
          minDate: Type.Optional(Type.Boolean()),
          ...paginationProperties(),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(taskV2Type),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => listTasks(server, request, reply),
  })

  server.get('/v2/tasks/:taskId', {
    schema: {
      tags: ['Tasks'],
      description: 'Get a task',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        taskId: Type.String(),
      },
      response: {
        200: Type.Object({
          task: taskV2Type,
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getTask(server, request, reply),
  })

  server.get('/v2/tasks/events', {
    schema: {
      tags: ['Tasks'],
      description: 'Get task events',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        taskId: Type.Optional(Type.String()),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => subscribeTaskUpdates(server, request, reply),
  })

  server.post('/v2/tasks/cancel', {
    schema: {
      tags: ['Tasks'],
      description: 'Cancel a task in progress',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        taskId: Type.String(),
      },
      response: {
        200: Type.Object({
          taskStatus: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => cancelTask(server, request, reply),
  })
}

export default taskRoutesV2
