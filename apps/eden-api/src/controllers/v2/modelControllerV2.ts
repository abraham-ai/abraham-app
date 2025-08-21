import { User } from '../../models/User'
import { LikeV2 } from '../../models/v2/LikeV2'
import { ModelV2 } from '../../models/v2/ModelV2'
import { s3Url } from '../../plugins/s3Plugin'
import ModelV2Repository from '../../repositories/ModelV2Repository'
import {
  ModelsV2GetArguments,
  ModelsV2ListArguments,
  ModelsV2PatchArguments,
  SubscriptionTier,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export const listModels = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }
  

  const { modelId, limit, page, sort } = request.query as ModelsV2ListArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const modelsRepository = new ModelV2Repository(ModelV2)

  const query: ModelsV2ListArguments = {
    // user: user._id.toString(),
    // createdAt: {
    //   $gte: new Date(new Date().getTime() - (7 * 24 * 60 * 60 * 1000)),
    // },
    // ...typeQuery,
  }

  if (modelId) {
    query.modelId = modelId
  }

  const models = await modelsRepository.query(query, {
    select: '-args.lora_training_urls',
    limit,
    page,
    sort: {
      ...sort,
      createdAt: -1,
    },
  })

  return reply.status(200).send(models)
}

export const getModel = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { modelId } = request.params as ModelsV2GetArguments
  const { userId } = request.user || {}

  const model = await ModelV2.findOneWithDeleted({
    _id: modelId,
  })
    .populate({
      path: 'user',
      select: '_id userId username userImage',
    })
    .populate({
      path: 'task',
      select: '_id args',
    })

  if (!model) {
    return reply.status(404).send({
      message: 'Model not found',
    })
  }

  const isOwner = model.user._id.toString() === request.user?.userId.toString()

  if (!isOwner && !model.public) {
    return reply.status(401).send({
      message: 'User not authorized to view this',
    })
  }

  // Check if user has liked this model
  if (userId) {
    const userLike = await LikeV2.findOne({
      user: userId,
      entityType: 'model',
      entityId: modelId,
    })
    model.isLiked = !!userLike
  }

  if (!isOwner && model?.task?.args) {
    delete model.task.args.lora_training_urls
  }

  model.thumbnail = s3Url(server, model.thumbnail || '')

  return reply.status(200).send({ model })
}

export const modelUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { modelId } = request.params as ModelsV2PatchArguments
  const { public: isPublic, deleted } = request.body as ModelsV2PatchArguments

  if (
    !userId ||
    !modelId ||
    (typeof isPublic === 'undefined' && typeof deleted === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  const model = await ModelV2.findOne({
    _id: modelId,
    user: userId,
  })

  if (!model) {
    return reply.status(404).send({
      message: 'Model not found',
    })
  }

  if (isPublic === false) {
    const user = request.user
    if (user.subscriptionTier === SubscriptionTier.Free) {
      return reply.status(401).send({
        error: 'You are not authorized to make a model private',
      })
    }
  }

  if (typeof isPublic !== 'undefined') {
    model.public = isPublic
  }

  if (typeof deleted !== 'undefined') {
    model.deleted = deleted
  }

  await model.save()

  await model.populate({
    path: 'user',
    select: '_id username userId userImage',
  })

  return reply.status(200).send({
    model,
  })
}

export const likeModel = async (
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

  const { modelId } = request.params as { modelId: string }

  if (!modelId) {
    return reply.status(422).send({
      message: 'Model ID is required',
    })
  }

  try {
    // Check if the model exists and user has access to it
    const model = await ModelV2.findOne({
      _id: modelId,
      deleted: false,
      $or: [{ public: true }, { user: userId }],
    })

    if (!model) {
      return reply.status(404).send({
        message: 'Model not found or you do not have access to it',
      })
    }

    // Check if user has already liked this model
    const existingLike = await LikeV2.findOne({
      user: userId,
      entityType: 'model',
      entityId: modelId,
    })

    if (existingLike) {
      return reply.status(400).send({
        message: 'Model already liked by user',
      })
    }

    // Create the like
    await LikeV2.create({
      user: userId,
      entityType: 'model',
      entityId: modelId,
    })

    // Increment the like count
    await ModelV2.findByIdAndUpdate(modelId, {
      $inc: { likeCount: 1 },
    })

    return reply.status(200).send({
      message: 'Model liked successfully',
    })
  } catch (error) {
    console.error('Error liking model:', error)
    return reply.status(500).send({
      message: 'Error liking model',
    })
  }
}

export const unlikeModel = async (
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

  const { modelId } = request.params as { modelId: string }

  if (!modelId) {
    return reply.status(422).send({
      message: 'Model ID is required',
    })
  }

  try {
    // Check if the model exists and user has access to it
    const model = await ModelV2.findOne({
      _id: modelId,
      deleted: false,
      $or: [{ public: true }, { user: userId }],
    })

    if (!model) {
      return reply.status(404).send({
        message: 'Model not found or you do not have access to it',
      })
    }

    // Check if the like exists
    const like = await LikeV2.findOne({
      user: userId,
      entityType: 'model',
      entityId: modelId,
    })

    if (!like) {
      return reply.status(404).send({
        message: 'Like not found',
      })
    }

    // Delete the like
    await LikeV2.findByIdAndDelete(like._id)

    // Decrement the like count
    if (model.likeCount && model.likeCount > 0) {
      await ModelV2.findByIdAndUpdate(modelId, {
        $inc: { likeCount: -1 },
      })
    }

    return reply.status(200).send({
      message: 'Model unliked successfully',
    })
  } catch (error) {
    console.error('Error unliking model:', error)
    return reply.status(500).send({
      message: 'Error unliking model',
    })
  }
}
