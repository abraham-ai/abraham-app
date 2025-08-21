import { Agent, AgentDocument } from '../models/Agent'
import { AgentPermission, PermissionLevel } from '../models/AgentPermission'
import { Deployment } from '../models/Deployment'
import { Notification } from '../models/Notification'
import { Trigger } from '../models/Trigger'
import { User } from '../models/User'
import { LikeV2 } from '../models/v2/LikeV2'
import { ModelV2 } from '../models/v2/ModelV2'
import { forceCloudfrontUrl } from '../plugins/s3Plugin'
import AgentRepository from '../repositories/AgentRepository'
import { generateBlurhash } from '../utils/blurhash'
import { createIdOrSlugQuery, createMultiFieldQuery } from '../utils/mongoUtils'
import {
  AgentGetArguments,
  AgentsCreateArguments,
  AgentsCreateTriggerArguments,
  AgentsCreateTriggerResponse,
  AgentsDeleteArguments,
  AgentsDeleteTriggerResponse,
  AgentsDeployArguments,
  AgentsDeployResponse,
  AgentsStopDeploymentArguments,
  AgentsStopDeploymentResponse,
  AgentsUpdateArguments,
  AgentsUpdateDeploymentArguments,
  FeatureFlag,
  SubscriptionTier,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { UpdateResult } from 'mongodb'
import { UpdateQuery } from 'mongoose'

// Helper function to check if user has owner-level permissions
const hasOwnerPermissions = async (
  agentId: string,
  userId: string,
): Promise<boolean> => {
  // Check if user is the original owner
  const agent = await Agent.findById(agentId)
  if (!agent) return false

  if (agent.owner.toString() === userId) {
    return true
  }

  // Check if user has owner permission
  const permission = await AgentPermission.findOne({
    agent: agentId,
    user: userId,
    level: PermissionLevel.Owner,
  })

  return !!permission
}

export const getAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as AgentGetArguments
  const query = createIdOrSlugQuery(agentId)
  const agent = await Agent.findOne(query)

  if (!agent || agent.deleted) {
    return reply.status(404).send({ error: 'Agent not found' })
  }

  const currentUserId = request.user ? request.user.userId : undefined
  const isOwnAgent =
    currentUserId && agent.owner.toString() === currentUserId.toString()

  const agentRepository = new AgentRepository(Agent)

  await Promise.all([
    agentRepository.model.populate(agent, {
      path: 'owner',
      select: '_id userId username userImage',
    }),
    isOwnAgent && agent.deployments && agent.deployments.length > 0
      ? agentRepository.model.populate(agent, {
          path: 'deployments',
          select: '_id platform',
          model: Deployment,
        })
      : Promise.resolve(),
    // No longer needed - permissions are in separate collection
  ])

  if (agent.userImage) {
    agent.userImage = forceCloudfrontUrl(server, agent.userImage)
  }

  if (agent.owner.userImage) {
    agent.owner.userImage = forceCloudfrontUrl(server, agent.owner.userImage)
  }

  // Check if user has liked this agent
  if (currentUserId) {
    const userLike = await LikeV2.findOne({
      user: currentUserId,
      entityType: 'agent',
      entityId: agent._id,
    })
    agent.isLiked = !!userLike
  }

  // Get permissions if user is owner
  if (isOwnAgent) {
    const permissions = await AgentPermission.find({
      agent: agent._id,
    }).populate('user', '_id userId username userImage')

    // Attach permissions to response
    ;(agent as any).permissions = permissions
  }

  return reply.status(200).send({ agent })
}

export const createAgent = async (
  _server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    name,
    key,
    description,
    image,
    models,
    persona,
    isPersonaPublic,
    greeting,
    knowledge,
    suggestions,
    voice,
    tools,
  } = request.body as AgentsCreateArguments

  const currentUserId = request.user.userId

  if (models && models.length > 10) {
    return reply.status(422).send({
      error: 'Cannot have more than 10 models',
    })
  }

  // Verify access to all models if provided
  if (models && models.length > 0) {
    for (const model of models) {
      await verifyModelAccess(reply, model.lora, currentUserId.toString())
    }
  }

  const imageFilename = image.split('/').pop()

  const agent = new Agent({
    type: 'agent',
    owner: currentUserId,
    username: key,
    name: name,
    userImage: imageFilename,
    description,
    persona,
    isPersonaPublic,
    greeting,
    knowledge,
    suggestions,
    voice,
    models: models || [],
    tools,
    featureFlags: [FeatureFlag.FreeTools],
  })

  try {
    await agent.save()
  } catch (error) {
    // @ts-ignore
    if (error.code === 11000) {
      return reply.status(409).send({
        error: 'An agent with this key already exists',
      })
    }

    return reply.status(500).send({
      error: 'An error occurred while creating the agent',
    })
  }

  return reply.status(200).send({ agentId: agent._id })
}

