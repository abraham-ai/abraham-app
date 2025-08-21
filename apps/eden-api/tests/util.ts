import { edenHandlers } from '../src/lib/taskHandlers/edenHandlers'
import { ApiKey } from '../src/models/ApiKey'
import { Character, CharacterInput } from '../src/models/Character'
import { Creation } from '../src/models/Creation'
import { Generator, GeneratorSchema } from '../src/models/Generator'
import { User } from '../src/models/User'
import createServer, { CreateServerOpts } from '../src/server'
import { MediaType } from '@edenlabs/eden-sdk'
import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'

export const createTestServer = async () => {
  const opts: CreateServerOpts = {
    mongoUri: globalThis.__MONGO_URI__ + 'test',
  }
  const server = await createServer(opts)
  return server
}

export const createEdenServer = async () => {
  const opts: CreateServerOpts = {
    mongoUri: globalThis.__MONGO_URI__ + 'eden',
    taskHandlers: edenHandlers,
  }
  const server = await createServer(opts)
  return server
}

export const getDb = (server: FastifyInstance) => {
  const db = server.mongo.db
  if (!db) {
    throw new Error('No database connection')
  }
  return db
}

export const prepareUserHeaders = () => {
  return {
    'x-api-key': 'user',
    'x-api-secret': 'user',
  }
}

export const prepareBasicUserHeaders = () => {
  return {
    'x-api-key': 'basicuser',
    'x-api-secret': 'basicuser',
  }
}

export const prepareProUserHeaders = () => {
  return {
    'x-api-key': 'prouser',
    'x-api-secret': 'prouser',
  }
}

export const prepareBelieverUserHeaders = () => {
  return {
    'x-api-key': 'believeruser',
    'x-api-secret': 'believeruser',
  }
}

export const preparePreviewUserHeaders = () => {
  return {
    'x-api-key': 'previewuser',
    'x-api-secret': 'previewuser',
  }
}

export const prepareAdminHeaders = () => {
  return {
    'x-api-key': 'admin',
    'x-api-secret': 'admin',
  }
}

export const prepareCharacterHeaders = () => {
  return {
    'x-api-key': 'character',
    'x-api-secret': 'character',
  }
}

export const getDefaultUserId = async () => {
  const userResult = await User.findOne({ userId: 'user' })
  return userResult?._id
}

export const getDummyObjectId = () => {
  return new ObjectId(0)
}

export const createGenerator = async (generatorName: string) => {
  const generatorVersionData = {
    versionId: '1.0.0',
    parameters: [
      {
        name: 'guidance_scale',
        label: 'Guidance scale',
        description: 'Strength of prompt conditioning guidance',
        default: 7.5,
        minimum: 0.0,
        maximum: 30.0,
        step: 0.1,
        optional: true,
      },
    ],
    isDeprecated: false,
    provider: 'test',
    mode: 'test',
    address: 'test',
    creationAttributes: [],
    createdAt: new Date(),
  }
  const generator: GeneratorSchema = {
    generatorName,
    description: 'test',
    defaultVersionId: '1.0.0',
    versions: [generatorVersionData],
    output: 'creation',
  }
  await Generator.create(generator)
  return generator
}

export const createCreation = async () => {
  const creation = await Creation.create({
    user: await getDefaultUserId(),
    task: new ObjectId(0),
    uri: 'test',
    name: 'test',
    attributes: {},
    mediaAttributes: {
      type: MediaType.Image,
    },
  })
  return creation
}

export const createCharacter = async () => {
  const characterInput: CharacterInput = {
    user: await getDefaultUserId(),
    name: 'character',
  }
  const character = await Character.create(characterInput)

  const characterApiKey = {
    apiKey: 'character',
    apiSecret: 'character',
    user: character.user,
    character: character._id,
  }

  await ApiKey.create(characterApiKey)
  return character
}
