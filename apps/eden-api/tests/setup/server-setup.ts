import { beforeEach } from 'vitest'

import { createTestServer } from '../util'

beforeEach(async context => {
  const server = await createTestServer()
  context.server = server
})