export const updateAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { agentId } = request.params as AgentsUpdateArguments
  const {
    name,
    key,
    description,
    persona,
    isPersonaPublic,
    greeting,
    knowledge,
    suggestions,
    image,
    voice,
    models,
    public: isPublic,
    owner_pays,
    tools,
  } = request.body as AgentsUpdateArguments

  if (models && models.length > 10) {
    return reply.status(422).send({
      error: 'Cannot have more than 10 models',
    })
  }

  if (!agentId) {
    return reply.status(422).send({
      error: 'Missing agentId',
    })
  }

  if (isPublic === false) {
    const user = request.user
    if (user.subscriptionTier === SubscriptionTier.Free) {
      return reply.status(401).send({
        error: 'You are not authorized to make an agent private',
      })
    }
  }

  const query = createIdOrSlugQuery(agentId)

  const updateData: UpdateQuery<AgentDocument> = {
    username: key,
    name: name,
    description,
    persona,
    isPersonaPublic,
    greeting,
    knowledge,
    suggestions,
    voice,
    public: isPublic,
    owner_pays,
    tools,
  }

  // Handle models array
  if (!models || models.length === 0) {
    updateData.$unset = { models: 1 }
  } else {
    // Verify access to all models
    for (const model of models) {
      await verifyModelAccess(reply, model.lora, currentUserId.toString())
    }
    updateData.models = models
  }

  // Only update image fields if image is explicitly provided in the request
  if (image !== undefined) {
    if (!image || image === '') {
      updateData.userImage = null
      updateData.blurhash = null
    } else if (image.startsWith('http')) {
      // This is a new uploaded image URL - process it
      const blurhash = await generateBlurhash(server, image)
      const imageFilename = image.split('/').pop()

      updateData.userImage = imageFilename
      updateData.blurhash = blurhash
    }
    // If image is just a filename (existing image), don't update image fields
  }

  let result: UpdateResult
  // Check if user is owner or editor
  const agentToCheck = await Agent.findOne({
    ...query,
    deleted: false,
  })

  if (!agentToCheck) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  const isOriginalOwner =
    agentToCheck.owner.toString() === currentUserId.toString()

  // Check new permissions system
  let hasPermission = isOriginalOwner
  if (!hasPermission) {
    const permission = await AgentPermission.findOne({
      agent: agentId,
      user: currentUserId,
    })
    hasPermission = !!permission
  }

  if (!hasPermission) {
    return reply.status(401).send({
      error: 'You are not authorized to update this agent',
    })
  }

  try {
    result = await Agent.updateOne(
      {
        ...query,
        deleted: false,
      },
      updateData,
    )
  } catch (error) {
    // @ts-ignore
    if (error.code === 11000) {
      return reply.status(409).send({
        error: 'An agent with this key already exists',
      })
    }

    return reply.status(500).send({
      error: 'An error occurred while updating the agent',
    })
  }

  if (!result.matchedCount) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  return reply.status(200).send({
    agentId,
  })
}

export const getAgentTriggers = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const currentUserId = request.user.userId
  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to view triggers for this agent',
    })
  }

  const triggers = await Trigger.find({
    agent: agentId,
    $or: [{ deleted: { $exists: false } }, { deleted: false }],
  })

  return reply.status(200).send({
    triggers,
  })
}

export const createAgentTrigger = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    agentId,
    instruction,
    session_type,
    session,
    schedule,
    posting_instructions,
  } = request.body as AgentsCreateTriggerArguments
  const currentUserId = request.user.userId
  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to create triggers for this agent',
    })
  }

  const updateData = {
    agent: agentId,
    user: currentUserId,
    instruction,
    session_type,
    session,
    schedule,
    posting_instructions,
  }

  const edenComputeRequest = {
    endpoint: `${server.config.EDEN_COMPUTE_API_URL}/triggers/create`,
    data: updateData,
  }

  const edenComputeResponse = await axios.post(
    edenComputeRequest.endpoint,
    edenComputeRequest.data,
    {
      headers: {
        Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
      },
    },
  )

  const response = edenComputeResponse.data as AgentsCreateTriggerResponse

  return reply.status(200).send({
    triggerId: response.trigger_id,
  })
}

const calculateNextScheduledRun = (schedule: any): Date | null => {
  if (!schedule) return null

  const now = new Date()

  // For one-time tasks (start_date equals end_date)
  if (schedule.start_date && schedule.end_date) {
    const startDate = new Date(schedule.start_date)
    const endDate = new Date(schedule.end_date)

    if (startDate.getTime() === endDate.getTime()) {
      // One-time task
      return startDate > now ? startDate : null
    }
  }

  // For recurring tasks, calculate next run based on current time
  if (schedule.hour !== undefined && schedule.minute !== undefined) {
    const nextRun = new Date()
    nextRun.setHours(parseInt(schedule.hour.toString(), 10))
    nextRun.setMinutes(parseInt(schedule.minute.toString(), 10))
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)

    // If the time today has passed, move to next occurrence based on schedule
    if (nextRun <= now) {
      if (schedule.day_of_week === '*') {
        // Daily - add 1 day
        nextRun.setDate(nextRun.getDate() + 1)
      } else if (schedule.day_of_week) {
        // Weekly - find next occurrence of the day
        const targetDay = parseInt(schedule.day_of_week.toString(), 10)
        const currentDay = nextRun.getDay()
        let daysUntilNext = targetDay - currentDay
        if (daysUntilNext <= 0) daysUntilNext += 7
        nextRun.setDate(nextRun.getDate() + daysUntilNext)
      } else if (schedule.month && schedule.day) {
        // Annually - find next occurrence
        const targetMonth = parseInt(schedule.month.toString(), 10) - 1 // 0-indexed
        const targetDay = parseInt(schedule.day.toString(), 10)
        nextRun.setMonth(targetMonth)
        nextRun.setDate(targetDay)
        if (nextRun <= now) {
          nextRun.setFullYear(nextRun.getFullYear() + 1)
        }
      } else if (schedule.day) {
        // Monthly - find next occurrence of the day
        const targetDay = parseInt(schedule.day.toString(), 10)
        nextRun.setDate(targetDay)
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1)
        }
      }
    }

    return nextRun
  }

  return null
}

