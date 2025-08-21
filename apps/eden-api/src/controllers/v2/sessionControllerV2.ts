import { Agent } from '../../models/Agent'
import { User } from '../../models/User'
import { Message } from '../../models/v2/Message'
import { SessionShare } from '../../models/v2/SessionShareV2'
import { Session } from '../../models/v2/SessionV2'
import { QueryOptions } from '../../repositories/RestfulRepository'
import SessionRepository from '../../repositories/SessionRepository'
import { createIdOrSlugQuery } from '../../utils/mongoUtils'
import {
  SessionsV2CreateArguments,
  SessionsV2DeleteArguments,
  SessionsV2GetArguments,
  SessionsV2ListArguments,
  SessionsV2MessageArguments,
  SessionsV2MessageReactArguments,
  SessionsV2RenameArguments,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

// Helper function to create eden messages for agent operations
const createEdenMessage = async (
  sessionId: ObjectId,
  messageType: 'agent_add' | 'agent_remove',
  agents: any[],
) => {
  const edenMessage = new Message({
    session: sessionId,
    sender: new ObjectId('000000000000000000000000'), // System sender
    role: 'eden',
    content: '',
    eden_message_data: {
      message_type: messageType,
      agents: agents.map(agent => ({
        id: agent._id,
        name: agent.name || agent.username,
        avatar: agent.userImage,
      })),
    },
  })

  await edenMessage.save()
  return edenMessage
}

export const createSession = async (
  server: FastifyInstance,
  request: FastifyRequest<{ Body: SessionsV2CreateArguments }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { agent_ids, scenario, budget, title, autonomy_settings } = request.body

  // Validation
  if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
    return reply.status(400).send({
      message: 'agent_ids must be a non-empty array',
    })
  }

  if (
    scenario !== undefined &&
    (typeof scenario !== 'string' || scenario.length > 1000)
  ) {
    return reply.status(400).send({
      message: 'scenario must be a string with max 1000 characters',
    })
  }

  // Updated budget validation
  if (budget !== undefined) {
    if (typeof budget !== 'object') {
      return reply.status(400).send({
        message: 'budget must be an object',
      })
    }

    if (
      budget.manna_budget !== undefined &&
      (typeof budget.manna_budget !== 'number' ||
        budget.manna_budget < 100 ||
        budget.manna_budget > 50000)
    ) {
      return reply.status(400).send({
        message: 'manna_budget must be a number between 100 and 50000',
      })
    }

    if (
      budget.token_budget !== undefined &&
      (typeof budget.token_budget !== 'number' ||
        budget.token_budget < 1000 ||
        budget.token_budget > 1000000)
    ) {
      return reply.status(400).send({
        message: 'token_budget must be a number between 1000 and 1000000',
      })
    }

    if (
      budget.turn_budget !== undefined &&
      (typeof budget.turn_budget !== 'number' ||
        budget.turn_budget < 1 ||
        budget.turn_budget > 1000)
    ) {
      return reply.status(400).send({
        message: 'turn_budget must be a number between 1 and 1000',
      })
    }
  }

  if (
    title !== undefined &&
    (typeof title !== 'string' || title.length > 1000)
  ) {
    return reply.status(400).send({
      message: 'title must be a string with max 1000 characters',
    })
  }

  // Validate autonomy_settings
  if (autonomy_settings !== undefined) {
    if (typeof autonomy_settings !== 'object') {
      return reply.status(400).send({
        message: 'autonomy_settings must be an object',
      })
    }

    if (
      autonomy_settings.auto_reply !== undefined &&
      typeof autonomy_settings.auto_reply !== 'boolean'
    ) {
      return reply.status(400).send({
        message: 'auto_reply must be a boolean',
      })
    }

    if (
      autonomy_settings.reply_interval !== undefined &&
      (typeof autonomy_settings.reply_interval !== 'number' ||
        autonomy_settings.reply_interval < 0 ||
        autonomy_settings.reply_interval > 3600)
    ) {
      return reply.status(400).send({
        message: 'reply_interval must be a number between 0 and 3600',
      })
    }

    if (
      autonomy_settings.actor_selection_method !== undefined &&
      !['random', 'random_exclude_last'].includes(
        autonomy_settings.actor_selection_method,
      )
    ) {
      return reply.status(400).send({
        message:
          'actor_selection_method must be "random" or "random_exclude_last"',
      })
    }
  }

  try {
    const userDocument = await User.findById(userId)
    if (!userDocument) {
      return reply.status(404).send({
        message: 'User not found',
      })
    }

    // Validate that all agent IDs are valid ObjectIds
    const validAgentIds = agent_ids.map(id => {
      try {
        return new ObjectId(id)
      } catch (error) {
        throw new Error(`Invalid agent ID format: ${id}`)
      }
    })

    // Validate that all agents exist
    const existingAgents = await Agent.find({ _id: { $in: validAgentIds } })
    if (existingAgents.length !== validAgentIds.length) {
      return reply.status(400).send({
        message: 'One or more agent IDs do not exist',
      })
    }

    // Create the session
    const sessionData: any = {
      owner: userId,
      agents: validAgentIds,
      messages: [],
      title,
    }

    if (scenario) {
      sessionData.scenario = scenario
    }

    if (budget) {
      sessionData.budget = {
        token_budget: budget.token_budget,
        manna_budget: budget.manna_budget,
        turn_budget: budget.turn_budget,
        tokens_spent: 0,
        manna_spent: 0,
        turns_spent: 0,
      }
    }

    if (autonomy_settings) {
      sessionData.autonomy_settings = autonomy_settings
    }

    const session = new Session(sessionData)

    // Create an eden message for agent additions
    const edenMessage = await createEdenMessage(
      session._id,
      'agent_add',
      existingAgents,
    )
    session.messages.push(edenMessage.id)
    await session.save()

    // Populate the session with agent and owner data
    const populatedSession = await Session.findById(session._id)
      .populate({
        path: 'owner',
        select: '_id username userId userImage',
      })
      .populate({
        path: 'users',
        select: '_id username userImage',
      })
      .populate({
        path: 'agents',
        select: '_id username userImage name description',
      })

    if (!populatedSession) {
      return reply.status(500).send({
        message: 'Failed to retrieve created session',
      })
    }

    return reply.status(201).send({
      success: true,
      session: populatedSession,
    })
  } catch (error) {
    server.log.error({
      message: 'Failed to create session',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return reply.status(500).send({
      message:
        error instanceof Error ? error.message : 'Failed to create session',
    })
  }
}

export const createSessionMessage = async (
  server: FastifyInstance,
  request: FastifyRequest<{
    Body: SessionsV2MessageArguments & {
      stream?: boolean
      agent_ids?: string[]
      scenario?: string
      budget?: {
        manna_budget?: number
        token_budget?: number
        turn_budget?: number
      }
      title?: string
      autonomy_settings?: {
        auto_reply: boolean
        reply_interval: number
        actor_selection_method: 'random' | 'random_exclude_last'
      }
    }
  }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const {
    session_id,
    content,
    attachments,
    stream,
    agent_ids,
    scenario,
    budget,
    title,
    autonomy_settings,
  } = request.body

  let session: any = null
  let sessionId = session_id

  // If no session_id provided, create a new session
  if (!session_id) {
    if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return reply.status(400).send({
        message: 'agent_ids must be provided when creating a new session',
      })
    }

    // Validate agent IDs
    const validAgentIds = agent_ids.map(id => {
      try {
        return new ObjectId(id)
      } catch (error) {
        throw new Error(`Invalid agent ID format: ${id}`)
      }
    })

    // Validate that all agents exist
    const existingAgents = await Agent.find({ _id: { $in: validAgentIds } })
    if (existingAgents.length !== validAgentIds.length) {
      return reply.status(400).send({
        message: 'One or more agent IDs do not exist',
      })
    }

    // Create the session
    const sessionData: any = {
      owner: userId,
      agents: validAgentIds,
      messages: [],
      title,
    }

    if (scenario) {
      sessionData.scenario = scenario
    }

    if (budget) {
      sessionData.budget = {
        token_budget: budget.token_budget,
        manna_budget: budget.manna_budget,
        turn_budget: budget.turn_budget,
        tokens_spent: 0,
        manna_spent: 0,
        turns_spent: 0,
      }
    }

    if (autonomy_settings) {
      sessionData.autonomy_settings = autonomy_settings
    }

    session = new Session(sessionData)

    // Create an eden message for agent additions
    const edenMessage = await createEdenMessage(
      session._id,
      'agent_add',
      existingAgents,
    )
    session.messages.push(edenMessage.id)
    await session.save()

    sessionId = session._id.toString()
  } else {
    // Find existing session
    const query = createIdOrSlugQuery(session_id)
    session = await Session.findOne(query)

    if (!session) {
      return reply.status(404).send({
        message: 'session not found',
      })
    }

    // Check if user has access to the session (owner or in users list)
    const currentUserIdStr = userId.toString()
    const isOwner = session.owner.toString() === currentUserIdStr
    const isAllowedUser = session.users?.some(
      (user: any) => user.toString() === currentUserIdStr,
    )

    if (!isOwner && !isAllowedUser) {
      return reply.status(403).send({
        message: 'You do not have access to this session',
      })
    }
  }

  const userDocument = await User.findById(userId)
  if (!userDocument) {
    return reply.status(404).send({
      message: `User not found`,
    })
  }

  const modalRequest = {
    endpoint: `${server.config.EDEN_COMPUTE_API_URL}/sessions/prompt`,
    data: {
      session_id: sessionId,
      message: {
        content,
        attachments,
      },
      user_id: userId,
      stream: stream || false,
      // Include agent_ids from request body if provided (for multi-agent targeting)
      ...(agent_ids && { actor_agent_ids: agent_ids }),
    },
    headers: {
      'X-Client-Platform': 'web',
      'X-Client-Deployment-Id': session.id,
    },
  }

  try {
    if (stream) {
      // Set up SSE headers for streaming
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      const response = await axios.post(
        modalRequest.endpoint,
        modalRequest.data,
        {
          headers: {
            Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
          },
          responseType: 'stream',
        },
      )

      // Pipe the stream from the compute API to the client
      response.data.on('data', (chunk: Buffer) => {
        reply.raw.write(chunk)
      })

      response.data.on('end', () => {
        reply.raw.end()
      })

      response.data.on('error', (error: Error) => {
        console.error('Stream error:', error)
        reply.raw.write(
          `data: ${JSON.stringify({
            event: 'error',
            data: { error: error.message },
          })}\n\n`,
        )
        reply.raw.end()
      })
    } else {
      // Non-streaming response
      const modalResponse = await axios.post(
        modalRequest.endpoint,
        modalRequest.data,
        {
          headers: {
            Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
          },
        },
      )

      if (!modalResponse?.data?.session_id) {
        return reply.status(500).send({
          message: `Missing session_id`,
        })
      }

      const message_id =
        modalResponse.data.message_id || modalResponse.data.messages?.[0]?.id

      return reply.status(200).send({
        session_id: modalResponse.data.session_id,
        message_id,
      })
    }
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage = error?.response?.data || 'Unknown Error'
    console.log(e)

    if (stream) {
      reply.raw.write(
        `data: ${JSON.stringify({
          event: 'error',
          data: { error: errorMessage },
        })}\n\n`,
      )
      reply.raw.end()
    } else {
      return reply.status(500).send({ error: errorMessage })
    }
  }
}

export const listSessions = async (
  server: FastifyInstance,
  request: FastifyRequest<{ Querystring: SessionsV2ListArguments }>,
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

  const { limit = 25, page, sort, agent_id } = request.query

  try {
    const queryOptions: QueryOptions = {
      select: '_id title name createdAt updatedAt trigger agents users',
      limit,
      page,
      sort: {
        ...sort,
        updatedAt: -1,
        createdAt: -1,
      },
      populate: [
        {
          path: 'agents',
          select: '_id username userImage name',
        },
        {
          path: 'users',
          select: '_id username userImage',
        },
      ],
    }

    const sessionsRepository = new SessionRepository(Session)
    const sessionQuery: any = {
      $or: [{ owner: userId }, { users: userId }],
    }

    // Add agent filter if provided - look up agent by username first
    if (agent_id) {
      const agent = await Agent.findOne({ username: agent_id })
      if (!agent) {
        return reply.status(404).send({
          message: 'Agent not found',
        })
      }
      sessionQuery.agents = agent._id
    }

    const paginatedResponse = await sessionsRepository.query(
      sessionQuery,
      queryOptions,
    )

    return reply.status(200).send(paginatedResponse)
  } catch (e) {
    console.log(e)

    const error = e as { response?: { data?: string } }
    const errorMessage = error?.response?.data || 'Unknown Error'

    server.log.error({
      message: 'Failed to list sessions',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const getSession = async (
  server: FastifyInstance,
  request: FastifyRequest<{ Params: SessionsV2GetArguments }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { session_id } = request.params

  try {
    const session = await Session.findOne({
      _id: new ObjectId(session_id as string),
    })
      .populate({
        path: 'owner',
        select: '_id username userId userImage',
      })
      .populate({
        path: 'users',
        select: '_id username userImage',
      })
      .populate({
        path: 'agents',
        select: '_id username userImage',
      })
      .populate({
        path: 'messages',
        select:
          '_id content sender role eden_message_data tool_calls attachments createdAt reactions',
        populate: {
          path: 'sender',
          select: '_id username userImage',
        },
      })

    if (!session) {
      return reply.status(404).send({
        message: 'Session not found',
      })
    }

    // Check if user has access to the session (owner or in users list)
    const getSessionUserIdStr = userId.toString()
    const isSessionOwner = session.owner._id.toString() === getSessionUserIdStr
    const isSessionUser = session.users?.some(
      (user: any) => user.toString() === getSessionUserIdStr,
    )

    if (!isSessionOwner && !isSessionUser) {
      return reply.status(403).send({
        message: 'You do not have access to this session',
      })
    }

    return reply.status(200).send({ session })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage = error?.response?.data || 'Unknown Error'

    server.log.error({
      message: 'Failed to get session',
      error: errorMessage,
    })
    return reply.status(500).send({ error: errorMessage })
  }
}

export const addSessionMessageReaction = async (
  request: FastifyRequest<{ Body: SessionsV2MessageReactArguments }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { message_id, reaction } = request.body

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

  const message = await Message.findOne({
    _id: new ObjectId(message_id as string),
  })

  if (!message) {
    return reply.status(404).send({
      message: 'Message not found',
    })
  }

  // Find the session to check access
  const session = await Session.findOne({
    _id: message.session,
  })

  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  // Check if user has access to the session (owner or in users list)
  const reactionUserIdStr = userId.toString()
  const isSessionOwner = session.owner.toString() === reactionUserIdStr
  const isSessionUser = session.users?.some(
    (user: any) => user.toString() === reactionUserIdStr,
  )

  if (!isSessionOwner && !isSessionUser) {
    return reply.status(403).send({
      message: 'You do not have access to this session',
    })
  }

  // Initialize reactions if it doesn't exist
  if (!message.reactions) {
    message.reactions = {}
  }

  const userIdStr = userId.toString()
  const existingReactions = message.reactions[userIdStr] || []

  // Handle reaction toggle
  if (existingReactions.includes(reaction)) {
    // Remove the reaction if it exists
    message.reactions[userIdStr] = existingReactions.filter(r => r !== reaction)
  } else {
    // Add the reaction if it doesn't exist
    let newReactions = [...existingReactions, reaction]

    // Handle mutually exclusive thumbs up/down
    if (reaction === 'thumbs_up') {
      newReactions = newReactions.filter(r => r !== 'thumbs_down')
    } else if (reaction === 'thumbs_down') {
      newReactions = newReactions.filter(r => r !== 'thumbs_up')
    }

    message.reactions[userIdStr] = newReactions
  }

  // If the user has no reactions left, remove their entry
  if (message.reactions[userIdStr].length === 0) {
    delete message.reactions[userIdStr]
  }

  // Use markModified to ensure Mongoose knows the mixed type field was changed
  message.markModified('reactions')
  await message.save()

  return reply.status(200).send({ success: true, message })
}

export const deleteSession = async (
  request: FastifyRequest<{ Params: SessionsV2DeleteArguments }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { session_id } = request.params

  const session = await Session.findOne({
    _id: new ObjectId(session_id as string),
  })

  if (!session || session.deleted) {
    return reply.status(404).send({
      error: 'Session not found',
    })
  }

  if (session.owner.toString() !== userId.toString()) {
    return reply.status(401).send({
      error: 'You are not allowed to delete this session',
    })
  }

  await session.delete()

  return reply.status(200).send({ success: true })
}

export const renameSession = async (
  request: FastifyRequest<{
    Params: Pick<SessionsV2RenameArguments, 'session_id'>
    Body: Pick<SessionsV2RenameArguments, 'title'>
  }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { session_id } = request.params
  const { title } = request.body

  if (!title) {
    return reply.status(400).send({
      error: 'Title not provided',
    })
  }

  const session = await Session.findOne({
    _id: new ObjectId(session_id as string),
  })

  if (!session || session.deleted) {
    return reply.status(404).send({
      error: 'Session not found',
    })
  }

  if (session.owner.toString() !== userId.toString()) {
    return reply.status(401).send({
      error: 'You are not allowed to rename this session',
    })
  }

  await session.updateOne({
    $set: {
      title: title,
    },
  })

  return reply.status(200).send({ success: true })
}

export const cancelSession = async (
  server: FastifyInstance,
  request: FastifyRequest<{
    Params: { session_id: string }
    Body?: {
      tool_call_id?: string
      tool_call_index?: number
    }
  }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { session_id } = request.params

  const session = await Session.findOne({
    _id: new ObjectId(session_id as string),
  })

  if (!session || session.deleted) {
    return reply.status(404).send({
      error: 'Session not found',
    })
  }

  if (session.owner.toString() !== userId.toString()) {
    return reply.status(401).send({
      error: 'You are not allowed to cancel this session',
    })
  }

  try {
    // Send cancel request to the Python API
    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/sessions/cancel`,
      data: {
        session_id,
        user_id: userId,
        ...(request.body?.tool_call_id && {
          tool_call_id: request.body.tool_call_id,
        }),
        ...(request.body?.tool_call_index !== undefined && {
          tool_call_index: request.body.tool_call_index,
        }),
      },
    }

    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )

    return reply.status(200).send({
      status: modalResponse.data.status || 'cancel_signal_sent',
      session_id,
    })
  } catch (e) {
    const error = e as { response?: { data?: string } }
    const errorMessage = error?.response?.data || 'Failed to cancel session'
    console.log(e)
    return reply.status(500).send({ error: errorMessage })
  }
}

export const createSessionShare = async (
  server: FastifyInstance,
  request: FastifyRequest<{
    Params: { session_id: string }
    Body: { message_id: string; title?: string }
  }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { session_id } = request.params
  const { message_id, title } = request.body

  if (!message_id) {
    return reply.status(400).send({
      error: 'message_id is required',
    })
  }

  if (title && (typeof title !== 'string' || title.length > 200)) {
    return reply.status(400).send({
      error: 'title must be a string with max 200 characters',
    })
  }

  try {
    // Find the session and verify ownership
    const session = await Session.findOne({
      _id: new ObjectId(session_id),
    })

    if (!session) {
      return reply.status(404).send({
        error: 'Session not found',
      })
    }

    if (session.owner.toString() !== userId.toString()) {
      return reply.status(403).send({
        error: 'Only session owner can create shares',
      })
    }

    // Verify the message exists and belongs to this session
    const message = await Message.findOne({
      _id: new ObjectId(message_id),
      session: session._id,
    })

    if (!message) {
      return reply.status(404).send({
        error: 'Message not found in this session',
      })
    }

    // Create the share
    const sessionShare = new SessionShare({
      session: session._id,
      owner: userId,
      message_id: new ObjectId(message_id),
      title: title || undefined,
    })

    await sessionShare.save()

    return reply.status(201).send({
      success: true,
      share_id: sessionShare._id.toString(),
      share_url: `/sessions/share/${sessionShare._id.toString()}`,
    })
  } catch (error) {
    server.log.error({
      message: 'Failed to create session share',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return reply.status(500).send({
      error: 'Failed to create session share',
    })
  }
}

export const getSharedSession = async (
  server: FastifyInstance,
  request: FastifyRequest<{ Params: { share_id: string } }>,
  reply: FastifyReply,
) => {
  const { share_id } = request.params

  try {
    // Find the share by ObjectId
    const sessionShare = await SessionShare.findById(share_id)
      .populate({
        path: 'session',
        select: '_id title scenario agents createdAt',
        populate: [
          {
            path: 'agents',
            select: '_id username userImage name description',
          },
        ],
      })
      .populate({
        path: 'owner',
        select: '_id username userImage',
      })

    if (!sessionShare) {
      return reply.status(404).send({
        error: 'Shared session not found',
      })
    }

    // Get messages up to the shared message (inclusive)
    const messages = await Message.find({
      session: sessionShare.session._id,
      createdAt: {
        $lte: (await Message.findById(sessionShare.message_id))?.createdAt,
      },
    })
      .populate({
        path: 'sender',
        select: '_id username userImage name',
      })
      .sort({ createdAt: 1 })
      .select(
        '_id content sender role eden_message_data tool_calls attachments createdAt',
      )

    return reply.status(200).send({
      share: {
        share_id: sessionShare._id.toString(),
        title: sessionShare.title,
        session: sessionShare.session,
        messages,
        owner: sessionShare.owner,
        createdAt: sessionShare.createdAt,
      },
    })
  } catch (error) {
    server.log.error({
      message: 'Failed to get shared session',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return reply.status(500).send({
      error: 'Failed to get shared session',
    })
  }
}

export const deleteSessionShare = async (
  server: FastifyInstance,
  request: FastifyRequest<{ Params: { share_id: string } }>,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      error: 'User missing from request',
    })
  }

  const { share_id } = request.params

  try {
    const sessionShare = await SessionShare.findById(share_id)

    if (!sessionShare) {
      return reply.status(404).send({
        error: 'Share not found',
      })
    }

    if (sessionShare.owner.toString() !== userId.toString()) {
      return reply.status(403).send({
        error: 'Only share owner can delete this share',
      })
    }

    await sessionShare.delete()

    return reply.status(200).send({
      success: true,
    })
  } catch (error) {
    server.log.error({
      message: 'Failed to delete session share',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return reply.status(500).send({
      error: 'Failed to delete session share',
    })
  }
}
