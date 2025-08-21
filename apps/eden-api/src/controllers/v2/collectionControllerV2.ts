import { UserDocument } from '../../models/User'
import {
  CollectionV2,
  CollectionV2Document,
} from '../../models/v2/CollectionV2'
import { CreationV2, CreationV2Document } from '../../models/v2/CreationV2'
import { s3ThumbnailUrl, s3Url } from '../../plugins/s3Plugin'
import CollectionV2Repository from '../../repositories/CollectionV2Repository'
import { downloadZip } from '../../utils/downloader'
import {
  CollectionsV2AddCreationsArguments,
  CollectionsV2CreateArguments,
  CollectionsV2DeleteArguments,
  CollectionsV2GetArguments,
  CollectionsV2UpdateArguments,
  SubscriptionTier,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'
import { UpdateQuery, UpdateWriteOpResult } from 'mongoose'

export const getUserCollectionsLight = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const collectionsRepository = new CollectionV2Repository(CollectionV2)
  const collections = await collectionsRepository.query(
    {
      $or: [{ user: currentUserId }, { contributors: currentUserId }],
      deleted: false,
    },
    {
      select: '_id name creations public contributors',
      sort: { updatedAt: -1 },
    },
  )

  return reply.status(200).send({ collections: collections.docs })
}

export const getCollection = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { collectionId } = request.params as CollectionsV2GetArguments

  const collectionsRepository = new CollectionV2Repository(CollectionV2)
  const collection = await collectionsRepository.findById(collectionId)

  if (!collection || collection.deleted) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  const currentUserId = request.user ? request.user.userId : undefined
  const isOwnCollection =
    currentUserId && collection.user.toString() === currentUserId.toString()
  const isContributor = currentUserId
    ? collection.contributors?.filter(
        contributor => contributor.toString() === currentUserId?.toString(),
      )[0]
    : false

  if (!isOwnCollection && !isContributor && !collection.public) {
    return reply.status(401).send({
      error: 'User not authorized to view this collection',
    })
  }

  await collectionsRepository.model.populate(collection, {
    path: 'user',
    select: '_id userId username userImage',
  })

  await collectionsRepository.model.populate(collection, {
    path: 'coverCreation',
    select: '_id mediaAttributes thumbnail',
  })

  if (collection.coverCreation) {
    collection.coverCreation.thumbnail = s3ThumbnailUrl(
      server,
      collection.coverCreation.thumbnail || '',
      1024,
    )
  }

  return reply.status(200).send({ collection })
}

export const getCollectionCreations = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { collectionId } = request.params as CollectionsV2GetArguments

  const collectionsRepository = new CollectionV2Repository(CollectionV2)
  const collection = await collectionsRepository.findById(collectionId)

  if (!collection || collection.deleted) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  const creations = await CreationV2.find(
    {
      _id: { $in: collection.creations },
      deleted: false,
    },
    '_id mediaAttributes filename thumbnail url',
  )

  creations.forEach(creation => {
    creation.thumbnail = s3ThumbnailUrl(server, creation.filename || '', 1024)
    creation.url = s3Url(server, creation.filename || '')
  })

  return reply.status(200).send({ creations })
}

export const createCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    name,
    description,
    creationIds,
    public: isPublic,
  } = request.body as CollectionsV2CreateArguments

  const currentUserId = request.user.userId

  const user = request.user
  let canCreatePrivateCollection = true
  if (user.subscriptionTier === SubscriptionTier.Free) {
    canCreatePrivateCollection = false
  }

  if (isPublic === false && !canCreatePrivateCollection) {
    return reply.status(401).send({
      error: 'You are not authorized to create a private collection',
    })
  }

  if (creationIds) {
    const creations = await CreationV2.find(
      {
        _id: { $in: creationIds },
      },
      '_id user public',
    )

    const isAuthorized = creations.every(
      creation =>
        creation.user.toString() === currentUserId.toString() ||
        creation.public,
    )

    if (!isAuthorized) {
      return reply.status(401).send({
        error: 'User not authorized to add creations to collection',
      })
    }

    if (creations.length !== creationIds.length) {
      return reply.status(404).send({
        error: 'One or more creations not found',
      })
    }
  }

  const collection = new CollectionV2({
    user: currentUserId,
    name,
    description,
    creations: creationIds,
    public: canCreatePrivateCollection ? false : isPublic || true,
  })

  try {
    await collection.save()
  } catch (error) {
    // @ts-ignore
    if (error.code === 11000) {
      return reply.status(409).send({
        error: 'A collection with this name already exists',
      })
    }
    return reply.status(500).send({
      error: 'Error creating collection',
    })
  }

  return reply.status(200).send({ collectionId: collection._id })
}

export const updateCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { collectionId } = request.params as CollectionsV2UpdateArguments
  const {
    name,
    description,
    public: isPublic,
  } = request.body as CollectionsV2UpdateArguments

  if (!collectionId) {
    return reply.status(422).send({
      error: 'Missing collectionId',
    })
  }

  if (isPublic === false) {
    const user = request.user
    if (user.subscriptionTier === SubscriptionTier.Free) {
      return reply.status(401).send({
        error: 'You are not authorized to make a collection private',
      })
    }
  }

  const updateData: UpdateQuery<CollectionV2Document> = {
    name,
    description,
    public: isPublic,
  }

  let result: UpdateWriteOpResult
  try {
    result = await CollectionV2.updateOne(
      {
        _id: collectionId,
        user: currentUserId,
        deleted: false,
      },
      updateData,
    )
  } catch (error) {
    // @ts-ignore
    if (error.code === 11000) {
      return reply.status(409).send({
        error: 'A collection with this name already exists',
      })
    }
    return reply.status(500).send({
      error: 'Error updating collection',
    })
  }

  if (!result.matchedCount) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  return reply.status(200).send({
    collectionId,
  })
}

