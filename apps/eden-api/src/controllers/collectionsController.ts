import { enforceUserDocumentLimit } from '../lib/data'
import { Collection } from '../models/Collection'
import { Creation } from '../models/Creation'
import { User } from '../models/User'
import CollectionRepository from '../repositories/CollectionRepository'
import CreatorRepository from '../repositories/CreatorRepository'
import {
  CollectionsAddCreationsArguments,
  CollectionsCreateArguments,
  CollectionsDeleteArguments,
  CollectionsGetArguments,
  CollectionsListArguments,
  CollectionsRemoveCreationsArguments,
  CollectionsUpdateArguments,
} from '@edenlabs/eden-sdk'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'
import { PipelineStage } from 'mongoose'

const getDefaultCollection = async (user: ObjectId) => {
  let collection = await Collection.findOne({ isDefaultCollection: true, user })

  // Create the default collection if it doesn't exist
  if (!collection) {
    collection = await Collection.create({
      name: 'Bookmarks',
      description: 'My bookmarked creations',
      isDefaultCollection: true,
      user,
    })
  }

  return collection
}

export const getCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { collectionId } = request.params as CollectionsGetArguments
  const collection = await Collection.findById(collectionId)
  if (!collection) {
    return reply.status(404).send({ message: 'Collection not found' })
  }

  if (collection.isPrivate) {
    if (
      !request.user?.userId ||
      collection.user._id.toString() !== request.user?.userId.toString()
    ) {
      console.error('User not authorized to view this')
      return reply.status(401).send({
        message: 'User not authorized to view this',
      })
    }
  }

  const user = await User.findById(collection.user)
  return reply.status(200).send({
    collection: {
      ...collection.toObject(),
      creatorId: user?.userId,
      creatorName: user?.username,
      creatorImage: user?.userImage,
    },
  })
}

const collectionsAggregate = (
  userId: string,
  creationId: string,
  filter?: {
    isPrivate?: { $eq?: boolean }
    deleted?: { $eq?: boolean }
  },
) => {
  const pipelines: PipelineStage[] = [
    {
      $match: {
        $or: [
          { user: new ObjectId(userId) },
          { contributors: { $in: [userId] } },
        ],
      },
    },
    {
      $addFields: {
        creationCount: {
          $size: '$creations',
        },
        hasItem: {
          $in: [new ObjectId(creationId), '$creations'],
        },
      },
    },
    {
      $sort: {
        creationCount: -1,
      },
    },
  ]

  if (filter?.isPrivate) {
    pipelines.push({
      $match: {
        isPrivate: filter.isPrivate,
      },
    })
  }

  if (filter?.deleted) {
    pipelines.push({
      $match: {
        deleted: filter.deleted,
      },
    })
  }

  // console.log(JSON.stringify(pipelines, null, 2))
  return Collection.aggregate(pipelines)
}

export const listCollections = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, limit, page, sort, creationId } =
    request.query as CollectionsListArguments

  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    _id: userId,
  })

  const creatorId = creators.docs[0]?._id
  const sortFilter: { [key: string]: unknown } = {}
  const ownUserId = request.user ? request.user.userId : undefined
  const isUserRequestingOwnProfileFeed =
    creatorId && ownUserId && ownUserId.toString() === creatorId.toString()
  if (!isUserRequestingOwnProfileFeed) {
    sortFilter['isPrivate'] = { $eq: false }
  }

  const collectionRepository = new CollectionRepository(Collection)
  const collections =
    creatorId && creationId
      ? // finds all collections belonging to creatorId that contain creationId
        await collectionRepository.aggregateQuery(
          collectionsAggregate(creatorId, creationId as string, {
            ...sortFilter,
            deleted: { $eq: false },
          }),
          {
            limit,
            page,
            sort: {
              ...sort,
              updatedAt: -1,
            },
          },
        )
      : await collectionRepository.query(
          {
            $or: [
              {
                user: userId
                  ? creators.docs.map(creator => creator._id)
                  : undefined,
              },
              {
                contributors: {
                  $in: userId
                    ? creators.docs.map(creator => creator._id)
                    : undefined,
                },
              },
            ],
            // contributors: userId
            //   ? { $in: creators.docs.map(creator => creator._id) }
            //   : undefined,
            ...sortFilter,
          },
          {
            limit,
            page,
            sort: {
              ...sort,
              updatedAt: -1,
            },
          },
        )

  await collectionRepository.model.populate(collections.docs, {
    path: 'user',
    select: 'userId username userImage',
  })

  return reply.status(200).send(collections)
}

