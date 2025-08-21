import { Creation } from '../../models/Creation'
import {
  GeneratorDocument,
  GeneratorVersionSchema,
} from '../../models/Generator'
import { Task, TaskStatus } from '../../models/Task'
import { InternalMessagesQueues } from '../../plugins/internalMessagesPlugin'
import { TaskHandlers } from '../../plugins/tasks'
import { submitMonologueTask } from './airflow'
import axios from 'axios'
import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

interface Output {
  result: string
  thumbnail: string
}

const dummyImages: Output[] = [
  // square image 1
  {
    result:
      'https://media.discordapp.net/attachments/1003581679916548207/1113042054960922717/output.jpg',
    thumbnail:
      'https://media.discordapp.net/attachments/1003581679916548207/1113042054960922717/output.jpg',
  },
  // square image 1
  {
    result:
      'https://media.discordapp.net/attachments/1003581679916548207/1111725311122481304/output.jpg',
    thumbnail:
      'https://media.discordapp.net/attachments/1003581679916548207/1111725311122481304/output.jpg',
  },
  // vertical image
  {
    result:
      'https://media.discordapp.net/attachments/1003581679916548207/1119288277082587256/output.jpg',
    thumbnail:
      'https://media.discordapp.net/attachments/1003581679916548207/1119288277082587256/output.jpg',
  },
  // horizontal image
  {
    result:
      'https://media.discordapp.net/attachments/1003581679916548207/1119288301787033741/output.jpg',
    thumbnail:
      'https://media.discordapp.net/attachments/1003581679916548207/1119288301787033741/output.jpg',
  },
  // square video
  {
    result:
      'https://cdn.discordapp.com/attachments/1003581679916548207/1115391443146641439/out.mp4',
    thumbnail:
      'https://media.discordapp.net/attachments/731285155255419041/1119286801618714634/output.jpg',
  },
  // vertical video
  {
    result:
      'https://cdn.discordapp.com/attachments/879507579926102056/1118979744805957643/be36ce2e52040096d10c93b6bb12c179c93e1c3c9eff8fc46956197a4c049b61.mp4',
    thumbnail:
      'https://media.discordapp.net/attachments/731285155255419041/1119286801841004664/output1.jpg',
  },
  // horizontal video
  {
    result:
      'https://cdn.discordapp.com/attachments/1003581679916548207/1115379600466382918/out.mp4',
    thumbnail:
      'https://media.discordapp.net/attachments/731285155255419041/1119286802050732152/output2.jpg',
  },
]

interface TaskUpdate {
  id: string
}

export const dummySubmitTask = async (
  server: FastifyInstance,
  generator: GeneratorDocument,
  generatorVersion: GeneratorVersionSchema,
  config: any,
): Promise<string> => {
  if (generator.generatorName === 'monologue') {
    return await submitMonologueTask(server, config)
  } else if (generator.generatorName === 'test') {
    console.log(
      `Submitting task for generator version ${
        generatorVersion.versionId
      } with config ${JSON.stringify(config)}`,
    )
    return new Promise(resolve => resolve(uuidv4()))
  } else {
    throw new Error('Invalid generator name.')
  }
}

export const dummyReceiveTaskUpdate = async (
  server: FastifyInstance,
  update: any,
) => {
  const { id: taskId } = update as TaskUpdate
  const task = await Task.findOne({
    taskId,
  })
  if (!task) {
    throw new Error(`Could not find task ${taskId}`)
  }

  const taskUpdateIntermediate = {
    status: TaskStatus.Pending,
    progress: 0.5,
  }

  await Task.updateOne(
    {
      taskId,
    },
    {
      $set: taskUpdateIntermediate,
    },
  )

  const eventMessage = {
    userId: task.user._id,
    taskId,
    status: TaskStatus.Pending,
    progress: 0.5,
    task: {
      ...task,
      ...taskUpdateIntermediate,
    },
  }

  server.eventEmitter.emit('task-update', eventMessage)
  server.internalMessages.publish(
    InternalMessagesQueues.TaskUpdates,
    eventMessage,
  )

  const image = dummyImages[Math.floor(Math.random() * dummyImages.length)]
  const asset = await server.uploadUrlAsset(server, image.result)
  const thumbnail = await server.uploadS3ThumbnailAsset(server, image.thumbnail)

  const creationUser = task.attributes?.delegateUserId
    ? new ObjectId(task.attributes.delegateUserId)
    : task.user

  const creationData = {
    user: creationUser,
    character: task.character,
    task: task._id,
    uri: asset.uri,
    thumbnail,
    name: 'Test Image',
    attributes: task.attributes,
    mediaAttributes: asset.mediaAttributes,
  }
  const creation = await Creation.create(creationData)

  const taskUpdate = {
    status: 'completed',
    progress: 1.0,
    creation: creation._id,
  }

  await Task.updateOne(
    {
      taskId,
    },
    {
      $set: taskUpdate,
    },
  )

  const taskCompletedEventMessage = {
    userId: task.user._id,
    taskId,
    status: TaskStatus.Completed,
    progress: 1.0,
    result: asset.uri,
    task: {
      ...task,
      ...taskUpdate,
    },
  }
  server.eventEmitter.emit('task-update', taskCompletedEventMessage)
  server.internalMessages.publish(
    InternalMessagesQueues.TaskUpdates,
    taskCompletedEventMessage,
  )

  if (task.webhooks) {
    await Promise.all(
      task.webhooks.map(async webhook => {
        await axios.post(webhook, {
          taskId,
          creationId: creation._id,
        })
      }),
    )
  }

  return update
}

export const dummyGetTransactionCost = (
  _: FastifyInstance,
  //@ts-ignore
  generator: GeneratorDocument,
  generatorVersion: GeneratorVersionSchema,
  config: any,
) => {
  console.log(
    `Getting transaction cost for generator, version ${
      generatorVersion.versionId
    } with config ${JSON.stringify(config)}`,
  )
  return 1
}

// const dummyHandleInteraction = async (
//   server: FastifyInstance,
//   assistant: Assistant,
//   interaction: Interaction,
// ): Promise<LogosResponse> => {
//   return {
//     message: 'Hello',
//     config: {
//       generatorName: 'test',
//       config: {
//         test: 'test',
//       },
//     },
//   }
// }

export const dummyTaskHandlers: TaskHandlers = {
  submitTask: dummySubmitTask,
  receiveTaskUpdate: dummyReceiveTaskUpdate,
  getTransactionCost: dummyGetTransactionCost,
}
