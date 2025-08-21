import {
  archiveNotifications,
  createNotification,
  getNotificationCount,
  getNotifications,
  markNotificationsRead,
} from '../../controllers/notificationController'
import { isAdmin, isAuth } from '../../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const notificationRoutes: FastifyPluginAsync = async server => {
  // Create notification (admin only)
  server.post('/v2/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'Create a notification',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        user_id: Type.String(),
        type: Type.Union([
          Type.Literal('trigger_complete'),
          Type.Literal('trigger_failed'),
          Type.Literal('trigger_started'),
          Type.Literal('session_complete'),
          Type.Literal('session_failed'),
          Type.Literal('agent_mentioned'),
          Type.Literal('system_alert'),
          Type.Literal('agent_permission_added'),
          Type.Literal('agent_permission_removed'),
        ]),
        title: Type.String(),
        message: Type.String(),
        priority: Type.Optional(
          Type.Union([
            Type.Literal('low'),
            Type.Literal('normal'),
            Type.Literal('high'),
            Type.Literal('urgent'),
          ]),
        ),
        channels: Type.Optional(
          Type.Array(
            Type.Union([
              Type.Literal('in_app'),
              Type.Literal('push'),
              Type.Literal('email'),
              Type.Literal('sms'),
            ]),
          ),
        ),
        trigger_id: Type.Optional(Type.String()),
        session_id: Type.Optional(Type.String()),
        agent_id: Type.Optional(Type.String()),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
        action_url: Type.Optional(Type.String()),
        expires_at: Type.Optional(Type.String({ format: 'date-time' })),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAdmin(server, request, reply)],
    handler: (request, reply) => createNotification(request, reply),
  })

  // Get notifications for current user
  server.get('/v2/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'Get notifications for current user',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: Type.Object({
        read: Type.Optional(Type.Boolean()),
        type: Type.Optional(
          Type.Union([
            Type.Literal('trigger_complete'),
            Type.Literal('trigger_failed'),
            Type.Literal('trigger_started'),
            Type.Literal('session_complete'),
            Type.Literal('session_failed'),
            Type.Literal('agent_mentioned'),
            Type.Literal('system_alert'),
            Type.Literal('agent_permission_added'),
            Type.Literal('agent_permission_removed'),
          ]),
        ),
        priority: Type.Optional(
          Type.Union([
            Type.Literal('low'),
            Type.Literal('normal'),
            Type.Literal('high'),
            Type.Literal('urgent'),
          ]),
        ),
        trigger_id: Type.Optional(Type.String()),
        session_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        include_archived: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          notifications: Type.Array(Type.Any()),
          total_count: Type.Integer(),
          unread_count: Type.Integer(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getNotifications(server, request, reply),
  })

  // Mark notifications as read
  server.patch('/v2/notifications/read', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark notifications as read',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        notification_ids: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        200: Type.Object({
          marked_read_count: Type.Integer(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => markNotificationsRead(request, reply),
  })

  // Get notification count
  server.get('/v2/notifications/count', {
    schema: {
      tags: ['Notifications'],
      description: 'Get notification count for current user',
      security: [
        {
          apiKey: [],
        },
      ],
      querystring: Type.Object({
        read: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          count: Type.Integer(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => getNotificationCount(request, reply),
  })

  // Archive notifications
  server.patch('/v2/notifications/archive', {
    schema: {
      tags: ['Notifications'],
      description: 'Archive notifications (soft delete)',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        notification_ids: Type.Array(Type.String(), { minItems: 1 }),
      }),
      response: {
        200: Type.Object({
          archived_count: Type.Integer(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (request, reply) => archiveNotifications(request, reply),
  })
}

export default notificationRoutes
