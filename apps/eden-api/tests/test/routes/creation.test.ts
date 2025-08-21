import { expect, test } from 'vitest'

import { Reaction } from '../../../src/models/Reaction'
import { createCreation, prepareUserHeaders } from '../../util'

test('User can list creations', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/creations',
    headers,
  })
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs.length).toBeGreaterThan(0)
})

test('User can get a creation by ID', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const creation = await createCreation()
  const response = await server.inject({
    method: 'GET',
    url: `/creations/${creation.id}`,
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('creation')
})

test('User can react to a creation', async context => {
  const { server } = context
  const creation = await createCreation()
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creations/reactions/add',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')
  expect(response.json().success).toBe(true)

  const reaction = await Reaction.findOne({
    where: {
      creationId: creation.id,
      userId: headers['x-user-id'],
    },
  })
  expect(reaction).not.toBeNull()
})

test('User cannot send the same reaction twice', async context => {
  const { server } = context
  const creation = await createCreation()
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creations/reactions/add',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')
  expect(response.json().success).toBe(true)
  const response2 = await server.inject({
    method: 'POST',
    url: '/creations/reactions/add',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response2.statusCode).toBe(400)
  expect(response2.json()).toHaveProperty('message')
  expect(response2.json().message).toBe('Reaction already exists')
})

test('User can unreact to a creation', async context => {
  const { server } = context
  const creation = await createCreation()
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creations/reactions/add',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')
  expect(response.json().success).toBe(true)
  const response2 = await server.inject({
    method: 'POST',
    url: '/creations/reactions/remove',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response2.statusCode).toBe(200)
  expect(response2.json()).toHaveProperty('success')
  expect(response2.json().success).toBe(true)
  const reaction = await Reaction.findOne({
    where: {
      creationId: creation.id,
      userId: headers['x-user-id'],
    },
  })
  expect(reaction).toBeNull()
})

test('User cannot unreact to a creation without reacting first', async context => {
  const { server } = context
  const creation = await createCreation()
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creations/reactions/remove',
    payload: {
      creationId: creation.id,
      reaction: 'praise',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
  expect(response.json().message).toBe('Reaction does not exist')
})

test('User cannot send an invalid reaction', async context => {
  const { server } = context
  const creation = await createCreation()
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creations/reactions/add',
    payload: {
      creationId: creation.id,
      reaction: 'invalid',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
})

test('Free user cannot make a creation private', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const creation = await createCreation()
  const response = await server.inject({
    method: 'PATCH',
    url: `/creations/${creation.id}`,
    headers,
    payload: {
      isPrivate: true,
    },
  })
  expect(response.statusCode).toBe(401)
})

// TODO: $text index locally.
// test('User can search creations', async context => {
//   const { server } = context
//   const headers = prepareUserHeaders()
//   const response = await server.inject({
//     method: 'GET',
//     url: '/creations',
//     headers,
//     query: {
//       name: 'test',
//     },
//   })
//   expect(response.statusCode).toBe(200)
//   const json = response.json()
//   expect(json).toHaveProperty('docs')
//   expect(json.docs.length).toBeGreaterThan(0)
//   expect(json.docs[0].name).toBe('test')
// })

// test('User cannot find non-existing creation', async context => {
//   const { server } = context
//   const headers = prepareUserHeaders()
//   const response = await server.inject({
//     method: 'GET',
//     url: '/creations',
//     headers,
//     query: {
//       name: 'Non-existing Creation',
//     },
//   })
//   expect(response.statusCode).toBe(200)
//   const json = response.json()
//   expect(json).toHaveProperty('docs')
//   expect(json.docs.length).toBe(0)
// })
