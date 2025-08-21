import { ScenarioType, SessionEventType } from '@edenlabs/eden-sdk'
import { FastifyInstance } from 'fastify'
import { expect, test } from 'vitest'

import {
  getDefaultUserId,
  prepareAdminHeaders,
  prepareUserHeaders,
} from '../../util'

const listSessionsRequest = async (server: FastifyInstance) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/sessions',
    headers,
  })
  return response
}

const getSessionRequest = async (
  server: FastifyInstance,
  sessionId: string,
) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: `/sessions/${sessionId}`,
    headers,
  })
  return response
}

const getSessionEventsRequest = async (
  server: FastifyInstance,
  sessionId: string,
) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/events`,
    headers,
  })
  return response
}

const createSessionRequest = async (
  server: FastifyInstance,
  type: ScenarioType,
) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/sessions/create',
    payload: {
      type,
    },
    headers,
  })
  return response
}

const updateSessionRequest = async (
  server: FastifyInstance,
  sessionId: string,
  type: SessionEventType,
  data?: any,
) => {
  const headers = prepareAdminHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/sessions/update',
    payload: {
      sessionId,
      type,
      data,
    },
    headers,
  })
  return response
}

const deleteSessionRequest = async (
  server: FastifyInstance,
  sessionId: string,
) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/sessions/delete',
    payload: {
      sessionId,
    },
    headers,
  })
  return response
}

test('list sessions', async context => {
  const { server } = context
  const response = await listSessionsRequest(server)
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('docs')
})

test('create session', async context => {
  const { server } = context
  const response = await createSessionRequest(server, ScenarioType.CHATROOM)

  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('sessionId')
})

test('get session', async context => {
  const { server } = context
  const createSessionResponse = await createSessionRequest(
    server,
    ScenarioType.CHATROOM,
  )
  const sessionId = createSessionResponse.json().sessionId
  const response = await getSessionRequest(server, sessionId)
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('session')
})

test('delete session', async context => {
  const { server } = context
  const createSessionResponse = await createSessionRequest(
    server,
    ScenarioType.CHATROOM,
  )
  const sessionId = createSessionResponse.json().sessionId
  const response = await deleteSessionRequest(server, sessionId)
  expect(response.statusCode).toBe(200)
})

test('create session event', async context => {
  const { server } = context
  const createSessionResponse = await createSessionRequest(
    server,
    ScenarioType.CHATROOM,
  )
  const sessionId = createSessionResponse.json().sessionId
  const response = await updateSessionRequest(
    server,
    sessionId,
    SessionEventType.USER_ADD,
    {
      user: getDefaultUserId(),
    },
  )
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('eventId')
})

test('get session events', async context => {
  const { server } = context
  const createSessionResponse = await createSessionRequest(
    server,
    ScenarioType.CHATROOM,
  )
  const sessionId = createSessionResponse.json().sessionId
  await updateSessionRequest(server, sessionId, SessionEventType.USER_ADD, {
    user: getDefaultUserId(),
  })
  const response = await getSessionEventsRequest(server, sessionId)
  expect(response.statusCode).toBe(200)
})
