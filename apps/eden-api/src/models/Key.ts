import { Document, Schema, model } from 'mongoose'

export interface KeySchema {
  user_id: string
  hashed_password?: string
}

export interface KeyDocument extends KeySchema, Document {}

const key = new Schema<KeyDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    hashed_password: {
      type: String,
      required: false,
    },
  } as const,
  {
    _id: false,
  },
)

export const Key = model<KeyDocument>('keys', key)
