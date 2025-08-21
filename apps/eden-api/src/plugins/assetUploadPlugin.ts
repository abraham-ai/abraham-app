import { MediaAttributes, MediaType } from '@edenlabs/eden-sdk'
import axios from 'axios'
import type { FastifyInstance } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'

export interface Asset {
  uri: string
  thumbnailUri?: string
  assetBuffer?: Buffer
  mediaAttributes: Omit<MediaAttributes, 'mimeType'>
}

export const mediaTypeMap: Record<string, MediaType> = {
  mp4: MediaType.Video,
  m3u8: MediaType.Video,
  jpg: MediaType.Image,
  jpeg: MediaType.Image,
  png: MediaType.Image,
  webp: MediaType.Image,
  zip: MediaType.Zip,
  tar: MediaType.Zip,
}

const uploadUrlAsset = async (server: FastifyInstance, url: string) => {
  const asset = await axios.get(url, { responseType: 'arraybuffer' })
  const assetB64 = Buffer.from(asset.data, 'base64')
  const fileType = await fileTypeFromBuffer(assetB64)
  const fileSize = assetB64.byteLength

  if (!fileType) {
    throw new Error('fileType from buffer is undefined')
  }

  const mediaType = mediaTypeMap[fileType?.ext || 'txt']

  // all non-video assets larger 50 MB need to be stored on S3
  if (!fileType.mime.startsWith('video') && fileSize >= 52428800) {
    // upload original to s3, return S3 asset url for `uri` field
    const originalAsset = await server.uploadS3BufferAsset(
      server,
      assetB64,
      fileType,
    )
    const uploadedOriginalAsset: Asset = {
      uri: originalAsset.uri,
      thumbnailUri: originalAsset.thumbnailUri,
      mediaAttributes: originalAsset.mediaAttributes,
    }

    // produce a smaller version of images and upload them to cloudinary
    if (fileType.mime.startsWith('image')) {
      const thumbnailBuffer = await sharp(assetB64)
        .resize({ width: 2560, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      const thumbnailAsset = await server.uploadCldBufferAsset(
        server,
        MediaType.Image,
        thumbnailBuffer,
      )
      uploadedOriginalAsset.thumbnailUri = thumbnailAsset.uri
    } else {
      uploadedOriginalAsset.thumbnailUri = originalAsset.thumbnailUri
    }

    return new Promise<Asset>(resolve => resolve(uploadedOriginalAsset))
  }

  return server.uploadCldBufferAsset(server, mediaType, assetB64)
}

export const registerAssetUpload = async (fastify: FastifyInstance) => {
  try {
    fastify.decorate('uploadUrlAsset', uploadUrlAsset)
    fastify.log.info('Successfully registered plugin: AssetUpload')
  } catch (err) {
    fastify.log.error('Plugin: AssetUpload, error on register', err)
    console.error(err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    uploadUrlAsset: (server: FastifyInstance, url: string) => Promise<Asset>
  }
}

export default registerAssetUpload
