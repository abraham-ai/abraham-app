import { VisibilitySchema } from '../types/baseSchemas'
import { TaskDocument } from './Task'
import { UserDocument } from './User'
import { MediaType } from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface ConceptSchema extends VisibilitySchema {
  user: UserDocument
  task: TaskDocument
  creationCount: number
  praiseCount: number
  bookmarkCount: number
  delegate?: UserDocument
  uri: string
  thumbnail?: string
  name: string
  description?: string
  conceptName: string
  checkpoint: string
  training_images?: string[]
  num_training_images?: number
  grid_prompts?: string[]
  publishedUrl?: string
  attributes?: any
  createdAt?: Date
  updatedAt?: Date
}

export interface ConceptInput {
  user: ObjectId
  task: ObjectId
  delegate?: ObjectId
  uri: string
  thumbnail?: string
  name: string
  description?: string
  conceptName: string
  checkpoint: string
  training_images?: string[]
  grid_prompts?: string[]
  num_training_images?: number
  attributes?: Record<string, any>
  mediaAttributes?: {
    type: MediaType
    duration?: number
  }
  isPrivate?: boolean
}

export interface ConceptDocument extends SoftDeleteDocument, ConceptSchema {}

const concept = new Schema<ConceptDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'tasks',
      required: true,
    },
    creationCount: {
      type: Number,
      default: 0,
    },
    praiseCount: {
      type: Number,
      default: 0,
    },
    bookmarkCount: {
      type: Number,
      default: 0,
    },
    uri: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    thumbnail: {
      type: String,
      maxlength: 1000,
    },
    name: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    description: {
      type: String,
      maxlength: 5000,
    },
    conceptName: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    checkpoint: {
      type: String,
      required: true,
    },
    training_images: {
      type: [String],
      required: true,
    },
    num_training_images: {
      type: Number,
      required: false,
    },
    grid_prompts: {
      type: [String],
      required: false,
      default: [],
    },
    publishedUrl: {
      type: String,
      maxlength: 1000,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deleteBy: {
      type: String,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

concept.pre<ConceptDocument>('save', function (next) {
  this.updatedAt = new Date()

  next()
})

concept.index({ createdAt: 1 })
concept.index({ user: 1, deleted: 1, isPrivate: 1 })
concept.index({ deleted: 1, isPrivate: 1 })
concept.index({
  createdAt: -1,
  creationCount: -1,
  praiseCount: -1,
  bookmarkCount: -1,
})
concept.index({
  isPrivate: 1,
  createdAt: -1,
  _id: -1,
  deleted: 1,
})

// concept.plugin(mongooseDelete, { overrideMethods: 'all' })
concept.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})
concept.plugin(paginate)
concept.plugin(aggregatePaginate)

export const Concept = model<ConceptDocument>(
  'concepts',
  concept,
) as SoftDeleteModel<ConceptDocument>
