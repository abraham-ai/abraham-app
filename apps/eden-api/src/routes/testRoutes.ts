// import { InternalMessagesQueues } from '../plugins/internalMessagesPlugin'
import { Type } from '@sinclair/typebox'
import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify'

const triggerEventEmitter = (
  server: FastifyInstance,
  _request: FastifyRequest,
  reply: FastifyReply,
) => {
  const update = {
    _id: '6686c950dbb95f860bf4118e',
    user: '652bfd262ea937e07378268c',
    tool: 'txt2img',
    args: {
      prompt: 'TEST UPDATE',
    },
  }
  // server.eventEmitter.emit('task-update', update)
  // server.internalMessages.publish(InternalMessagesQueues.TaskUpdatesV2, update)
  server.internalMessages.publish('task-updates-v2', update)

  return reply.status(200).send({
    sentUpdate: update,
  })
}

const testRoutes: FastifyPluginAsync = async server => {
  server.get('/test/task-update', {
    schema: {
      tags: ['Tasks'],
      description: 'Trigger task update websocket event',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Object({
          sentUpdate: Type.Optional(Type.Any()),
        }),
      },
    },
    handler: (request, reply) => triggerEventEmitter(server, request, reply),
  })
}

export default testRoutes
