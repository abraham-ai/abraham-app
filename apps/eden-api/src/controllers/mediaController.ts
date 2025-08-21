import { Creation } from '../models/Creation'
import { s3BaseUrl } from '../plugins/s3Plugin'
import { downloadZip } from '../utils/downloader'
import { MediaBulkDownloadArguments } from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import pLimit from 'p-limit'

export const uploadMedia = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const data = await request.file()

  if (!data) {
    return reply.status(500).send({
      message: 'No data found in upload',
    })
  }

  const buffer = await data.toBuffer()
  const type = await fileTypeFromBuffer(buffer)

  // Allow images, video, audio, text, and .bin files
  if (
    !type ||
    !(
      type.mime.startsWith('image/') ||
      type.mime.startsWith('video/') ||
      type.mime.startsWith('audio/') ||
      type.mime.startsWith('text/') ||
      type.mime.startsWith('application/zip') ||
      type.mime.startsWith('application/gzip') ||
      type.mime.startsWith('application/tar') ||
      type.mime.startsWith('application/x-tar') ||
      type.mime.startsWith('application/rar') ||
      type.mime.startsWith('application/vnd.rar') ||
      type.mime.startsWith('application/x-7z-compressed')
    )
  ) {
    return reply.status(400).send({
      message: 'Invalid file type',
    })
  }

  const { uri } = await server.uploadS3BufferAsset(server, buffer, type)
  return reply.status(200).send({ url: uri })
}

export const uploadMediaAdmin = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const data = await request.file()

  if (!data) {
    return reply.status(500).send({
      message: 'No data found in upload',
    })
  }

  const buffer = await data.toBuffer()
  const type = await fileTypeFromBuffer(buffer)

  // Allow images, video, audio, text, and .bin files
  if (
    !type ||
    !(
      type.mime.startsWith('image/') ||
      type.mime.startsWith('video/') ||
      type.mime.startsWith('audio/') ||
      type.mime.startsWith('text/') ||
      type.mime.startsWith('application/zip') ||
      type.mime.startsWith('application/gzip') ||
      type.mime.startsWith('application/tar') ||
      type.mime.startsWith('application/x-tar') ||
      type.mime.startsWith('application/rar') ||
      type.mime.startsWith('application/vnd.rar') ||
      type.mime.startsWith('application/x-7z-compressed')
    )
  ) {
    return reply.status(400).send({
      message: 'Invalid file type',
    })
  }

  const { uri } = await server.uploadS3BufferAsset(server, buffer, type)
  return reply.status(200).send({ url: uri })
}

export const getMediaDownloadUrl = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { url, fileName, fileExtension } = request.query as {
    url: string
    fileName: string
    fileExtension?: string
  }

  if (!url) {
    return reply.status(500).send({
      message: 'No url provided',
    })
  }

  const isCloudinaryAsset = url.startsWith('https://res.cloudinary.com')
  const signedUrl = isCloudinaryAsset
    ? await server.getCldSignedDownloadUrl(url, fileName)
    : await server.getS3SignedDownloadUrl(
        server,
        url,
        `${fileName}.${fileExtension}`,
      )

  return reply.status(200).send({ signedUrl })
}

// Define maximum number of concurrent promises
const CONCURRENCY_LIMIT = 5

export const getMediaDownloadUrls = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { files } = request.body as MediaBulkDownloadArguments

  if (
    !files ||
    !Array.isArray(files) ||
    files.length === 0 ||
    !files.every(
      file => typeof file.url === 'string' && typeof file.fileName === 'string',
    )
  ) {
    return reply.status(422).send({
      message:
        'Invalid request. Ensure that an array of files with url and fileName is provided.',
    })
  }

  const limit = pLimit(CONCURRENCY_LIMIT)

  const downloadPromises = files.map(file =>
    limit(async () => {
      const { url, fileName, fileExtension } = file

      if (!url) {
        return {
          fileName,
          error: 'No URL provided for this file.',
        }
      }

      try {
        const isCloudinaryAsset = url.startsWith('https://res.cloudinary.com')
        let signedUrl: string

        if (isCloudinaryAsset) {
          signedUrl = await server.getCldSignedDownloadUrl(url, fileName)
        } else {
          const fullFileName = fileExtension
            ? `${fileName}.${fileExtension}`
            : fileName
          signedUrl = await server.getS3SignedDownloadUrl(
            server,
            url,
            fullFileName,
          )
        }

        return {
          fileName,
          signedUrl,
        }
      } catch (error: any) {
        console.error(
          `Error generating signed URL for file "${fileName}":`,
          error,
        )

        return {
          fileName,
          error: error.message || 'Failed to generate signed URL.',
        }
      }
    }),
  )

  const settledResults = await Promise.allSettled(downloadPromises)

  const signedUrls = settledResults.map((result, index) => {
    const file = files[index]
    const fileName = file.fileName

    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        fileName,
        error: result.reason?.message || 'An unexpected error occurred.',
      }
    }
  })

  // console.log({ signedUrls })

  return reply
    .status(200)
    .send({ signedUrls: signedUrls.map(signed => signed.signedUrl) })
}

export const getMediaDownloadZip = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { files } = request.body as MediaBulkDownloadArguments

  // Validate the Request Body
  if (
    !files ||
    !Array.isArray(files) ||
    files.length === 0 ||
    !files.every(
      file => typeof file.url === 'string' && file.url.startsWith('http'),
    )
  ) {
    return reply.status(422).send({
      message:
        'Invalid request. Ensure that an array of files with valid URLs is provided.',
    })
  }

  await downloadZip(files, reply, server)
}

export const uploadS3MediaRequest = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { filename, contentType } = request.body as {
    filename: string
    contentType: string
  }

  if (!filename || !contentType) {
    return reply.status(400).send({
      message: 'Missing fileName or contentType',
    })
  }

  try {
    const signedUrl = await server.generateS3UploadSignedUrl(server, {
      filename,
      contentType,
    })
    return reply.status(200).send({ signedUrl })
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return reply.status(500).send({
      message: 'Error generating signed URL',
    })
  }
}

export const uploadMediaRequestCloudinary = async (
  server: FastifyInstance,
  //@ts-ignore - unused
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const signature = server.generateCldUploadSignature(server)
    return reply.status(200).send(signature)
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return reply.status(500).send({
      message: 'Error generating signed URL',
    })
  }
}

export const receiveMediaTranscodeUpdate = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { secret } = request.query as { secret: string }
  const { s3key } = request.body as {
    s3key: string
  }

  if (secret !== server.config.WEBHOOK_SECRET) {
    return reply.status(401).send({
      message: 'Invalid webhook secret',
    })
  }

  // const baseUrl = s3BaseUrl(server)
  const baseUrl = s3BaseUrl(server)
  const creationUri = `${baseUrl}/${s3key}`
  const parts = s3key.split('/')
  const ogFileName = parts.pop() || '' // Provide a fallback empty string if pop() returns undefined
  const ogFile = ogFileName.replace(/\.[^/.]+$/, '') // Remove the extension
  const filename = `${ogFile}.m3u8`
  const mediaUri = `${baseUrl}/transcoded/${s3key}/${filename}`
  // console.log('creationUri', creationUri)
  // console.log('mediaUri', mediaUri)

  const creation = await Creation.findOne({ uri: creationUri })

  if (!creation) {
    return reply.status(404).send({
      message: 'Creation not found',
    })
  }

  creation.mediaUri = mediaUri
  await creation.save()

  return reply.status(200).send({})
}
