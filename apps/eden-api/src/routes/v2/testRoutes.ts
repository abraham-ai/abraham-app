import { testDiscordNotification } from '../../controllers/v2/testController'
import { isAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const testRoutes: FastifyPluginAsync = async server => {
  server.get('/v2/test/discord', {
    schema: {
      tags: ['test'],
      description: 'Test discord notification',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Any(),
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) =>
      testDiscordNotification(server, request, reply),
  })
}

export default testRoutes
