import { GetObjectCommand } from '@aws-sdk/client-s3';
import { loadConfig } from '~~/server/utils/config';
import {
  buildImageKey,
  buildLegacyImageKey,
  getS3Client,
} from '~~/server/utils/image-assets';

function isSafeImageName(name: string): boolean {
  return name.length > 0 && !name.includes('/') && !name.includes('..');
}

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');
  const img = getQuery(event).img;

  if (!collectionId || !postId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID and Post ID are required',
    });
  }
  if (typeof img !== 'string' || !isSafeImageName(img)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid image name',
    });
  }

  const runtimeConfig = useRuntimeConfig(event);
  const config = await loadConfig(runtimeConfig.rootDir);

  if (!config.s3) {
    throw createError({
      statusCode: 404,
      message: 'Image storage not configured',
    });
  }

  const client = getS3Client(config.s3);
  const keys = [
    buildImageKey(config.s3, collectionId, img),
    buildLegacyImageKey(config.s3, collectionId, postId, img),
  ];

  let result;
  for (const key of keys) {
    try {
      result = await client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
      break;
    } catch (error: any) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        continue;
      }
      console.error(`Error fetching proxied image ${key}:`, error);
      throw createError({ statusCode: 500, message: 'Failed to fetch image' });
    }
  }

  if (!result) {
    throw createError({ statusCode: 404, message: 'Image not found' });
  }

  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw createError({ statusCode: 404, message: 'Image not found' });
  }

  setResponseHeader(event, 'Content-Type', result.ContentType ?? 'application/octet-stream');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');

  return Buffer.from(bytes);
});
