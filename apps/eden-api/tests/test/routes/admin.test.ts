import { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import fs from 'fs'
import { ObjectId } from 'mongodb'
import path from 'path'
import { expect, test } from 'vitest'

import { Transaction } from '../../../src/models/Transaction'
import { prepareAdminHeaders, prepareUserHeaders } from '../../util'

const addMannaRequest = async (
  server: FastifyInstance,
  userId: string,
  amount: number,
  customHeaders?: Record<string, string>,
) => {
  const headers = customHeaders || prepareAdminHeaders()
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

test('Admin can modify Manna', async context => {
  const { server } = context
  const response = await addMannaRequest(server, 'user', 100)
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('userId')
  expect(response.json()).toHaveProperty('manna')
  expect(response.json()).toHaveProperty('transactionId')
  expect(response.json().manna).toBe(1100)

  // Get the transaction from the database
  const transactionId = new ObjectId(response.json().transactionId)
  const transaction = await Transaction.findById(transactionId)
  expect(transaction).not.toBe(null)
})

test('Non-admin cannot modify Manna', async context => {
  const { server } = context
  const response = await addMannaRequest(
    server,
    'user',
    100,
    prepareUserHeaders(),
  )
  expect(response.statusCode).toBe(401)
})

test('Admin can create a Manna voucher', async context => {
  const { server } = context
  const response = await server.inject({
    method: 'POST',
    url: '/admin/manna/vouchers/create',
    payload: {
      amount: 100,
    },
    headers: prepareAdminHeaders(),
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('code')
})

test('Non-admin cannot create a Manna voucher', async context => {
  const { server } = context
  const response = await server.inject({
    method: 'POST',
    url: '/admin/manna/vouchers/create',
    payload: {
      amount: 100,
    },
    headers: prepareUserHeaders(),
  })
  expect(response.statusCode).toBe(401)
})

test('Admin can use admin media upload', async context => {
  const { server } = context
  const form = new FormData()
  const filePath = path.join(__dirname, '../..', 'assets', 'logo.png')
  form.append('media', fs.createReadStream(filePath))

  const response = await server.inject({
    method: 'POST',
    url: '/admin/media/upload',
    headers: {
      ...prepareAdminHeaders(),
      ...form.getHeaders(),
    },
    payload: form,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('url')
})

test('Non-admin cannot use admin media upload', async context => {
  const { server } = context
  const response = await server.inject({
    method: 'POST',
    url: '/admin/media/upload',
    payload: {
      media: 'test',
    },
    headers: prepareUserHeaders(),
  })
  expect(response.statusCode).toBe(401)
})
