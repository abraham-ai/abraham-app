import { Creation } from '../models/Creation'
import { Follow, FollowDocument } from '../models/Follow'
import { Manna } from '../models/Manna'
import { User } from '../models/User'
import CreatorRepository from '../repositories/CreatorRepository'
import FollowerRepository from '../repositories/FollowerRepository'
import { createMultiFieldQuery } from '../utils/mongoUtils'
import {
  CreatorFollowersListArguments,
  CreatorFollowingListArguments,
  CreatorsFollowArguments,
  CreatorsGetArguments,
  CreatorsListArguments,
  CreatorsUnfollowArguments,
  CreatorsUpdateArguments,
} from '@edenlabs/eden-sdk'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

const removePrivateFields = (creator: any) => {
  const creatorObject = creator.toObject()
  delete creatorObject.featureFlags
  delete creatorObject.subscriptionTier
  delete creatorObject.isAdmin
  delete creatorObject.isWeb2
  return creatorObject
}

const findCreatorByIdOrUsername = async (userId: string) => {
  const query = createMultiFieldQuery(userId, ['userId', 'username'])
  return await User.findOne(query)
}

export const listCreators = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, discordId, limit, page, sort } =
    request.query as CreatorsListArguments

  const creatorRepository = new CreatorRepository(User)
  const creators = await creatorRepository.query(
    {
      userId,
      discordId,
    },
    {
      limit,
      page,
      sort,
    },
  )

  creators.docs = creators.docs.map(creator => {
    return removePrivateFields(creator)
  })

  return reply.status(200).send(creators)
}

const aggregateFollowerByUserId = (
  followedUserId: string,
  authenticatedUserId?: ObjectId,
) => {
  const pipe = [
    {
      $match: {
        following: {
          $eq: new ObjectId(followedUserId),
        },
      },
    },
    {
      $project: {
        _id: 0,
        follower: 1,
        following: 1,
      },
    },
    {
      $lookup: {
        from: 'users3',
        localField: 'follower',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
      },
    },
    {
      $lookup: {
        from: 'follows',
        localField: 'follower',
        foreignField: 'following',
        let: {
          is_following: authenticatedUserId,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$$is_following', '$follower'],
              },
            },
          },
        ],
        as: 'follower_lookup',
      },
    },
    {
      $addFields: {
        'user.isFollowing': {
          $gt: [
            {
              $size: '$follower_lookup',
            },
            0,
          ],
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: '$user',
      },
    },
    {
      $project: {
        _id: 1,
        isFollowing: 1,
        userId: 1,
        username: 1,
        userImage: 1,
      },
    },
  ]
  return Follow.aggregate(pipe)
}

const aggregateFollowingByUserId = (
  followerUserId: string,
  authenticatedUserId?: ObjectId,
) => {
  const pipe = [
    {
      $match: {
        follower: {
          $eq: new ObjectId(followerUserId),
        },
      },
    },
    {
      $project: {
        _id: 0,
        follower: 1,
        following: 1,
      },
    },
    {
      $lookup: {
        from: 'users3',
        localField: 'following',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
      },
    },
    {
      $lookup: {
        from: 'follows',
        localField: 'follower',
        foreignField: 'following',
        let: {
          is_following: authenticatedUserId,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$$is_following', '$follower'],
              },
            },
          },
        ],
        as: 'follower_lookup',
      },
    },
    {
      $addFields: {
        'user.isFollowing': {
          $or: [
            {
              $eq: [followerUserId, authenticatedUserId],
            },
            {
              $gt: [
                {
                  $size: '$follower_lookup',
                },
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: '$user',
      },
    },
    {
      $project: {
        _id: 1,
        isFollowing: 1,
        userId: 1,
        username: 1,
        userImage: 1,
      },
    },
  ]
  return Follow.aggregate(pipe)
}

export const listCreatorFollowers = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { limit, page } = request.query as CreatorFollowersListArguments
  const { userId: creatorId } = request.params as CreatorFollowersListArguments
  const creatorDoc = await findCreatorByIdOrUsername(creatorId)

  if (!creatorDoc) {
    return reply.status(404).send({
      message: 'Creator not found',
    })
  }

  const { userId } = request.user

  const followCreationRepository = new FollowerRepository(Follow)
  const followAggregate = aggregateFollowerByUserId(creatorDoc._id, userId)
  const followers = await followCreationRepository.aggregateQuery(
    followAggregate,
    {
      limit,
      page,
      sort: { createdAt: -1 },
    },
  )

  return reply.status(200).send(followers)
}

export const listCreatorFollowing = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { limit, page } = request.query as CreatorFollowingListArguments
  const { userId: creatorId } = request.params as CreatorFollowersListArguments

  const creatorDoc = await findCreatorByIdOrUsername(creatorId)

  if (!creatorDoc) {
    return reply.status(404).send({
      message: 'Creator not found',
    })
  }

  const { userId } = request.user
  const followCreationRepository = new FollowerRepository(Follow)
  const followAggregate = aggregateFollowingByUserId(creatorDoc._id, userId)
  const following = await followCreationRepository.aggregateQuery(
    followAggregate,
    {
      limit,
      page,
      sort: { createdAt: -1 },
    },
  )

  return reply.status(200).send(following)
}

