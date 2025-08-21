import { taskRateLimitCheck, toolAccessCheck } from '../../lib/ratelimit'
import { User } from '../../models/User'
import { ModelV2 } from '../../models/v2/ModelV2'
import { SessionDocument } from '../../models/v2/SessionV2'
import { TaskV2Document, TaskV2 as TaskV2Model } from '../../models/v2/TaskV2'
import { ThreadDocument } from '../../models/v2/Thread'
import { ToolV2 } from '../../models/v2/ToolV2'
import { s3ThumbnailUrl, s3Url } from '../../plugins/s3Plugin'
import { QueryOptions } from '../../repositories/RestfulRepository'
import TaskV2Repository from '../../repositories/TaskV2Repository'
import { sendLoraTrainingCompletedEmail } from '../../utils/mailchimp'
import { verifyToken } from '@clerk/clerk-sdk-node'
import {
  MediaOutput,
  Message,
  TaskV2,
  TaskV2Result,
  TaskV2Status,
  TasksV2CancelArguments,
  TasksV2CreateArguments,
  TasksV2GetArguments,
  TasksV2ListArguments,
  ThreadMessage,
  ToolCall,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import { on } from 'events'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import WebSocket from 'ws'

export enum SocketClientEventName {
  Auth = 'auth',
  Ping = 'ping',
}

export enum ServerEventName {
  TaskUpdate = 'task-update',
  ThreadUpdate = 'thread-update',
  SessionUpdate = 'session-update',
  AuthInfo = 'auth-info',
  MessageError = 'message-error',
}

export const internalToolNameBlacklist = [
  'create_session',
  'search_agents',
  'search_models',
]

export type SocketClientEvent = {
  event: SocketClientEventName
  data?: { [key: string]: string }
}

export type SocketMetaData = {
  connectionId: string
  msgId: number
  isAuthenticated: boolean
  userId: null | string
  _id: null | string
}

export const createTask = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const timing = {
    start: performance.now(),
    modalStart: 0,
    modalEnd: 0,
  }

  try {
    // Add Server-Timing header
    reply.header('Server-Timing', '')

    const { userId } = request.user || {}
    if (!userId) {
      return reply.status(400).send({
        message: 'User missing from request',
      })
    }

    const { tool, args, makePublic } = request.body as TasksV2CreateArguments
    const toolDocument = await ToolV2.findOne({ key: tool, active: true })
    if (!toolDocument) {
      return reply.status(404).send({
        message: `Tool ${tool} not available`,
      })
    }

    const userDocument = await User.findById(userId)
    if (!userDocument) {
      return reply.status(404).send({
        message: `User not found`,
      })
    }

    const toolAccessCheckResult = await toolAccessCheck(request, toolDocument)
    if (!toolAccessCheckResult || toolAccessCheckResult.status !== 'ok') {
      return reply.status(403).send({
        message: toolAccessCheckResult.message,
      })
    }

    const rateLimitCheckResult = await taskRateLimitCheck(request, toolDocument)
    if (!rateLimitCheckResult || rateLimitCheckResult.status !== 'ok') {
      return reply.status(429).send({
        message: rateLimitCheckResult.message,
      })
    }

    console.log({
      tool,
      args,
      public: makePublic,
      user_id: userId,
    })

    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/create`,
      data: {
        tool,
        args,
        public: makePublic,
        user_id: userId,
      },
    }

    // if output type is lora, sanitize args.name to be url/filename safe
    if (toolDocument.output_type === 'lora') {
      args.name = args.name.replace(/[^a-zA-Z0-9]/g, '_')
    }

    if (args.lora) {
      const lora = await ModelV2.findById(args.lora)
      const isOwner = lora?.user.toString() === userId.toString()
      if (!isOwner && !lora?.public) {
        args.use_lora = false
        delete args.lora
        delete args.lora_strength
      }
    }

    timing.modalStart = performance.now()
    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )
    timing.modalEnd = performance.now()

    if (!modalResponse || !modalResponse.data) {
      console.log('malformed response', modalResponse)
      return reply.status(500).send({
        message: `Empty / Unexpected response from compute api`,
      })
    }

    const task = modalResponse.data as TaskV2

    const taskWithUrls =
      task && task.result
        ? {
            ...task,
            result: task.result.map(result =>
              injectResultUrls(server, result, task.output_type === 'lora'),
            ),
          }
        : task

    const end = performance.now()
    const internalDuration = timing.modalStart - timing.start
    const modalDuration = timing.modalEnd - timing.modalStart
    const totalDuration = end - timing.start

    reply.header(
      'Server-Timing',
      `total;dur=${totalDuration.toFixed(
        2,
      )}, internal;dur=${internalDuration.toFixed(
        2,
      )}, modal;dur=${modalDuration.toFixed(2)}`,
    )

    return reply.status(200).send({ task: taskWithUrls })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    const end = performance.now()
    const totalDuration = end - timing.start
    reply.header(
      'Server-Timing',
      `total;dur=${totalDuration.toFixed(2)};desc="Error"`,
    )

    server.log.error({ message: 'Failed to create task', error: errorMessage })
    return reply.status(500).send({ error: errorMessage })
  }
}

function getTypeQuery(tool: string | undefined, minDate: boolean | undefined) {
  const excludedTools = [
    'lora_trainer',
    'flux_trainer',
    ...internalToolNameBlacklist,
  ]

  // If minDate is provided, return empty query
  if (minDate) {
    return {
      tool: { $nin: excludedTools },
    }
  }

  const isModelTask = tool === 'lora_trainer' || tool === 'flux_trainer'

  // If tool is provided and is a model task, filter by that tool
  if (tool && isModelTask) {
    return { tool }
  }

  // Otherwise exclude model tasks and tools from internalToolNameBlacklist
  return {
    tool: { $nin: excludedTools },
  }
}

export const listTasks = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}

  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const {
    tool,
    status,
    taskId,
    limit = 25,
    page,
    sort,
    minDate,
  } = request.query as TasksV2ListArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const typeQuery = getTypeQuery(tool, minDate)

  const tasksRepository = new TaskV2Repository(TaskV2Model)

  const query: {
    user?: string
    status?: string | string[]
    taskId?: string | string[]
    tool?: string | { $nin?: string[]; $in?: string[] }
    createdAt?: { $gte: Date }
  } = {
    user: user._id.toString(),
    ...typeQuery,
  }

  if (status) {
    query.status = status
  }

  if (taskId) {
    query.taskId = taskId
  }

  if (minDate) {
    query.createdAt = {
      $gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
    }
  }

  if (query.tool) {
    if (typeof query.tool === 'object') {
      if (query.tool.$nin) {
        query.tool.$nin.push('twitter_mentions', 'tweet', 'twitter_search')
      } else {
        query.tool = {
          ...query.tool,
          $nin: ['twitter_mentions', 'tweet', 'twitter_search'],
        }
      }
    }
  } else {
    query.tool = { $nin: ['twitter_mentions', 'tweet', 'twitter_search'] }
  }

  const queryOptions: QueryOptions = {
    select: '',
    limit,
    page,
    sort: {
      ...sort,
      createdAt: -1,
    },
  }

  // remove training image urls from task args
  queryOptions.select = '-args.lora_training_urls'

  const paginatedResponse = await tasksRepository.query(query, queryOptions)

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.creation',
    model: 'creations3',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.creation.task',
    model: 'tasks3',
    select: '_id args',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.creation.user',
    model: 'users3',
    select: '_id username userId userImage',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.model',
    model: 'models3',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.model.task',
    model: 'tasks3',
    select: '_id args',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'result.output.model.user',
    model: 'users3',
    select: '_id username userId userImage',
  })

  await tasksRepository.model.populate(paginatedResponse.docs, {
    path: 'user',
    select: '_id username userId userImage',
  })

  paginatedResponse.docs.forEach(doc => {
    if (doc.result) {
      doc.result = doc.result.map(result =>
        injectResultUrls(server, result, doc.output_type === 'lora'),
      )
    }
  })

  return reply.status(200).send(paginatedResponse)
}

const injectUrlsToMediaOutput = (
  server: FastifyInstance,
  output: MediaOutput,
  isModelResult: boolean,
): MediaOutput => {
  if (!output.filename) {
    return output
  }

  const thumbnailName = isModelResult ? output.thumbnail || '' : output.filename
  const thumbnailSize = 1024 // get rid of this special handling once model thumbnails are in line with creations

  return {
    ...output,
    url: s3Url(server, output.filename),
    thumbnail: thumbnailName
      ? s3ThumbnailUrl(server, thumbnailName, thumbnailSize)
      : null,
  }
}

const injectResultUrls = (
  server: FastifyInstance,
  result: TaskV2Result,
  isModelResult: boolean,
): TaskV2Result => {
  if (!result.output) {
    return result
  }

  if (Array.isArray(result.output)) {
    result.output = result.output.map(output => {
      const thumbnailName = isModelResult
        ? output.model?.thumbnail || ''
        : output.filename

      const thumbnailSize = 1024 // get rid of this special handling once model thumbnails are in line with creations

      return {
        ...output,
        url: s3Url(server, output.filename),
        thumbnail: isModelResult
          ? output.model?.thumbnail
            ? s3Url(server, output.model?.thumbnail || '')
            : null
          : s3ThumbnailUrl(server, thumbnailName, thumbnailSize),
      }
    })
  }

  if (result.intermediate_outputs) {
    result.intermediate_outputs = Object.fromEntries(
      Object.entries(result.intermediate_outputs).map(
        ([key, partialResults]) => {
          // console.log(key, partialResults)
          if (Array.isArray(partialResults)) {
            return [
              key,
              partialResults.map(partialResult =>
                injectUrlsToMediaOutput(server, partialResult, isModelResult),
              ),
            ]
          }
          return [key, partialResults]
        },
      ),
    )
  }

  // console.log(JSON.stringify(result, null, 2))

  return result
}

export const getTask = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { taskId } = request.params as TasksV2GetArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const task = await TaskV2Model.findOne({
    _id: new ObjectId(taskId),
    user: userId,
  })
    .select('-args.lora_training_urls')
    .populate({
      path: 'user',
      select: '_id username userId userImage',
    })
    .populate({
      path: 'result.output.creation',
      model: 'creations3',
    })
    .populate({
      path: 'result.output.creation.task',
      model: 'tasks3',
      select: '_id args',
    })
    .populate({
      path: 'result.output.creation.user',
      model: 'users3',
      select: '_id username userId userImage',
    })
    .populate({
      path: 'result.output.model',
      model: 'models3',
    })
    .populate({
      path: 'result.output.model.task',
      model: 'tasks3',
      select: '_id args',
    })
    .populate({
      path: 'result.output.model.user',
      model: 'users3',
      select: '_id username userId userImage',
    })

  // console.log(task)

  if (!task) {
    return reply.status(404).send({
      message: 'Task not found',
    })
  }

  if (task.result) {
    task.result = task.result.map(result =>
      injectResultUrls(server, result, task.output_type === 'lora'),
    )
  }

  return reply.status(200).send({ task })
}

export const subscribeTaskUpdates = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { taskId } = request.query as {
    taskId?: string
  }

  if (!userId) {
    server.log.error(`User not found ${userId}`)
    return
  }

  const internalEmitterEventHandler = async (task: TaskV2Document) => {
    server.log.info({
      msg: 'subscribeTaskUpdates::internalEmitterEventHandler',
      task,
    })
    // server.log.info({ userId: userId, taskUser: task.user })

    // @todo: Could this be done more efficiently?
    // @todo: atm we'd publish events for all connected users internally to then discard all but one

    // ensure socket message is only sent to the intended recipient
    if (userId.toString() === task.user.toString()) {
      const taskWithUrls =
        task && task.result
          ? {
              ...task,
              result: task.result.map(result =>
                injectResultUrls(server, result, task.output_type === 'lora'),
              ),
            }
          : task

      // emit SSE Event
      server.eventEmitter.emit('SSE-task-update-v2', taskWithUrls)
    }
  }

  server.internalMessages.connection.on(
    'task-updates-v2',
    internalEmitterEventHandler,
  )

  reply.header('Connection', 'keep-alive')

  // send initial message
  reply.sse({
    event: 'init-ping',
    data: JSON.stringify({
      version: 'v2',
      rand: Math.random(),
      heartbeat: userId,
    }),
  })

  // keep the connection alive.
  const keepAliveTimer = setInterval(() => {
    // console.log('SSE keep alive', { event: 'keep-alive', data: JSON.stringify({ heartbeat: userId }) })
    reply.sse({
      event: 'keep-alive',
      data: JSON.stringify({
        version: 'v2',
        rand: Math.random(),
        heartbeat: userId,
      }),
    })
  }, 15000) // Send a keep-alive every 15 seconds

  reply.sse(
    // gather all accumulated emit calls for this tick
    (async function* (): AsyncGenerator<{
      event: string
      data: string
    }> {
      // server.log.info(`SSE V2 to user ${userId}`)
      try {
        // handle task update emits
        for await (const [event] of on(
          server.eventEmitter,
          'SSE-task-update-v2',
        )) {
          const taskUpdate = event as TaskV2
          // server.log.info({
          //   taskUpdate,
          //   userId,
          //   taskId,
          // })

          // if (taskId === 'all') {
          //   console.log(
          //     'YIELDING ALL TASK UPDATES',
          //     taskUpdate.user,
          //     taskUpdate._id,
          //     taskUpdate.status,
          //   )
          //   yield {
          //     event: 'task-update',
          //     data: JSON.stringify(taskUpdate),
          //   }
          // } else {
          if (
            taskUpdate.user.toString() === userId.toString() &&
            (!taskId || taskUpdate._id.toString() === taskId.toString())
          ) {
            // server.log.info('sending SSE V2 task update to', {
            //   event: 'task-update',
            //   data: JSON.stringify(taskUpdate),
            // })

            // send SSE message
            yield {
              event: 'task-update',
              data: JSON.stringify(taskUpdate),
            }
          }
          // }
        }
      } catch (e) {
        console.error(e)
      }
    })(),
  )

  request.socket.on('close', () => {
    // console.log('request socket close')`
    // console.log('CLEARING keepAliveTimer')
    clearInterval(keepAliveTimer)
    reply.raw.end()
    server.internalMessages.connection.off(
      // InternalMessagesQueues.TaskUpdatesV2,
      'task-updates-v2',
      internalEmitterEventHandler,
    )
  })
}