export const updateAgentTrigger = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId, triggerId } = request.params as {
    agentId: string
    triggerId: string
  }
  const {
    instruction,
    session_type,
    session,
    schedule,
    status,
    posting_instructions,
  } = request.body as {
    instruction?: string
    session_type?: 'new' | 'another'
    session?: string | null
    schedule?: any
    status?: 'active' | 'paused' | 'finished'
    posting_instructions?: any
  }
  const currentUserId = request.user.userId

  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to update triggers for this agent',
    })
  }

  // Find the trigger to update
  const trigger = await Trigger.findById(triggerId)

  if (!trigger) {
    return reply.status(404).send({
      error: 'Trigger not found',
    })
  }

  // Verify the trigger belongs to the agent
  if (trigger.agent.toString() !== agentId) {
    return reply.status(401).send({
      error: 'Trigger does not belong to this agent',
    })
  }

  // Validate schedule if provided
  if (schedule !== undefined) {
    const nextRun = calculateNextScheduledRun(schedule)
    if (nextRun) {
      const now = new Date()
      const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000)

      if (nextRun < twoMinutesFromNow) {
        return reply.status(400).send({
          error: 'Next scheduled run must be at least 2 minutes in the future',
        })
      }
    }
  }

  // Build update data - only include fields that are provided
  const updateData: any = {}

  if (instruction !== undefined) updateData.instruction = instruction
  if (session_type !== undefined) updateData.session_type = session_type
  if (session !== undefined) updateData.session = session
  if (schedule !== undefined) {
    updateData.schedule = schedule
    // Calculate and update next_scheduled_run when schedule is updated
    updateData.next_scheduled_run = calculateNextScheduledRun(schedule)
  }
  if (status !== undefined) updateData.status = status
  if (posting_instructions !== undefined)
    updateData.posting_instructions = posting_instructions

  // Update the trigger
  const updatedTrigger = await Trigger.findByIdAndUpdate(
    triggerId,
    updateData,
    { new: true },
  )

  return reply.status(200).send({
    trigger: updatedTrigger,
  })
}

export const deleteAgentTrigger = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId, triggerId } = request.params as {
    agentId: string
    triggerId: string
  }
  const currentUserId = request.user.userId

  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to delete triggers for this agent',
    })
  }

  const edenComputeRequest = {
    endpoint: `${server.config.EDEN_COMPUTE_API_URL}/triggers/delete`,
    data: { id: triggerId },
  }

  const edenComputeResponse = await axios.post(
    edenComputeRequest.endpoint,
    edenComputeRequest.data,
    {
      headers: {
        Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
      },
    },
  )

  const response = edenComputeResponse.data as AgentsDeleteTriggerResponse

  return reply.status(200).send({
    success: response.success,
  })
}

export const getAgentDeployments = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const currentUserId = request.user.userId
  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to view deployments for this agent',
    })
  }

  const deployments = await Deployment.find({
    agent: agentId,
  })

  return reply.status(200).send({
    deployments,
  })
}

export const deployAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId
  const { agentId } = request.params as AgentsDeployArguments
  const { platform, secrets, config } = request.body as AgentsDeployArguments

  const agent = await Agent.findById(agentId)

  if (!request.user.featureFlags.includes(FeatureFlag.Preview)) {
    return reply.status(401).send({
      error: 'You are not authorized to use this feature.',
    })
  }

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to deploy this agent',
    })
  }

  try {
    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/v2/deployments/create`,
      data: {
        agent: agentId,
        user: currentUserId,
        platform,
        secrets,
        config,
      },
    }

    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )

    const deployment = modalResponse.data as AgentsDeployResponse

    return reply.status(200).send({
      deploymentId: deployment.deployment_id,
    })
  } catch (error: any) {
    console.error(error)
    return reply.status(500).send({
      error:
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        'An error occurred while deploying the agent',
    })
  }
}

export const updateAgentDeployment = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId
  const { agentId } = request.params as AgentsUpdateDeploymentArguments
  const { platform, config, secrets } =
    request.body as AgentsUpdateDeploymentArguments

  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to update this deployment',
    })
  }

  const deployment = await Deployment.findOne({
    agent: agentId,
    platform,
  })

  if (!deployment) {
    return reply.status(404).send({
      error: 'Deployment not found',
    })
  }

  if (deployment.agent.toString() !== agentId) {
    return reply.status(401).send({
      error: 'User not authorized to update this deployment',
    })
  }

  try {
    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/v2/deployments/update`,
      data: {
        deployment_id: deployment._id,
        config,
        secrets,
      },
    }

    await axios.post(modalRequest.endpoint, modalRequest.data, {
      headers: {
        Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
      },
    })

    return reply.status(200).send({
      deploymentId: deployment._id,
    })
  } catch (error) {
    console.error(error)
    return reply.status(500).send({
      error: 'An error occurred while updating the deployment',
    })
  }
}

