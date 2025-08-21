import { Document, Schema, model } from 'mongoose'
import paginate from 'mongoose-paginate-v2'

export interface GeneratorParameter {
  name: string
  label: string
  description?: string
  isRequired?: boolean
  optional?: boolean
  default?: any
  allowedValues?: any[]
  allowedValuesFrom?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  step?: number
  mediaUpload?: string
}

export interface GeneratorVersionSchema {
  provider: string
  address: string
  versionId: string
  parameters: GeneratorParameter[]
  creationAttributes: string[]
  isDeprecated: boolean
  createdAt: Date
}

export interface GeneratorVersionInput {
  provider: string
  address: string
  versionId: string
  parameters: GeneratorParameter[]
  creationAttributes: string[]
}

export interface GeneratorVersionDocument
  extends GeneratorVersionSchema,
    Document {}

const generatorVersion = new Schema<GeneratorVersionDocument>(
  {
    provider: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    versionId: {
      type: String,
      required: true,
    },
    parameters: {
      type: [
        {
          name: {
            type: String,
            required: true,
          },
          label: {
            type: String,
            required: true,
          },
          description: {
            type: String,
            required: true,
          },
          isRequired: {
            type: Boolean,
            default: false,
          },
          optional: {
            type: Boolean,
            default: false,
          },
          default: {
            type: Schema.Types.Mixed,
            required: true,
          },
          allowedValues: {
            type: [Schema.Types.Mixed],
            default: [],
          },
          allowedValuesFrom: {
            type: String,
          },
          minimum: {
            type: Number,
          },
          maximum: {
            type: Number,
          },
          minLength: {
            type: Number,
          },
          maxLength: {
            type: Number,
          },
          mediaUpload: {
            type: String,
          },
        },
      ],
      default: [],
    },
    creationAttributes: {
      type: [String],
      default: [],
    },
    isDeprecated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

type GeneratorOutputType = 'creation' | 'llm' | 'concept'

export interface GeneratorSchema {
  generatorName: string
  description: string
  defaultVersionId?: string
  deployment?: string
  versions: GeneratorVersionSchema[]
  output: GeneratorOutputType
  visible?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface GeneratorInput {
  generatorName: string
  description: string
  defaultVersionId?: string
  deployment?: string
  versions: GeneratorVersionInput[]
  output: GeneratorOutputType
  visible?: boolean
}

export interface GeneratorDocument extends GeneratorSchema, Document {}

const generator = new Schema<GeneratorDocument>(
  {
    generatorName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    output: {
      type: String,
      required: true,
    },
    defaultVersionId: {
      type: String,
    },
    deployment: {
      type: String,
    },
    versions: {
      type: [generatorVersion],
      default: [],
    },
    visible: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  },
)

generator.pre<GeneratorDocument>('save', function (next) {
  this.updatedAt = new Date()

  next()
})

generator.plugin(paginate)

export const Generator = model<GeneratorDocument>('generators', generator)
