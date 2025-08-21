import { Document, Schema, model } from 'mongoose'

import { CHALLENGE_TTL } from '../lib/constants'

export interface ChallengeSchema {
  address: string
  isWeb2: boolean
  nonce: string
  ack: boolean
  expiresAt: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface ChallengeInput {
  address: string
  isWeb2: boolean
}

export interface ChallengeDocument extends ChallengeSchema, Document {}

const challenge = new Schema<ChallengeDocument>(
  {
    address: {
      type: String,
      required: true,
      maxlength: 42,
    },
    isWeb2: {
      type: Boolean,
      required: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    ack: {
      type: Boolean,
      required: true,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + CHALLENGE_TTL),
    },
  },
  {
    timestamps: true,
  },
)

export default model<ChallengeDocument>('challenges', challenge)
