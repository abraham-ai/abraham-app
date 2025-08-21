import { FastifyInstance } from 'fastify'
import { expect, test } from 'vitest'

import {
  prepareBasicUserHeaders,
  preparePreviewUserHeaders,
  prepareUserHeaders,
} from '../../util'

const createTask = async (server: FastifyInstance) => {
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/tasks/create',
    headers,
    payload: {
      generatorName: 'test',
    },
  })
  return response
}

test('User can create a task', async context => {
  const { server } = context
  const response = await createTask(server)
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('taskId')
})

test('User can list their tasks', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  await createTask(server)
  const response = await server.inject({
    method: 'GET',
    url: '/tasks',
    headers,
  })
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs.length).toBeGreaterThan(0)
})

test('User can get a task by ID', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const task = await createTask(server)
  const taskId = task.json().taskId
  const response = await server.inject({
    method: 'GET',
    url: `/tasks/${taskId}`,
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('task')
})

test('Basic user cannot create a private task', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/tasks/create',
    headers,
    payload: {
      generatorName: 'test',
      config: {
        isPrivate: true,
      },
    },
  })
  expect(response.statusCode).toBe(401)
})

test('Subscription user can create a private task', async context => {
  const { server } = context
  const headers = prepareBasicUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/tasks/create',
    headers,
    payload: {
      generatorName: 'test',
      config: {
        isPrivate: true,
      },
    },
  })
  expect(response.statusCode).toBe(200)
})

test('User cannot add attributes to a task', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/tasks/create',
    headers,
    payload: {
      generatorName: 'test',
      attributes: {
        test: 'test',
      },
    },
  })
  expect(response.statusCode).toBe(200)
  const json = response.json()
  const taskId = json.taskId
  expect(taskId).toBeDefined()

  const response2 = await server.inject({
    method: 'GET',
    url: `/tasks/${taskId}`,
    headers,
  })

  expect(response2.statusCode).toBe(200)
  const json2 = response2.json()
  expect(json2).toHaveProperty('task')
  expect(json2.task).not.toHaveProperty('attributes')
})

test('Preview user can create a private task', async context => {
  const { server } = context
  const headers = preparePreviewUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/tasks/create',
    headers,
    payload: {
      generatorName: 'test',
      config: {
        isPrivate: true,
      },
    },
  })
  expect(response.statusCode).toBe(200)
})
