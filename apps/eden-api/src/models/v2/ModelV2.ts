import { TaskV2 } from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface ModelV2Schema {
  name: string
  user: ObjectId
  task: TaskV2
  checkpoint: string
  public?: boolean
  slug: string
  thumbnail: string | null
  createdAt: Date
  updatedAt: Date
  lora_trigger_text?: string
  thumbnail_prompts?: string[]
  likeCount?: number
  isLiked?: boolean
  creationCount?: number
}

export interface ModelV2Input {
  name: string
  user: ObjectId
  task: TaskV2
  checkpoint: string
  public?: boolean
  slug: string
  thumbnail: string | null
  lora_trigger_text?: string
  thumbnail_prompts?: string[]
}

export interface ModelV2Document extends SoftDeleteDocument, ModelV2Schema {}

export const modelSchema = new Schema<ModelV2Document>(
  {
    name: {
      type: String,
      required: true,
      unique: false,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'tasks3',
      required: true,
    },
    checkpoint: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    public: {
      type: Boolean,
      default: true,
    },
    lora_trigger_text: {
      type: String,
      default: '',
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    isLiked: {
      type: Boolean,
    },
    creationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)
modelSchema.index({ createdAt: -1 })
modelSchema.index({ base_model: 1, createdAt: 1, thumbnail: 1 })
modelSchema.index({ deleted: -1, createdAt: -1 })
modelSchema.index({ public: -1, deleted: -1, createdAt: -1 })
modelSchema.index({
  user: 1,
  public: -1,
  deleted: -1,
  task: 1,
  createdAt: -1,
})

// Add index for likeCount-based sorting
modelSchema.index({
  public: 1,
  deleted: 1,
  likeCount: -1,
  _id: -1,
})

// Add index for creationCount-based sorting
modelSchema.index({
  public: 1,
  deleted: 1,
  creationCount: -1,
  _id: -1,
})

modelSchema.plugin(paginate)
modelSchema.plugin(aggregatePaginate)
modelSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

export const ModelV2 = model<ModelV2Document>(
  'models3',
  modelSchema,
) as SoftDeleteModel<ModelV2Document>
