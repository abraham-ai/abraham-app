import { ChromaClient } from 'chromadb'
import type { FastifyInstance } from 'fastify'

export const registerChroma = async (
  fastify: FastifyInstance,
  chromaUri: string | undefined,
) => {
  const uri = chromaUri || fastify.config.CHROMA_URI
  try {
    const chromadb = new ChromaClient({
      path: uri,
      auth: { provider: 'basic', credentials: 'chromadb:changeme' },
    })
    fastify.decorate('chromadb', chromadb)
    fastify.log.info('Successfully registered plugin: Chroma')
  } catch (err) {
    fastify.log.error('Plugin: Chroma, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    chromadb?: ChromaClient
  }
}

export default registerChroma
