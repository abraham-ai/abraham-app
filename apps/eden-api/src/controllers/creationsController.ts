import { Collection } from '../models/Collection'
import { Creation, CreationDocument } from '../models/Creation'
import { Rating } from '../models/Rating'
import { Reaction } from '../models/Reaction'
import { User } from '../models/User'
import CreationRepository from '../repositories/CreationRepository'
import CreatorRepository from '../repositories/CreatorRepository'
import {
  CreationsDeleteArguments,
  CreationsGetArguments,
  CreationsListArguments,
  CreationsReactArguments,
  CreationsUnreactArguments,
  CreationsUpdateArguments,
  ReactionType,
} from '@edenlabs/eden-sdk'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

export const getReactions = async (
  userId: ObjectId,
  creations: CreationDocument[],
): Promise<{ [key: string]: Map<ReactionType, boolean> }> => {
  const reactions = await Reaction.aggregate([
    {
      $match: {
        user: userId,
        creation: {
          $in: creations.map(creation => creation._id),
        },
      },
    },
    {
      $lookup: {
        from: 'creations',
        localField: 'creation',
        foreignField: '_id',
        as: 'creation',
      },
    },
    {
      $unwind: '$creation',
    },
  ])

  // Convert reactions to a map for easy lookup
  const reactionsMap = reactions.reduce((map, reaction) => {
    const creationId = reaction.creation._id.toString()
    if (!map[creationId]) {
      map[creationId] = {}
    }
    map[creationId][reaction.reaction] = true
    return map
  }, {} as { [key: string]: ReactionType[] }) // explicitly set the type of the accumulator

  return reactionsMap
}

export const getRating = async (
  userId: ObjectId,
  creationId: ObjectId,
): Promise<number> => {
  const rating = await Rating.findOne({
    user: userId,
    creation: creationId,
  })

  if (!rating) {
    return 0
  }

  return rating.rating
}

export const getBookmarks = async (
  userId: ObjectId,
  creations: CreationDocument[],
): Promise<{ [key: string]: boolean }> => {
  const defaultCollection = await Collection.findOne({
    user: userId,
    isDefaultCollection: true,
  })

  if (!defaultCollection) {
    // The user doesn't have a default collection, so none of the creations are bookmarked
    // This should never happen though...
    return {}
  }

  const bookmarksMap = creations
    .filter(creation => defaultCollection.creations.includes(creation._id))
    .reduce((map, creation) => {
      map[creation._id.toString()] = defaultCollection.creations.includes(
        creation._id,
      )
      return map
    }, {} as { [key: string]: boolean })

  return bookmarksMap
}

export const listCreations = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, name, limit, page, sort } =
    request.query as CreationsListArguments
  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    userId,
  })

  const creationRepository = new CreationRepository(Creation)
  const creations = await creationRepository.query(
    {
      user:
        userId && creators.docs
          ? creators.docs.map(creator => creator._id)
          : undefined,
      ...(name ? { $text: { $search: name } } : {}),
    },
    {
      limit,
      page,
      sort,
    },
  )

  const creationsWithPublicName = await Promise.all(
    creations.docs.map(async doc => {
      const user = await User.findById(doc.user._id)
      const publicName = `${user?.username}:${doc.name}`
      return {
        ...doc.toObject(),
        publicName,
      }
    }),
  )

  const response = {
    ...creations,
    docs: creationsWithPublicName,
  }

  return reply.status(200).send(response)
}

