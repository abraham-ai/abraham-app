import {
  getMediaDownloadUrl,
  getMediaDownloadZip,
  receiveMediaTranscodeUpdate,
  uploadMedia,
  uploadMediaRequestCloudinary,
  uploadS3MediaRequest,
} from '../controllers/mediaController'
import { isAuth } from '../middleware/authMiddleware'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'

const mediaRoutes: FastifyPluginAsync = async server => {
  server.post('/media/upload', {
    schema: {
      tags: ['Media'],
      description: 'Upload media',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Object({
          url: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (req, reply) => uploadMedia(server, req, reply),
  })

  server.post('/media/upload/request', {
    schema: {
      tags: ['Media'],
      description: 'Upload media request',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        filename: Type.String(),
        contentType: Type.String(),
      }),
      response: {
        200: Type.Object({
          signedUrl: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (req, reply) => uploadS3MediaRequest(server, req, reply),
  })

  server.get('/media/upload/sign-request', {
    schema: {
      tags: ['Media'],
      description: 'Upload media request - Cloudinary',
      security: [
        {
          apiKey: [],
        },
      ],
      response: {
        200: Type.Object({
          signature: Type.String(),
          timestamp: Type.Number(),
          cloudName: Type.String(),
          apiKey: Type.String(),
        }),
        500: Type.Object({
          message: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (req, reply) => uploadMediaRequestCloudinary(server, req, reply),
  })

  server.get('/media/download', {
    schema: {
      tags: ['Media'],
      description: 'Get media download url',
      security: [
        {
          apiKey: [],
          // apiSecret: [],
        },
      ],
      querystring: {
        url: Type.String(),
        fileName: Type.Optional(Type.String()),
        fileExtension: Type.Optional(Type.String()),
      },
      response: {
        200: Type.Object({
          signedUrl: Type.String(),
        }),
      },
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (req, reply) => getMediaDownloadUrl(server, req, reply),
  })

  server.post('/media/download/bulk', {
    schema: {
      tags: ['Media'],
      description: 'Bulk download media as zip file',
      security: [
        {
          apiKey: [],
        },
      ],
      body: Type.Object({
        files: Type.Array(
          Type.Object({
            url: Type.String({ format: 'uri' }),
            fileName: Type.Optional(Type.String()),
            fileExtension: Type.Optional(Type.String()),
          }),
        ),
      }),
    },
    preHandler: [(request, reply) => isAuth(server, request, reply)],
    handler: (req, reply) => getMediaDownloadZip(server, req, reply),
  })

  server.post('/media/update/transcode', {
    schema: {
      tags: ['Tasks'],
      description: 'Update a task',
      hide: true,
      querystring: {
        secret: Type.String(),
      },
      body: Type.Object({
        s3key: Type.String(),
      }),
    },
    handler: (request, reply) =>
      receiveMediaTranscodeUpdate(server, request, reply),
  })
}

export default mediaRoutes
