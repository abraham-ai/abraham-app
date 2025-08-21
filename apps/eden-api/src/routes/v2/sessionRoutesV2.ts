import {
  addSessionMessageReaction,
  cancelSession,
  createSession,
  createSessionMessage,
  createSessionShare,
  deleteSession,
  deleteSessionShare,
  getSession,
  getSharedSession,
  listSessions,
  renameSession,
} from '../../controllers/v2/sessionControllerV2'
import { isAuth } from '../../middleware/authMiddleware'
import { paginatedResponse, paginationProperties } from '../index'
import {
  SessionsV2CreateArguments,
  SessionsV2DeleteArguments,
  SessionsV2GetArguments,
  SessionsV2ListArguments,
  SessionsV2MessageArguments,
  SessionsV2MessageReactArguments,
  SessionsV2RenameArguments,
} from '@edenlabs/eden-sdk'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'

const sessionRoutesV2: FastifyPluginAsync = async server => {
  // Helper to create consistent preHandlers
  const sessionPreHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    await isAuth(server, request, reply)
  }

  server.post<{
    Body: SessionsV2CreateArguments
  }>('/v2/sessions/create', {
    schema: {
      tags: ['Sessions'],
      description: 'Create a new session',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        agent_ids: Type.Array(Type.String(), { minItems: 1 }),
        scenario: Type.Optional(Type.String({ maxLength: 1000 })),
        budget: Type.Optional(
          Type.Object({
            manna_budget: Type.Optional(
              Type.Number({ minimum: 100, maximum: 50000 }),
            ),
            token_budget: Type.Optional(
              Type.Number({ minimum: 1000, maximum: 1000000 }),
            ),
            turn_budget: Type.Optional(
              Type.Number({ minimum: 1, maximum: 1000 }),
            ),
          }),
        ),
        title: Type.Optional(Type.String({ maxLength: 1000 })),
        autonomy_settings: Type.Optional(
          Type.Object({
            auto_reply: Type.Boolean(),
            reply_interval: Type.Number({ minimum: 0, maximum: 3600 }),
            actor_selection_method: Type.Union([
              Type.Literal('random'),
              Type.Literal('random_exclude_last'),
            ]),
          }),
        ),
      },
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          session: Type.Any(),
        }),
        400: {
          message: Type.Optional(Type.String()),
        },
        401: {
          message: Type.Optional(Type.String()),
        },
        404: {
          message: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => createSession(server, request, reply),
  })

  server.post<{
    Body: SessionsV2MessageArguments & {
      stream?: boolean
      agent_ids?: string[]
      scenario?: string
      budget?: {
        manna_budget?: number
        token_budget?: number
        turn_budget?: number
      }
      title?: string
      autonomy_settings?: {
        auto_reply: boolean
        reply_interval: number
        actor_selection_method: 'random' | 'random_exclude_last'
      }
    }
  }>('/v2/sessions', {
    schema: {
      tags: ['Sessions'],
      description: 'Interact with a session',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        session_id: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
        attachments: Type.Optional(Type.Array(Type.String())),
        stream: Type.Optional(Type.Boolean()),
        agent_ids: Type.Optional(Type.Array(Type.String())),
        scenario: Type.Optional(Type.String({ maxLength: 1000 })),
        budget: Type.Optional(
          Type.Object({
            manna_budget: Type.Optional(
              Type.Number({ minimum: 100, maximum: 50000 }),
            ),
            token_budget: Type.Optional(
              Type.Number({ minimum: 1000, maximum: 1000000 }),
            ),
            turn_budget: Type.Optional(
              Type.Number({ minimum: 1, maximum: 1000 }),
            ),
          }),
        ),
        title: Type.Optional(Type.String({ maxLength: 1000 })),
        autonomy_settings: Type.Optional(
          Type.Object({
            auto_reply: Type.Boolean(),
            reply_interval: Type.Number({ minimum: 0, maximum: 3600 }),
            actor_selection_method: Type.Union([
              Type.Literal('random'),
              Type.Literal('random_exclude_last'),
            ]),
          }),
        ),
      },
      response: {
        200: Type.Object({
          session_id: Type.String(),
        }),
        400: {
          message: Type.Optional(Type.String()),
        },
        401: {
          message: Type.Optional(Type.String()),
        },
        404: {
          message: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => createSessionMessage(server, request, reply),
  })

  server.post<{
    Body: SessionsV2MessageReactArguments
  }>('/v2/sessions/react', {
    schema: {
      tags: ['Sessions'],
      description: 'Add a reaction to a session message',
      security: [
        {
          apiKey: [],
        },
      ],
      body: {
        message_id: Type.String(),
        reaction: Type.String(),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.Any(),
        }),
        400: {
          message: Type.Optional(Type.String()),
        },
        401: {
          message: Type.Optional(Type.String()),
        },
        404: {
          message: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.Any()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => addSessionMessageReaction(request, reply),
  })

  server.get<{
    Querystring: SessionsV2ListArguments
  }>('/v2/sessions', {
    schema: {
      tags: ['Sessions'],
      description: 'List sessions',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: {
        type: 'object',
        properties: {
          ...paginationProperties(),
          agent_id: Type.Optional(Type.String()),
        },
        required: [],
      },
      response: {
        200: paginatedResponse(Type.Any()),
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => listSessions(server, request, reply),
  })

  server.get<{
    Params: SessionsV2GetArguments
  }>('/v2/sessions/:session_id', {
    schema: {
      tags: ['Sessions'],
      description: 'Get a session',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        session_id: Type.String(),
      },
      response: {
        200: Type.Object({
          session: Type.Any(),
        }),
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => getSession(server, request, reply),
  })

  server.patch<{
    Params: Pick<SessionsV2RenameArguments, 'session_id'>
    Body: Pick<SessionsV2RenameArguments, 'title'>
  }>('/v2/sessions/:session_id', {
    schema: {
      tags: ['Sessions'],
      description: 'Modify a session',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        session_id: Type.String(),
      },
      body: {
        title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
        }),
        400: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        401: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => renameSession(request, reply),
  })

  server.delete<{
    Params: SessionsV2DeleteArguments
  }>('/v2/sessions/:session_id', {
    schema: {
      tags: ['Sessions'],
      description: 'Delete a session',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        session_id: Type.String(),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
        }),
        400: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        401: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => deleteSession(request, reply),
  })

  server.post<{
    Params: { session_id: string }
    Body: {
      tool_call_id?: string
      tool_call_index?: number
    }
  }>('/v2/sessions/:session_id/cancel', {
    schema: {
      tags: ['Sessions'],
      description: 'Cancel a running session',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        session_id: Type.String(),
      },
      body: Type.Object({
        tool_call_id: Type.Optional(Type.String()),
        tool_call_index: Type.Optional(Type.Number()),
      }),
      response: {
        200: Type.Object({
          status: Type.String(),
          session_id: Type.String(),
        }),
        400: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        401: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
          message: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => cancelSession(server, request, reply),
  })

  // Session Share Routes
  server.post<{
    Params: { session_id: string }
    Body: { message_id: string; title?: string }
  }>('/v2/sessions/:session_id/share', {
    schema: {
      tags: ['Sessions'],
      description: 'Create a share point for a session',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        session_id: Type.String(),
      },
      body: {
        message_id: Type.String(),
        title: Type.Optional(Type.String({ maxLength: 200 })),
      },
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          share_id: Type.String(),
          share_url: Type.String(),
        }),
        400: {
          error: Type.Optional(Type.String()),
        },
        403: {
          error: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => createSessionShare(server, request, reply),
  })

  server.get<{
    Params: { share_id: string }
  }>('/v2/sessions/share/:share_id', {
    schema: {
      tags: ['Sessions'],
      description: 'Get a shared session (public)',
      params: {
        share_id: Type.String(),
      },
      response: {
        200: Type.Object({
          share: Type.Object({
            share_id: Type.String(),
            title: Type.Optional(Type.String()),
            session: Type.Any(),
            messages: Type.Array(Type.Any()),
            owner: Type.Any(),
            createdAt: Type.String(),
          }),
        }),
        404: {
          error: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.String()),
        },
      },
    },
    // No auth required - this is a public endpoint
    handler: (request, reply) => getSharedSession(server, request, reply),
  })

  server.delete<{
    Params: { share_id: string }
  }>('/v2/sessions/share/:share_id', {
    schema: {
      tags: ['Sessions'],
      description: 'Delete a session share',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        share_id: Type.String(),
      },
      response: {
        200: Type.Object({
          success: Type.Boolean(),
        }),
        400: {
          error: Type.Optional(Type.String()),
        },
        403: {
          error: Type.Optional(Type.String()),
        },
        404: {
          error: Type.Optional(Type.String()),
        },
        500: {
          error: Type.Optional(Type.String()),
        },
      },
    },
    preHandler: [(request, reply) => sessionPreHandler(request, reply)],
    handler: (request, reply) => deleteSessionShare(server, request, reply),
  })
}

export default sessionRoutesV2
