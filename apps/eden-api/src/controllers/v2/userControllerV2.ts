import { Manna } from '../../models/Manna'
import { Transaction } from '../../models/Transaction'
import TransactionRepository from '../../repositories/TransactionRepository'
import { FastifyReply, FastifyRequest } from 'fastify'

export const getUserIdByClerkUserId = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  return reply.status(200).send({ id: userId.toString() })
}

export const listTransactions = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const manna = await Manna.findOne({ user: userId })
  if (!manna) {
    return reply.status(400).send({
      message: 'Manna doc not found',
    })
  }

  const { page, limit } = request.query as {
    page: number
    limit: number
  }

  const transactionRepository = new TransactionRepository(Transaction)
  const paginatedResponse = await transactionRepository.query(
    { manna: manna._id },
    { page, limit, sort: { createdAt: -1 } },
  )

  await transactionRepository.model.populate(paginatedResponse.docs, {
    path: 'task',
    model: 'tasks3',
    select: '_id tool user agent',
  })

  await transactionRepository.model.populate(paginatedResponse.docs, {
    path: 'task.agent',
    model: 'agent',
    select: '_id username',
  })

  return reply.status(200).send(paginatedResponse)
}
