import { expect, test } from 'vitest'

import { prepareUserHeaders } from '../../util'

test('User can list creators', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: '/creators',
    headers,
  })
  expect(response.statusCode).toBe(200)
  const json = response.json()
  expect(json).toHaveProperty('docs')
  expect(json.docs.length).toBeGreaterThan(0)
})

test('User can get a creator by ID', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'GET',
    url: `/creators/user`,
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('creator')
})

test('User can follow a creator', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/follow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')
  expect(response.json().success).toBe(true)
})

test('User cannot follow the same creator twice', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/follow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')

  const response2 = await server.inject({
    method: 'POST',
    url: '/creators/follow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  expect(response2.statusCode).toBe(400)
})

test('User cannot follow themselves', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/follow',
    payload: {
      userId: headers['x-user-id'],
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
})

test('User can unfollow a creator', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  await server.inject({
    method: 'POST',
    url: '/creators/follow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  const response = await server.inject({
    method: 'POST',
    url: '/creators/unfollow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('success')
  expect(response.json().success).toBe(true)
})

test('User cannot unfollow a creator they are not following', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/unfollow',
    payload: {
      userId: 'admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
})

test('User can update their username', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/update',
    payload: {
      username: 'test',
    },
    headers,
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toHaveProperty('creator')
  expect(response.json().creator.username).toBe('test')
})

test('Two users cannot have the same username', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/update',
    payload: {
      username: 'admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
  expect(response.json().message).toBe('Username already taken')
})

test('Two users cannot have the same username with a different casing', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/update',
    payload: {
      username: 'Admin',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
  expect(response.json().message).toBe('Username already taken')
})

test('User cannot set a name that is too short', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/update',
    payload: {
      username: 'a',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
  expect(response.json().message).toBe(
    'Username must be between 3 and 32 characters (or your address)',
  )
})

test('User cannot set a name that is too long', async context => {
  const { server } = context
  const headers = prepareUserHeaders()
  const response = await server.inject({
    method: 'POST',
    url: '/creators/update',
    payload: {
      username:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5497875894375893475974395',
    },
    headers,
  })
  expect(response.statusCode).toBe(400)
  expect(response.json()).toHaveProperty('message')
  expect(response.json().message).toBe(
    'Username must be between 3 and 32 characters (or your address)',
  )
})
