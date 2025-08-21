import { LogosResponse } from './tasks'
import {
  CharactersTestArguments,
  SessionsInteractArguments,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import type { FastifyInstance } from 'fastify'

export interface LogosTestArguments {
  name: string
  identity: string
  knowledge?: string
  knowledge_summary?: string
  message: string
  attachments?: string[]
}

export interface LogosGeneratorRequestArguments {
  generatorName: string
  config: Record<string, unknown>
  webhookUrl: string
}

const handleGeneratorRequest = async (
  server: FastifyInstance,
  args: LogosGeneratorRequestArguments,
): Promise<LogosResponse> => {
  const { data } = await axios.post(
    `${server.config.LOGOS_URL}/tasks/create`,
    args,
  )
  return data
}

const handleInteraction = async (
  server: FastifyInstance,
  args: SessionsInteractArguments,
): Promise<LogosResponse> => {
  const { data } = await axios.post(
    `${server.config.LOGOS_URL}/chat/speak`,
    args,
  )
  return data
}

const handleInteractionTest = async (
  server: FastifyInstance,
  args: CharactersTestArguments,
): Promise<LogosResponse> => {
  const { data } = await axios.post(
    `${server.config.LOGOS_URL}/chat/test`,
    args,
  )
  return data
}

export const registerLogos = async (fastify: FastifyInstance) => {
  try {
    fastify.decorate('handleGeneratorRequest', handleGeneratorRequest)
    fastify.decorate('handleInteraction', handleInteraction)
    fastify.decorate('handleInteractionTest', handleInteractionTest)
    fastify.log.info('Successfully registered plugin: Logos')
  } catch (err) {
    console.log(err)
    fastify.log.error('Plugin: Logos, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    handleGeneratorRequest: (
      server: FastifyInstance,
      args: LogosGeneratorRequestArguments,
    ) => Promise<any>
    handleInteraction: (
      server: FastifyInstance,
      args: SessionsInteractArguments,
    ) => Promise<LogosResponse>
    handleInteractionTest: (
      server: FastifyInstance,
      args: CharactersTestArguments,
    ) => Promise<LogosResponse>
  }
}

export default registerLogos
