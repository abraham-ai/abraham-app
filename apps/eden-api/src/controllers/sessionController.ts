import { Character } from '../models/Character'
import { Session } from '../models/Session'
import { SessionEvent } from '../models/SessionEvent'
import { User } from '../models/User'
import CreatorRepository from '../repositories/CreatorRepository'
import SessionEventRepository from '../repositories/SessionEventRepository'
import SessionRepository from '../repositories/SessionRepository'
import {
  ChatResponseEvent,
  InteractionEvent,
  SessionEventType,
  SessionEventsListArguments,
  SessionsAddCharactersArguments,
  SessionsAddUsersArguments,
  SessionsDeleteArguments,
  SessionsGetArguments,
  SessionsInteractArguments,
  SessionsListArguments,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export const createSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user

  const input = {
    user: userId,
  }

  const sessionRepository = new SessionRepository(Session)
  const session = await sessionRepository.create(input)

  return reply.status(200).send({
    sessionId: session._id,
  })
}

export const deleteSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { sessionId } = request.body as SessionsDeleteArguments

  if (!sessionId) {
    return reply.status(400).send({
      message: 'You must provide an sessionId',
    })
  }

  const dbSession = await Session.findOne({
    sessionId,
    user: userId,
  })

  if (!dbSession) {
    return reply.status(401).send({
      message: 'Session not found',
    })
  }

  await dbSession.delete()

  return reply.status(200).send({})
}

export const listSessions = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, limit, page, sort } = request.query as SessionsListArguments

  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    userId,
  })

  const sessionRepository = new SessionRepository(Session)
  const sessionPaginatedResponse = await sessionRepository.query(
    {
      user:
        creators.docs.length > 0
          ? creators.docs.map(creator => creator._id)
          : undefined,
    },
    {
      limit,
      page,
      sort,
    },
  )

  const response = {
    ...sessionPaginatedResponse,
    docs: sessionPaginatedResponse.docs.map(session => ({
      id: session._id,
      user: session.user,
      characters: session.characters,
      users: session.users,
    })),
  }

  return reply.status(200).send(response)
}

export const getSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { sessionId } = request.params as SessionsGetArguments
  const session = await Session.findById(sessionId)
    .populate('users')
    .populate('characters')
  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  const response = {
    id: session._id,
    user: session.user,
    characters: session.characters,
    users: session.users,
  }

  return reply.status(200).send({ session: response })
}

export const getSessionEvents = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { sessionId, limit, page, sort } =
    request.params as SessionEventsListArguments
  const session = await Session.findOne({ sessionId })
  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  const sessionEventsRepository = new SessionEventRepository(SessionEvent)
  const sessionEventsPaginatedResponse = await sessionEventsRepository.query(
    {
      session: session._id,
    },
    {
      limit,
      page,
      sort,
    },
  )

  const response = {
    ...sessionEventsPaginatedResponse,
    docs: sessionEventsPaginatedResponse.docs.map(sessionEvent => ({
      id: sessionEvent._id,
      type: sessionEvent.type,
      data: sessionEvent.data,
    })),
  }

  return reply.status(200).send(response)
}

export const interactSession = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const args = request.body as SessionsInteractArguments
  const { session_id, character_id, message, attachments } = args

  const session = await Session.findById(session_id)
  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  const interactionEventData: InteractionEvent = {
    character: character_id,
    message,
    attachments,
  }
  const interactionEvent = await SessionEvent.create({
    session: session._id,
    type: SessionEventType.INTERACTION,
    data: interactionEventData,
  })

  // TODO: Check if user is allowed to interact with session

  const { message: responseMessage, config } = await server.handleInteraction(
    server,
    args,
  )

  const eventData: ChatResponseEvent = {
    interaction: interactionEvent._id,
    message: responseMessage,
  }

  await SessionEvent.create({
    session: session._id,
    type: SessionEventType.CHAT_RESPONSE,
    data: eventData,
  })

  reply.status(200).send({
    message: responseMessage,
    config,
  })
}

export const addUsersToSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { sessionId, userIds } = request.body as SessionsAddUsersArguments

  const session = await Session.findById(sessionId)
  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  const users = await User.find({
    userId: userIds,
  })

  // Check that all users exist
  if (users.length !== userIds.length) {
    return reply.status(404).send({
      message: 'Some users not found',
    })
  }

  const event = {
    session: session._id,
    type: SessionEventType.USERS_ADD,
    data: {
      usersAdded: {
        users: users.map(user => user._id),
      },
    },
  }

  await SessionEvent.create(event)
  await session.updateOne({
    users: [...session.users, ...users.map(user => user._id)],
  })

  return reply.status(200).send({})
}

export const addCharactersToSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { sessionId, characterIds } =
    request.body as SessionsAddCharactersArguments

  const session = await Session.findById(sessionId)
  if (!session) {
    return reply.status(404).send({
      message: 'Session not found',
    })
  }

  const characters = await Character.find({
    _id: characterIds,
  })

  // Check that all characters exist
  if (characters.length !== characterIds.length) {
    return reply.status(404).send({
      message: 'Some characters not found',
    })
  }

  const event = {
    session: session._id,
    type: SessionEventType.CHARACTERS_ADD,
    data: {
      charactersAdded: {
        characters: characters.map(character => character._id),
      },
    },
  }

  await SessionEvent.create(event)
  await session.updateOne({
    characters: [...session.characters, ...characters.map(c => c._id)],
  })

  return reply.status(200).send({})
}
