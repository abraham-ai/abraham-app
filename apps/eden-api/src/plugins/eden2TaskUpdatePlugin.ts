import { sendDiscordNotification } from '../lib/discord'
import { handleTaskUpdateStreamEvent } from '../lib/eden2'
import { TaskV2Document } from '../models/v2/TaskV2'
import { FastifyPluginAsync } from 'fastify'
import { ChangeStreamDocument, UpdateDescription } from 'mongodb'

const WATCHED_COLLECTION = 'tasks3'
export const registerEden2TaskUpdates: FastifyPluginAsync = async fastify => {
  try {
    const task2Collection =
      fastify.mongoose.connection.db.collection(WATCHED_COLLECTION)

    const taskChangeStream = task2Collection.watch(
      [
        {
          $match: {
            'fullDocument.updatedAt': {
              $gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        },
      ],
      { fullDocument: 'updateLookup' },
    )

    taskChangeStream.on(
      'change',
      async (data: ChangeStreamDocument<TaskV2Document>) => {
        try {
          // fastify.log.info({
          //   msg: 'Task change stream event received',
          //   operationType: data.operationType,
          // })

          if (
            data.operationType === 'insert' ||
            data.operationType === 'update'
          ) {
            // fastify.log.info({
            //   msg: `Task DB event: ${data.operationType} `,
            //   doc: data.fullDocument,
            // })

            const updatedFields =
              data.operationType === 'update'
                ? (data.updateDescription as UpdateDescription).updatedFields
                : undefined

            if (
              fastify.config.NODE_ENV === 'production' &&
              data.fullDocument?.status === 'failed'
            ) {
              sendDiscordNotification(fastify, data.fullDocument)
            }

            await handleTaskUpdateStreamEvent(
              fastify,
              data.fullDocument as TaskV2Document,
              updatedFields,
            )
          }
        } catch (err) {
          fastify.log.error(
            'Failed to handle change stream onChange: Eden2Tasks',
            { err },
          )
        }
      },
    )

    fastify.addHook('onClose', (_instance, done) => {
      const streamClosePromise = taskChangeStream.close()

      if (streamClosePromise) {
        streamClosePromise.then(() => {
          fastify.log.info('Task change stream closed')
          done()
          return
        })
      }

      done()
    })

    fastify.log.info('Successfully registered plugin: Eden2TaskUpdates')
  } catch (err) {
    fastify.log.error('Failed to register plugin: Eden2TaskUpdates', { err })
  }
}

export default registerEden2TaskUpdates
