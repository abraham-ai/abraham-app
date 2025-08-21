import type { FastifyInstance } from 'fastify'
import Stripe from 'stripe'

export const registerStripe = async (fastify: FastifyInstance) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2022-11-15',
    })
    fastify.decorate('stripe', stripe)
    fastify.log.info('Successfully registered plugin: Stripe')
  } catch (err) {
    fastify.log.error('Plugin: Stripe, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    stripe?: Stripe
  }
}

export default registerStripe
