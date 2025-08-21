import { isAllowedAccess } from '../lib/authorization'
import { User } from '../models/User'
import { clerkPlugin, createClerkClient, getAuth } from '@clerk/fastify'
import { clerkClient } from '@clerk/fastify/dist/types/clerkClient'
import { SubscriptionTier } from '@edenlabs/eden-sdk'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export const registerClerk = async (fastify: FastifyInstance) => {
  try {
    const clerkOptions = {
      publishableKey: fastify.config.CLERK_PUBLISHABLE_KEY,
      secretKey: fastify.config.CLERK_SECRET_KEY,
    }

    const clerkClient = createClerkClient(clerkOptions)
    fastify.register(clerkPlugin, clerkOptions)
    fastify.decorate('clerk', clerkClient)
    fastify.decorate('verifyUser', async (request: FastifyRequest) => {
      const { userId } = getAuth(request)
      if (!userId) {
        throw new Error('Invalid session')
      }

      const user = await User.findOne({
        userId,
      })

      if (!user) {
        throw new Error('User not found')
      }

      if (!isAllowedAccess(fastify, userId)) {
        throw new Error('User not allowed')
      }

      request.user = {
        userId: user._id,
        subscriptionTier: user.subscriptionTier || SubscriptionTier.Free,
        featureFlags: user.featureFlags || [],
        isAdmin: user.isAdmin || false,
      }
    })
    fastify.log.info('Successfully registered plugin: Clerk')
  } catch (err) {
    fastify.log.error('Plugin: Clerk, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    clerk?: typeof clerkClient
  }
}

export default registerClerk
