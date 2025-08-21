import { Document, Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import paginate from 'mongoose-paginate-v2'

import { CreationDocument } from './Creation'

export interface EmbeddingSchema {
  creation: CreationDocument
  embedding: number[]
  createdAt?: Date
  updatedAt?: Date
}

export interface EmbeddingDocument extends EmbeddingSchema, Document {}

const embedding = new Schema<EmbeddingDocument>(
  {
    creation: {
      type: Schema.Types.ObjectId,
      ref: 'creations',
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

embedding.plugin(paginate)
embedding.plugin(aggregatePaginate)

export const Embedding = model<EmbeddingDocument>('embeddings', embedding)
