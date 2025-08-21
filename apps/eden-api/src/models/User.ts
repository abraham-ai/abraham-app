import { BaseUser, BaseUserDocument, BaseUserSchema } from './BaseUser'
import { SubscriptionTier } from '@edenlabs/eden-sdk'
import { Schema } from 'mongoose'

export interface UserSchema extends BaseUserSchema {
  userId: string
  email?: string
  normalizedEmail?: string
  isWeb2?: boolean
  isAdmin: boolean
  provider?: string
  subscriptionTier?: SubscriptionTier
  highestMonthlySubscriptionTier?: SubscriptionTier
  preferences?: {
    agent_spend_threshold?: number
  }
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  lastDailyLoginBonus?: Date
  discordLinkBonusClaimed?: boolean
  twitterLinkBonusClaimed?: boolean
  type?: 'agent' | 'user'
}

export type UserInput = {
  userId: string
  isWeb2: boolean
  username: string
  userImage?: string
  isClerk?: boolean
  isAdmin?: boolean
  email?: string
  normalizedEmail?: string
  type?: 'agent' | 'user'
}

export interface UserDocument extends UserSchema, BaseUserDocument {}

const UserSchema = new Schema<UserDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 42,
    },
    isWeb2: {
      type: Boolean,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      maxlength: 42,
    },
    email: {
      type: String,
      unique: true,
      maxLength: 320,
    },
    normalizedEmail: {
      type: String,
      unique: true,
      maxLength: 320,
    },
    subscriptionTier: {
      type: Number,
      default: SubscriptionTier.Free,
    },
    highestMonthlySubscriptionTier: {
      type: Number,
      default: SubscriptionTier.Free,
    },
    preferences: {
      type: {
        agent_spend_threshold: {
          type: Number,
          default: 50,
        },
      },
      default: () => ({ agent_spend_threshold: 50 }),
    },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
    },
    lastDailyLoginBonus: {
      type: Date,
      default: new Date(),
    },
    discordLinkBonusClaimed: {
      type: Boolean,
      default: false,
    },
    twitterLinkBonusClaimed: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    discriminatorKey: 'type',
    timestamps: true,
  },
)

UserSchema.index({ userId: 1 })
UserSchema.index({ email: 1 })
UserSchema.index({ normalizedEmail: 1 })

export const User = BaseUser.discriminator<UserDocument>('user', UserSchema)