export const deleteAgentDeployment = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId
  const { agentId, platform } = request.params as AgentsStopDeploymentArguments

  const agent = await Agent.findById(agentId)

  if (!agent) {
    return reply.status(404).send({
      error: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      error: 'User not authorized to stop this deployment',
    })
  }

  // Find the deployment to get its ID for the v2 API
  const deployment = await Deployment.findOne({
    agent: agentId,
    platform,
  })

  if (!deployment) {
    return reply.status(404).send({
      error: 'Deployment not found',
    })
  }

  try {
    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/v2/deployments/delete`,
      data: {
        deployment_id: deployment._id,
      },
    }

    const modalResponse = await axios.post(
      modalRequest.endpoint,
      modalRequest.data,
      {
        headers: {
          Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
        },
      },
    )

    const response = modalResponse.data as AgentsStopDeploymentResponse

    return reply.status(200).send({
      success: response.success,
    })
  } catch (error) {
    console.error(error)
    return reply.status(500).send({
      error: 'An error occurred while stopping the deployment',
    })
  }
}

export const deleteAgent = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  const { agentId } = request.params as AgentsDeleteArguments

  const agent = await Agent.findOne({
    _id: agentId,
  })

  if (!agent || agent.deleted) {
    return reply.status(404).send({
      message: 'Agent not found',
    })
  }

  if (
    !(await hasOwnerPermissions(agent._id.toString(), currentUserId.toString()))
  ) {
    return reply.status(401).send({
      message: 'User not authorized to delete this',
    })
  }

  await agent.delete()

  return reply.status(200).send()
}

const verifyModelAccess = async (
  reply: FastifyReply,
  modelId: string,
  currentUserId: string,
) => {
  const model = await ModelV2.findById(modelId)

  if (!model || model.deleted) {
    return reply.status(404).send({
      error: 'Model not found',
    })
  }

  const isOwnModel = model.user.toString() === currentUserId.toString()
  if (!isOwnModel && !model.public) {
    return reply.status(401).send({
      error: 'You are not authorized to use this model',
    })
  }
}

export const likeAgent = async (
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

  const { agentId } = request.params as { agentId: string }

  if (!agentId) {
    return reply.status(422).send({
      message: 'Agent ID is required',
    })
  }

  try {
    // Check if the agent exists and user has access to it
    const agent = await Agent.findOne({
      _id: agentId,
      deleted: false,
      $or: [{ public: true }, { owner: userId }],
    })

    if (!agent) {
      return reply.status(404).send({
        message: 'Agent not found or you do not have access to it',
      })
    }

    // Check if user has already liked this agent
    const existingLike = await LikeV2.findOne({
      user: userId,
      entityType: 'agent',
      entityId: agentId,
    })

    if (existingLike) {
      return reply.status(400).send({
        message: 'Agent already liked by user',
      })
    }

    // Create the like
    await LikeV2.create({
      user: userId,
      entityType: 'agent',
      entityId: agentId,
    })

    // Increment the like count
    await Agent.findByIdAndUpdate(agentId, {
      $inc: { likeCount: 1 },
    })

    return reply.status(200).send({
      message: 'Agent liked successfully',
    })
  } catch (error) {
    console.error('Error liking agent:', error)
    return reply.status(500).send({
      message: 'Error liking agent',
    })
  }
}

export const unlikeAgent = async (
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

  const { agentId } = request.params as { agentId: string }

  if (!agentId) {
    return reply.status(422).send({
      message: 'Agent ID is required',
    })
  }

  try {
    // Check if the agent exists and user has access to it
    const agent = await Agent.findOne({
      _id: agentId,
      deleted: false,
      $or: [{ public: true }, { owner: userId }],
    })

    if (!agent) {
      return reply.status(404).send({
        message: 'Agent not found or you do not have access to it',
      })
    }

    // Check if the like exists
    const like = await LikeV2.findOne({
      user: userId,
      entityType: 'agent',
      entityId: agentId,
    })

    if (!like) {
      return reply.status(404).send({
        message: 'Like not found',
      })
    }

    // Delete the like
    await LikeV2.findByIdAndDelete(like._id)

    // Decrement the like count
    if (agent.likeCount && agent.likeCount > 0) {
      await Agent.findByIdAndUpdate(agentId, {
        $inc: { likeCount: -1 },
      })
    }

    return reply.status(200).send({
      message: 'Agent unliked successfully',
    })
  } catch (error) {
    console.error('Error unliking agent:', error)
    return reply.status(500).send({
      message: 'Error unliking agent',
    })
  }
}

export const getAllUserTriggers = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  try {
    // Get all user's agents
    const agents = await Agent.find({
      owner: currentUserId,
      deleted: false,
    }).select('_id name username userImage')

    const agentIds = agents.map(agent => agent._id)

    if (agentIds.length === 0) {
      return reply.status(200).send({
        triggers: [],
      })
    }

    type TriggerWithAgent = typeof Trigger & {
      agent: {
        _id: string
        name: string
        username: string
        userImage: string
      }
    }

    // Get all triggers for user's agents
    const triggers = (await Trigger.find({
      agent: { $in: agentIds },
      $or: [{ deleted: { $exists: false } }, { deleted: false }],
    }).populate({
      path: 'agent',
      select: '_id name username userImage',
      model: Agent,
    })) as TriggerWithAgent[]

    // Force cloudfront URLs for agent images
    triggers.forEach(trigger => {
      if (trigger.agent && trigger.agent.userImage) {
        trigger.agent.userImage = forceCloudfrontUrl(
          server,
          trigger.agent.userImage,
        )
      }
    })

    return reply.status(200).send({
      triggers,
    })
  } catch (error) {
    console.error('Error getting user triggers:', error)
    return reply.status(500).send({
      error: 'Failed to get user triggers',
    })
  }
}

export const getAllUserDeployments = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  try {
    // Get all user's agents
    const agents = await Agent.find({
      owner: currentUserId,
      deleted: false,
    }).select('_id name username userImage')

    const agentIds = agents.map(agent => agent._id)

    if (agentIds.length === 0) {
      return reply.status(200).send({
        deployments: [],
      })
    }

    type DeploymentWithAgent = typeof Deployment & {
      agent: {
        _id: string
        name: string
        username: string
        userImage: string
      }
    }

    // Get all deployments for user's agents
    const deployments = (await Deployment.find({
      agent: { $in: agentIds },
    }).populate({
      path: 'agent',
      select: '_id name username userImage',
      model: Agent,
    })) as DeploymentWithAgent[]

    // Force cloudfront URLs for agent images
    deployments.forEach(deployment => {
      if (deployment.agent && deployment.agent.userImage) {
        deployment.agent.userImage = forceCloudfrontUrl(
          server,
          deployment.agent.userImage,
        )
      }
    })

    return reply.status(200).send({
      deployments,
    })
  } catch (error) {
    console.error('Error getting user deployments:', error)
    return reply.status(500).send({
      error: 'Failed to get user deployments',
    })
  }
}

const validateAgentAccess = async (agentId: string) => {
  const query = createIdOrSlugQuery(agentId)
  const agent = await Agent.findOne(query)

  if (!agent || agent.deleted) {
    return { agent: null, error: 'Agent not found' }
  }

  return { agent, error: null }
}

const createAgentObjectId = (agentId: string, agentDoc: any, mongoose: any) => {
  return mongoose.Types.ObjectId.isValid(agentId)
    ? new mongoose.Types.ObjectId(agentId)
    : new mongoose.Types.ObjectId(agentDoc._id)
}

export const getAgentMemory = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_user')
    const memoryRecord = await memoryCollection.findOne({
      agent_id: createAgentObjectId(agentId, agent, server.mongoose),
      user_id: new server.mongoose.Types.ObjectId(userId),
    })

    let unabsorbedDirectives: any[] = []

    // Get unabsorbed directives if they exist
    if (memoryRecord?.unabsorbed_memory_ids?.length > 0) {
      const sessionMemoryCollection =
        server.mongoose.connection.db.collection('memory_sessions')
      const directiveIds = memoryRecord?.unabsorbed_memory_ids.map(
        (id: any) => new server.mongoose.Types.ObjectId(id),
      )

      const query = {
        agent_id: createAgentObjectId(agentId, agent, server.mongoose),
        memory_type: 'directive',
        related_users: new server.mongoose.Types.ObjectId(userId),
        _id: { $in: directiveIds },
      }

      const directives = await sessionMemoryCollection.find(query).toArray()

      unabsorbedDirectives = directives
        .filter(directive => directive.content?.trim() !== '')
        .map(directive => ({
          _id: directive._id,
          content: directive.content,
          createdAt: directive.createdAt,
        }))
    }

    return reply.status(200).send({
      content: memoryRecord?.content || '',
      unabsorbedDirectives,
    })
  } catch (error) {
    server.log.error('Error fetching user memory:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

export const saveAgentMemory = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const { content } = request.body as { content: string }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_user')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    await memoryCollection.updateOne(
      {
        agent_id: agentObjectId,
        user_id: new server.mongoose.Types.ObjectId(userId),
      },
      {
        $set: {
          content: content || '',
          fully_formed_memory: null,
        },
        $setOnInsert: {
          agent_id: agentObjectId,
          user_id: new server.mongoose.Types.ObjectId(userId),
          agent_owner: null,
          unabsorbed_memory_ids: [],
        },
      },
      { upsert: true },
    )

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error saving user memory:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: retrieve_memory_user
export const retrieveMemoryUser = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_user')
    const memoryRecord = await memoryCollection.findOne({
      agent_id: createAgentObjectId(agentId, agent, server.mongoose),
      user_id: new server.mongoose.Types.ObjectId(userId),
    })

    return reply.status(200).send(memoryRecord || {})
  } catch (error) {
    server.log.error('Error retrieving memory user:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: retrieve_memory_agent
export const retrieveMemoryAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_agent')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    // Find all memory_agent documents for this agent
    const memoryRecords = await memoryCollection
      .find({
        agent_id: agentObjectId,
      })
      .toArray()

    const processedRecords: any[] = []

    for (const record of memoryRecords) {
      let factsWithContent: any[] = []
      let unabsorbedWithContent: any[] = []

      // Process facts array (similar to unabsorbed_memory_ids in User Memory)
      if (record.facts && Array.isArray(record.facts)) {
        const memorySessionCollection =
          server.mongoose.connection.db.collection('memory_sessions')
        const factDocs = await memorySessionCollection
          .find({
            _id: {
              $in: record.facts.map(
                (id: any) => new server.mongoose.Types.ObjectId(id),
              ),
            },
          })
          .toArray()

        factsWithContent = factDocs.map((doc: any) => ({
          _id: doc._id.toString(),
          content: doc.content || '',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }))
      }

      // Process unabsorbed_memory_ids array
      if (
        record.unabsorbed_memory_ids &&
        Array.isArray(record.unabsorbed_memory_ids)
      ) {
        const memorySessionCollection =
          server.mongoose.connection.db.collection('memory_sessions')
        const unabsorbedDocs = await memorySessionCollection
          .find({
            _id: {
              $in: record.unabsorbed_memory_ids.map(
                (id: any) => new server.mongoose.Types.ObjectId(id),
              ),
            },
          })
          .toArray()

        unabsorbedWithContent = unabsorbedDocs.map((doc: any) => ({
          _id: doc._id.toString(),
          content: doc.content || '',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }))
      }

      processedRecords.push({
        ...record,
        _id: record._id.toString(),
        facts: factsWithContent,
        unabsorbed_memory_ids: unabsorbedWithContent,
      })
    }

    return reply.status(200).send({
      shards: processedRecords,
    })
  } catch (error) {
    server.log.error('Error retrieving memory agent:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: update_memory_agent
export const updateMemoryAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId, memoryAgentId } = request.params as {
    agentId: string
    memoryAgentId: string
  }
  const updates = request.body as Record<string, any>
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_agent')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    // Check if we're updating fields that require invalidating fully_formed_memory
    const invalidatingFields = [
      'content',
      'unabsorbed_memory_ids',
      'facts',
      'extraction_prompt',
    ]
    const shouldInvalidate = Object.keys(updates).some(key =>
      invalidatingFields.includes(key),
    )

    const finalUpdates = shouldInvalidate
      ? { ...updates, fully_formed_memory: null }
      : updates

    // Ensure we're only updating a memory_agent document that belongs to this agent
    const result = await memoryCollection.updateOne(
      {
        _id: new server.mongoose.Types.ObjectId(memoryAgentId),
        agent_id: agentObjectId,
      },
      { $set: finalUpdates },
    )

    if (result.matchedCount === 0) {
      return reply
        .status(404)
        .send({ error: 'Memory agent document not found or access denied' })
    }

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error updating memory agent:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: remove memory from memory_agent arrays
export const removeMemoryFromAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId, memoryAgentId, memoryId } = request.params as {
    agentId: string
    memoryAgentId: string
    memoryId: string
  }
  const { arrayField } = request.body as {
    arrayField: 'facts' | 'unabsorbed_memory_ids'
  }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_agent')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    const result = await memoryCollection.updateOne(
      {
        _id: new server.mongoose.Types.ObjectId(memoryAgentId),
        agent_id: agentObjectId,
      },
      {
        $pull: {
          [arrayField]: new server.mongoose.Types.ObjectId(memoryId),
        },
        $set: {
          fully_formed_memory: null,
        },
      },
    )

    if (result.matchedCount === 0) {
      return reply
        .status(404)
        .send({ error: 'Memory agent document not found or access denied' })
    }

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error removing memory from agent:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: retrieve_memory_session
export const retrieveMemorySession = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { memoryId } = request.params as { memoryId: string }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const sessionMemoryCollection =
      server.mongoose.connection.db.collection('memory_sessions')

    const memoryRecord = await sessionMemoryCollection.findOne({
      _id: new server.mongoose.Types.ObjectId(memoryId),
      related_users: new server.mongoose.Types.ObjectId(userId),
    })

    if (!memoryRecord) {
      return reply.status(404).send({ error: 'Memory session not found' })
    }

    return reply.status(200).send(memoryRecord)
  } catch (error) {
    server.log.error('Error retrieving memory session:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: update_memory_user
export const updateMemoryUser = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const updates = request.body as Record<string, any>
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_user')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    // Check if we're updating fields that require invalidating fully_formed_memory
    const invalidatingFields = ['content', 'unabsorbed_memory_ids']
    const shouldInvalidate = Object.keys(updates).some(key =>
      invalidatingFields.includes(key),
    )

    const finalUpdates = shouldInvalidate
      ? { ...updates, fully_formed_memory: null }
      : updates

    await memoryCollection.updateOne(
      {
        agent_id: agentObjectId,
        user_id: new server.mongoose.Types.ObjectId(userId),
      },
      { $set: finalUpdates },
      { upsert: true },
    )

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error updating memory user:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Helper function: update_memory_session
export const updateMemorySession = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { memoryId } = request.params as { memoryId: string }
  const updates = request.body as Record<string, any>
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({
      error: 'Authentication required',
      message: 'You must be logged in to update memory sessions',
    })
  }

  if (!memoryId) {
    return reply.status(400).send({
      error: 'Invalid request',
      message: 'Memory session ID is required',
    })
  }

  try {
    const sessionMemoryCollection =
      server.mongoose.connection.db.collection('memory_sessions')

    const result = await sessionMemoryCollection.updateOne(
      { _id: new server.mongoose.Types.ObjectId(memoryId) },
      { $set: updates },
    )

    if (result.matchedCount === 0) {
      return reply.status(404).send({
        error: 'Memory session not found',
        message: `No memory session found with ID: ${memoryId}`,
      })
    }

    // If we updated the content field, invalidate related memories
    if (updates.content !== undefined) {
      await invalidateFullyFormedMemories(server, memoryId)
    }

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error updating memory session:', error)

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('ObjectId')) {
        return reply.status(400).send({
          error: 'Invalid memory ID',
          message: 'The provided memory session ID is not valid',
        })
      }
      if (error.message.includes('validation')) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'The update data contains invalid values',
        })
      }
    }

    return reply.status(500).send({
      error: 'Server error',
      message: 'Failed to update memory session due to an internal error',
    })
  }
}

// Remove unabsorbed memory from memory_user
export const removeUnabsorbedMemory = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId, memoryId } = request.params as {
    agentId: string
    memoryId: string
  }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_user')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    await memoryCollection.updateOne(
      {
        agent_id: agentObjectId,
        user_id: new server.mongoose.Types.ObjectId(userId),
      },
      {
        $pull: {
          unabsorbed_memory_ids: new server.mongoose.Types.ObjectId(memoryId),
        },
        $set: {
          fully_formed_memory: null,
        },
      },
    )

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error removing unabsorbed directive:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Create new memory agent shard
// Get agent permissions
export const getAgentPermissions = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }

  const agent = await Agent.findById(agentId)
  if (!agent || agent.deleted) {
    return reply.status(404).send({ error: 'Agent not found' })
  }

  // Anyone can view agent permissions for transparency

  const permissions = await AgentPermission.find({ agent: agentId }).populate(
    'user',
    '_id userId username userImage',
  )

  return reply.status(200).send({ permissions })
}

// Update agent permissions
export const updateAgentPermissions = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const { permissions } = request.body as {
    permissions: Array<{ username: string; level: 'editor' | 'owner' }>
  }
  const currentUserId = request.user.userId

  const agent = await Agent.findById(agentId)
  if (!agent || agent.deleted) {
    return reply.status(404).send({ error: 'Agent not found' })
  }

  // Only owner can modify permissions
  if (!(await hasOwnerPermissions(agentId, currentUserId.toString()))) {
    return reply.status(401).send({
      error: 'Only agent owners can modify permissions',
    })
  }

  try {
    // Get existing permissions for notification comparison
    const existingPermissions = await AgentPermission.find({
      agent: agentId,
    }).populate('user', 'username')

    const existingUserMap = new Map(
      existingPermissions.map(p => [(p.user as any).username, p.level]),
    )

    // Delete existing permissions
    await AgentPermission.deleteMany({ agent: agentId })

    const newPermissions = []

    // Add new permissions and track changes for notifications
    for (const perm of permissions) {
      const query = createMultiFieldQuery(perm.username, ['userId', 'username'])
      const user = await User.findOne(query)

      if (!user) {
        return reply.status(404).send({
          error: `User not found: ${perm.username}`,
        })
      }

      const newPermission = await AgentPermission.create({
        agent: agentId,
        user: user._id,
        level:
          perm.level === 'owner'
            ? PermissionLevel.Owner
            : PermissionLevel.Editor,
        grantedBy: currentUserId,
        grantedAt: new Date(),
      })

      newPermissions.push({
        permission: newPermission,
        user,
        username: perm.username,
        level: perm.level,
      })

      // Check if this is a new permission or changed level
      const existingLevel = existingUserMap.get(perm.username)
      if (!existingLevel) {
        // New permission - send notification
        await Notification.create({
          user: user._id,
          type: 'agent_permission_added',
          title: 'Agent Permission Added',
          message: `You've been granted ${perm.level} access to the agent "${agent.name}".`,
          priority: 'normal',
          agent: agentId,
          action_url: `/chat/${agent.username}`,
          channels: ['in_app'],
        })
      } else if (
        existingLevel !==
        (perm.level === 'owner'
          ? PermissionLevel.Owner
          : PermissionLevel.Editor)
      ) {
        // Permission level changed - send notification
        await Notification.create({
          user: user._id,
          type: 'agent_permission_added',
          title: 'Agent Permission Updated',
          message: `Your access to the agent "${agent.name}" has been changed to ${perm.level}.`,
          priority: 'normal',
          agent: agentId,
          action_url: `/chat/${agent.username}`,
          channels: ['in_app'],
        })
      }
    }

    // Check for removed permissions and send notifications
    const newUserMap = new Map(newPermissions.map(p => [p.username, p.level]))

    for (const [username, _] of existingUserMap) {
      if (!newUserMap.has(username)) {
        // Permission was removed - send notification
        const removedUser = await User.findOne(
          createMultiFieldQuery(username, ['userId', 'username']),
        )
        if (removedUser) {
          await Notification.create({
            user: removedUser._id,
            type: 'agent_permission_removed',
            title: 'Agent Permission Removed',
            message: `Your access to the agent "${agent.name}" has been removed.`,
            priority: 'normal',
            agent: agentId,
            action_url: `/chat/${agent.username}`,
            channels: ['in_app'],
          })
        }
      }
    }

    return reply.status(200).send({ success: true })
  } catch (error) {
    console.error('Error updating permissions:', error)
    return reply.status(500).send({
      error: 'Failed to update permissions',
    })
  }
}

