import { MediaOutput, TaskV2Args } from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface CreationV2Schema extends MediaOutput {
  user: ObjectId
  agent?: ObjectId
  task: ObjectId
  args: TaskV2Args
  tool: string
  createdAt: Date
  updatedAt: Date
  public?: boolean
  metadata?: string | null
  attributes?: {
    discordId?: string
  }
  likeCount?: number
  isLiked?: boolean
}

export interface CreationV2Input extends MediaOutput {
  user: ObjectId
  agent?: ObjectId
  task: ObjectId
  args: TaskV2Args
  tool: string
  metadata?: string | null
}

export interface CreationV2Document
  extends SoftDeleteDocument,
    CreationV2Schema {}

export const creationSchema = new Schema<CreationV2Document>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: false,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'tasks3',
      required: true,
    },
    tool: {
      type: String,
      required: true,
    },
    args: {
      type: Schema.Types.Mixed,
      default: {},
    },
    url: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    filename: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    attributes: {
      type: Schema.Types.Mixed,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    isLiked: {
      type: Boolean,
    },
    mediaAttributes: {
      mimeType: {
        type: String,
        required: true,
      },
      duration: {
        type: Number,
      },
      width: {
        type: Number,
      },
      height: {
        type: Number,
      },
      aspectRatio: {
        type: Number,
      },
      blurhash: {
        type: String,
      },
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    public: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

creationSchema.index({ task: 1 })
creationSchema.index({ createdAt: -1 })
creationSchema.index({ deleted: -1, createdAt: -1 })
creationSchema.index({
  'attributes.discordId': -1,
})
creationSchema.index({
  public: 1,
  deleted: 1,
  'mediaAttributes.mimeType': 1,
  createdAt: -1,
  _id: -1,
})
creationSchema.index({
  public: 1,
  deleted: 1,
  createdAt: -1,
  _id: -1,
})
creationSchema.index({
  user: 1,
  agent: 1,
  'mediaAttributes.mimeType': 1,
  task: -1,
  public: -1,
  deleted: -1,
  createdAt: -1,
})
creationSchema.index({
  user: 1,
  agent: 1,
  public: 1,
  deleted: 1,
  createdAt: -1,
  _id: -1,
})
creationSchema.index({
  public: 1,
  deleted: 1,
  likeCount: -1,
  _id: -1,
})
creationSchema.plugin(paginate)
creationSchema.plugin(aggregatePaginate)
creationSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

export const CreationV2 = model<CreationV2Document>(
  'creations3',
  creationSchema,
) as SoftDeleteModel<CreationV2Document>