export const createCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { name, description, creationIds } =
    request.body as CollectionsCreateArguments

  // validate creations
  let creations
  if (creationIds) {
    creations = await Creation.find({ _id: { $in: creationIds } })
    if (creations.length !== creationIds.length) {
      return reply.status(400).send({
        message: 'Invalid creation(s)',
      })
    }
  }

  const collection = await Collection.create({
    name,
    description,
    creations: creations ? creations.map(creation => creation._id) : undefined,
    user: userId,
  })

  return reply.status(200).send({ collectionId: collection._id })
}

export const deleteCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { collectionId } = request.body as CollectionsDeleteArguments
  const collection = await Collection.findOne({
    _id: collectionId,
    user: userId,
  })

  if (!collection) {
    return reply.status(400).send({
      message: 'Invalid collection',
    })
  }

  if (collection.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      message: 'User not authorized to delete this',
    })
  }

  if (collection.isDefaultCollection) {
    return reply.status(400).send({
      message: 'Cannot delete default collection',
    })
  }

  await collection.delete()

  return reply.status(200).send({
    success: true,
  })
}

export const updateCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { collectionId } = request.params as CollectionsUpdateArguments
  const { name, description, isPrivate, deleted } =
    request.body as CollectionsUpdateArguments

  if (
    !userId ||
    !collectionId ||
    (typeof name === 'undefined' &&
      typeof description === 'undefined' &&
      typeof isPrivate === 'undefined' &&
      typeof deleted === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  let collection

  if (collectionId) {
    collection = await Collection.findOneWithDeleted({
      _id: collectionId,
      user: userId,
    })

    if (!collection) {
      return reply.status(404).send({
        message: 'Collection not found',
      })
    }
  } else {
    // Get the default collection
    collection = await getDefaultCollection(userId)
  }

  if (typeof name !== 'undefined') {
    collection.name = name
  }

  if (typeof description !== 'undefined') {
    collection.description = description
  }

  if (typeof isPrivate !== 'undefined') {
    collection.isPrivate = isPrivate
  }

  if (typeof deleted !== 'undefined') {
    collection.deleted = !!deleted
  }

  await collection.save()

  return reply.status(200).send({})
}

export const addCreationsToCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { collectionId, creationIds } =
    request.body as CollectionsAddCreationsArguments

  let collection

  if (collectionId) {
    collection = await Collection.findOne({
      _id: collectionId,
      $or: [
        { user: new ObjectId(userId) },
        { contributors: new ObjectId(userId) },
      ],
    })
  } else {
    // Get the default collection
    collection = await getDefaultCollection(userId)
  }

  if (!collection) {
    return reply.status(400).send({
      message: 'Invalid collection',
    })
  }

  // validate creations
  const creationDocs = await Creation.find({ _id: { $in: creationIds } })
  if (creationDocs.length !== creationIds.length) {
    return reply.status(400).send({
      message: 'Invalid creation(s)',
    })
  }

  const withinDocumentLimits = await enforceUserDocumentLimit(
    150,
    'collections',
    userId.toString(),
  )

  if (!withinDocumentLimits) {
    return reply.status(400).send({
      message: 'User has reached the maximum number of collections',
    })
  }

  await collection.updateOne({
    $addToSet: {
      creations: { $each: creationDocs.map(c => c._id) },
    },
    displayImageUri: creationDocs[0].thumbnail,
  })

  if (collection.isDefaultCollection) {
    await Promise.all(
      creationDocs.map(creation =>
        creation.updateOne({
          $inc: { bookmarkCount: 1 },
        }),
      ),
    )
  }

  return reply.status(200).send({})
}

export const removeCreationsFromCollection = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { collectionId, creationIds } =
    request.body as CollectionsRemoveCreationsArguments

  let collection

  if (collectionId) {
    collection = await Collection.findOne({
      _id: collectionId,
      $or: [
        { user: new ObjectId(userId) },
        { contributors: new ObjectId(userId) },
      ],
    })
  } else {
    // Get the default collection
    collection = await getDefaultCollection(userId)
  }

  if (!collection) {
    return reply.status(400).send({
      message: 'Invalid collection',
    })
  }

  // validate creations
  const creationDocs = await Creation.find({ _id: { $in: creationIds } })
  if (creationDocs.length !== creationIds.length) {
    return reply.status(400).send({
      message: 'Invalid creation(s)',
    })
  }

  // Remove creations from collection
  const creationIdsToRemove = creationDocs.map(creation => creation._id)
  await Collection.updateOne(
    { _id: collection._id },
    { $pullAll: { creations: creationIdsToRemove } },
  )

  if (collection.isDefaultCollection) {
    await Promise.all(
      creationDocs.map(creation =>
        creation.updateOne({
          $inc: { bookmarkCount: -1 },
        }),
      ),
    )
  }

  return reply.status(200).send({})
}
