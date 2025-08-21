import { CharacterDocument } from './Character'
import { UserDocument } from './User'
import { Schema, model } from 'mongoose'
import { SoftDeleteDocument } from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface SessionSchema {
  user: UserDocument
  users: UserDocument[]
  characters: CharacterDocument[]
  createdAt?: Date
  updatedAt?: Date
}

export interface SessionDocument extends SessionSchema, SoftDeleteDocument {}

const session = new Schema<SessionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users3',
        default: [],
      },
    ],
    characters: [
      {
        type: Schema.Types.ObjectId,
        ref: 'characters',
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  },
)

session.pre<SessionDocument>('save', function (next) {
  this.updatedAt = new Date()

  next()
})

session.index({ createdAt: 1 })
session.plugin(paginate)

export const Session = model<SessionDocument>('sessions_old', session)
