import { getTool, listTools } from '../../controllers/v2/toolControllerV2'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const toolRoutesV2: FastifyPluginAsync = async server => {
  server.get('/v2/tools/:toolKey', {
    schema: {
      tags: ['Tools'],
      description: 'Get a Tool',
      security: [
        {
          apiKey: [],
        },
      ],
      params: Type.Object({
        toolKey: Type.String(),
      }),
      response: {
        200: Type.Object({
          tool: Type.Object({
            key: Type.String(),
            name: Type.String(),
            active: Type.Optional(Type.Boolean()),
            description: Type.Optional(Type.String()),
            output_type: Type.String(),
            cost_estimate: Type.Optional(Type.String()),
            parameters: Type.Optional(Type.Array(Type.Any())),
            resolutions: Type.Optional(Type.Array(Type.String())),
            thumbnail: Type.Optional(Type.String()),
            order: Type.Optional(Type.Number()),
            base_model: Type.Optional(Type.String()),
          }),
        }),
      },
    },
    handler: (request, reply) => getTool(server, request, reply),
  })

  server.get('/v2/tools', {
    schema: {
      tags: ['Tools'],
      description: 'List Tools',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        hideParams: Type.Optional(Type.String()),
      },
      response: {
        200: Type.Object({
          tools: Type.Array(
            Type.Object({
              key: Type.String(),
              name: Type.String(),
              active: Type.Optional(Type.Boolean()),
              description: Type.Optional(Type.String()),
              output_type: Type.String(),
              cost_estimate: Type.Optional(Type.String()),
              parameters: Type.Optional(Type.Array(Type.Any())),
              resolutions: Type.Optional(Type.Array(Type.String())),
              thumbnail: Type.Optional(Type.String()),
              order: Type.Optional(Type.Number()),
              base_model: Type.Optional(Type.String()),
            }),
          ),
        }),
      },
    },
    handler: (request, reply) => listTools(server, request, reply),
  })
}

export default toolRoutesV2
