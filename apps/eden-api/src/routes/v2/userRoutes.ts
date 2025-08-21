import { listTransactions } from '../../controllers/v2/userControllerV2'
import { isAuth } from '../../middleware/authMiddleware'
import { paginatedResponse, paginationProperties } from '../index'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const userRoutes: FastifyPluginAsync = async server => {
  server.get('/v2/user/transactions', {
    schema: {
      tags: ['User'],
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
    handler: (request, reply) => listTransactions(request, reply),
  })
}

export default userRoutes
