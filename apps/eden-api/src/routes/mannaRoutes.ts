import { getBalance, redeemMannaVoucher } from '../controllers/mannaController'
import { isAuth } from '../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const mannaRoutes: FastifyPluginAsync = async server => {
  server.get('/manna/balance', {
    schema: {
      tags: ['Manna'],
      description: 'Get manna balance',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Object({
          balance: Type.Number(),
          subscriptionBalance: Type.Number(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getBalance(request, reply),
  })

  server.post('/manna/vouchers/redeem', {
    schema: {
      tags: ['Manna'],
      description: 'Redeem a manna voucher',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        code: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Optional(Type.Boolean()),
          action: Type.Optional(Type.String()),
          manna: Type.Optional(Type.Number()),
          transactionId: Type.Optional(Type.String()),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => redeemMannaVoucher(request, reply),
  })
}

export default mannaRoutes
