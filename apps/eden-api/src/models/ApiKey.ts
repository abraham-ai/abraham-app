import { CharacterDocument } from './Character'
import { UserDocument } from './User'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import { SoftDeleteDocument } from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface ApiKeySchema {
  user: UserDocument
  character?: CharacterDocument
  apiKey: string
  apiSecret?: string
  note?: string
  createdAt?: Date
}

export interface ApiKeyInput {
  user: ObjectId
  apiKey: string
  apiSecret?: string
  note?: string
}

export interface ApiKeyDocument extends ApiKeySchema, SoftDeleteDocument {}

const apiKey = new Schema<ApiKeyDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    character: {
      type: Schema.Types.ObjectId,
      ref: 'characters',
    },
    apiKey: {
      type: String,
      required: true,
    },
    apiSecret: {
      type: String,
      required: false,
    },
    note: {
      type: String,
      required: false,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  },
)

apiKey.plugin(paginate)

export const ApiKey = model<ApiKeyDocument>('apikeys', apiKey)
