import { handleThreadUpdateStreamEvent } from '../lib/eden2'
import { Thread, ThreadDocument } from '../models/v2/Thread'
import { ThreadMessage } from '@edenlabs/eden-sdk'
import { FastifyPluginAsync } from 'fastify'
import _ from 'lodash'
import { ChangeStreamDocument } from 'mongodb'

const WATCHED_COLLECTION = 'threads3'

/**
 * Recursively build a usable nested structure from dot-notated updatedFields
 */
const reconstructNestedObject = (
  updatedFields: Record<string, any>,
): Record<string, any> => {
  const result: Record<string, any> = {}

  Object.entries(updatedFields).forEach(([key, value]) => {
    const keys = key.split('.')
    let current = result

    // Traverse or create the nested structure
    keys.forEach((part, index) => {
      if (index === keys.length - 1) {
        // Final key gets the value
        current[part] = value
      } else {
        current[part] = current[part] || {}
        current = current[part]
      }
    })
  })

  return result
}

/**
 * Extract modified messages from updatedFields
 */
const extractModifiedMessages = (
  updatedFields: Record<string, any>,
): Record<number, any> => {
  const nested = reconstructNestedObject(updatedFields)
  return nested.messages || {}
}

export const registerEden2ThreadUpdates: FastifyPluginAsync = async fastify => {
  try {
    const threadCollection =
      fastify.mongoose.connection.db.collection(WATCHED_COLLECTION)

    const changeStream = threadCollection.watch(
      [
        {
          $match: {
            operationType: { $in: ['insert', 'update'] },
          },
        },
      ],
      { fullDocument: 'updateLookup' },
    )

    changeStream.on(
      'change',
      async (data: ChangeStreamDocument<ThreadDocument>) => {
        // fastify.log.info(`Change stream onChange: ${WATCHED_COLLECTION}`)
        // console.log(data.operationType, data)
        try {
          if (data.operationType === 'insert') {
            const cachedDoc = data.fullDocument

            if (!cachedDoc) {
              fastify.log.error('insert: No fullDocument found')
              return
            }

            if (!cachedDoc.user) {
              // fastify.log.error(
              //   `insert: No user field found for thread ${cachedDoc._id}`,
              // )
              return
            }

            await handleThreadUpdateStreamEvent(fastify, cachedDoc, undefined)
          } else if (data.operationType === 'update') {
            const cachedDoc = data.fullDocument

            if (!cachedDoc) {
              fastify.log.error('update: No fullDocument found')
              return
            }

            if (!cachedDoc.user) {
              // fastify.log.error(
              //   `update: No user field found for thread ${cachedDoc._id}`,
              // )
              return
            }

            // Apply updates to cached document
            const updatedFields = data.updateDescription.updatedFields

            if (!updatedFields) {
              fastify.log.error('update: No updated fields found')
              return
            }

            Object.entries(updatedFields).forEach(([key, value]) => {
              _.set(cachedDoc, key, value)
            })

            if (cachedDoc) {
              await Thread.populate(cachedDoc, {
                path: 'messages.tool_calls.result.output.creation',
                model: 'creations3',
                select: '_id user mediaAttributes tool filename',
                populate: {
                  path: 'user',
                  model: 'users3',
                  select: '_id username userImage',
                },
              })
            }

            if (updatedFields) {
              await Thread.populate(updatedFields, {
                path: 'messages.tool_calls.result.output.creation',
                model: 'creations3',
                select: '_id user mediaAttributes tool filename',
                populate: {
                  path: 'user',
                  model: 'users3',
                  select: '_id username userImage',
                },
              })
            }

            const modifiedMessages = extractModifiedMessages(updatedFields)

            const updatedMessages: ThreadMessage[] = []
            // Merge updated parts into the cached document or `fullDocument`
            Object.entries(modifiedMessages).forEach(
              async ([index, updates]) => {
                const messageIndex = parseInt(index, 10)
                const existingMessage = cachedDoc?.messages[messageIndex] || {}
                const fullUpdatedMessage = _.merge(existingMessage, updates)
                // console.log('fullUpdatedMessage', fullUpdatedMessage)
                // populate fullUpdatedMessage.tool_calls.result.output.creation

                updatedMessages.push(fullUpdatedMessage)
              },
            )

            if (!updatedMessages.length) {
              // console.log('update: No messages updated')
              return
            }

            const filteredModifiedMessages = updatedMessages.filter(msg => {
              return msg.role !== 'user'
            })

            if (!filteredModifiedMessages.length) {
              // console.log('update: No non-user messages updated')
              return
            }

            await handleThreadUpdateStreamEvent(
              fastify,
              cachedDoc,
              filteredModifiedMessages,
            )
          }
        } catch (err) {
          console.log('err', err)
          fastify.log.error(
            'Failed to handle change stream onChange: Eden2Tasks',
            { err },
          )
        }
      },
    )

    fastify.addHook('onClose', (_instance, done) => {
      const streamClosePromise = changeStream.close()

      if (streamClosePromise) {
        streamClosePromise.then(() => {
          fastify.log.info('Thread change stream closed')
          done()
          return
        })
      }

      done()
    })

    fastify.log.info('Successfully registered plugin: Eden2ThreadUpdates')
  } catch (err) {
    fastify.log.error('Failed to register plugin: Eden2ThreadUpdates', { err })
  }
}

export default registerEden2ThreadUpdates