export const getCreation = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { creationId } = request.params as CreationsGetArguments
  const creation = (await Creation.findOneWithDeleted({ _id: creationId })
    .populate({
      path: 'task',
      select: 'config status generator',
      populate: {
        path: 'generator',
        select: 'generatorName description output',
      },
    })
    .populate({
      path: 'concept',
      select: '_id name user conceptName creationCount thumbnail',
    })
    .populate({
      path: 'user',
      select: '_id userId username userImage',
    })) as CreationDocument & {
    reactions?: Map<ReactionType, boolean>
    bookmarked?: boolean
  }

  // nothing found or it was deleted and the user is not the owner
  if (
    !creation ||
    (request.user?.userId &&
      creation.deleted &&
      creation.user._id.toString() !== request.user?.userId.toString())
  ) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  if (creation.isPrivate) {
    if (creation.user._id.toString() !== request.user?.userId.toString()) {
      console.error('User not authorized to view this')
      return reply.status(401).send({
        message: 'User not authorized to view this',
      })
    }
  }

  if (request.user?.userId) {
    // Get user's reactions and bookmarks
    const userId = request.user.userId
    const user = await User.findOne({ _id: userId })
    if (!user) {
      return reply.status(404).send({
        message: 'User not found',
      })
    }
    const uid = new ObjectId(userId)
    const userRating = await getRating(uid, creation._id)
    const reactionsMap = await getReactions(uid, [creation])
    const bookmarksMap = await getBookmarks(uid, [creation])

    // creation.reactions = reactionsMap[creation._id.toString()]
    // creation.bookmarked = bookmarksMap[creation._id.toString()]
    const creationWithExtras = {
      ...creation.toObject(),
      reactions: reactionsMap[creation._id.toString()],
      bookmarked: bookmarksMap[creation._id.toString()],
      rating: userRating,
    }

    return reply.status(200).send({
      creation: creationWithExtras,
    })
  }

  return reply.status(200).send({ creation })
}

export const creationDelete = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { creationId } = request.params as CreationsDeleteArguments

  const creation = await Creation.findById(creationId)

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  if (creation.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      message: 'User not authorized to delete this',
    })
  }

  await creation.delete()

  return reply.status(200).send({
    success: true,
  })
}

export const creationUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { creationId } = request.params as CreationsUpdateArguments
  const { isPrivate, deleted } = request.body as CreationsUpdateArguments

  if (
    !userId ||
    !creationId ||
    (typeof isPrivate === 'undefined' && typeof deleted === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  const creation = await Creation.findOneWithDeleted({
    _id: creationId,
    user: userId,
  })

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  if (
    typeof isPrivate !== 'undefined' &&
    !isPrivate &&
    creation.attributes &&
    creation.attributes.nsfw_score &&
    creation.attributes.nsfw_score > 0.5
  ) {
    return reply.status(403).send({
      message: 'Creation has NSFW flag and can not be made public.',
    })
  }

  if (typeof isPrivate !== 'undefined') {
    creation.isPrivate = isPrivate
  }
  if (typeof deleted !== 'undefined') {
    creation.deleted = !!deleted
  }

  creation.save()

  return reply.status(200).send({
    creation,
  })
}

export const creationRate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { creationId, rating } = request.body as {
    creationId: string
    rating: number
  }

  // check if reaction in ReactionType enum
  if (rating < 0 || rating > 5) {
    return reply.status(400).send({
      message: 'Invalid rating',
    })
  }

  const creation = await Creation.findById(creationId)

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  const ratingData = {
    creation: creationId,
    user: userId,
    rating,
  }

  await Rating.findOneAndUpdate(
    { creation: ratingData.creation, user: ratingData.user },
    { rating: ratingData.rating },
    { upsert: true },
  )

  return reply.status(200).send({
    success: true,
  })
}

export const creationReact = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { creationId, reaction } = request.body as CreationsReactArguments

  // check if reaction in ReactionType enum
  if (!Object.values(ReactionType).includes(reaction)) {
    return reply.status(400).send({
      message: 'Invalid reaction',
    })
  }

  const creation = await Creation.findById(creationId)

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  const reactionData = {
    creation: creationId,
    user: userId,
    reaction,
  }

  const existingReaction = await Reaction.findOne(reactionData)

  if (existingReaction) {
    return reply.status(400).send({
      message: 'Reaction already exists',
    })
  }

  await Reaction.create(reactionData)

  await creation.updateOne({
    $inc: {
      praiseCount: reaction === ReactionType.Praise ? 1 : 0,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}

export const creationUnreact = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { creationId, reaction } = request.body as CreationsUnreactArguments

  // check if reaction in ReactionType enum
  if (!Object.values(ReactionType).includes(reaction)) {
    return reply.status(400).send({
      message: 'Invalid reaction',
    })
  }

  const creation = await Creation.findById(creationId)

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  const reactionData = {
    creation: creationId,
    user: userId,
    reaction,
  }

  const existingReaction = await Reaction.findOne(reactionData)

  if (!existingReaction) {
    return reply.status(400).send({
      message: 'Reaction does not exist',
    })
  }

  await existingReaction.deleteOne()

  await creation.updateOne({
    $inc: {
      praiseCount: reaction === ReactionType.Praise ? -1 : 0,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}
