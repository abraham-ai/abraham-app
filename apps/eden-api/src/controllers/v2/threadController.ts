import { Agent } from '../../models/Agent'
import { User } from '../../models/User'
import { Thread as ThreadModel } from '../../models/v2/Thread'
import { QueryOptions } from '../../repositories/RestfulRepository'
import ThreadRepository from '../../repositories/ThreadRepository'
import { createIdOrSlugQuery } from '../../utils/mongoUtils'
import {
  TaskV2Status,
  ThreadsCreateArguments,
  ThreadsDeleteArguments,
  ThreadsGetArguments,
  ThreadsListArguments,
  ThreadsMessageReactArguments,
  ThreadsPinMessageArguments,
  ThreadsRenameArguments,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

export const createThreadMessage = async (
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

  const { thread_id, agent_id, content, attachments } =
    request.body as ThreadsCreateArguments

  if (!agent_id) {
    return reply.status(400).send({
      message: 'agent_id not provided',
    })
  }

  const query = createIdOrSlugQuery(agent_id)
  const agent = await Agent.findOne(query)

  if (!agent) {
    return reply.status(404).send({
      message: 'agent not found',
    })
  }

  const userDocument = await User.findById(userId)
  if (!userDocument) {
    return reply.status(404).send({
      message: `User not found`,
    })
  }

  const thread = await ThreadModel.findOne({
    _id: new ObjectId(thread_id),
  })

  if (thread && thread.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      message: 'You are not allowed to create a message in this thread',
    })
  }

  const modalRequest = {
    endpoint: `${server.config.EDEN_COMPUTE_API_URL}/chat`,
    data: {
      agent_id: agent._id,
      thread_id,
      user_message: {
        content,
        attachments,
      },
      user_id: userId,
      force_reply: true,
    },
    headers: {
      'X-Client-Platform': 'web',
      'X-Client-Agent': agent.username,
    },
  }

  server.log.info('> modal::request::chat')
  server.log.info(modalRequest)

  try {
    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )

    server.log.info('< modal::response::chat')
    server.log.info(modalResponse.data)

    if (!modalResponse) {
      server.log.error('empty response', modalResponse)
      return reply.status(500).send({
        message: `Empty response from compute api`,
      })
    }

    if (!modalResponse.data) {
      server.log.error(
        'malformed response, data missing from response',
        modalResponse,
      )
      return reply.status(500).send({
        message: `Unexpected response from compute api`,
      })
    }

    if (!modalResponse.data.thread_id) {
      server.log.error(
        'malformed response, thread_id missing from response',
        modalResponse,
      )
      return reply.status(500).send({
        message: `Missing thread_id`,
      })
    }

    // Get the message_id from the response
    const message_id =
      modalResponse.data.message_id || modalResponse.data.messages?.[0]?.id

    return reply.status(200).send({
      thread_id: modalResponse.data.thread_id,
      message_id,
    })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'
    console.log(e)
    server.log.error({
      message: 'Failed to create thread/message',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const listThreads = async (
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

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(404).send({
      message: `User not found`,
    })
  }

  const {
    limit = 25,
    page,
    sort,
    agent_id,
  } = request.query as ThreadsListArguments

  try {
    const agentQuery = {
      ...(agent_id ? createIdOrSlugQuery(agent_id) : {}),
      user: userId,
    }

    const agent = await Agent.findOne(agentQuery)

    // if (!agent) {
    //   return reply.status(404).send({
    //     message: 'Agent not found',
    //   })
    // }

    const queryOptions: QueryOptions = {
      select: '_id title name createdAt updatedAt user agent',
      limit,
      page,
      sort: {
        ...sort,
        updatedAt: -1,
        createdAt: -1,
      },
    }

    const threadsRepository = new ThreadRepository(ThreadModel)
    const threadQuery = {
      user: userId,
      agent: agent_id && agent ? agent._id : undefined,
    }

    const paginatedResponse = await threadsRepository.query(
      threadQuery,
      queryOptions,
    )

    await threadsRepository.model.populate(paginatedResponse.docs, {
      path: 'agent',
      select: '_id name username userImage',
    })

    return reply.status(200).send(paginatedResponse)
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({
      message: 'Failed to list threads',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const getThread = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { thread_id } = request.params as ThreadsGetArguments

  try {
    const thread = await ThreadModel.findOne({
      _id: new ObjectId(thread_id),
    })
      .populate({
        path: 'user',
        select: '_id username userId userImage',
      })
      .populate({
        path: 'agent',
        select: '_id username userImage',
      })
      .populate({
        path: 'messages.tool_calls.result.output.creation',
        model: 'creations3',
        select: '_id user mediaAttributes tool filename',
        populate: {
          path: 'user',
          model: 'users3',
          select: '_id username userImage',
        },
      })

    // console.log(thread)

    if (!thread) {
      return reply.status(404).send({
        message: 'Thread not found',
      })
    }

    const extendedMessages = thread.messages.map(msg => {
      if (msg.role !== 'assistant') {
        return msg
      }

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
    })

    thread.messages = extendedMessages

    return reply.status(200).send({ thread })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({
      message: 'Failed to get thread',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const addThreadMessageReaction = async (
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

  const { message_id, reaction } = request.body as ThreadsMessageReactArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  if (!message_id) {
    return reply.status(400).send({
      message: 'message_id not provided',
    })
  }

  if (!reaction) {
    return reply.status(400).send({
      message: 'reaction not provided',
    })
  }

  try {
    const query = {
      user: userId,
      'messages.id': new ObjectId(message_id),
    }

    const thread = await ThreadModel.findOne(query)

    if (reaction === 'thumbs_up') {
      const existingReactions =
        thread?.messages.find(m => {
          return m.id.toString() === message_id
        })?.reactions?.thumbs_up || []

      console.log({ existingReactions })

      if (
        existingReactions
          .map(reactingUserId => reactingUserId?.toString())
          .includes(userId.toString())
      ) {
        console.log('already reacted', 'remove', userId.toString())
        // User already reacted, remove the reaction
        await ThreadModel.updateOne(
          query,
          {
            $pull: { 'messages.$[msg].reactions.thumbs_up': userId },
          },
          {
            arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
          },
        )
      } else {
        console.log('not reacted', 'add', userId.toString())
        // User has not reacted, add the reaction
        await ThreadModel.updateOne(
          query,
          {
            $push: { 'messages.$[msg].reactions.thumbs_up': userId },
          },
          {
            arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
          },
        )
      }
    } else if (reaction === 'thumbs_down') {
      const existingReactions =
        thread?.messages.find(m => m.id.toString() === message_id)?.reactions
          ?.thumbs_down || []

      if (
        existingReactions
          .map(reactingUserId => reactingUserId?.toString())
          .includes(userId.toString())
      ) {
        // User already reacted, remove the reaction
        await ThreadModel.updateOne(
          query,
          {
            $pull: { 'messages.$[msg].reactions.thumbs_down': userId },
          },
          {
            arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
          },
        )
      } else {
        // User has not reacted, add the reaction
        await ThreadModel.updateOne(
          query,
          {
            $push: { 'messages.$[msg].reactions.thumbs_down': userId },
          },
          {
            arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
          },
        )
      }
    }

    return reply.status(200).send({ success: true })
  } catch (e) {
    console.log(e)
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({
      message: 'Failed to add thread message reaction',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const deleteThread = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { thread_id } = request.params as ThreadsDeleteArguments

  const thread = await ThreadModel.findOne({
    _id: new ObjectId(thread_id),
  })

  if (!thread || thread.deleted) {
    return reply.status(404).send({
      error: 'Thread not found',
    })
  }

  if (thread.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      error: 'You are not allowed to delete this thread',
    })
  }

  await thread.delete()

  return reply.status(200).send({ success: true })
}

export const renameThread = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { thread_id } = request.params as ThreadsRenameArguments
  const { title } = request.body as ThreadsRenameArguments

  if (!title) {
    return reply.status(400).send({
      error: 'Title not provided',
    })
  }

  const thread = await ThreadModel.findOne({
    _id: new ObjectId(thread_id),
  })

  if (!thread || thread.deleted) {
    return reply.status(404).send({
      error: 'Thread not found',
    })
  }

  if (thread.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      error: 'You are not allowed to rename this thread',
    })
  }

  await thread.updateOne({
    $set: {
      title: title,
    },
  })

  return reply.status(200).send({ success: true })
}

export const pinThreadMessage = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { message_id } = request.body as ThreadsPinMessageArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  if (!message_id) {
    return reply.status(400).send({
      message: 'message_id not provided',
    })
  }

  try {
    const query = {
      user: userId,
      'messages.id': new ObjectId(message_id),
    }

    console.log('pinning message', message_id, userId.toString())

    await ThreadModel.updateOne(
      query,
      {
        $set: { 'messages.$[msg].pinned': true },
      },
      {
        arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
      },
    )

    return reply.status(200).send({ success: true })
  } catch (e) {
    console.log(e)
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({
      message: 'Failed to pin thread message',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const unpinThreadMessage = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { message_id } = request.body as ThreadsPinMessageArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  if (!message_id) {
    return reply.status(400).send({
      message: 'message_id not provided',
    })
  }

  try {
    const query = {
      user: userId,
      'messages.id': new ObjectId(message_id),
    }

    console.log('pinning message', message_id, userId.toString())

    await ThreadModel.updateOne(
      query,
      {
        $set: { 'messages.$[msg].pinned': false },
      },
      {
        arrayFilters: [{ 'msg.id': new ObjectId(message_id) }],
      },
    )

    return reply.status(200).send({ success: true })
  } catch (e) {
    console.log(e)
    const error = e as { response?: { data?: string } }
    const errorMessage =
      error && error.response && error.response.data
        ? error.response.data
        : 'Unknown Error'

    server.log.error({
      message: 'Failed to pin thread message',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}
