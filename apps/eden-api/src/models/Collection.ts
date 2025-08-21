import { VisibilitySchema } from '../types/baseSchemas'
import { CreationDocument } from './Creation'
import { UserDocument } from './User'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface CollectionSchema extends VisibilitySchema {
  user: UserDocument
  name: string
  description?: string
  creations: CreationDocument[]
  contributors?: UserDocument[]
  isDefaultCollection: boolean
  displayImageUri?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface CollectionInput {
  user: ObjectId
  name: string
  description?: string
  displayImageUri?: string
  contributors?: UserDocument[]
  isPrivate?: boolean
}

export interface CollectionDocument
  extends SoftDeleteDocument,
    CollectionSchema {}

const collection = new Schema<CollectionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    contributors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users3',
        default: [],
      },
    ],
    name: {
      type: String,
      required: true,
      maxlength: 80,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    creations: [
      {
        type: Schema.Types.ObjectId,
        ref: 'creations',
        default: [],
      },
    ],
    isDefaultCollection: {
      type: Boolean,
      default: false,
    },
    displayImageUri: {
      type: String,
      maxLength: 1000,
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

collection.index({ _id: -1, user: 1, deleted: 1, isPrivate: 1 })
collection.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})
collection.plugin(paginate)
collection.plugin(aggregatePaginate)

export const Collection = model<CollectionDocument>(
  'collections',
  collection,
) as SoftDeleteModel<CollectionDocument>
