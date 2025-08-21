import { UserDocument } from '../User'
import { CreationV2Document } from './CreationV2'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface CollectionV2Schema {
  user: UserDocument
  name: string
  description?: string
  creations: CreationV2Document[]
  contributors?: UserDocument[]
  coverCreation?: CreationV2Document
  createdAt: Date
  updatedAt: Date
  public?: boolean
}

export interface CollectionV2Document
  extends SoftDeleteDocument,
    CollectionV2Schema {}

export const collectionSchema = new Schema<CollectionV2Document>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
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
        ref: 'creations3',
        default: [],
      },
    ],
    contributors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users3',
        default: [],
      },
    ],
    coverCreation: {
      type: Schema.Types.ObjectId,
      ref: 'creations3',
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

collectionSchema.index({
  _id: -1,
  user: 1,
  public: 1,
  deleted: 1,
})
collectionSchema.plugin(paginate)
collectionSchema.plugin(aggregatePaginate)
collectionSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})
collectionSchema.index({ user: 1, name: 1 }, { unique: true })

// @ts-ignore
collectionSchema.pre('delete', function (next) {
  const doc = this as unknown as CollectionV2Document
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  doc.name = `${doc.name} [deleted-${randomSuffix}]`
  next()
})

export const CollectionV2 = model<CollectionV2Document>(
  'collections3',
  collectionSchema,
) as SoftDeleteModel<CollectionV2Document>
