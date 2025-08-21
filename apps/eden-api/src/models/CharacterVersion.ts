import { VisibilitySchema } from '../types/baseSchemas'
import { CharacterDocument } from './Character'
import { Capabilities, LogosData } from '@edenlabs/eden-sdk'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, { SoftDeleteDocument } from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface CharacterVersionSchema extends VisibilitySchema {
  character: CharacterDocument
  name: string
  logosData?: LogosData
  greeting?: string
  image?: string
  voice?: string
  createdAt?: Date
}

export interface CharacterVersionDocument
  extends SoftDeleteDocument,
    CharacterVersionSchema {}

const character = new Schema<CharacterVersionDocument>(
  {
    character: {
      type: Schema.Types.ObjectId,
      ref: 'characters',
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 80,
    },
    logosData: {
      type: {
        capabilities: {
          type: Array,
          values: Object.values(Capabilities),
          required: false,
        },
        identity: {
          type: String,
          maxlength: 9999,
          required: false,
        },
        knowledge: {
          type: String,
          maxlength: 99990,
          required: false,
        },
        knowledgeSummary: {
          type: String,
          maxlength: 99999,
          required: false,
        },
        concept: {
          type: String,
          maxlength: 1000,
          required: false,
        },
      },
      required: false,
    },
    greeting: {
      type: String,
      maxlength: 1000,
    },
    image: {
      type: String,
      required: false,
    },
    voice: {
      type: String,
      required: false,
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

character.pre<CharacterDocument>('save', function (next) {
  this.updatedAt = new Date()

  next()
})

character.index({ createdAt: 1 })

character.plugin(paginate)
character.plugin(aggregatePaginate)
character.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

export const Character = model<CharacterVersionDocument>(
  'characters',
  character,
)
