import EventEmitter from 'events'
import type { FastifyInstance } from 'fastify'

export const registerEventEmitter = async (fastify: FastifyInstance) => {
  try {
    const eventEmitter = new EventEmitter()
    eventEmitter.setMaxListeners(100 * 1000)
    fastify.decorate('eventEmitter', eventEmitter)
    fastify.log.info('Successfully registered plugin: EventEmitter')
  } catch (err) {
    fastify.log.error('Plugin: EventEmitter, error on register', err)
  }
}

export default registerEventEmitter

declare module 'fastify' {
  interface FastifyInstance {
    eventEmitter: EventEmitter
  }
}
