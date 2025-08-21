import { Document, Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import paginate from 'mongoose-paginate-v2'

export interface CompletionSchema {
  prompt: string
  config: any
  completion: string
  createdAt?: Date
}

export interface CompletionInput {
  prompt: string
  completion: string
  config?: any
}

export interface CompletionDocument extends CompletionSchema, Document {}

const completion = new Schema<CompletionDocument>(
  {
    prompt: {
      type: String,
      required: true,
    },
    completion: {
      type: String,
      required: true,
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

completion.plugin(paginate)
completion.plugin(aggregatePaginate)

export const Completion = model<CompletionDocument>('completions', completion)
