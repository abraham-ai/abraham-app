import { GeneratorDocument } from '../../models/Generator'
import { uploadS3BufferAsset as uploadBufferAsset } from '../../plugins/s3Plugin'
import { randomId } from '../util'
import { receiveTaskUpdate } from './edenHandlers'
import { FastifyInstance } from 'fastify'

const submitTask = async (
  server: FastifyInstance,
  //@ts-ignore
  generator: GeneratorDocument,
  //@ts-ignore
  generatorVersion: any,
  config: any,
) => {
  const task = { id: randomId(24) }
  setTimeout(async () => {
    await runTask(server, config, task)
  }, 0)
  return task
}

const getTransactionCost = () => 1

const runTask = async (server: FastifyInstance, config: any, task: any) => {
  const { elevenLabs } = server
  if (!elevenLabs) {
    throw new Error('elevenLabs not initialized')
  }

  const audioBuffer = await elevenLabs.runTask(config.voice, config.text)
  const { uri: audioUri } = await uploadBufferAsset(server, audioBuffer, {
    ext: 'wav',
    mime: 'audio/mpeg',
  })

  const output = {
    file: audioUri,
    name: `${task.id}.wav`,
    isFinal: true,
  }

  const update = {
    id: task.id,
    status: 'processing',
    progress: 1,
    output,
    error: null,
  }

  console.log('the update will be this', update)

  await receiveTaskUpdate(server, update)
}

export { submitTask, getTransactionCost }
