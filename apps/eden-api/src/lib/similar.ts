import { FastifyInstance } from 'fastify'

export const getSimilarCreationIds = async (
  server: FastifyInstance,
  embedding: number[],
) => {
  const { chromadb } = server
  if (!chromadb) {
    throw new Error('Chromadb not initialized')
  }

  const collection = await chromadb.getCollection({
    name: 'creation_clip_embeddings',
  })

  if (!collection) {
    throw new Error('Chromadb collection not found')
  }

  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: 11,
  })

  if (!results?.ids) {
    throw new Error('Chromadb query failed')
  }

  return results.ids[0].slice(1)
}
