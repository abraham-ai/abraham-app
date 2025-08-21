import { FastifyInstance } from 'fastify'
import { expect, test } from 'vitest'

import {
  prepareBelieverUserHeaders,
  prepareCharacterHeaders,
} from '../../util'

const createCharacter = async (server: FastifyInstance) => {
  const headers = prepareBelieverUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/characters',
    headers,
    payload: {
      name: 'Test Character',
      description: 'Test Description',
      greeting: 'Test Greeting',
    },
  })
  return response
}

const listCharacters = async (server: FastifyInstance) => {
  const headers = prepareBelieverUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/characters',
    headers,
  })
  return response
}

const getCharacter = async (server: FastifyInstance, characterId: string) => {
  const headers = prepareBelieverUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: `/characters/${characterId}`,
    headers,
  })
  return response
}

// const deleteCharacter = async (
//   server: FastifyInstance,
//   characterId: string,
// ) => {
//   const headers = prepareBelieverUserHeaders()
//   const response = await server.inject({
//     method: 'POST',
//     url: '/characters/delete',
//     headers,
//     payload: {
//       characterId,
//     },
//   })
//   return response
// }

test('User can create an Character', async context => {
  const { server } = context
  const response = await createCharacter(server)
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('characterId')
})

test('User can list their Characters', async context => {
  const { server } = context
  await createCharacter(server)
  const response = await listCharacters(server)
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs).toHaveLength(2)
})

// test('User can delete an Character', async context => {
//   const { server } = context
//   await createCharacter(server)
//   const getResponse = await listCharacters(server)
//   const characters = getResponse.json().docs
//   const character = characters[0].id
//   const deleteResponse = await deleteCharacter(server, character)
//   expect(deleteResponse.statusCode).toBe(200)
//   const getResponse2 = await listCharacters(server)
//   const json = getResponse2.json()
//   expect(json).toHaveProperty('docs')
//   expect(json.docs).toHaveLength(1)
// })

test('Can get a character by ID', async context => {
  const { server } = context
  const createResponse = await createCharacter(server)
  const characterId = createResponse.json().characterId
  const getResponse = await getCharacter(server, characterId)
  expect(getResponse.statusCode).toBe(200)
  const json = getResponse.json()
  expect(json).toHaveProperty('character')
  expect(json.character).toHaveProperty('name')
})

test('Character can add attributes to a task', async context => {
  const { server } = context
  const response = await server.inject({
    method: 'POST',
    url: `/characters/tasks/create`,
    headers: prepareCharacterHeaders(),
    payload: {
      generatorName: 'test',
      attributes: {
        test: 'test',
      },
    },
  })
  expect(response.statusCode).toBe(200)
  const { taskId } = response.json()
  expect(taskId).toBeDefined()

  const taskGetResponse = await server.inject({
    method: 'GET',
    url: `/tasks/${taskId}`,
    headers: prepareCharacterHeaders(),
  })

  expect(taskGetResponse.statusCode).toBe(200)
  const { task } = taskGetResponse.json()
  expect(task).toBeDefined()
  expect(task).toHaveProperty('character')
})

// TODO: Bring back in when out of preview
// test('Free user cannot create a private character', async context => {
//   const { server } = context
//   const headers = prepareBelieverUserHeaders()
//   const response = await server.inject({
//     method: 'POST',
//     url: '/characters',
//     headers,
//     payload: {
//       name: 'Test Character',
//       description: 'Test Description',
//       greeting: 'Test Greeting',
//       isPrivate: true,
//     },
//   })
//   expect(response.statusCode).toBe(401)
// })

// test('Subscription user can create a private character', async context => {
//   const { server } = context
//   const headers = prepareBasicUserHeaders()
//   const response = await server.inject({
//     method: 'POST',
//     url: '/characters',
//     headers,
//     payload: {
//       name: 'Test Character',
//       description: 'Test Description',
//       greeting: 'Test Greeting',
//       isPrivate: true,
//     },
//   })
//   expect(response.statusCode).toBe(200)
// })

// test('Free user cannot update a character to be private', async context => {
//   const { server } = context
//   const headers = prepareBelieverUserHeaders()
//   const createResponse = await createCharacter(server)
//   const characterId = createResponse.json().characterId
//   const response = await server.inject({
//     method: 'PATCH',
//     url: `/characters/${characterId}`,
//     headers,
//     payload: {
//       characterId,
//       isPrivate: true,
//     },
//   })
//   expect(response.statusCode).toBe(401)
// })
