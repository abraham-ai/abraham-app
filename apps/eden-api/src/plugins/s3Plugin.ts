import * as util from '../lib/util'
import { Asset, mediaTypeMap } from './assetUploadPlugin'
import { MediaAttributes, MediaType } from '@edenlabs/eden-sdk'
import AWS from 'aws-sdk'
import axios from 'axios'
import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { FileTypeResult, fileTypeFromBuffer } from 'file-type'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

const getS3MediaAttributes = async (
  buffer: Buffer,
  fileExtension: string,
): Promise<Omit<MediaAttributes, 'mimeType'>> => {
  const mediaType = mediaTypeMap[fileExtension]
  const mediaAttributes: Omit<MediaAttributes, 'mimeType'> = {
    type: mediaType,
  }

  const tempFilePath = join(tmpdir(), randomUUID())
  fs.writeFileSync(tempFilePath, buffer)

  if (mediaType === MediaType.Video || mediaType === MediaType.Audio) {
    const duration = await new Promise<number | undefined>(
      (resolve, reject) => {
        ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
          if (err) reject(err)
          else resolve(metadata.format.duration)
        })
      },
    )
    if (!duration) throw new Error('Could not get media duration')
    mediaAttributes.duration = duration
  }

  if (mediaType === MediaType.Video) {
    const { width, height, aspectRatio } = await new Promise<{
      width: number
      height: number
      aspectRatio: number
    }>((resolve, reject) => {
      ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
        if (err) reject(err)
        else {
          const width = metadata.streams[0].width
          const height = metadata.streams[0].height
          const aspectRatio = width && height ? width / height : undefined
          if (width && height && aspectRatio) {
            resolve({ width, height, aspectRatio })
          } else {
            reject(new Error('Width, height or aspect ratio is undefined'))
          }
        }
      })
    })
    if (!width || !height || !aspectRatio) {
      throw new Error('Could not get media resolution')
    }
    mediaAttributes.width = width
    mediaAttributes.height = height
    mediaAttributes.aspectRatio = aspectRatio
  }

  if (mediaType === MediaType.Image) {
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not get image resolution')
    }
    mediaAttributes.width = metadata.width
    mediaAttributes.height = metadata.height
    mediaAttributes.aspectRatio = metadata.width / metadata.height
  }

  fs.unlinkSync(tempFilePath)

  return mediaAttributes
}

export const uploadS3UrlAsset = async (
  server: FastifyInstance,
  url: string,
): Promise<Asset> => {
  const asset = await axios.get(url, { responseType: 'arraybuffer' })
  const assetB64 = Buffer.from(asset.data, 'base64')
  const fileType = await fileTypeFromBuffer(assetB64)

  // Allow images, video, audio, text, and .bin files
  if (
    !fileType ||
    !(
      fileType.mime.startsWith('image/') ||
      fileType.mime.startsWith('video/') ||
      fileType.mime.startsWith('audio/') ||
      fileType.mime.startsWith('text/') ||
      fileType.mime.startsWith('application/zip') ||
      fileType.mime.startsWith('application/gzip') ||
      fileType.mime.startsWith('application/tar') ||
      fileType.mime.startsWith('application/x-tar') ||
      fileType.mime.startsWith('application/rar') ||
      fileType.mime.startsWith('application/vnd.rar') ||
      fileType.mime.startsWith('application/x-7z-compressed')
    )
  ) {
    throw new Error(`unknown/unsupported file type ${url}`)
  }

  const { uri, mediaAttributes } = await uploadS3BufferAsset(
    server,
    assetB64,
    fileType,
  )
  return {
    uri,
    assetBuffer: assetB64,
    mediaAttributes,
  }
}

