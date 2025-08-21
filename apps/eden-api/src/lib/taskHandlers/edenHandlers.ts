import { Character } from '../../models/Character'
import { Concept } from '../../models/Concept'
import { Creation, CreationInput } from '../../models/Creation'
import { Generator, GeneratorDocument } from '../../models/Generator'
import { Manna } from '../../models/Manna'
import { Task } from '../../models/Task'
import { Transaction } from '../../models/Transaction'
import { User } from '../../models/User'
import { InternalMessagesQueues } from '../../plugins/internalMessagesPlugin'
import { TaskHandlers } from '../../plugins/tasks'
import * as eden2 from '../eden2'
import * as elevenPlay from './elevenPlay'
import * as logos from './logos'
import * as replicate from './replicate'
import axios from 'axios'
import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'

type TaskProvider = 'replicate' | 'elevenPlay' | 'logos' | 'eden2'

const providers = new Map<TaskProvider, any>([
  ['elevenPlay', elevenPlay],
  ['replicate', replicate],
  ['logos', logos],
  ['eden2', eden2],
])

const universalGenerators = ['zeroscope-v2-xl', 'upscale']

interface TaskOutput {
  result: string
  files: string[]
  thumbnails: string[]
  name: string
  attributes: any
  progress: number
  isFinal: boolean
}

const submitTask = async (
  server: FastifyInstance,
  generator: GeneratorDocument,
  generatorVersion: any,
  config: any,
) => {
  const { provider } = generatorVersion
  const task = await providers
    .get(provider)
    .submitTask(server, generator, generatorVersion, config)
  return task.id
}

type TaskStatusUpdate = {
  progress?: number
  status: string
}

