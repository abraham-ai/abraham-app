import { characterLimitPermissionCheck } from '../lib/authorization'
import { ApiKey } from '../models/ApiKey'
import { Character } from '../models/Character'
import { User } from '../models/User'
import ApiKeyRepository from '../repositories/ApiKeyRepository'
import CharacterRepository from '../repositories/CharacterRepository'
import CreatorRepository from '../repositories/CreatorRepository'
import { createMultiFieldQuery } from '../utils/mongoUtils'
import { generateApiKey } from './apiKeyController'
import {
  CharactersCreateArguments,
  CharactersDeleteArguments,
  CharactersGetArguments,
  CharactersListArguments,
  CharactersTestArguments,
  CharactersUpdateArguments,
  SessionsInteractArguments,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

const findCharacterByIdOrSlug = async (id: string) => {
  const query = createMultiFieldQuery(id, ['slug'])
  return await Character.findOne(query)
}

export const createCharacter = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { name, image, voice, greeting, dialogue, logosData, isPrivate } =
    request.body as CharactersCreateArguments

  const newLogosData = {
    ...logosData,
    chatModel: logosData?.chatModel ? logosData.chatModel : undefined,
    identity: logosData?.identity ? logosData.identity : undefined,
    concept: logosData?.concept ? logosData.concept : undefined,
    knowledge: logosData?.knowledge ? logosData.knowledge : undefined,
    knowledgeSummary: logosData?.knowledgeSummary
      ? logosData.knowledgeSummary
      : undefined,
  }

  const input: {
    user: ObjectId
    name: string
    image: string | undefined
    voice: string | undefined
    greeting: string | undefined
    dialogue: any[] | undefined
    logosData: any | undefined
    isPrivate?: boolean
  } = {
    user: userId,
    name,
    image,
    voice,
    greeting,
    dialogue,
    logosData: newLogosData,
    isPrivate,
  }

  const characterRepository = new CharacterRepository(Character)

  const charactersCount = await Character.countDocuments({
    user: userId,
  })

  if (!characterLimitPermissionCheck(request, charactersCount)) {
    return reply.status(401).send({
      message:
        'Only basic+ subscribers can have more than one character. Please upgrade your subscription.',
    })
  }

  const character = await characterRepository.create(input)

  // Create API Key for character
  const { apiKey, apiSecret } = generateApiKey()
  const apiKeyInput = {
    user: userId,
    character: character._id,
    apiKey,
    apiSecret,
  }

  const apiKeyRepository = new ApiKeyRepository(ApiKey)
  await apiKeyRepository.create(apiKeyInput)

  return reply.status(200).send({
    characterId: character._id,
    slug: character.slug,
  })
}

export const updateCharacter = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { characterId } = request.params as CharactersUpdateArguments

  if (!characterId) {
    return reply.status(400).send({
      message: 'You must provide a characterId',
    })
  }

  const { name, image, voice, greeting, dialogue, logosData, isPrivate } =
    request.body as CharactersUpdateArguments

  const newLogosData = {
    ...logosData,
    chatModel: logosData?.chatModel ? logosData.chatModel : undefined,
    identity: logosData?.identity ? logosData.identity : undefined,
    concept: logosData?.concept ? logosData.concept : undefined,
    knowledge: logosData?.knowledge ? logosData.knowledge : undefined,
    knowledgeSummary: logosData?.knowledgeSummary
      ? logosData.knowledgeSummary
      : undefined,
  }

  const character = await Character.findOne({
    _id: characterId,
    user: userId,
  })

  if (!character) {
    return reply.status(404).send({
      message: 'Character not found',
    })
  }

  // Manually assign the updated values to the character document
  character.name = name !== undefined ? name : character.name
  character.image = image !== undefined ? image : character.image
  character.voice = voice !== undefined ? voice : character.voice
  character.greeting = greeting !== undefined ? greeting : character.greeting
  character.dialogue = dialogue !== undefined ? dialogue : character.dialogue
  character.logosData =
    newLogosData !== undefined ? newLogosData : character.logosData
  character.isPrivate =
    isPrivate !== undefined ? isPrivate : character.isPrivate

  // Save the document to trigger pre-save hooks and validate the document
  await character.save()

  return reply.status(200).send({ characterId: character._id })
}

export const deleteCharacter = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { characterId } = request.body as CharactersDeleteArguments

  const dbCharacter = await Character.findOne({
    _id: characterId,
    user: userId,
  })

  if (!dbCharacter) {
    return reply.status(401).send({
      message: 'Character not found',
    })
  }

  await dbCharacter.delete()

  return reply.status(200).send({})
}

export const listCharacters = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, limit, page, sort } = request.query as CharactersListArguments

  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    userId,
  })

  const characterRepository = new CharacterRepository(Character)
  const characterPaginatedResponse = await characterRepository.query(
    {
      user: creators.docs
        ? creators.docs.map(creator => creator._id)
        : undefined,
    },
    {
      limit,
      page,
      sort,
    },
  )

  await characterRepository.model.populate(characterPaginatedResponse.docs, {
    path: 'user',
    select: 'userId username userImage',
  })

  const response = {
    ...characterPaginatedResponse,
    docs: characterPaginatedResponse.docs.map(character => ({
      _id: character._id.toString(),
      user: character.user,
      name: character.name,
      slug: character.slug,
      image: character.image,
      voice: character.voice,
      greeting: character.greeting,
      dialogue: character.dialogue,
      logosData: character.logosData,
      creationCount: character.creationCount,
      isPrivate: character.isPrivate,
    })),
  }

  return reply.status(200).send(response)
}

export const getCharacter = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { characterId } = request.params as CharactersGetArguments
  const character = await findCharacterByIdOrSlug(characterId)

  if (!character) {
    return reply.status(404).send({
      message: 'Character not found',
    })
  }

  if (character.isPrivate) {
    if (character.user.toString() !== request.user?.userId.toString()) {
      console.error('User not authorized to view this')
      return reply.status(401).send({
        message: 'User not authorized to view this',
      })
    }
  }

  await Character.populate(character, {
    path: 'user',
    select: 'userId username userImage',
  })

  const response = {
    _id: character._id,
    user: character.user,
    name: character.name,
    slug: character.slug,
    image: character.image,
    voice: character.voice,
    greeting: character.greeting,
    dialogue: character.dialogue,
    logosData: character.logosData,
    creationCount: character.creationCount,
    isPrivate: character.isPrivate,
  }
  return reply.status(200).send({ character: response })
}

export const testCharacter = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const args = request.body as CharactersTestArguments

  const { message, config } = await server.handleInteractionTest(server, args)

  reply.status(200).send({
    message,
    config,
  })
}

export const interactCharacter = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const args = request.body as SessionsInteractArguments
  const { character_id } = args
  const character = await Character.findById(character_id)

  if (!character) {
    return reply.status(404).send({
      message: 'Character not found',
    })
  }

  if (character.user.toString() !== request.user?.userId.toString()) {
    return reply.status(401).send({
      message: 'You may not interact with this character',
    })
  }

  const { message, config } = await server.handleInteraction(server, args)

  reply.status(200).send({
    message,
    config,
  })
}
