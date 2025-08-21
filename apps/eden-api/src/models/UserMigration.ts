import { UserDocument } from './User'
import { Document, Schema, model } from 'mongoose'
import paginate from 'mongoose-paginate-v2'

export interface UserMigrationSchema {
  user: UserDocument
  oldUser: UserDocument
  createdAt?: Date
}

export interface UserMigrationDocument extends UserMigrationSchema, Document {}

const userMigration = new Schema<UserMigrationDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    oldUser: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

userMigration.plugin(paginate)

export const UserMigration = model<UserMigrationDocument>(
  'userMigrations',
  userMigration,
)