const handleUpdate = async (
  server: FastifyInstance,
  taskId: string,
  output: TaskOutput[],
  status?: string,
) => {
  const task = await Task.findOne({
    taskId,
  })
  if (!task) {
    throw new Error(`Could not find task ${taskId}`)
  }

  output = Array.isArray(output) ? output : [output]
  output = output.filter((o: TaskOutput) => o)

  const intermediateOutputs = output.filter((o: TaskOutput) => !o.isFinal)
  const finalOutputs = output.filter((o: TaskOutput) => o.isFinal)

  const isCompleted = finalOutputs.some(Boolean) && status == 'succeeded'
  const maxProgress = Math.max(
    ...intermediateOutputs.map((o: TaskOutput) => o.progress),
  )

  const taskUpdate: TaskStatusUpdate = {
    status: status === 'starting' ? 'pending' : 'running',
  }
  if (taskUpdate.status === 'running') {
    taskUpdate.progress = Math.max(maxProgress, task.progress || 0)
  }

  const filteredIntermediateOutputs = intermediateOutputs.filter(
    o => o.files && Array.isArray(o.files) && o.files.length > 0,
  )
  if (
    !task.intermediateOutputs ||
    filteredIntermediateOutputs.length > task.intermediateOutputs.length
  ) {
    const intermediateResults = filteredIntermediateOutputs.map(
      async (o: TaskOutput) => ({ files: o.files, progress: o.progress }),
    )
    Object.assign(taskUpdate, {
      intermediateOutputs: await Promise.all(intermediateResults),
    })
  }

  const generator = await Generator.findById(task.generator)

  if (isCompleted) {
    const finalOutput = finalOutputs.slice(-1)[0]
    Object.assign(taskUpdate, { output: finalOutput })

    if (generator?.output == 'creation') {
      const creationData: CreationInput[] = []

      const { nsfw_scores, ...remainingAttributes } =
        finalOutput.attributes || {}
      const finalOutputAttributes = { ...remainingAttributes }

      await Promise.allSettled(
        //@ts-ignore
        finalOutput.files.map(async (files, index) => {
          const creationId = new ObjectId()
          const creationUser = task.attributes?.delegateUserId
            ? new ObjectId(task.attributes.delegateUserId)
            : task.user

          const nsfwScore =
            nsfw_scores && nsfw_scores.length ? nsfw_scores[index] : 0
          const isNsfw = nsfwScore && nsfwScore > 0.5

          const creationDocument: CreationInput = {
            _id: creationId,
            user: creationUser,
            character: task.character,
            task: task._id,
            uri: finalOutput.files[index],
            thumbnail: finalOutput.thumbnails[index],
            name: finalOutput.name,
            attributes: {
              ...task.attributes,
              ...finalOutputAttributes,
              nsfw_score: nsfwScore,
            },
            isPrivate: isNsfw ? true : task.config.isPrivate || false,
          }

          if (task.config.lora) {
            creationDocument.concept = new ObjectId(task.config.lora)
          }

          if (task.generator) {
            creationDocument.generator = task.generator
          }

          if (finalOutput.files[index]) {
            console.log('uploading asset', finalOutput.files[index])
            try {
              const { uri, mediaAttributes, thumbnailUri } =
                await server.uploadUrlAsset(server, finalOutput.files[index])
              console.log('uploaded asset', uri, mediaAttributes)

              creationDocument.uri = uri
              creationDocument.mediaAttributes = mediaAttributes
              creationDocument.thumbnail = thumbnailUri
            } catch (e) {
              console.error('uploadUrlAsset error', e)
            }
          }

          creationData.push(creationDocument)
        }),
      )

      // update concept creation count
      if (task.config.lora) {
        await Concept.findOneAndUpdate(
          {
            _id: task.config.lora,
          },
          {
            $inc: {
              creationCount: task.config.n_samples ? task.config.n_samples : 1,
            },
          },
        )
      }

      // update user creation count
      if (task.user) {
        await User.findOneAndUpdate(
          {
            _id: task.user,
          },
          {
            $inc: {
              creationCount: task.config.n_samples ? task.config.n_samples : 1,
            },
          },
        )
      }

      // update character creation count
      if (task.character) {
        await Character.findOneAndUpdate(
          {
            _id: task.character,
          },
          {
            $inc: {
              creationCount: task.config.n_samples ? task.config.n_samples : 1,
            },
          },
        )
      }

      await Promise.allSettled(
        creationData.map(async creationInput => {
          const otherCreationIds = creationData
            .filter(dataItem => dataItem._id !== creationInput._id)
            .map(item => item._id)

          await Creation.create({
            ...creationInput,
            samples: otherCreationIds,
          })
        }),
      )

      if (task.webhooks) {
        for (const webhook of task.webhooks) {
          await axios.post(webhook, {
            taskId,
            creationData,
          })
        }
      }

      // n_samples: add samples field with other creationIds
      if (
        creationData.length > 1 &&
        task.config.n_samples &&
        task.config.n_samples > 1
      ) {
        Object.assign(taskUpdate, {
          samples: creationData.map(item => item._id),
        })
      }

      // update task -
      Object.assign(taskUpdate, {
        creation: creationData[0]._id, // keep using only first creationId here to not break existing logic
        status: 'completed',
        progress: 1.0,
      })

      const taskCompletedEventMessage = {
        userId: task.user._id,
        taskId,
        status: 'completed',
        progress: 1.0,
        result: creationData.map(item => item.uri),
        task: {
          ...task.toObject(),
          ...taskUpdate,
          creation: creationData[0],
          generator: {
            generatorName: generator.generatorName,
          },
        },
      }
      server.eventEmitter.emit('task-update', taskCompletedEventMessage)
      server.internalMessages.publish(
        InternalMessagesQueues.TaskUpdates,
        taskCompletedEventMessage,
      )
    } else if (generator?.output == 'concept') {
      for (let i = 0; i < finalOutput.files.length; i++) {
        // version the concept's public name (v2, v3, etc)
        let publicName = finalOutput.name
        const concepts = await Concept.find({
          user: task.user,
          name: publicName,
        })
        if (concepts.length > 0) {
          const baseName = publicName
          let version = 2
          let newName = `${baseName}_v${version}`
          while (
            await Concept.findOne({
              user: task.user,
              name: newName,
            })
          ) {
            version++
            newName = `${baseName}_v${version}`
          }
          publicName = newName
        }
        const conceptData = {
          user: task.user,
          task: task._id,
          name: publicName,
          conceptName: finalOutput.name,
          checkpoint: task.config.checkpoint || 'JuggernautXL_v6', //task.config.checkpoint,
          grid_prompts:
            finalOutput.attributes &&
            finalOutput.attributes.grid_prompts !== undefined
              ? finalOutput.attributes.grid_prompts
              : [], //task.config.checkpoint,
          training_images: task.config.lora_training_urls,
          num_training_images:
            finalOutput.attributes && finalOutput.attributes.num_training_images
              ? finalOutput.attributes.num_training_images
              : 0,
          uri: finalOutput.files[i],
          thumbnail: finalOutput.thumbnails[0],
          isPrivate: task.config.isPrivate || false,
        }
        if (finalOutput.files[i]) {
          const { uri } = await server.uploadS3UrlAsset(
            server,
            finalOutput.files[i],
          )
          conceptData.uri = uri
        }

        if (finalOutput.thumbnails[i]) {
          const { uri } = await server.uploadUrlAsset(
            server,
            finalOutput.thumbnails[i],
          )
          conceptData.thumbnail = uri
        }

        const concept = await Concept.create(conceptData)
        Object.assign(taskUpdate, {
          concept: concept._id,
          status: 'completed',
          progress: 1.0,
        })

        const taskCompletedEventMessage = {
          userId: task.user._id,
          taskId,
          status: 'completed',
          progress: 1.0,
          result: [conceptData.uri],
          task: {
            ...task.toObject(),
            ...taskUpdate,
            concept,
            generator: {
              generatorName: generator.generatorName,
            },
          },
        }
        server.eventEmitter.emit('task-update', taskCompletedEventMessage)
        server.internalMessages.publish(
          InternalMessagesQueues.TaskUpdates,
          taskCompletedEventMessage,
        )

        if (task.webhooks) {
          task.webhooks.forEach(async (webhook: string) => {
            await axios.post(webhook, {
              taskId,
              concept,
            })
          })
        }
      }
    }
  } else {
    const taskProcessingEventMessage = {
      userId: task.user._id,
      taskId,
      status: taskUpdate.status,
      progress: taskUpdate.progress,
      task: {
        ...task.toObject(),
        ...taskUpdate,
        generator: { generatorName: generator?.generatorName || 'n/a' },
      },
    }
    server.eventEmitter.emit('task-update', taskProcessingEventMessage)
    server.internalMessages.publish(
      InternalMessagesQueues.TaskUpdates,
      taskProcessingEventMessage,
    )
  }

  await Task.updateOne(
    {
      taskId,
      status: { $nin: ['completed', 'failed'] },
    },
    {
      $set: taskUpdate,
    },
  )
}

