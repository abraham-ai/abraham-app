import {
  BaseModelName,
  ToolOutputTypeV2,
  ToolParameterV2,
} from '@edenlabs/eden-sdk'
import { Schema, model } from 'mongoose'

export type ToolV2Schema = {
  key: string
  name: string
  description?: string
  active?: boolean
  visible?: boolean
  parameters?: ToolParameterV2[]
  output_type: ToolOutputTypeV2
  cost_estimate?: string
  resolutions?: string[]
  thumbnail?: string
  order?: number
  base_model?: BaseModelName
}

export interface ToolV2Document extends ToolV2Schema {}

export const ToolV2Schema = new Schema<ToolV2Document>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    active: {
      type: Boolean,
      default: false,
    },
    visible: {
      type: Boolean,
      default: false,
    },
    parameters: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    output_type: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    resolutions: {
      type: [String],
    },
    order: {
      type: Number,
    },
    base_model: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

ToolV2Schema.index({ active: 1 })
ToolV2Schema.index({ createdAt: -1 })
ToolV2Schema.index({ output_type: -1, createdAt: -1 })
ToolV2Schema.index({ key: -1, active: 1, createdAt: -1 })

export const ToolV2 = model<ToolV2Document>('tools3', ToolV2Schema)
