import { FastifyInstance } from 'fastify'
import { expect, test } from 'vitest'

import {
  prepareBasicUserHeaders,
  prepareBelieverUserHeaders,
  preparePreviewUserHeaders,
  prepareProUserHeaders,
  prepareUserHeaders,
} from '../../util'

const createApiKey = async (
  server: FastifyInstance,
  customHeaders?: Record<string, string>,
) => {
  const headers = customHeaders || prepareProUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/apikeys/create',
    headers,
    payload: {},
  })
  return response
}

const listApiKeys = async (
  server: FastifyInstance,
  customHeaders?: Record<string, string>,
) => {
  const headers = customHeaders || prepareProUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/apikeys',
    headers,
  })
  return response
}

const deleteApiKey = async (
  server: FastifyInstance,
  apiKey: string,
  customHeaders?: Record<string, string>,
) => {
  const headers = customHeaders || prepareProUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/apikeys/delete',
    headers,
    payload: {
      apiKey,
    },
  })
  return response
}

test('Pro+ user can create an API Key', async context => {
  const { server } = context
  const response = await createApiKey(server)
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('apiKey')
  expect(json.apiKey).toHaveProperty('apiKey')
  expect(json.apiKey).toHaveProperty('apiSecret')

  const response2 = await createApiKey(server, prepareBelieverUserHeaders())
  expect(response2.statusCode).toBe(200)
  const json2 = response2.json()
  expect(json2).toHaveProperty('apiKey')
  expect(json2.apiKey).toHaveProperty('apiKey')
  expect(json2.apiKey).toHaveProperty('apiSecret')
})

test('Preview user can create an API Key', async context => {
  const { server } = context
  const response = await createApiKey(server, preparePreviewUserHeaders())
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('apiKey')
  expect(json.apiKey).toHaveProperty('apiKey')
  expect(json.apiKey).toHaveProperty('apiSecret')
})

test('Free user cannot create an API Key', async context => {
  const { server } = context
  const response = await createApiKey(server, prepareUserHeaders())
  expect(response.statusCode).toBe(401)
})

test('Basic user cannot create an API Key', async context => {
  const { server } = context
  const response = await createApiKey(server, prepareBasicUserHeaders())
  expect(response.statusCode).toBe(401)
})

test('User can list their API Keys', async context => {
  const { server } = context
  const response = await listApiKeys(server)
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs).toHaveLength(1)
})

test('User can delete an API Key', async context => {
  const { server } = context
  await createApiKey(server)
  const getResponse = await listApiKeys(server)
  const apiKeys = getResponse.json().docs
  const apiKey = apiKeys[1].apiKey
  const deleteResponse = await deleteApiKey(server, apiKey)
  expect(deleteResponse.statusCode).toBe(200)
  const getResponse2 = await listApiKeys(server)
  const json = getResponse2.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs).toHaveLength(1)
})