export const getCreator = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.params as CreatorsGetArguments
  const creatorDoc = await findCreatorByIdOrUsername(userId)
  if (!creatorDoc || !creatorDoc?._id) {
    return reply.status(404).send({
      message: 'Creator not found',
    })
  }

  const creationsCount = await Creation.countDocuments({
    user: creatorDoc?._id,
    character: null,
  })
  const followerCount = await Follow.countDocuments({
    following: creatorDoc?._id,
  })
  const followingCount = await Follow.countDocuments({
    follower: creatorDoc?._id,
  })
  let isFollowing = false
  if (request.user?.userId) {
    const followerQuery = await Follow.findOne({
      follower: request.user.userId,
      following: creatorDoc._id,
    })

    isFollowing = !!followerQuery
  }
  let creator = removePrivateFields(creatorDoc)
  creator = {
    ...creator,
    followerCount,
    followingCount,
    creationsCount,
    isFollowing,
  }
  return reply.status(200).send({ creator })
}

export const updateCreator = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { username, userImage, instagramHandle, preferences } =
    request.body as CreatorsUpdateArguments

  const creator = await User.findById(userId)
  if (!creator) {
    return reply.status(404).send({
      message: 'Creator not found',
    })
  }
  if (username) {
    if (username.length < 3 || username.length > 32) {
      if (username === creator.userId) {
        creator.username = username
      } else {
        return reply.status(400).send({
          message:
            'Username must be between 3 and 32 characters (or your address)',
        })
      }
    }

    // check if username exists, case-insensitive
    const userExists = await User.exists({
      username: { $regex: username.toLowerCase(), $options: 'i' },
    })

    if (userExists) {
      return reply.status(400).send({
        message: 'Username already taken',
      })
    }

    creator.username = username
  }

  if (userImage) {
    creator.userImage = userImage
  }

  if (instagramHandle !== undefined && instagramHandle !== null) {
    if (instagramHandle === '') {
      creator.instagramHandle = ''
    } else {
      const existingInstagramUser = await User.findOne({
        instagramHandle: {
          $regex: instagramHandle.toLowerCase(),
          $options: 'i',
        },
      })
      if (
        existingInstagramUser &&
        existingInstagramUser._id.toString() !== creator._id.toString()
      ) {
        return reply.status(400).send({
          message: 'Instagram handle already taken',
        })
      }
      creator.instagramHandle = instagramHandle
    }
  }

  if (preferences !== undefined && preferences !== null) {
    if (!creator.preferences) {
      creator.preferences = {}
    }

    if (preferences.agent_spend_threshold !== undefined) {
      if (preferences.agent_spend_threshold < 0) {
        return reply.status(400).send({
          message: 'Agent spend threshold must be a positive number',
        })
      }
      creator.preferences.agent_spend_threshold =
        preferences.agent_spend_threshold
    }
  }

  try {
    await creator.save()
  } catch (e) {
    console.error(e)
    return reply.status(400).send({
      message: 'Failed to save',
    })
  }

  return reply.status(200).send({
    creator,
  })
}

export const followCreator = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { userId: userIdToFollow } = request.body as CreatorsFollowArguments

  const user = await User.findById(userId.toString())

  if (!user) {
    return reply.status(400).send({
      message: 'User does not exist',
    })
  }

  const userToFollow = await User.findOne({ _id: userIdToFollow })

  if (!userToFollow) {
    return reply.status(400).send({
      message: 'User does not exist',
    })
  }

  if (user._id === userToFollow._id) {
    return reply.status(400).send({
      message: 'Cannot follow yourself',
    })
  }

  const followData = {
    follower: user._id,
    following: userToFollow._id,
  }

  const followResult = await Follow.findOne(followData)

  if (followResult) {
    return reply.status(400).send({
      message: 'Already following user',
    })
  }

  await Follow.create(followData)

  await userToFollow.updateOne({
    $inc: {
      followerCount: 1,
    },
  })
  await user.updateOne({
    $inc: {
      followingCount: 1,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}

export const unfollowCreator = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { userId: userIdToUnfollow } = request.body as CreatorsUnfollowArguments

  const user = await User.findById(userId.toString())

  if (!user) {
    return reply.status(400).send({
      message: 'User does not exist',
    })
  }

  const userToUnfollow = await User.findOne({ _id: userIdToUnfollow })

  if (!userToUnfollow) {
    return reply.status(400).send({
      message: 'User does not exist',
    })
  }

  if (user._id === userToUnfollow._id) {
    return reply.status(400).send({
      message: 'Cannot follow yourself',
    })
  }

  const followData = {
    follower: user._id,
    following: userToUnfollow._id,
  }

  const follow: FollowDocument | null = await Follow.findOne(followData)

  if (!follow) {
    return reply.status(400).send({
      message: 'Not following user',
    })
  }

  await follow.deleteOne()

  await userToUnfollow.updateOne({
    $inc: {
      followerCount: -1,
    },
  })
  await user.updateOne({
    $inc: {
      followingCount: -1,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}

export const getCreatorMe = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const user = await User.findById(userId.toString())

  if (!user) {
    return reply.status(400).send({
      message: 'User does not exist',
    })
  }

  const manna = await Manna.findOne({ user: user._id })

  const subscriptionBalance = manna?.subscriptionBalance || 0
  const balance = manna?.balance || 0
  const totalBalance = subscriptionBalance + balance

  return {
    creator: user,
    balance: totalBalance,
    subscriptionBalance,
    foreverBalance: balance,
  }
}
