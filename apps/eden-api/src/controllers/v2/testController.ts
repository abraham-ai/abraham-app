import { sendDiscordNotification } from '../../lib/discord'
import { User } from '../../models/User'
import { TaskV2Status } from '@edenlabs/eden-sdk'
import { FastifyInstance } from 'fastify'
import { FastifyRequest } from 'fastify'
import { FastifyReply } from 'fastify'

export const testDiscordNotification = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const user = await User.findById(userId)

  console.log(user, user?._id)

  // @ts-ignore
  sendDiscordNotification(server, {
    _id: user?._id,
    agent: user?._id,
    user: user?._id,
    tool: '123',
    args: {
      prompt: 'Hello, world!',
    },
    output_type: 'text',
    result: [],
    status: TaskV2Status.Failed,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return reply.status(200).send({
    message: 'Test discord notification',
  })
}
