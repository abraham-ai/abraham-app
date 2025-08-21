import type { FastifyInstance } from 'fastify'
import Replicate from 'replicate'

export const registerReplicate = async (fastify: FastifyInstance) => {
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_TOKEN as string,
    })
    fastify.decorate('replicate', replicate)
    fastify.log.info('Successfully registered plugin: Replicate')
  } catch (err) {
    fastify.log.error('Plugin: Replicate, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    replicate?: Replicate
  }
}

export default registerReplicate
