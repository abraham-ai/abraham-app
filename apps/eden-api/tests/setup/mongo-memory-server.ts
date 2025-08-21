import { ApiKey, ApiKeyInput } from '../../src/models/ApiKey'
import { Collection } from '../../src/models/Collection'
import { Manna } from '../../src/models/Manna'
import { User, UserInput } from '../../src/models/User'
import {
  createCharacter,
  createCreation,
  createGenerator,
  getDefaultUserId,
} from '../util'
import { FeatureFlag, SubscriptionTier } from '@edenlabs/eden-sdk'
import { MongoClient } from 'mongodb'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { setup, teardown } from 'vitest-mongodb'

const createAdmin = async () => {
  const userData: UserInput = {
    userId: 'admin',
    username: 'admin',
    isWeb2: false,
    isAdmin: true,
  }
  const user = new User(userData)
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'admin',
    apiSecret: 'admin',
    user: user._id,
  }

  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const adminManna = {
    user: user._id,
    balance: 1000,
  }

  const manna = new Manna(adminManna)
  await manna.save()
}

const createFreeUser = async () => {
  const userData: UserInput = {
    userId: 'user',
    username: 'user',
    isWeb2: false,
    isAdmin: false,
  }
  const user = new User(userData)
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'user',
    apiSecret: 'user',
    user: user._id,
  }
  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const userManna = {
    user: user._id,
    balance: 1000,
  }
  const manna = new Manna(userManna)
  await manna.save()
}

const createBasicUser = async () => {
  const userData: UserInput = {
    userId: 'basicuser',
    username: 'basicuser',
    isWeb2: false,
    isAdmin: false,
  }
  const user = new User(userData)
  user.subscriptionTier = SubscriptionTier.Basic
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'basicuser',
    apiSecret: 'basicuser',
    user: user._id,
  }
  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const userManna = {
    user: user._id,
    balance: 1000,
  }
  const manna = new Manna(userManna)
  await manna.save()
}

const createProUser = async () => {
  const userData: UserInput = {
    userId: 'prouser',
    username: 'prouser',
    isWeb2: false,
    isAdmin: false,
  }
  const user = new User(userData)
  user.subscriptionTier = SubscriptionTier.Pro
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'prouser',
    apiSecret: 'prouser',
    user: user._id,
  }
  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const userManna = {
    user: user._id,
    balance: 1000,
  }
  const manna = new Manna(userManna)
  await manna.save()
}

const createBelieverUser = async () => {
  const userData: UserInput = {
    userId: 'believeruser',
    username: 'believeruser',
    isWeb2: false,
    isAdmin: false,
  }
  const user = new User(userData)
  user.subscriptionTier = SubscriptionTier.Believer
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'believeruser',
    apiSecret: 'believeruser',
    user: user._id,
  }
  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const userManna = {
    user: user._id,
    balance: 1000,
  }
  const manna = new Manna(userManna)
  await manna.save()
}

const createPreviewUser = async () => {
  const userData: UserInput = {
    userId: 'previewUser',
    username: 'previewUser',
    isWeb2: false,
    isAdmin: false,
  }
  const user = new User(userData)
  user.featureFlags = [FeatureFlag.Preview]
  await user.save()

  const apiKeyData: ApiKeyInput = {
    apiKey: 'previewuser',
    apiSecret: 'previewuser',
    user: user._id,
  }
  const apiKey = new ApiKey(apiKeyData)
  await apiKey.save()

  const userManna = {
    user: user._id,
    balance: 1000,
  }
  const manna = new Manna(userManna)
  await manna.save()
}

const createCollection = async () => {
  const user = await getDefaultUserId()
  const collection = {
    name: 'bookmarks',
    isDefaultCollection: true,
    user,
  }
  await Collection.create(collection)
}

// const createReplicateGenerator = async (db: Db) => {
//   const generator: GeneratorSchema = {
//     generatorName: "abraham-ai/eden-stable-diffusion",
//     versions: [
//       {
//         versionId: "latest",
//         defaultConfig: StableDiffusionDefaults,
//         isDeprecated: false,
//         createdAt: new Date(),
//       },
//     ],
//   };
//   await db.collection("generators").insertOne(generator);
// }

beforeAll(async () => {
  await setup()
  process.env.MONGO_URI = globalThis.__MONGO_URI__
  const client = new MongoClient(globalThis.__MONGO_URI__)
  client.db('eden')
  mongoose.set('strictQuery', true)
  await mongoose.connect(process.env.MONGO_URI as string)

  // const replicateDb = client.db("replicate");
  // await createAdmin(replicateDb);
  // await createUser(replicateDb);
  // await createReplicateGenerator(replicateDb);
})

beforeEach(async () => {
  await createAdmin()
  await createFreeUser()
  await createBasicUser()
  await createProUser()
  await createBelieverUser()
  await createPreviewUser()
  await createGenerator('test')
  await createCreation()
  await createCollection()
  await createCharacter()
})

afterEach(async () => {
  // delete all existing data
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
})

afterAll(async () => {
  // delete all existing data
  await teardown()
})
