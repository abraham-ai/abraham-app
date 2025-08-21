import { CreationV2, CreationV2Document } from '../../models/v2/CreationV2'
import { LikeV2 } from '../../models/v2/LikeV2'
import {
  forceCloudfrontUrl,
  s3ThumbnailUrl,
  s3Url,
} from '../../plugins/s3Plugin'
import {
  CreationsV2BulkPatchArguments,
  CreationsV2GetArguments,
  CreationsV2PatchArguments,
} from '@edenlabs/eden-sdk'
import { SubscriptionTier } from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export const getCreation = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { creationId } = request.params as CreationsV2GetArguments
  const { userId } = request.user || {}

  const creation = (await CreationV2.findOneWithDeleted({
    _id: creationId,
  })
    // .populate({
    //   path: 'concept',
    //   select: '_id name user conceptName creationCount thumbnail',
    // })
    .populate({
      path: 'task',
      select: '_id args',
    })
    .populate({
      path: 'user',
      select: '_id userId username userImage type',
      model: 'users3',
    })
    .populate({
      path: 'agent',
      select: '_id username name userImage type',
    })) as CreationV2Document

  if (!creation || creation.deleted) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  // Check if user has liked this creation
  if (userId) {
    const userLike = await LikeV2.findOne({
      user: userId,
      entityType: 'creation',
      entityId: creationId,
    })
    creation.isLiked = !!userLike
  }

  console.log({ creation })

  // if (!creation.public) {
  //   if (creation.user._id.toString() !== request.user?.userId.toString()) {
  //     console.error('User not authorized to view this')
  //     return reply.status(401).send({
  //       message: 'User not authorized to view this',
  //     })
  //   }
  // }

  creation.url = s3Url(server, creation.filename || '')
  creation.thumbnail = s3ThumbnailUrl(server, creation.filename || '', 1024)

  //@ts-expect-error This stupid overloading of ids with full docs...
  if (creation.user.userImage) {
    //@ts-expect-error This stupid overloading of ids with full docs...
    creation.user.userImage = forceCloudfrontUrl(
      server,
      //@ts-expect-error This stupid overloading of ids with full docs...
      creation.user.userImage,
    )
  }

  return reply.status(200).send({ creation })
}

