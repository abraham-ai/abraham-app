import { ToolV2 } from '../../models/v2/ToolV2'
import { ToolsGetArgumentsV2, ToolsListArgumentsV2 } from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export const getTool = async (
  _server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { toolKey } = request.params as ToolsGetArgumentsV2
  const visibilityFilter = { active: true, visible: true }

  const tool = await ToolV2.findOne(
    {
      key: toolKey,
      ...visibilityFilter,
    },
    {
      'parameters.tip': 0,
    },
  )

  // nothing found or it was deleted and the user is not the owner
  if (!tool) {
    return reply.status(404).send({
      message: 'Tool not found',
    })
  }

  return reply.status(200).send({ tool })
}

export const listTools = async (
  _server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { hideParams } = request.query as ToolsListArgumentsV2
  const visibilityFilter = { active: true, visible: true }

  const projection = hideParams
    ? {
        resolutions: 0,
        parameters: 0,
      }
    : {
        'parameters.tip': 0,
      }

  const tools = await ToolV2.find(visibilityFilter, projection).sort({
    order: 1,
  })

  return reply.status(200).send({ tools })
}
