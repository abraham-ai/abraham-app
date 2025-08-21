import { isAllowedAccess } from '../lib/authorization'
import { checkUserFlags } from '../lib/data'
import { ApiKey } from '../models/ApiKey'
import { User } from '../models/User'
import { FeatureFlag, SubscriptionTier } from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const apiKeyVerify = async (
  server: FastifyInstance,
  request: FastifyRequest,
) => {
  if (!request.headers['x-api-key']) {
    throw new Error('Missing API key')
  }

  const apiKey = await ApiKey.findOne({
    apiKey: request.headers['x-api-key'],
  })

  if (!apiKey) {
    throw new Error('Invalid API key provided')
  }

  const user = await User.findById(apiKey.user)

  if (!user) {
    throw new Error('User not found')
  }

  if (!apiKey.character && !isAllowedAccess(server, user.userId)) {
    throw new Error('User not allowed')
  }

  request.user = {
    userId: user._id,
    character: apiKey.character,
    subscriptionTier: user.subscriptionTier || SubscriptionTier.Free,
    featureFlags: user.featureFlags || [],
    isAdmin: user.isAdmin || false,
  }
}

const getCredential = async (
  server: FastifyInstance,
  request: FastifyRequest,
  // reply: FastifyReply,
) => {
  if (request.headers['x-api-key']) {
    await apiKeyVerify(server, request)
  } else {
    await server.verifyUser(request)
  }
}

export const isAuth = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    await getCredential(server, request)
  } catch (error: any) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: error.message,
    })
  }
}

export const isAdmin = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    await getCredential(server, request)
  } catch (error: any) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: error.message,
    })
  }
  if (!request.user.isAdmin) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Unauthorized',
    })
  }
}

export const isCharacter = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    await getCredential(server, request)
  } catch (error: any) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: error.message,
    })
  }
  if (!request.user.character) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Unauthorized',
    })
  }
}

export const hasMinimumSubscriptionTier = (
  request: FastifyRequest,
  minimumTier: SubscriptionTier,
) => {
  if (!request.user) {
    return false
  }
  return (
    request.user.subscriptionTier >= minimumTier ||
    // Admin user and preview user are equivalent to having the highest tier
    request.user.isAdmin ||
    checkUserFlags(request.user.featureFlags, FeatureFlag.Preview)
  )
}

export const hasFeatureFlag = (
  request: FastifyRequest,
  reply: FastifyReply,
  featureFlag: FeatureFlag,
) => {
  try {
    checkUserFlags(request.user.featureFlags, featureFlag)
    return // Signal successful completion
  } catch (error) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Forbidden',
    })
  }
}

// used for public routes that may contain elements with extra data when authed (think like count on a feed)
export const maybeAuth = async (
  server: FastifyInstance,
  request: FastifyRequest,
) => {
  try {
    await getCredential(server, request)
  } catch (error) {
    // Ignore
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    verifyUser: (request: FastifyRequest) => Promise<void>
  }
}