export const creationUpdate = async (
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

  const { creationId } = request.params as CreationsV2PatchArguments
  const { public: isPublic, deleted } =
    request.body as CreationsV2PatchArguments

  if (
    !userId ||
    !creationId ||
    (typeof isPublic === 'undefined' && typeof deleted === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  const creation = await CreationV2.findOne({
    _id: creationId,
    user: userId,
  })

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  if (isPublic === false) {
    const user = request.user
    if (user.subscriptionTier === SubscriptionTier.Free) {
      return reply.status(401).send({
        error: 'You are not authorized to make a creation private',
      })
    }
  }

  if (typeof isPublic !== 'undefined') {
    creation.public = isPublic
  }

  if (typeof deleted !== 'undefined') {
    creation.deleted = deleted
  }

  await creation.save()

  await creation.populate({
    path: 'user',
    select: '_id username userId userImage type',
  })
  await creation.populate({
    path: 'agent',
    select: '_id username name userImage type',
  })
  await creation.populate({
    path: 'task',
    select: '_id args',
  })

  creation.url = s3Url(server, creation.filename || '')
  creation.thumbnail = s3ThumbnailUrl(server, creation.filename || '', 1024)

  return reply.status(200).send({
    creation,
  })
}

interface UpdateResult {
  creationId: string
  status: 'success' | 'failed'
  creation?: any // Replace 'any' with your creation type
  error?: string
}

export const creationBulkUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const {
    creationIds,
    public: isPublic,
    deleted,
  } = request.body as CreationsV2BulkPatchArguments

  if (
    !userId ||
    !creationIds ||
    !Array.isArray(creationIds) ||
    creationIds.length === 0 ||
    (typeof isPublic === 'undefined' && typeof deleted === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  const results: UpdateResult[] = []

  if (isPublic === false) {
    const user = request.user
    if (user.subscriptionTier === SubscriptionTier.Free) {
      return reply.status(401).send({
        error: 'You are not authorized to make creations private',
      })
    }
  }

  for (const creationId of creationIds) {
    try {
      // Find the creation belonging to the user
      const creation = await CreationV2.findOne({
        _id: creationId,
        user: userId,
      })

      if (!creation) {
        // If creation not found, record the failure
        results.push({
          creationId,
          status: 'failed',
          error: 'Creation not found',
        })
        continue // Proceed to the next creationId
      }

      // Update the fields if they are provided
      if (typeof isPublic !== 'undefined') {
        creation.public = isPublic
      }

      if (typeof deleted !== 'undefined') {
        creation.deleted = deleted
      }

      // Save the updated creation
      await creation.save()

      // Populate the 'user' field as needed
      await creation.populate({
        path: 'user',
        select: '_id username userId userImage',
      })

      await creation.populate({
        path: 'task',
        select: '_id args',
      })

      // Record the successful update
      results.push({
        creationId,
        status: 'success',
        creation, // Optionally include the updated creation data
      })
    } catch (error: any) {
      // Handle any unexpected errors during the update process
      results.push({
        creationId,
        status: 'failed',
        error: error.message || 'An unexpected error occurred',
      })
    }
  }

  // **4. Send the Response with All Results**
  return reply.status(200).send({
    results,
  })
}

export const likeCreation = async (
  _server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { creationId } = request.params as { creationId: string }

  if (!creationId) {
    return reply.status(422).send({
      message: 'Creation ID is required',
    })
  }

  try {
    // Check if the creation exists and user has access to it
    const creation = await CreationV2.findOne({
      _id: creationId,
      deleted: false,
      $or: [{ public: true }, { user: userId }],
    })

    if (!creation) {
      return reply.status(404).send({
        message: 'Creation not found or you do not have access to it',
      })
    }

    // Check if user has already liked this creation
    const existingLike = await LikeV2.findOne({
      user: userId,
      entityType: 'creation',
      entityId: creationId,
    })

    if (existingLike) {
      return reply.status(400).send({
        message: 'Creation already liked by user',
      })
    }

    // Create the like
    await LikeV2.create({
      user: userId,
      entityType: 'creation',
      entityId: creationId,
    })

    // Increment the like count
    await CreationV2.findByIdAndUpdate(creationId, {
      $inc: { likeCount: 1 },
    })

    return reply.status(200).send({
      message: 'Creation liked successfully',
    })
  } catch (error) {
    console.error('Error liking creation:', error)
    return reply.status(500).send({
      message: 'Error liking creation',
    })
  }
}

export const unlikeCreation = async (
  _server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { creationId } = request.params as { creationId: string }

  if (!creationId) {
    return reply.status(422).send({
      message: 'Creation ID is required',
    })
  }

  try {
    // Check if the creation exists and user has access to it
    const creation = await CreationV2.findOne({
      _id: creationId,
      deleted: false,
      $or: [{ public: true }, { user: userId }],
    })

    if (!creation) {
      return reply.status(404).send({
        message: 'Creation not found or you do not have access to it',
      })
    }

    // Check if the like exists
    const like = await LikeV2.findOne({
      user: userId,
      entityType: 'creation',
      entityId: creationId,
    })

    if (!like) {
      return reply.status(404).send({
        message: 'Like not found',
      })
    }

    // Delete the like
    await LikeV2.findByIdAndDelete(like._id)

    // Decrement the like count
    if (creation.likeCount && creation.likeCount > 0) {
      await CreationV2.findByIdAndUpdate(creationId, {
        $inc: { likeCount: -1 },
      })
    }

    return reply.status(200).send({
      message: 'Creation unliked successfully',
    })
  } catch (error) {
    console.error('Error unliking creation:', error)
    return reply.status(500).send({
      message: 'Error unliking creation',
    })
  }
}
