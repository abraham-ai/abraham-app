import { WebAPICallOptions, WebAPICallResult } from "../types";

export interface MediaAttributes {
  type: string;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  blurhash?: string;
}

export enum MediaType {
  Image = "image",
  Video = "video",
  Text = "text",
  Audio = "audio",
  Zip = "zip",
  Model = "model",
  Unknown = "unknown",
}

// Arguments

export interface MediaUploadArguments extends WebAPICallOptions {
  /**
   * Binary payload to upload. Supports browser (Blob/File) and Node (Buffer/ArrayBuffer/Uint8Array).
   */
  media: Blob | File | Buffer | Uint8Array | ArrayBuffer;
  /** Optional filename hint (mainly for Node.js usage) */
  filename?: string;
}

export interface MediaBulkDownloadArguments extends WebAPICallOptions {
  files: {
    url: string;
    fileName: string;
    fileExtension?: string;
  };
}

// Requests

export const mediaUploadRequestConfig = (args: MediaUploadArguments) => {
  const form = new FormData();
  const media: any = args.media;
  const filename = args.filename || "upload.bin";

  if (typeof Blob !== "undefined" && media instanceof Blob) {
    form.append("file", media, (media as any).name || filename);
  } else if (typeof File !== "undefined" && media instanceof File) {
    form.append("file", media, media.name);
  } else if (typeof Buffer !== "undefined" && media instanceof Buffer) {
    form.append("file", media as any, filename);
  } else if (media instanceof Uint8Array) {
    form.append("file", media as any, filename);
  } else if (media instanceof ArrayBuffer) {
    form.append("file", new Uint8Array(media) as any, filename);
  } else {
    throw new Error(
      "Unsupported media type supplied to mediaUploadRequestConfig"
    );
  }

  return {
    method: "POST",
    url: "/media/upload",
    data: form,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  };
};

export const mediaBulkDownloadRequestConfig = (
  args: MediaBulkDownloadArguments
) => {
  return {
    method: "POST",
    url: "/media/download/bulk",
    data: {
      ...args,
    },
  };
};

// Responses

export type MediaUploadResponse = WebAPICallResult & {
  error?: string;
  url?: string;
};

export type MediaBulkDownloadResponse = WebAPICallResult & {
  error?: string;
  signedUrls?: string[];
};
