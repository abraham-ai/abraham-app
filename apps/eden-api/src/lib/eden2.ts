import { SessionDocument } from '../models/v2/SessionV2'
import { TaskV2Document } from '../models/v2/TaskV2'
import { ThreadDocument } from '../models/v2/Thread'
import { Message, ThreadMessage } from '@edenlabs/eden-sdk'
import { FastifyInstance } from 'fastify'

type GenericUpdate = { [key: string]: string | number | boolean }

// updated fields are a flat structure that uses dot notation for sub documents, e.g. { 'task.output.files.0': 'http://12312312' }
export const handleTaskUpdateStreamEvent = async (
  server: FastifyInstance,
  task: TaskV2Document,
  _updatedFields?: GenericUpdate,
) => {
  // server.log.info({ msg: 'handleTaskUpdateStreamEvent', task })
  server.internalMessages.publish('task-updates-v2', task)
}

export const handleThreadUpdateStreamEvent = async (
  server: FastifyInstance,
  thread?: ThreadDocument,
  newMessages?: ThreadMessage[],
) => {
  server.internalMessages.publish('thread-updates', { thread, newMessages })
}

export const handleSessionUpdateStreamEvent = async (
  server: FastifyInstance,
  session?: SessionDocument,
  newMessages?: Message[],
) => {
  server.internalMessages.publish('session-updates', { session, newMessages })
}

export const calculateMaxDimensions = (
  aspectRatio: number,
  maxDimension: number,
): {
  width: number
  height: number
} => {
  let width, height
  if (aspectRatio > 1) {
    width = maxDimension
    height = Math.round(maxDimension / aspectRatio)
  } else {
    width = Math.round(maxDimension * aspectRatio)
    height = maxDimension
  }
  return { width, height }
}