const handleUpdateUniversal = async (
  server: FastifyInstance,
  taskId: string,
  output: string[] | string,
  status?: string,
) => {
  const task = await Task.findOne({
    taskId,
  })
  if (!task) {
    throw new Error(`Could not find task ${taskId}`)
  }
  output = Array.isArray(output) ? output : [output]

  const taskUpdate: TaskStatusUpdate = {
    status: status === 'starting' ? 'pending' : 'running',
  }
  if (taskUpdate.status === 'running') {
    taskUpdate.progress = 0
  }

  const isCompleted = output.some(Boolean) && status == 'succeeded'
  const generator = await Generator.findById(task.generator)

  if (isCompleted) {
    Object.assign(taskUpdate, {
      status: 'completed',
      progress: 1.0,
      output: output,
    })
    if (generator?.output == 'creation') {
      for (let i = 0; i < output.length; i++) {
        const creationUser = task.attributes?.delegateUserId
          ? new ObjectId(task.attributes.delegateUserId)
          : task.user
        const creationData = {
          user: creationUser,
          character: task.character,
          task: task._id,
          uri: output[i],
          thumbnail: '',
          name: task.config.prompt,
          attributes: task.attributes,
          mediaAttributes: {},
        }
        if (output[i]) {
          try {
            console.log('uploading asset', output[i])
            const { uri, mediaAttributes, thumbnailUri } =
              await server.uploadUrlAsset(server, output[i])
            console.log('uploaded asset', uri, thumbnailUri, mediaAttributes)
            creationData.uri = uri
            creationData.thumbnail = thumbnailUri || ''
            creationData.mediaAttributes = mediaAttributes
          } catch (e) {
            console.error('uploadUrlAsset error', e)
          }
        }
        const creation = await Creation.create(creationData)
        Object.assign(taskUpdate, { creation: creation._id })

        const taskSuccessEventMessage = {
          userId: task.user._id,
          taskId,
          status: 'completed',
          progress: 1.0,
          result: creationData.uri,
          task: {
            ...task.toObject(),
            ...taskUpdate,
            creation,
          },
        }
        server.eventEmitter.emit('task-update', taskSuccessEventMessage)
        server.internalMessages.publish(
          InternalMessagesQueues.TaskUpdates,
          taskSuccessEventMessage,
        )

        if (task.webhooks) {
          task.webhooks.forEach(async (webhook: string) => {
            await axios.post(webhook, {
              taskId,
              creation,
            })
          })
        }
      }
    }
  } else {
    const taskProcessingEventMessage = {
      userId: task.user._id,
      taskId,
      status: taskUpdate.status,
      progress: taskUpdate.progress,
      task: {
        ...task.toObject(),
        ...taskUpdate,
        generator: { generatorName: generator?.generatorName || 'n/a' },
      },
    }
    server.eventEmitter.emit('task-update', taskProcessingEventMessage)
    server.internalMessages.publish(
      InternalMessagesQueues.TaskUpdates,
      taskProcessingEventMessage,
    )
  }

  await Task.updateOne(
    {
      taskId,
      status: { $nin: ['completed', 'failed'] },
    },
    {
      $set: taskUpdate,
    },
  )
}