export const uploadS3ThumbnailAsset = async (
  server: FastifyInstance,
  assetInput: string | Buffer,
  maxWidth?: number,
) => {
  let assetB64: Buffer
  if (typeof assetInput === 'string') {
    const asset = await axios.get(assetInput, { responseType: 'arraybuffer' })
    assetB64 = Buffer.from(asset.data, 'base64')
  } else {
    assetB64 = assetInput
  }

  const resizedBuffer = await sharp(assetB64)
    .resize({ width: maxWidth || 500, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  const { uri } = await uploadS3BufferAsset(server, resizedBuffer, {
    ext: 'webp',
    mime: 'image/webp',
  })
  return uri
}

export const uploadS3BufferAsset = async (
  server: FastifyInstance,
  buffer: Buffer,
  fileType: FileTypeResult,
): Promise<Asset> => {
  const client = server.s3
  const S3_BUCKET = server.config.AWS_S3_BUCKET as string
  const sha = util.sha256(buffer)
  const metadata = { 'Content-Type': fileType.mime, SHA: sha }
  const filename = `${sha}.${fileType.ext}`
  const urlUpload = s3Url(server, filename)
  try {
    await client.headObject({ Bucket: S3_BUCKET, Key: filename }).promise()
  } catch (error) {
    await client
      .putObject({
        Bucket: S3_BUCKET,
        Key: filename,
        Body: buffer,
        Metadata: metadata,
        ContentType: fileType.mime,
      })
      .promise()
  }

  const mediaAttributes = await getS3MediaAttributes(buffer, fileType.ext)

  return {
    uri: urlUpload,
    mediaAttributes,
  }
}

export const generateS3UploadSignedUrl = async (
  server: FastifyInstance,
  { filename, contentType }: { filename: string; contentType: string },
): Promise<string> => {
  const s3 = new AWS.S3({
    accessKeyId: server.config.AWS_ACCESS_KEY, // Assuming these are set up in your config
    secretAccessKey: server.config.AWS_SECRET_KEY,
    region: server.config.AWS_REGION,
    useAccelerateEndpoint: true, // Enable S3 Transfer Acceleration
  })
  const S3_BUCKET = server.config.AWS_S3_BUCKET as string

  const params = {
    Bucket: S3_BUCKET,
    Key: filename,
    Expires: 60 * 5, // URL expires in 5 minutes
    ContentType: contentType,
  }

  return new Promise((resolve, reject) => {
    s3.getSignedUrl('putObject', params, (err, url) => {
      if (err) {
        reject(err)
      } else {
        resolve(url)
      }
    })
  })
}
export const getS3SignedDownloadUrl = (
  server: FastifyInstance,
  assetUrl: string,
  fileName?: string,
): Promise<string> => {
  // @todo: got assets floating on multiple buckets, thus this ugly solution of dissecting the url
  // @todo: swap this back to use config/ENV values whenever we're living on a single bucket
  //  currentBucketUrl = s3Url(server, '')
  // const isLegacyBucket = !assetUrl.includes(currentBucketUrl)
  const fileBucketUrlParts = assetUrl.split('/')
  const bucketName = server.config.AWS_S3_BUCKET

  if (!bucketName) {
    throw new Error('No bucket name found')
  }

  const assetPath = fileBucketUrlParts[fileBucketUrlParts.length - 1]

  const params = {
    // Bucket: server.config.AWS_S3_BUCKET || '',
    Bucket: bucketName,
    Key: assetPath,
  }

  return new Promise(function (resolve, reject) {
    server.s3
      .headObject(params)
      .promise()
      .then(function () {
        resolve(
          createS3SignedDownloadUrl(server, {
            ...params,
            ResponseContentType: 'application/octet-stream',
            ResponseContentDisposition: fileName
              ? `attachment; filename="${fileName}"`
              : undefined,
            Expires: 60 * 60 * 72, // 3 days
          }),
        )
      })
      .catch(function (err) {
        console.log('Generating Url Failed', err)
        reject('Generating Url Failed: file does not exist')
      })
  })
}

export const createS3SignedDownloadUrl = (
  server: FastifyInstance,
  params: {
    Bucket: string
    ResponseContentType: string
    ResponseContentDisposition: string | undefined
    Expires: number
    Key: string
  },
) => {
  return server.s3.getSignedUrl('getObject', params)
}

export const s3BaseUrl = (server: FastifyInstance) => {
  if (server.config.AWS_CLOUDFRONT_URL) {
    // Check if AWS_CLOUDFRONT_URL already includes https://
    return server.config.AWS_CLOUDFRONT_URL.startsWith('https://')
      ? server.config.AWS_CLOUDFRONT_URL
      : `https://${server.config.AWS_CLOUDFRONT_URL}`
  } else {
    return `https://${server.config.AWS_S3_BUCKET}.s3.${server.config.AWS_REGION}.amazonaws.com`
  }
}

export const rawS3BaseUrl = (server: FastifyInstance) => {
  return `https://${server.config.AWS_S3_BUCKET}.s3.${server.config.AWS_REGION}.amazonaws.com`
}

export enum ImageFormats {
  JPG = 'jpg',
  WEBP = 'webp',
}
const EXTENSION_PATTERN = /(\.[\w_-]+)$/i
export function changeExtension(
  filename: string,
  format: ImageFormats,
): string {
  return filename.replace(EXTENSION_PATTERN, `.${format}`)
}

export const s3Url = (server: FastifyInstance, filename: string) => {
  if (!filename) {
    return ''
  }

  if (filename.startsWith('https://')) {
    return filename
  }

  const baseUrl = s3BaseUrl(server)
  return `${baseUrl}/${filename}`
}

export const forceCloudfrontUrl = (
  server: FastifyInstance,
  url: string,
): string => {
  // console.log('url', url)
  // console.log('server.config.AWS_CLOUDFRONT_URL', server.config.AWS_CLOUDFRONT_URL)
  if (url.startsWith('https://')) {
    if (
      server.config.AWS_CLOUDFRONT_URL &&
      url.startsWith(server.config.AWS_CLOUDFRONT_URL)
    ) {
      // console.log('returning cloudfront url', url)
      return url
    }

    if (
      server.config.AWS_S3_BUCKET &&
      !url.includes(server.config.AWS_S3_BUCKET)
    ) {
      // console.log('returning non-s3 url', url)
      return url
    }
  }

  // console.log('returning cloudfront formatted url', url)

  const baseUrl = s3BaseUrl(server)

  // Construct a full URL if the provided string is a relative URL, does nothing otherwise
  const urlObject = new URL(url, baseUrl)

  // Extract the filename (last segment of the pathname)
  const pathnameSegments = urlObject.pathname.split('/')
  const filename = pathnameSegments[pathnameSegments.length - 1]

  // Create the new CloudFront URL by appending the filename to the base URL
  const cloudfrontUrl = `${baseUrl}/${filename}`

  // console.log('cloudfrontUrl', cloudfrontUrl)

  return cloudfrontUrl
}

export const s3ThumbnailUrl = (
  server: FastifyInstance,
  filename: string,
  size?: number,
) => {
  if (!filename) {
    return ''
  }

  if (filename.startsWith('https://')) {
    return filename
  }

  const baseUrl = s3BaseUrl(server)
  const srcWithSize = size
    ? filename.replace(EXTENSION_PATTERN, `_${size}$1`)
    : filename
  const filenameWithNewExtension = changeExtension(
    srcWithSize,
    ImageFormats.WEBP,
  )

  return `${baseUrl}/${filenameWithNewExtension}`
}

export const registerS3 = async (fastify: FastifyInstance) => {
  try {
    const s3 = new AWS.S3({
      accessKeyId: fastify.config.AWS_ACCESS_KEY,
      secretAccessKey: fastify.config.AWS_SECRET_KEY,
      region: fastify.config.AWS_REGION,
    })

    fastify.decorate('s3', s3)
    fastify.decorate('uploadS3ThumbnailAsset', uploadS3ThumbnailAsset)
    fastify.decorate('uploadS3BufferAsset', uploadS3BufferAsset)
    fastify.decorate('uploadS3UrlAsset', uploadS3UrlAsset)
    fastify.decorate('getS3SignedDownloadUrl', getS3SignedDownloadUrl)
    fastify.decorate('generateS3UploadSignedUrl', generateS3UploadSignedUrl)
    fastify.log.info('Successfully registered plugin: S3')
  } catch (err) {
    fastify.log.error('Plugin: S3, error on register', err)
    console.error(err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    s3: AWS.S3
    uploadS3ThumbnailAsset: (
      server: FastifyInstance,
      assetInput: string | Buffer,
    ) => Promise<string>
    uploadS3UrlAsset: (
      server: FastifyInstance,
      assetUrl: string,
    ) => Promise<Asset>
    uploadS3BufferAsset: (
      server: FastifyInstance,
      buffer: Buffer,
      fileType: FileTypeResult,
    ) => Promise<Asset>
    getS3SignedDownloadUrl: (
      server: FastifyInstance,
      assetUrl: string,
      fileName?: string,
    ) => Promise<string>
    generateS3UploadSignedUrl: (
      server: FastifyInstance,
      { filename, contentType }: { filename: string; contentType: string },
    ) => Promise<string>
  }
}

export default registerS3