export const deleteCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { collectionId } = request.params as CollectionsV2DeleteArguments

  const collection = await CollectionV2.findOne({
    _id: collectionId,
  })

  if (!collection || collection.deleted) {
    return reply.status(404).send({
      message: 'Collection not found',
    })
  }

  if (collection.user.toString() !== currentUserId.toString()) {
    return reply.status(401).send({
      message: 'User not authorized to delete this',
    })
  }

  await collection.delete()

  return reply.status(200).send()
}

export const addCreationsToCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { collectionId } = request.params as CollectionsV2AddCreationsArguments
  const { creationIds } = request.body as CollectionsV2AddCreationsArguments

  if (!collectionId) {
    return reply.status(422).send({
      error: 'Missing collectionId',
    })
  }

  const collection = await CollectionV2.findOne({
    _id: collectionId,
    $or: [
      { user: new ObjectId(currentUserId.toString()) },
      { contributors: new ObjectId(currentUserId.toString()) },
    ],
  })

  if (!collection || collection.deleted) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  if (collection.user.toString() !== currentUserId.toString()) {
    const isContributor = currentUserId
      ? collection.contributors?.filter(
          contributor => contributor.toString() === currentUserId?.toString(),
        )[0]
      : false
    if (!isContributor) {
      return reply.status(401).send({
        error: 'User not authorized to update this collection',
      })
    }
  }

  const creationsToAdd = await CreationV2.find({
    _id: { $in: creationIds },
  })

  if (creationsToAdd.length !== creationIds.length) {
    return reply.status(404).send({
      error: 'One or more creations not found',
    })
  }

  const isAuthorizedForCreations = creationsToAdd.every(
    creation =>
      creation.user.toString() === currentUserId.toString() ||
      creation.agent?.toString() === currentUserId.toString() ||
      creation.public,
  )

  if (!isAuthorizedForCreations) {
    return reply.status(401).send({
      error: 'User not authorized to update collection creations',
    })
  }

  const shouldUpdateCoverCreation =
    typeof collection.coverCreation === 'undefined'

  if (shouldUpdateCoverCreation) {
    collection.coverCreation = creationsToAdd[0]
  }

  await CollectionV2.updateOne(
    {
      _id: collectionId,
    },
    {
      $set: shouldUpdateCoverCreation
        ? { coverCreation: collection.coverCreation }
        : {},
      $addToSet: {
        creations: { $each: creationIds },
      },
    },
  )

  return reply.status(200).send({
    collectionId,
  })
}

export const removeCreationsFromCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { collectionId } = request.params as CollectionsV2AddCreationsArguments
  const { creationIds } = request.body as CollectionsV2AddCreationsArguments

  if (!collectionId) {
    return reply.status(422).send({
      error: 'Missing collectionId',
    })
  }

  const collection = await CollectionV2.findOne({
    _id: collectionId,
    $or: [
      { user: new ObjectId(currentUserId.toString()) },
      { contributors: new ObjectId(currentUserId.toString()) },
    ],
  })

  if (!collection || collection.deleted) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  if (collection.user.toString() !== currentUserId.toString()) {
    const isContributor = currentUserId
      ? collection.contributors?.filter(
          contributor => contributor.toString() === currentUserId?.toString(),
        )[0]
      : false
    if (!isContributor) {
      return reply.status(401).send({
        error: 'User not authorized to update this collection',
      })
    }
  }

  const shouldUpdateCoverCreation =
    collection.coverCreation &&
    creationIds.includes(collection.coverCreation.toString())

  if (shouldUpdateCoverCreation) {
    collection.coverCreation =
      collection.creations.find(
        creation => !creationIds.includes(creation.toString()),
      ) || undefined
  }

  await CollectionV2.updateOne(
    {
      _id: collectionId,
    },
    {
      $set:
        shouldUpdateCoverCreation && collection.coverCreation
          ? { coverCreation: collection.coverCreation }
          : {},
      $unset:
        shouldUpdateCoverCreation && !collection.coverCreation
          ? { coverCreation: '' }
          : {},
      $pullAll: {
        creations: creationIds,
      },
    },
  )

  return reply.status(200).send({
    collectionId,
  })
}

export const getCollectionDownloadZip = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { collectionId } = request.params as { collectionId: string }

  const collection: {
    creations: {
      _id: CreationV2Document['_id']
      filename: CreationV2Document['filename']
      user: {
        username: UserDocument['username']
      }
    }[]
  }[] = await CollectionV2.aggregate([
    {
      $match: { _id: new ObjectId(collectionId) },
    },
    {
      $lookup: {
        from: 'creations3',
        localField: 'creations',
        foreignField: '_id',
        as: 'creations',
      },
    },
    {
      $unwind: '$creations',
    },
    {
      $match: {
        'creations.deleted': { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'users3',
        localField: 'creations.user',
        foreignField: '_id',
        as: 'creations.user',
      },
    },
    {
      $unwind: '$creations.user',
    },
    {
      $group: {
        _id: '$_id',
        creations: { $push: '$creations' },
      },
    },
  ]).exec()

  if (!collection || !collection.length) {
    return reply.status(404).send({
      error: 'Collection not found',
    })
  }

  const files = collection[0].creations.map(creation => ({
    url: s3Url(server, creation.filename || ''),
    fileName: `${creation.user.username}_${creation._id}`,
    fileExtension: creation.filename?.split('.').pop() || '',
  }))

  await downloadZip(files, reply, server)
}
