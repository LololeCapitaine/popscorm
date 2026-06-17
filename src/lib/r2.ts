import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Client S3 configuré pour Cloudflare R2.
 * À n'utiliser que côté serveur (les identifiants ne sont jamais exposés au
 * navigateur : variables d'env SANS préfixe NEXT_PUBLIC).
 */
let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

/** Envoie un objet dans R2. */
export async function putObject(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType?: string,
) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** URL signée pour envoyer (PUT) un objet directement depuis le navigateur. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

/** Récupère un objet (utilisé par le proxy de lecture, étape 5). */
export async function getObject(key: string) {
  return getR2Client().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
}

/** Liste toutes les clés sous un préfixe (gère la pagination). */
export async function listKeys(prefix: string): Promise<string[]> {
  const client = getR2Client();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Supprime tous les objets sous un préfixe (par lots de 1000). */
export async function deletePrefix(prefix: string): Promise<number> {
  const client = getR2Client();
  const keys = await listKeys(prefix);
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
  return keys.length;
}
