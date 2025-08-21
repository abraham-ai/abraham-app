import { TaskV2 } from '../models/v2/TaskV2'
import { ToolV2Document } from '../models/v2/ToolV2'
import {
  FeatureFlag,
  SubscriptionTier,
  TaskV2Status,
  ToolOutputTypeV2,
} from '@edenlabs/eden-sdk'
import { FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'

type TaskRateLimit = {
  image: number
  video: number
}

const maximumTasksConcurrencyMap: Record<SubscriptionTier, TaskRateLimit> = {
  [SubscriptionTier.Free]: {
    image: 4,
    video: 2,
  },
  [SubscriptionTier.Basic]: {
    image: 8,
    video: 4,
  },
  [SubscriptionTier.Pro]: {
    image: 16,
    video: 8,
  },
  [SubscriptionTier.Believer]: {
    image: 24,
    video: 12,
  },
  [SubscriptionTier.Admin]: {
    image: 64,
    video: 32,
  },
}

const maximumTasksPerHourMap: Record<SubscriptionTier, TaskRateLimit> = {
  [SubscriptionTier.Free]: {
    image: 150,
    video: 15,
  },
  [SubscriptionTier.Basic]: {
    image: 600,
    video: 60,
  },
  [SubscriptionTier.Pro]: {
    image: 1200,
    video: 120,
  },
  [SubscriptionTier.Believer]: {
    image: 1800,
    video: 180,
  },
  [SubscriptionTier.Admin]: {
    image: 3600,
    video: 360,
  },
}

const maximumTasksPerMinuteMap: Record<SubscriptionTier, TaskRateLimit> = {
  [SubscriptionTier.Free]: {
    image: 20,
    video: 2,
  },
  [SubscriptionTier.Basic]: {
    image: 80,
    video: 8,
  },
  [SubscriptionTier.Pro]: {
    image: 160,
    video: 16,
  },
  [SubscriptionTier.Believer]: {
    image: 240,
    video: 24,
  },
  [SubscriptionTier.Admin]: {
    image: 480,
    video: 48,
  },
}

export const subscriptionTierNameMap: Record<SubscriptionTier, string> = {
  [SubscriptionTier.Free]: 'Free',
  [SubscriptionTier.Basic]: 'Basic',
  [SubscriptionTier.Pro]: 'Pro',
  [SubscriptionTier.Believer]: 'Believer',
  [SubscriptionTier.Admin]: 'Admin',
}

type TaskRateLimitCheckResult = {
  status: 'ok' | 'error' | 'n/a'
  message?: string
}

// Helper function to get maximum tasks for given subscription tier and output type
const getMaximumTasks = (
  map: Record<SubscriptionTier, TaskRateLimit>,
  subscriptionTier: SubscriptionTier | undefined,
  output_type: ToolOutputTypeV2,
): number => {
  const tier = subscriptionTier || SubscriptionTier.Free
  const type = output_type === 'image' ? 'image' : 'video'
  return map[tier][type]
}

// Helper function to find tasks created since a given timeframe
const getTasksCount = async (
  userId: ObjectId | undefined,
  since: Date,
  status: TaskV2Status[] = [],
  output_type: ToolOutputTypeV2 | undefined,
) => {
  const query: {
    user?: ObjectId
    status?: { $in: TaskV2Status[] }
    createdAt?: { $gte: Date }
    output_type?: ToolOutputTypeV2
  } = {
    user: userId,
    createdAt: { $gte: since },
  }

  if (status) {
    query.status = { $in: status }
  }

  if (output_type) {
    query.output_type = output_type
  }

  return TaskV2.countDocuments(query)
}

const LIMIT_FLAGS = [
  FeatureFlag.LimitsBasic,
  FeatureFlag.LimitsPro,
  FeatureFlag.LimitsBeliever,
  FeatureFlag.LimitsAdmin,
]

// check if featureFlags includes at least one of LIMIT_FLAGS values to override and if so, return the last one
const getUserLimitTier = (
  subscriptionTier: SubscriptionTier,
  featureFlags: FeatureFlag[],
) => {
  const limitFlag = featureFlags.find(flag => LIMIT_FLAGS.includes(flag))

  if (limitFlag) {
    const splittedFlag = limitFlag.split('_')[1]
    if (splittedFlag in SubscriptionTier) {
      const limitFlagTier =
        SubscriptionTier[splittedFlag as keyof typeof SubscriptionTier]

      if (limitFlagTier > subscriptionTier) {
        return limitFlagTier
      }
    }
  }

  return subscriptionTier || SubscriptionTier.Free
}

// Handles both complete exceptions and special rate limits for specific users
const handleSpecialUserRateLimits = async (
  userId?: ObjectId,
  _output_type?: ToolOutputTypeV2,
): Promise<TaskRateLimitCheckResult> => {
  if (!userId) {
    return { status: 'error' }
  }

  // List of users with special handling
  const specialUsers: Record<
    string,
    { taskLimit: number; limitPeriod: number }
  > = {
    // TempleTech Abyss - dylan, dylan@tof.live -  50 tasks per minute
    '66867ea4056de0f554a34a77': {
      taskLimit: 50,
      limitPeriod: 60000,
    },
  }

  const userIdStr = userId.toString()
  const specialUser = specialUsers[userIdStr]

  if (!specialUser) {
    return { status: 'n/a' }
  }

  // Apply special rate limit for this user
  const limitPeriodAgo = new Date(Date.now() - specialUser.limitPeriod)
  const numTasksCreatedInPeriod = await getTasksCount(
    userId,
    limitPeriodAgo,
    [
      TaskV2Status.Pending,
      TaskV2Status.Running,
      TaskV2Status.Completed,
      TaskV2Status.Cancelled,
    ],
    undefined, // Apply to all tasks regardless of output type
  )

  if (numTasksCreatedInPeriod >= specialUser.taskLimit) {
    return {
      status: 'error',
      message: `Special rate limit reached! Max. ${specialUser.taskLimit} tasks per minute. Try again later.`,
    }
  }

  return { status: 'ok' }
}

type ToolAccessCheckResult = {
  status: 'ok' | 'error' | 'n/a'
  message?: string
}

export const toolAccessCheck = async (
  request: FastifyRequest,
  tool: ToolV2Document,
): Promise<ToolAccessCheckResult> => {
  const { featureFlags } = request.user
  const { key } = tool

  if (key === 'veo3' && !featureFlags.includes(FeatureFlag.ToolAccessVeo3)) {
    return { status: 'error', message: 'Tool not available' }
  }

  return { status: 'ok' }
}

export const taskRateLimitCheck = async (
  request: FastifyRequest,
  tool: ToolV2Document,
): Promise<TaskRateLimitCheckResult> => {
  const { userId, subscriptionTier } = request.user
  const { output_type } = tool
  const type = output_type === 'image' ? 'image' : 'video'

  // Check for special users with custom rate limits
  const specialUserResult = await handleSpecialUserRateLimits(
    userId,
    output_type,
  )
  if (specialUserResult && specialUserResult.status === 'ok') {
    return specialUserResult
  }

  const userLimitTier = getUserLimitTier(
    subscriptionTier,
    request.user.featureFlags,
  )

  const maximumTasksConcurrency = getMaximumTasks(
    maximumTasksConcurrencyMap,
    userLimitTier,
    type,
  )
  const maximumTasksPerMinute = getMaximumTasks(
    maximumTasksPerMinuteMap,
    userLimitTier,
    type,
  )
  const maximumTasksPerHour = getMaximumTasks(
    maximumTasksPerHourMap,
    userLimitTier,
    type,
  )

  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)
  const numTasksInProgress = await getTasksCount(
    userId,
    oneHourAgo,
    [TaskV2Status.Pending, TaskV2Status.Running],
    type,
  )

  const subscriptionTierName = subscriptionTierNameMap[userLimitTier]
  if (numTasksInProgress >= maximumTasksConcurrency) {
    return {
      status: 'error',
      message: `Concurrency limit for '${output_type}' reached! Max. ${maximumTasksConcurrency} on '${subscriptionTierName}' plan. Wait for some tasks to finish.`,
    }
  }
  const oneMinuteAgo = new Date(Date.now() - 60000)
  const numTasksCreatedLastMinute = await getTasksCount(
    userId,
    oneMinuteAgo,
    [
      TaskV2Status.Pending,
      TaskV2Status.Running,
      TaskV2Status.Completed,
      TaskV2Status.Cancelled,
    ],
    type,
  )
  if (numTasksCreatedLastMinute >= maximumTasksPerMinute) {
    return {
      status: 'error',
      message: `Rate limit for '${output_type}' reached! Max. ${maximumTasksPerMinute} per minute on '${subscriptionTierName}' plan. Try again later.`,
    }
  }

  const numTasksCreatedLastHour = await getTasksCount(
    userId,
    oneHourAgo,
    [
      TaskV2Status.Pending,
      TaskV2Status.Running,
      TaskV2Status.Completed,
      TaskV2Status.Cancelled,
    ],
    type,
  )
  if (numTasksCreatedLastHour >= maximumTasksPerHour) {
    return {
      status: 'error',
      message: `Rate limit for '${output_type}' reached! Max. ${maximumTasksPerHour} per hour on '${subscriptionTierName}' plan. Try again later.`,
    }
  }

  // console.log({userLimitTier, subscriptionTier, maximumTasksPerMinute, maximumTasksPerHour, maximumTasksConcurrency})

  return { status: 'ok' }
}