// Get agents shared with user
export const getSharedAgents = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const currentUserId = request.user.userId

  try {
    // Find all permissions for this user
    const permissions = await AgentPermission.find({
      user: currentUserId,
    }).populate({
      path: 'agent',
      match: { deleted: false },
      populate: {
        path: 'owner',
        select: '_id userId username userImage',
      },
    })

    // Filter out null agents (deleted ones)
    const sharedAgents = permissions
      .filter(p => p.agent)
      .map(p => ({
        agent: p.agent,
        permissionLevel: p.level,
        grantedAt: p.grantedAt,
      }))

    // Process agent images
    sharedAgents.forEach(item => {
      const agent = item.agent as any
      if (agent.userImage) {
        agent.userImage = forceCloudfrontUrl(server, agent.userImage)
      }
      if (agent.owner?.userImage) {
        agent.owner.userImage = forceCloudfrontUrl(
          server,
          agent.owner.userImage,
        )
      }
    })

    return reply.status(200).send({ sharedAgents })
  } catch (error) {
    console.error('Error getting shared agents:', error)
    return reply.status(500).send({
      error: 'Failed to get shared agents',
    })
  }
}

// Helper function to invalidate fully_formed_memory for related UserMemory/AgentMemory documents
const invalidateFullyFormedMemories = async (
  server: FastifyInstance,
  sessionMemoryId: string,
) => {
  try {
    const sessionMemoryCollection =
      server.mongoose.connection.db.collection('memory_sessions')
    const sessionMemory = await sessionMemoryCollection.findOne({
      _id: new server.mongoose.Types.ObjectId(sessionMemoryId),
    })

    if (!sessionMemory) {
      return
    }

    const memoryUserCollection =
      server.mongoose.connection.db.collection('memory_user')
    const memoryAgentCollection =
      server.mongoose.connection.db.collection('memory_agent')

    // Handle SessionMemory with memory_type = "directive" -> invalidate UserMemory
    if (
      sessionMemory.memory_type === 'directive' &&
      sessionMemory.related_users
    ) {
      const relatedUsers = Array.isArray(sessionMemory.related_users)
        ? sessionMemory.related_users
        : [sessionMemory.related_users]

      for (const userId of relatedUsers) {
        await memoryUserCollection.updateMany(
          {
            agent_id: sessionMemory.agent_id,
            user_id: userId,
          },
          {
            $set: { fully_formed_memory: null },
          },
        )
      }
    }

    // Handle SessionMemory with memory_type = "fact" or "suggestion" -> invalidate AgentMemory
    if (
      sessionMemory.memory_type === 'fact' ||
      sessionMemory.memory_type === 'suggestion'
    ) {
      // If there's a direct shard relationship
      if (sessionMemory.shard_id) {
        await memoryAgentCollection.updateOne(
          {
            _id: sessionMemory.shard_id,
          },
          {
            $set: { fully_formed_memory: null },
          },
        )
      } else {
        // Find by searching unabsorbed_memory_ids or facts arrays
        await memoryAgentCollection.updateMany(
          {
            agent_id: sessionMemory.agent_id,
            $or: [
              {
                unabsorbed_memory_ids: new server.mongoose.Types.ObjectId(
                  sessionMemoryId,
                ),
              },
              { facts: new server.mongoose.Types.ObjectId(sessionMemoryId) },
            ],
          },
          {
            $set: { fully_formed_memory: null },
          },
        )
      }
    }
  } catch (error) {
    server.log.error('Error invalidating fully formed memories:', error)
  }
}

