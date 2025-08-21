import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { expect, test } from 'vitest'

import { Transaction } from '../../../src/models/Transaction'
import { prepareAdminHeaders, prepareUserHeaders } from '../../util'

const getMannaBalanceRequest = async (server: FastifyInstance) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/manna/balance',
    headers,
  })
  return response
}

const addMannaRequest = async (
  server: FastifyInstance,
  userId: string,
  amount: number,
) => {
  const headers = prepareAdminHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/admin/manna/modify',
    payload: {
      userId,
      amount,
    },
    headers,
  })
  return response
}

const createMannaVoucherRequest = async (
  server: FastifyInstance,
  amount: number,
  allowedUserIds?: string[],
) => {
  const headers = prepareAdminHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/admin/manna/vouchers/create',
    payload: {
      allowedUserIds,
      amount,
    },
    headers,
  })
  return response
}

const redeemMannaVoucherRequest = async (
  server: FastifyInstance,
  code: string,
) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/manna/vouchers/redeem',
    payload: {
      code,
    },
    headers,
  })
  return response
}

test('A user with manna should see their balance', async context => {
  const { server } = context
  await addMannaRequest(server, 'user', 100)
  const response = await getMannaBalanceRequest(server)
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('manna')
  expect(response.json().manna).toBe(1100)
})

test('User can redeem a manna voucher, and it creates a transaction', async context => {
  const { server } = context
  const createVoucherResponse = await createMannaVoucherRequest(server, 100)
  const code = createVoucherResponse.json().code
  const redeemResponse = await redeemMannaVoucherRequest(server, code)
  expect(redeemResponse.statusCode).toBe(200)
  expect(redeemResponse.json()).toHaveProperty('manna')
  expect(redeemResponse.json().manna).toBe(1100)
  expect(redeemResponse.json()).toHaveProperty('transactionId')

  // Get the transaction from the database
  const transactionId = new ObjectId(redeemResponse.json().transactionId)
  const transaction = await Transaction.findById(transactionId)
  expect(transaction).not.toBe(null)
})

test('User can redeem a manna voucher they are allowed for', async context => {
  const { server } = context
  const createVoucherResponse = await createMannaVoucherRequest(server, 100, [
    'user',
  ])
  const code = createVoucherResponse.json().code
  const redeemResponse = await redeemMannaVoucherRequest(server, code)
  expect(redeemResponse.statusCode).toBe(200)
})

test('User cannot redeem a manna voucher twice', async context => {
  const { server } = context
  const createVoucherResponse = await createMannaVoucherRequest(server, 100)
  const code = createVoucherResponse.json().code
  const redeemResponse = await redeemMannaVoucherRequest(server, code)
  expect(redeemResponse.statusCode).toBe(200)
  const redeemResponse2 = await redeemMannaVoucherRequest(server, code)
  expect(redeemResponse2.statusCode).toBe(400)
})

test('User cannot redeem a manna voucher that does not exist', async context => {
  const { server } = context
  const redeemResponse = await redeemMannaVoucherRequest(server, '123')
  expect(redeemResponse.statusCode).toBe(400)
})

test('User cannot redeem a manna voucher they are not allowed to', async context => {
  const { server } = context
  const createVoucherResponse = await createMannaVoucherRequest(server, 100, [
    'user2',
  ])
  const code = createVoucherResponse.json().code
  const redeemResponse = await redeemMannaVoucherRequest(server, code)
  expect(redeemResponse.statusCode).toBe(400)
})
