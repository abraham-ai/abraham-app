import { ObjectId } from 'mongodb'
import { expect, test } from 'vitest'

import { prepareUserHeaders } from '../../util'

test('User can list collections', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs.length).toBeGreaterThan(0)
  expect(json.docs[0]).toHaveProperty('isDefaultCollection')
  expect(json.docs[0]).toHaveProperty('name')
})

test('User can get a collection by ID', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const listResponse = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  const collectionId = listResponse.json().docs[0]._id
  const response = await server.inject({
    method: 'GET',
    url: `/collections/${collectionId}`,
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('collection')
})

test('User can create a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/collections/create',
    headers,
    payload: {
      name: 'test',
    },
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('collectionId')
})

test('User can update a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const listResponse = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  const collectionId = listResponse.json().docs[0]._id
  const response = await server.inject({
    method: 'PATCH',
    url: `/collections/${collectionId}`,
    headers,
    payload: {
      collectionId,
      name: 'test2',
      description: 'test2',
    },
  })
  expect(response.statusCode).toBe(200)
})

test('User can delete a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const createResponse = await server.inject({
    method: 'POST',
    url: '/collections/create',
    headers,
    payload: {
      name: 'test',
    },
  })
  const collectionId = createResponse.json().collectionId
  const response = await server.inject({
    method: 'DELETE',
    url: `/collections/${collectionId}`,
    headers,
  })
  expect(response.statusCode).toBe(200)
})

test('User can add a creation to a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const creationResponse = await server.inject({
    method: 'GET',
    url: '/creations',
  })
  const creationId = creationResponse.json().docs[0]._id
  const listResponse = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  const collectionId = listResponse.json().docs[0]._id
  const response = await server.inject({
    method: 'POST',
    url: '/collections/creations/add',
    payload: {
      collectionId,
      creationIds: [creationId],
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
})

test('If no collectionId is provided, the creations are added to the default collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const creationResponse = await server.inject({
    method: 'GET',
    url: '/creations',
  })
  const creationId = creationResponse.json().docs[0]._id
  const response = await server.inject({
    method: 'POST',
    url: '/collections/creations/add',
    payload: {
      creationIds: [creationId],
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
})

test('User can remove a creation from a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const creationResponse = await server.inject({
    method: 'GET',
    url: '/creations',
  })
  const creationId = creationResponse.json().docs[0]._id
  const listResponse = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  const collectionId = listResponse.json().docs[0]._id
  await server.inject({
    method: 'POST',
    url: '/collections/creations/add',
    payload: {
      collectionId,
      creationIds: [creationId],
    },
    headers,
  })
  const response = await server.inject({
    method: 'POST',
    url: '/collections/creations/remove',
    payload: {
      collectionId,
      creationIds: [creationId],
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  const getResponse = await server.inject({
    method: 'GET',
    url: `/collections/${collectionId}`,
    headers,
  })
  expect(getResponse.json().collection.creations).not.toContain(creationId)
})

test('User cannot add a non-existent creation to a collection', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const listResponse = await server.inject({
    method: 'GET',
    url: '/collections',
    headers,
  })
  const collectionId = listResponse.json().docs[0]._id
  const response = await server.inject({
    method: 'POST',
    url: '/collections/creations/add',
    payload: {
      collectionId,
      creationIds: [new ObjectId(123)],
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
})