export const createMemoryAgent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { agentId } = request.params as { agentId: string }
  const { shard_name, extraction_prompt } = request.body as {
    shard_name: string
    extraction_prompt: string
  }
  const userId = request.user?.userId

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' })
  }

  if (!shard_name || shard_name.trim() === '') {
    return reply.status(400).send({ error: 'Shard name is required' })
  }

  if (!extraction_prompt || extraction_prompt.trim() === '') {
    return reply.status(400).send({ error: 'Extraction prompt is required' })
  }

  if (shard_name.length > 50) {
    return reply
      .status(400)
      .send({ error: 'Shard name cannot exceed 50 characters' })
  }

  if (extraction_prompt.length > 2000) {
    return reply
      .status(400)
      .send({ error: 'Extraction prompt cannot exceed 2000 characters' })
  }

  try {
    const { agent, error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    const memoryCollection =
      server.mongoose.connection.db.collection('memory_agent')
    const agentObjectId = createAgentObjectId(agentId, agent, server.mongoose)

    // Check if a shard with this name already exists for this agent
    const existingShard = await memoryCollection.findOne({
      agent_id: agentObjectId,
      shard_name: shard_name,
    })

    if (existingShard) {
      return reply
        .status(400)
        .send({ error: 'A shard with this name already exists for this agent' })
    }

    // Create the new memory agent shard
    const newShard = {
      agent_id: agentObjectId,
      shard_name: shard_name.trim(),
      extraction_prompt: extraction_prompt.trim(),
      content: '',
      is_active: true,
      facts: [],
      unabsorbed_memory_ids: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      fully_formed_memory: null,
      last_updated_at: new Date(),
    }

    const result = await memoryCollection.insertOne(newShard)

    return reply.status(200).send({
      success: true,
      shard_id: result.insertedId.toString(),
      message: 'Collective Memory Shard created successfully',
    })
  } catch (error) {
    server.log.error('Error creating memory agent shard:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

export const updateUserMemoryEnabled = async (
  server: FastifyInstance,
  request: FastifyRequest<{
    Params: { agentId: string }
    Body: { user_memory_enabled: boolean }
  }>,
  reply: FastifyReply,
) => {
  const { agentId } = request.params
  const { user_memory_enabled } = request.body

  try {
    // Validate agent access
    const { error } = await validateAgentAccess(agentId)
    if (error) {
      return reply.status(404).send({ error })
    }

    // Permission check is handled by validateAgentAccess (same as other memory operations)

    // Update the agent's user_memory_enabled field in users3 collection
    const updateResult = await Agent.updateOne(
      { _id: agentId },
      {
        $set: {
          user_memory_enabled: user_memory_enabled,
          updatedAt: new Date(),
        },
      },
    )

    if (updateResult.matchedCount === 0) {
      return reply.status(404).send({ error: 'Agent not found' })
    }

    return reply.status(200).send({ success: true })
  } catch (error) {
    server.log.error('Error updating user memory enabled status:', error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
}
