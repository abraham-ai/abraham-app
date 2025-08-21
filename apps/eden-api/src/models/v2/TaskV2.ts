import { UserDocument } from '../User'
import {
  TaskV2Args,
  TaskV2Result,
  TaskV2Status,
  ToolOutputTypeV2,
} from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Document, Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import paginate from 'mongoose-paginate-v2'

export interface TaskV2Schema {
  user: UserDocument
  agent: UserDocument
  tool: string
  args: TaskV2Args
  output_type: ToolOutputTypeV2
  result: TaskV2Result[]
  status: TaskV2Status
  cost?: number
  error?: string
  progress?: number
  handler_id?: string
  performance?: { [key: string]: number }
  createdAt: Date
  updatedAt: Date
}

export interface TaskV2Input {
  user: ObjectId
  agent: ObjectId
  tool: string
  args: TaskV2Args
  output_type: ToolOutputTypeV2
  result: TaskV2Result[]
  status?: TaskV2Status
  cost?: number
  performance?: { [key: string]: number }
  error?: string
  handler_id?: string
  progress?: number
}

export interface TaskV2Document extends TaskV2Schema, Document {}

export const taskSchema = new Schema<TaskV2Document>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
    },
    tool: {
      type: Schema.Types.String,
      required: true,
    },
    output_type: {
      type: Schema.Types.String,
      required: true,
    },
    args: {
      type: Schema.Types.Mixed,
      default: {},
    },
    cost: {
      type: Schema.Types.Number,
    },
    handler_id: {
      type: Schema.Types.String,
    },
    status: {
      type: Schema.Types.String,
      enum: Object.values(TaskV2Status),
      default: TaskV2Status.Pending,
    },
    error: {
      type: Schema.Types.String,
      default: null,
    },
    performance: {
      type: Schema.Types.Mixed,
    },
    progress: {
      type: Schema.Types.Number,
      default: 0,
    },
    result: {
      type: [],
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

taskSchema.index({
  tool: 1,
})
taskSchema.index({
  status: 1,
  tool: 1,
})
taskSchema.index({
  'args.lora': 1,
  'result.output.creation': -1,
  createdAt: -1,
  _id: -1,
})
taskSchema.index({
  'args.lora': 1,
  createdAt: -1,
  _id: -1,
})
taskSchema.index({
  output_type: 1,
  createdAt: -1,
})
taskSchema.index({
  output_type: 1,
  'result.output.model': 1,
})
taskSchema.index({
  output_type: 1,
  'result.output.creation': 1,
})
taskSchema.index({ createdAt: -1 })
taskSchema.index({ handler_id: -1 })
taskSchema.index({
  user: 1,
  status: 1,
  tool: 1,
  output_type: 1,
  createdAt: -1,
})
taskSchema.index({ status: 1, createdAt: -1 })
taskSchema.index({ cost: 1, status: 1, createdAt: -1 })
taskSchema.index({ user: 1, createdAt: -1, tool: 1 })
taskSchema.plugin(paginate)
taskSchema.plugin(aggregatePaginate)

export const TaskV2 = model<TaskV2Document>('tasks3', taskSchema)
