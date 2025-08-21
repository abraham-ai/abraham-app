import { CollectionDocument } from './Collection'
import { CreationDocument } from './Creation'
import { FeatureFlag } from '@edenlabs/eden-sdk'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface BaseUserSchema {
  type?: 'user' | 'agent'
  userId: string
  username: string
  userImage?: string
  featureFlags?: FeatureFlag[]
  creations: CreationDocument[]
  collections: CollectionDocument[]
  creationCount?: number
  followerCount: number
  followingCount: number
  discordId?: string
  twitterHandle?: string
  twitterId?: string
  instagramHandle?: string
  deleted?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface BaseUserDocument extends SoftDeleteDocument, BaseUserSchema {}

const BaseUserSchema = new Schema<BaseUserDocument>(
  {
    type: {
      type: String,
      required: true,
      enum: ['user', 'agent'],
    },
    username: {
      type: String,
      unique: true,
      maxlength: 42,
    },
    userImage: {
      type: String,
      maxlength: 1000,
    },
    featureFlags: [
      {
        type: String,
        enum: Object.values(FeatureFlag),
      },
    ],
    creations: [
      {
        type: Schema.Types.ObjectId,
        ref: 'creations',
      },
    ],
    collections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'collections',
      },
    ],
    creationCount: {
      type: Number,
      default: 0,
    },
    followerCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    discordId: {
      type: String,
    },
    twitterHandle: {
      type: String,
    },
    twitterId: {
      type: String,
    },
    instagramHandle: {
      type: String,
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

BaseUserSchema.plugin(paginate)
BaseUserSchema.plugin(aggregatePaginate)
BaseUserSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

BaseUserSchema.index({ createdAt: 1 })
BaseUserSchema.index({ username: 1 })
BaseUserSchema.index({ followerCount: -1 })
BaseUserSchema.index({ creationCount: -1 })
BaseUserSchema.index({ type: 1 })

export const BaseUser = model<BaseUserDocument>(
  'users3',
  BaseUserSchema,
) as SoftDeleteModel<BaseUserDocument>
