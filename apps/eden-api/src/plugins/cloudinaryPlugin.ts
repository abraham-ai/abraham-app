import { Asset } from './assetUploadPlugin'
import { MediaAttributes, MediaType } from '@edenlabs/eden-sdk'
import {
  UploadApiOptions,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary'
import type { FastifyInstance } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import { MimeType } from 'file-type/core'

export interface CloudinaryUploadSignature {
  signature: string
  timestamp: number
  cloudName: string | undefined
  apiKey: string | undefined
}

const getMediaAttributes = async (
  uploadResponse: UploadApiResponse,
  mediaType: MediaType,
  mimeType: MimeType,
): Promise<MediaAttributes> => {
  const mediaAttributes: MediaAttributes = {
    type: mediaType,
    mimeType: mimeType,
  }

  if (mediaType === MediaType.Video || mediaType === MediaType.Audio) {
    mediaAttributes.duration = uploadResponse.duration
  }

  if (mediaType === MediaType.Image || mediaType === MediaType.Video) {
    mediaAttributes.width = uploadResponse.width
    mediaAttributes.height = uploadResponse.height
    mediaAttributes.aspectRatio = uploadResponse.width / uploadResponse.height
  }

  return mediaAttributes
}

export const uploadCldBufferAsset = async (
  server: FastifyInstance,
  mediaType: MediaType,
  buffer: Buffer,
): Promise<Asset> => {
  const fileType = await fileTypeFromBuffer(buffer)

  try {
    const uploadConfig: UploadApiOptions = {
      media_metadata:
        mediaType === MediaType.Video || mediaType === MediaType.Audio,
      resource_type:
        mediaType === MediaType.Image
          ? 'image'
          : mediaType === MediaType.Video
          ? 'video'
          : 'raw',
      eager:
        mediaType === MediaType.Video
          ? 'c_fill,w_1200,h_630,g_center/c_limit,w_1200/f_webp/q_auto|c_fill,w_1200,h_630,g_center/c_limit,w_1200/f_jpg/q_auto'
          : undefined,
      folder: 'creations',
    }
    const uploadResult = await new Promise<UploadApiResponse | undefined>(
      (resolve, reject) => {
        // determine the estimated filesize of buffer and use upload_chunked_stream if it is above 50MB
        const chunkingRequiredLimit = 90 * 1024 * 1024
        const estimatedFileSize = buffer.byteLength

        if (estimatedFileSize > chunkingRequiredLimit) {
          // console.log(
          //   'upload: file size bigger 50MB, use upload_chunked_stream',
          //   estimatedFileSize,
          // )
          // console.log('upload_chunked_stream', {
          //   chunk_size: 20000000,
          //   ...uploadConfig,
          // })
          server.cloudinary.uploader
            .upload_chunked_stream(
              {
                chunk_size: 20000000,
                ...uploadConfig,
              },
              (error, uploadResponse) => {
                if (error) {
                  console.log('upload_chunked_stream error', error)
                  reject(new Error(error.message))
                }

                // console.log(
                //   'upload_chunked_stream done',
                //   uploadResponse?.secure_url,
                // )
                resolve(uploadResponse)
              },
            )
            .end(buffer)
        } else {
          // console.log('upload_stream', uploadConfig)
          server.cloudinary.uploader
            .upload_stream({ ...uploadConfig }, (error, uploadResponse) => {
              if (error) {
                console.log('upload_stream error', error)
                reject(new Error(error.message))
              }

              // console.log('upload_stream done', uploadResponse?.secure_url)
              resolve(uploadResponse)
            })
            .end(buffer)
        }
      },
    )

    if (!uploadResult) {
      console.log('upload failed')
      return {
        uri: '',
        thumbnailUri: '',
        mediaAttributes: {
          type: mediaType,
          // mimeType: fileType?.mime || 'image/jpeg',
        },
      }
    }

    const mediaAttributes = await getMediaAttributes(
      uploadResult,
      mediaType,
      fileType?.mime || 'image/jpeg',
    )

    const formatVideoThumbnailUri = (uploadResult: UploadApiResponse) => {
      const { secure_url } = uploadResult
      return `${secure_url.substring(0, secure_url.lastIndexOf('.'))}`
    }

    const thumbnailUri =
      mediaType == MediaType.Video
        ? formatVideoThumbnailUri(uploadResult)
        : uploadResult.secure_url

    return {
      uri: uploadResult.secure_url,
      thumbnailUri,
      mediaAttributes,
    }
  } catch (e) {
    console.error('uploadCldBufferAsset failed returning dummy')
    return {
      uri: '',
      thumbnailUri: '',
      mediaAttributes: {
        type: mediaType,
        // mimeType: fileType?.mime || 'image/jpeg',
      },
    }
  }
}

type UploadConfig = {
  eager?: string
  folder?: string
}

const signRequest = (server: FastifyInstance, uploadConfig: UploadConfig) => {
  if (!server.config.CLOUDINARY_API_SECRET) {
    console.log('CLOUDINARY_API_SECRET not set')
    throw new Error('CLOUDINARY_API_SECRET not set')
  }

  const timestamp = Math.round(new Date().getTime() / 1000)

  const signature = server.cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
      ...uploadConfig,
    },
    server.config.CLOUDINARY_API_SECRET,
  )

  return { timestamp, signature }
}

