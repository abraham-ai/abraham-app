import { GeneratorDocument } from '../../models/Generator'
import { FastifyInstance } from 'fastify'

const makeWebhookUrl = (server: FastifyInstance) =>
  `${server.config.WEBHOOK_URL}/tasks/update?secret=${server.config.WEBHOOK_SECRET}`

const submitTask = async (
  server: FastifyInstance,
  generator: GeneratorDocument,
  //@ts-ignore
  generatorVersion: any,
  config: any,
) => {
  const { handleGeneratorRequest } = server
  if (!handleGeneratorRequest) {
    throw new Error('Logos not initialized')
  }
  const webhookUrl = makeWebhookUrl(server)

  const args = {
    generatorName: generator.generatorName,
    config: config,
    webhookUrl: webhookUrl,
  }

  const task = await handleGeneratorRequest(server, args)

  return task
}

const getTransactionCost = (
  _: FastifyInstance,
  generator: GeneratorDocument,
) => {
  if (generator.generatorName.includes('kojii')) {
    return 1
  } else {
    return 30
  }
}

export { submitTask, getTransactionCost }
