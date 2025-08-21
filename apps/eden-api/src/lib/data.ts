import { FeatureFlag } from '@edenlabs/eden-sdk'
import mongoose from 'mongoose'

export const enforceUserDocumentLimit = async (
  limit: number,
  modelName: string,
  userId: string,
) => {
  const creator = await mongoose.model('user').findById(userId)
  if (creator) {
    const count = await mongoose
      .model(modelName)
      .countDocuments({ user: creator._id })

    return count < limit
  }
}

export const checkUserFlags = (
  featureFlags?: FeatureFlag[],
  flag?: FeatureFlag,
): boolean => {
  if (!featureFlags || !flag) {
    throw new Error('Feature flag not found')
  }

  if (!featureFlags.includes(flag)) {
    throw new Error('Feature flag not found')
  }

  return true
}
