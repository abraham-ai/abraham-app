import { describe, expect, test } from 'vitest'

describe('Server', () => {
  test('Should return server instance', async context => {
    // @ts-ignore
    const { server } = context
    expect(typeof server).eq('object')
    await server.close()
  })
})