export const generateCldUploadSignature: (
  server: FastifyInstance,
) => CloudinaryUploadSignature = (server: FastifyInstance) => {
  const uploadConfig = {
    folder: 'user_uploads',
  }
  const sig = signRequest(server, uploadConfig)
  return {
    signature: sig.signature,
    timestamp: sig.timestamp,
    cloudName: server.config.CLOUDINARY_CLOUD_NAME,
    apiKey: server.config.CLOUDINARY_API_KEY,
  }
}
export const getCldSignedDownloadUrl = (
  assetUrl: string,
  fileName?: string,
): Promise<string> => {
  return new Promise(function (resolve) {
    // console.log(assetUrl, fileName)
    const cloudinaryUrlSegments = assetUrl.split('/')
    const versionSegment =
      cloudinaryUrlSegments[cloudinaryUrlSegments.length - 3]
    // const folderSegment = cloudinaryUrlSegments[cloudinaryUrlSegments.length - 2]
    // const fileSegment = cloudinaryUrlSegments[cloudinaryUrlSegments.length - 1]
    // const [ publicId, fileExtension ] = lastSegment.split('.')

    const attachmentFlag = `fl_attachment:${fileName}`
    const signedUrl = assetUrl.replace(
      versionSegment,
      `${attachmentFlag}/${versionSegment}`,
    )

    // console.log({signedUrl})
    resolve(signedUrl)
  })
}

export const registerCloudinary = async (fastify: FastifyInstance) => {
  try {
    cloudinary.config({
      api_secret: fastify.config.CLOUDINARY_API_SECRET,
      api_key: fastify.config.CLOUDINARY_API_KEY,
      cloud_name: fastify.config.CLOUDINARY_CLOUD_NAME,
    })

    fastify.decorate('cloudinary', cloudinary)
    fastify.decorate('uploadCldBufferAsset', uploadCldBufferAsset)
    fastify.decorate('getCldSignedDownloadUrl', getCldSignedDownloadUrl)
    fastify.decorate('generateCldUploadSignature', generateCldUploadSignature)
    fastify.log.info('Successfully registered plugin: Cloudinary')
  } catch (err) {
    fastify.log.error('Plugin: Cloudinary, error on register', err)
    console.error(err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    cloudinary: typeof cloudinary
    uploadCldBufferAsset: (
      server: FastifyInstance,
      mediaType: MediaType,
      buffer: Buffer,
    ) => Promise<Asset>
    getCldSignedDownloadUrl: (
      assetUrl: string,
      fileName?: string,
    ) => Promise<string>
    generateCldUploadSignature: (
      server: FastifyInstance,
    ) => CloudinaryUploadSignature
  }
}

export default registerCloudinary