export const subscribeWebSocketUpdates = function wsHandler(
  this: FastifyInstance,
  socket: WebSocket.WebSocket,
) {
  const metaData: SocketMetaData = {
    connectionId: uuidv4(),
    msgId: 0,
    isAuthenticated: false,
    userId: null,
    _id: null,
  }

  // assume the connection to be unauthenticated by default
  try {
    // listen to internal message queue and forward task update events to the respective client
    const internalEmitterEventHandlerTaskUpdates = async (
      task: TaskV2Document,
    ) => {
      // console.log('internalEmitterEventHandler', metaData, task)

      if (!metaData.userId) {
        // this.log.error(`User not authenticated/not found - ${task.user}`)
        return
      }

      if (task.tool === 'chat') {
        return
      }

      // Send email notification when a Lora model has completed training
      if (
        task.status === 'completed' &&
        task.output_type === 'lora' &&
        task.result?.[0]?.output
      ) {
        try {
          // Get user details
          const user = await User.findById(task.user)
          if (user?.email) {
            const outputArray = task.result[0].output
            // Find the model in the output array
            const modelOutput = outputArray.find(output => output.model)

            if (modelOutput?.model) {
              const loraName =
                modelOutput.model.name || task.args?.name || 'Custom Lora'
              const loraId = modelOutput.model._id
              const loraUrl = loraId
                ? `${this.config.FRONTEND_URL}/models/${loraId}`
                : undefined

              // Send email notification
              await sendLoraTrainingCompletedEmail(
                this,
                user.email,
                loraName,
                loraUrl,
                user.username,
              )

              this.log.info(
                `Sent Lora completion email to ${user.email} for model ${loraName}`,
              )
            }
          }
        } catch (error) {
          this.log.error(`Error sending Lora completion email: ${error}`)
          // Don't rethrow - we don't want to interrupt the event flow
        }
      }

      // socket message is only sent to the intended recipient
      if (metaData?._id?.toString() === task.user.toString()) {
        const tasksRepository = new TaskV2Repository(TaskV2Model)
        await tasksRepository.model.populate(task, {
          path: 'result.output.creation',
          model: 'creations3',
        })

        await tasksRepository.model.populate(task, {
          path: 'result.output.creation.task',
          model: 'tasks3',
          select: '_id args',
        })

        await tasksRepository.model.populate(task, {
          path: 'result.output.creation.user',
          model: 'users3',
          select: '_id username userId userImage',
        })

        await tasksRepository.model.populate(task, {
          path: 'result.output.model',
          model: 'models3',
        })

        await tasksRepository.model.populate(task, {
          path: 'result.output.model.user',
          model: 'users3',
          select: '_id username userId userImage',
        })

        await tasksRepository.model.populate(task, {
          path: 'result.output.model.task',
          model: 'tasks3',
          select: '_id args',
        })

        await tasksRepository.model.populate(task, {
          path: 'user',
          model: 'users3',
          select: '_id username userId userImage',
        })

        // emit WS Event
        socket.send(
          JSON.stringify({
            event: ServerEventName.TaskUpdate,
            connectionId: metaData.connectionId,
            msgId: metaData.msgId,
            data: {
              task:
                task && task.result && Array.isArray(task.result)
                  ? {
                      ...task,
                      result: task.result.map(result =>
                        injectResultUrls(
                          this,
                          result,
                          task.output_type === 'lora',
                        ),
                      ),
                    }
                  : task,
            },
          }),
        )

        metaData.msgId += 1
      }
    }

    this.internalMessages.connection.on(
      // InternalMessagesQueues.TaskUpdatesV2,
      'task-updates-v2',
      internalEmitterEventHandlerTaskUpdates,
    )

    const internalEmitterEventHandlerThreadUpdates = async ({
      thread,
      newMessages,
    }: {
      thread: ThreadDocument
      newMessages: ThreadMessage[]
    }) => {
      if (!metaData.userId) {
        // this.log.error(`User not authenticated/not found - ${thread.user}`)
        return
      }

      // console.log(metaData)
      // const threadsRepository = new ThreadRepository(ThreadModel)

      if (!thread.user) {
        this.log.error(
          `Thread ${thread._id} has no user field, skipping update message`,
        )
        return
      }

      // socket message is only sent to the intended recipient
      if (metaData?._id?.toString() === thread.user.toString()) {
        this.log.info(
          `${ServerEventName.ThreadUpdate}: ${metaData.connectionId} - ${metaData.msgId} ${thread._id}`,
        )

        socket.send(
          JSON.stringify({
            event: ServerEventName.ThreadUpdate,
            msgId: metaData.msgId,
            connectionId: metaData.connectionId,
            data: newMessages
              ? {
                  newMessages: newMessages.map(msg => {
                    const hasPendingToolCalls =
                      msg.tool_calls?.length &&
                      msg.tool_calls?.some(
                        call =>
                          !call.status ||
                          call.status === TaskV2Status.Running ||
                          call.status === TaskV2Status.Pending,
                      )
                    return {
                      ...msg,
                      status: hasPendingToolCalls
                        ? { type: 'running' }
                        : { type: 'complete', reason: 'stop' },
                    }
                  }),
                  thread_id: thread._id,
                  title: thread.title,
                  active: thread.active,
                }
              : {
                  thread: thread,
                  thread_id: thread._id,
                  active: thread.active,
                },
          }),
        )

        metaData.msgId += 1
      }
    }

    this.internalMessages.connection.on(
      'thread-updates',
      internalEmitterEventHandlerThreadUpdates,
    )

    const internalEmitterEventHandlerSessionUpdates = async ({
      session,
      newMessages,
    }: {
      session: SessionDocument
      newMessages: Message[]
    }) => {
      // if (!metaData.userId) {
      //   // this.log.error(`User not authenticated/not found - ${thread.user}`)
      //   return
      // }

      if (!session.owner) {
        this.log.error(
          `Session ${session._id} has no owner field, skipping update message`,
        )
        return
      }

      // socket message is only sent to the intended recipient
      if (metaData?._id?.toString() === session.owner._id.toString()) {
        this.log.info(
          `${ServerEventName.SessionUpdate}: ${metaData.connectionId} - ${metaData.msgId} ${session._id}`,
        )

        socket.send(
          JSON.stringify({
            event: ServerEventName.SessionUpdate,
            msgId: metaData.msgId,
            connectionId: metaData.connectionId,
            data: newMessages
              ? {
                  newMessages: newMessages.map(msg => {
                    // Convert Mongoose document to plain object
                    const plainMsg = (msg as any).toJSON
                      ? (msg as any).toJSON()
                      : msg

                    const hasPendingToolCalls =
                      plainMsg.tool_calls?.length &&
                      plainMsg.tool_calls?.some(
                        (call: ToolCall) =>
                          !call.status ||
                          call.status === TaskV2Status.Running ||
                          call.status === TaskV2Status.Pending,
                      )
                    return {
                      ...plainMsg,
                      status: hasPendingToolCalls
                        ? { type: 'running' }
                        : { type: 'complete', reason: 'stop' },
                    }
                  }),
                  session_id: session._id,
                  title: session.title,
                }
              : {
                  session: session,
                  session_id: session._id,
                },
          }),
        )

        metaData.msgId += 1
      }
    }

    this.internalMessages.connection.on(
      'session-updates',
      internalEmitterEventHandlerSessionUpdates,
    )

    socket.on('message', async message => {
      try {
        const msgJson = JSON.parse(message.toString()) as SocketClientEvent

        if (!msgJson) {
          socket.send(
            JSON.stringify({
              event: ServerEventName.MessageError,
              data: {
                message: `onMessage::error - invalid msgJson - received message:  ${message.toString()}`,
              },
            }),
          )
          return
        }

        if (!msgJson.event) {
          socket.send(
            JSON.stringify({
              event: ServerEventName.MessageError,
              data: {
                message: `onMessage::error - missing event name - received message: ${message.toString()}`,
              },
            }),
          )
          return
        }

        // Handle ping messages
        if (msgJson.event === SocketClientEventName.Ping) {
          socket.send(
            JSON.stringify({
              event: 'pong',
              data: {
                ts: Date.now(),
              },
            }),
          )
          return
        }

        // handle auth event
        if (
          msgJson.event === SocketClientEventName.Auth &&
          msgJson.data &&
          msgJson.data.userId &&
          msgJson.data.token
        ) {
          // console.log(
          //   'WS:',
          //   metaData.connectionId,
          //   '[ Received auth event ]',
          //   msgJson.data?.userId,
          // )
          const tokenClaims = await verifyToken(msgJson.data.token, {
            authorizedParties: [
              this.config.FRONTEND_URL,
              this.config.API_URL,
              this.config.EDEN2_FRONTEND_URL,
            ],
            jwtKey: this.config.CLERK_JWT_KEY,
          })

          // check that claims resolved and that resolved userId (sub) matches what the client passed
          if (!tokenClaims || tokenClaims.sub !== msgJson.data.userId) {
            metaData.isAuthenticated = false
            metaData.userId = null
            socket.send(
              JSON.stringify({
                event: ServerEventName.AuthInfo,
                data: {
                  message: `onMessage::error | invalid token - received message: ${message.toString()}`,
                },
              }),
            )
            return
          }

          const userDocument = await User.findOne({
            userId: msgJson.data.userId,
          })

          if (!userDocument) {
            socket.send(
              JSON.stringify({
                event: ServerEventName.AuthInfo,
                data: {
                  message: `onMessage::error - user ${msgJson.data.userId} not found`,
                },
              }),
            )
            return
          }

          metaData.isAuthenticated = true
          metaData.userId = msgJson.data.userId
          metaData._id = userDocument._id
          // console.log(
          //   'WS:',
          //   metaData.connectionId,
          //   '[ Authenticated ]',
          //   metaData.userId,
          // )
          socket.send(
            JSON.stringify({
              event: ServerEventName.AuthInfo,
              data: {
                message: `onMessage::success - authenticated - ${metaData.userId}, ${metaData.connectionId}`,
              },
            }),
          )
          return
        }

        // authentication guard
        if (!metaData.isAuthenticated) {
          socket.send(
            JSON.stringify({
              event: ServerEventName.AuthInfo,
              data: {
                message: `onMessage::error - not authenticated - received message: ${message.toString()}`,
              },
            }),
          )
          return
        }

        // assume authenticated socket from here on
        // console.log('onMessage', msgJson)
        // socket.send(
        //   `server echo: ${message.toString()} ${JSON.stringify(metaData)}`,
        // )
      } catch (e) {
        console.error('Caught error in websocket onMessage handler', e)
        socket.send(
          JSON.stringify({
            event: ServerEventName.MessageError,
            data: { message: `onMessage::error - caught ${e}` },
          }),
        )
      }
    })

    // clean up on socket close
    socket.on('close', () => {
      this.internalMessages.connection.removeListener(
        'task-updates-v2',
        internalEmitterEventHandlerTaskUpdates,
      )
      this.internalMessages.connection.removeListener(
        'thread-updates',
        internalEmitterEventHandlerThreadUpdates,
      )
      this.internalMessages.connection.removeListener(
        'session-updates',
        internalEmitterEventHandlerSessionUpdates,
      )
    })
  } catch (e) {
    console.log('Caught error subscribeWebSocketTaskUpdates', e)
  }
}

export const cancelTask = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { taskId } = request.body as TasksV2CancelArguments

  if (!taskId) {
    return reply.status(400).send({
      message: `TaskId missing`,
    })
  }

  const userDocument = await User.findById(userId)
  if (!userDocument) {
    return reply.status(404).send({
      message: `User not found`,
    })
  }

  try {
    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/cancel`,
      // @todo: remove duplication after compute api is updated
      data: {
        taskId,
        task_id: taskId,
        user: userDocument._id,
        user_id: userDocument._id,
      },
    }

    server.log.info('> modal::request::cancel')
    server.log.info(modalRequest)

    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )

    server.log.info('< modal::response::cancel')
    server.log.info(modalResponse.data)

    if (!modalResponse || !modalResponse.data) {
      console.log('malformed response', modalResponse)
      return reply.status(500).send({
        message: `Empty / Unexpected response from compute api`,
      })
    }

    const taskStatus = modalResponse.data.status as TaskV2Status

    return reply.status(200).send({ taskStatus })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({ message: 'Failed to cancel task', error: errorMessage })
    return reply.status(500).send({ error: errorMessage })
  }
}
