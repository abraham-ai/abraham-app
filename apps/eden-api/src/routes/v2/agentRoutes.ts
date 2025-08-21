import {
  createAgent,
  createAgentTrigger,
  createMemoryAgent,
  deleteAgent,
  deleteAgentDeployment,
  deleteAgentTrigger,
  deployAgent,
  getAgent,
  getAgentDeployments,
  getAgentMemory,
  getAgentPermissions,
  getAgentTriggers,
  getAllUserDeployments,
  getAllUserTriggers,
  getSharedAgents,
  likeAgent,
  removeMemoryFromAgent,
  removeUnabsorbedMemory,
  retrieveMemoryAgent,
  retrieveMemorySession,
  retrieveMemoryUser,
  saveAgentMemory,
  unlikeAgent,
  updateAgent,
  updateAgentDeployment,
  updateAgentPermissions,
  updateAgentTrigger,
  updateMemoryAgent,
  updateMemorySession,
  updateMemoryUser,
  updateUserMemoryEnabled,
} from '../../controllers/agentController'
import { isAuth, maybeAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync, FastifyRequest } from 'fastify'

const agentRoutes: FastifyPluginAsync = async server => {
  server.get('/v2/agents/:agentId', {
    schema: {
      tags: ['Agents'],
      description: 'Get an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      response: {
        200: {
          agent: Type.Any(),
        },
      },
    },
    preHandler: [request => maybeAuth(server, request)],
    handler: (request, reply) => getAgent(server, request, reply),
  })

  server.post('/v2/agents', {
    schema: {
      tags: ['Agents'],
      description: 'Create an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        name: Type.String(),
        key: Type.String(),
        description: Type.String(),
        image: Type.String(),
        models: Type.Optional(
          Type.Array(
            Type.Object({
              lora: Type.String(),
              use_when: Type.Optional(Type.String()),
            }),
          ),
        ),
        persona: Type.Optional(Type.String()),
        isPersonaPublic: Type.Optional(Type.Boolean()),
        greeting: Type.Optional(Type.String()),
        knowledge: Type.Optional(Type.String()),
        voice: Type.Optional(Type.String()),
        suggestions: Type.Optional(
          Type.Array(
            Type.Object({
              label: Type.String(),
              prompt: Type.String(),
            }),
          ),
        ),
        tools: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
      }),
      response: {
        200: {
          agentId: Type.String(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createAgent(server, request, reply),
  })

  server.patch('/v2/agents/:agentId', {
    schema: {
      tags: ['Agents'],
      description: 'Update an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      body: Type.Object({
        name: Type.Optional(Type.String()),
        key: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        image: Type.Optional(Type.String()),
        public: Type.Optional(Type.Boolean()),
        models: Type.Optional(
          Type.Array(
            Type.Object({
              lora: Type.String(),
              use_when: Type.Optional(Type.String()),
            }),
          ),
        ),
        persona: Type.Optional(Type.String()),
        isPersonaPublic: Type.Optional(Type.Boolean()),
        greeting: Type.Optional(Type.String()),
        knowledge: Type.Optional(Type.String()),
        voice: Type.Optional(Type.String()),
        suggestions: Type.Optional(
          Type.Array(
            Type.Object({
              label: Type.String(),
              prompt: Type.String(),
            }),
          ),
        ),
        owner_pays: Type.Optional(Type.Boolean()),
        tools: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
      }),
      response: {
        200: Type.Object({
          agentId: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateAgent(server, request, reply),
  })

  server.get('/v2/agents/:agentId/triggers', {
    schema: {
      tags: ['Agents'],
      description: 'Get agent triggers',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAgentTriggers(request, reply),
  })

  server.post('/v2/agents/:agentId/triggers', {
    schema: {
      tags: ['Agents'],
      description: 'Create an agent trigger',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createAgentTrigger(server, request, reply),
  })

  server.patch('/v2/agents/:agentId/triggers/:triggerId', {
    schema: {
      tags: ['Agents'],
      description: 'Update an agent trigger',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateAgentTrigger(request, reply),
  })

  server.delete('/v2/agents/:agentId/triggers/:triggerId', {
    schema: {
      tags: ['Agents'],
      description: 'Delete an agent trigger',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteAgentTrigger(server, request, reply),
  })

  server.get('/v2/agents/:agentId/deployments', {
    schema: {
      tags: ['Agents'],
      description: 'Get agent deployments',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAgentDeployments(request, reply),
  })

  server.post('/v2/agents/:agentId/deployments', {
    schema: {
      tags: ['Agents'],
      description: 'Deploys or updates an agent deployment',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      response: {
        200: Type.Object({
          deploymentId: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deployAgent(server, request, reply),
  })

  server.patch('/v2/agents/:agentId/deployments', {
    schema: {
      tags: ['Agents'],
      description: 'Update an agent deployment',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateAgentDeployment(server, request, reply),
  })

  server.delete('/v2/agents/:agentId/deployments/:platform', {
    schema: {
      tags: ['Agents'],
      description: 'Delete an agent deployment',
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteAgentDeployment(server, request, reply),
  })

  server.delete('/v2/agents/:agentId', {
    schema: {
      tags: ['Agents'],
      description: 'Delete an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      response: {
        200: Type.Object({}),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => deleteAgent(request, reply),
  })

  server.post('/v2/agents/:agentId/like', {
    schema: {
      tags: ['Agents'],
      description: 'Like an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      response: {
        200: {
          message: Type.String(),
        },
        400: {
          message: Type.String(),
        },
        404: {
          message: Type.String(),
        },
        500: {
          message: Type.String(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => likeAgent(server, request, reply),
  })

  server.delete('/v2/agents/:agentId/like', {
    schema: {
      tags: ['Agents'],
      description: 'Unlike an agent',
      security: [
        {
          apiKey: [],
        },
      ],
      params: {
        agentId: Type.String(),
      },
      response: {
        200: {
          message: Type.String(),
        },
        400: {
          message: Type.String(),
        },
        404: {
          message: Type.String(),
        },
        500: {
          message: Type.String(),
        },
      },
    },
    preHandler: [async (request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => unlikeAgent(server, request, reply),
  })

  server.get('/v2/agents/triggers', {
    schema: {
      tags: ['Agents'],
      description: 'Get all triggers for user agents',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: {
          triggers: Type.Array(Type.Any()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAllUserTriggers(server, request, reply),
  })

  server.get('/v2/agents/deployments', {
    schema: {
      tags: ['Agents'],
      description: 'Get all deployments for user agents',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: {
          deployments: Type.Array(Type.Any()),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAllUserDeployments(server, request, reply),
  })

  server.get('/v2/agents/:agentId/memory', {
    schema: {
      tags: ['Agents'],
      description: 'Get user memory for an agent',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      response: {
        200: {
          content: Type.String(),
          unabsorbedDirectives: Type.Array(Type.Object({
            _id: Type.String(),
            content: Type.String(),
            createdAt: Type.Optional(Type.String()),
          })),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAgentMemory(server, request, reply),
  })

  server.post('/v2/agents/:agentId/memory', {
    schema: {
      tags: ['Agents'],
      description: 'Save user memory for an agent',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      body: Type.Object({ content: Type.String() }),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => saveAgentMemory(server, request, reply),
  })

  // New routes for memory operations
  server.get('/v2/agents/:agentId/memory-user', {
    schema: {
      tags: ['Agents'],
      description: 'Get full memory_user document',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => retrieveMemoryUser(server, request, reply),
  })

  server.patch('/v2/agents/:agentId/memory-user', {
    schema: {
      tags: ['Agents'],
      description: 'Update memory_user document',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      body: Type.Record(Type.String(), Type.Any()),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateMemoryUser(server, request, reply),
  })

  server.patch('/v2/agents/:agentId/user-memory-enabled', {
    schema: {
      tags: ['Agents'],
      description: 'Update user_memory_enabled field for an agent',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      body: Type.Object({
        user_memory_enabled: Type.Boolean(),
      }),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request: FastifyRequest<{ Params: { agentId: string }; Body: { user_memory_enabled: boolean } }>, reply) => updateUserMemoryEnabled(server, request, reply),
  })

  server.get('/v2/memory-sessions/:memoryId', {
    schema: {
      tags: ['Agents'],
      description: 'Get memory_session document',
      security: [{ apiKey: [] }],
      params: { memoryId: Type.String() },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => retrieveMemorySession(server, request, reply),
  })

  server.patch('/v2/memory-sessions/:memoryId', {
    schema: {
      tags: ['Agents'],
      description: 'Update memory_session document',
      security: [{ apiKey: [] }],
      params: { memoryId: Type.String() },
      body: Type.Record(Type.String(), Type.Any()),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateMemorySession(server, request, reply),
  })

  server.delete('/v2/agents/:agentId/memory/:memoryId', {
    schema: {
      tags: ['Agents'],
      description: 'Remove unabsorbed memory from memory_user',
      security: [{ apiKey: [] }],
      params: { 
        agentId: Type.String(),
        memoryId: Type.String(),
      },
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => removeUnabsorbedMemory(server, request, reply),
  })

  // Collective Memory routes
  server.get('/v2/agents/:agentId/memory-agent', {
    schema: {
      tags: ['Agents'],
      description: 'Get collective memory (memory_agent documents)',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      response: {
        200: {
          shards: Type.Array(Type.Object({
            _id: Type.String(),
            agent_id: Type.Any(),
            content: Type.Optional(Type.String()),
            extraction_prompt: Type.Optional(Type.String()),
            is_active: Type.Optional(Type.Boolean()),
            facts: Type.Array(Type.Object({
              _id: Type.String(),
              content: Type.String(),
              createdAt: Type.Optional(Type.String()),
              updatedAt: Type.Optional(Type.String()),
            })),
            unabsorbed_memory_ids: Type.Array(Type.Object({
              _id: Type.String(),
              content: Type.String(),
              createdAt: Type.Optional(Type.String()),
              updatedAt: Type.Optional(Type.String()),
            })),
          })),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => retrieveMemoryAgent(server, request, reply),
  })

  server.post('/v2/agents/:agentId/memory-agent', {
    schema: {
      tags: ['Agents'],
      description: 'Create new collective memory shard',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      body: Type.Object({
        shard_name: Type.String({ minLength: 1, maxLength: 50 }),
        extraction_prompt: Type.String({ minLength: 1, maxLength: 2000 }),
      }),
      response: {
        200: {
          success: Type.Boolean(),
          shard_id: Type.String(),
          message: Type.String(),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => createMemoryAgent(server, request, reply),
  })

  server.patch('/v2/agents/:agentId/memory-agent/:memoryAgentId', {
    schema: {
      tags: ['Agents'],
      description: 'Update memory_agent document',
      security: [{ apiKey: [] }],
      params: { 
        agentId: Type.String(),
        memoryAgentId: Type.String(),
      },
      body: Type.Record(Type.String(), Type.Any()),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateMemoryAgent(server, request, reply),
  })

  server.delete('/v2/agents/:agentId/memory-agent/:memoryAgentId/memory/:memoryId', {
    schema: {
      tags: ['Agents'],
      description: 'Remove memory from memory_agent arrays (facts or unabsorbed_memory_ids)',
      security: [{ apiKey: [] }],
      params: { 
        agentId: Type.String(),
        memoryAgentId: Type.String(),
        memoryId: Type.String(),
      },
      body: Type.Object({
        arrayField: Type.Union([Type.Literal('facts'), Type.Literal('unabsorbed_memory_ids')])
      }),
      response: { 200: { success: Type.Boolean() } },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => removeMemoryFromAgent(server, request, reply),
  })

  // Permissions routes
  server.get('/v2/agents/:agentId/permissions', {
    schema: {
      tags: ['Agents'],
      description: 'Get agent permissions',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      response: {
        200: {
          permissions: Type.Array(Type.Object({
            _id: Type.String(),
            agent: Type.String(),
            user: Type.Object({
              _id: Type.String(),
              userId: Type.Optional(Type.String()),
              username: Type.String(),
              userImage: Type.Optional(Type.String()),
            }),
            level: Type.String(),
            grantedAt: Type.String(),
          })),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getAgentPermissions(request, reply),
  })

  server.put('/v2/agents/:agentId/permissions', {
    schema: {
      tags: ['Agents'],
      description: 'Update agent permissions',
      security: [{ apiKey: [] }],
      params: { agentId: Type.String() },
      body: Type.Object({
        permissions: Type.Array(Type.Object({
          username: Type.String(),
          level: Type.Union([Type.Literal('editor'), Type.Literal('owner')]),
        })),
      }),
      response: {
        200: { success: Type.Boolean() },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => updateAgentPermissions(request, reply),
  })

  server.get('/v2/agents/shared', {
    schema: {
      tags: ['Agents'],
      description: 'Get agents shared with the current user',
      security: [{ apiKey: [] }],
      response: {
        200: {
          sharedAgents: Type.Array(Type.Object({
            agent: Type.Any(),
            permissionLevel: Type.String(),
            grantedAt: Type.String(),
          })),
        },
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getSharedAgents(server, request, reply),
  })
}

export default agentRoutes
