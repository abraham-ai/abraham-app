import { MongoClient } from 'mongodb'
import { expect, it } from 'vitest'

it('connects to mongodb', () => {
  expect(async () => {
    const client = new MongoClient(globalThis.__MONGO_URI__)
    try {
      const db = client.db('eden')
      await db.command({ ping: 1 })
    } finally {
      await client.close()
    }
  }).not.toThrow()
})
