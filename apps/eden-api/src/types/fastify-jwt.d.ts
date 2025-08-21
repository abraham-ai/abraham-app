import { CharacterDocument } from '../models/Character'
import { SubscriptionTier } from '../models/User'
import { FeatureFlag } from '@edenlabs/eden-sdk'
import '@fastify/jwt'
import { ObjectId } from 'mongodb'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; isAdmin: boolean }
    user: {
      userId: ObjectId
      character?: CharacterDocument
      featureFlags: FeatureFlag[]
      subscriptionTier: SubscriptionTier
      isAdmin: boolean
    }
  }
}