const handleFailure = async (
  server: FastifyInstance,
  taskId: string,
  error: string,
) => {
  const task = await Task.findOne({
    taskId,
  })
  if (!task) {
    throw new Error(`Could not find task ${taskId}`)
  }
  const taskUpdate = {
    status: 'failed',
    error,
  }
  await Task.updateOne(
    {
      taskId,
    },
    {
      $set: taskUpdate,
    },
  )

  // refund the user
  const manna = await Manna.findOne({
    user: task.user,
  })

  if (!manna) {
    throw new Error(`Could not find manna for user ${task.user}`)
  }

  const mannaUpdate = {
    balance: manna.balance + task.cost,
  }

  await Manna.updateOne(
    {
      user: task.user,
    },
    {
      $set: mannaUpdate,
    },
  )

  await Transaction.create({
    manna: manna._id,
    task: task._id,
    amount: task.cost,
  })

  const taskFailedEventMessage = {
    userId: task.user._id,
    taskId,
    status: 'failed',
    progress: 1.0,
    result: null,
    task: {
      ...task.toObject(),
      ...taskUpdate,
    },
  }

  server.eventEmitter.emit('task-update', taskFailedEventMessage)
  server.internalMessages.publish(
    InternalMessagesQueues.TaskUpdates,
    taskFailedEventMessage,
  )
}

export const receiveTaskUpdate = async (
  server: FastifyInstance,
  update: any,
) => {
  const { id: taskId, status, output, error } = update as any
  console.log(`Received update for task ${taskId} with status ${status}`)
  if (output) {
    console.log(`Output: ${JSON.stringify(output)}`)
  }
  if (error) {
    console.error(`Error for task ${taskId}: ${error}`)
  }
  const task = await Task.findOne({
    taskId,
  })
  if (!task) {
    throw new Error(`Could not find task ${taskId}`)
  }
  const generator = await Generator.findById(task.generator)
  if (!generator) {
    throw new Error(`Could not find generator ${task.generator}`)
  }
  const generatorName = generator.generatorName
  switch (status) {
    case 'starting':
      if (universalGenerators.includes(generatorName)) {
        await handleUpdateUniversal(server, taskId, output, 'starting')
      } else {
        await handleUpdate(server, taskId, output, 'starting')
      }
      break
    case 'processing':
      if (universalGenerators.includes(generatorName)) {
        await handleUpdateUniversal(server, taskId, output, 'processing')
      } else {
        await handleUpdate(server, taskId, output, 'processing')
      }
      break
    case 'succeeded':
      if (universalGenerators.includes(generatorName)) {
        await handleUpdateUniversal(server, taskId, output, 'succeeded')
      } else {
        await handleUpdate(server, taskId, output, 'succeeded')
      }
      break
    case 'failed':
      await handleFailure(server, taskId, error)
      break
    case 'cancelled':
      await handleFailure(server, taskId, 'Cancelled')
      break
    default:
      throw new Error(`Unknown status ${status}`)
  }
}

const getTransactionCost = (
  server: FastifyInstance,
  generator: GeneratorDocument,
  generatorVersion: any,
  config: any,
) => {
  const { provider } = generatorVersion
  const cost = providers
    .get(provider)
    .getTransactionCost(server, generator, generatorVersion, config)
  return cost
}

export const edenHandlers: TaskHandlers = {
  submitTask,
  receiveTaskUpdate,
  getTransactionCost,
}
