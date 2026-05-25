import { databases, ID, Query, DATABASE_ID, getAppwriteErrorMessage, isAppwriteConfigured } from '@/lib/appwrite';

const DEFAULT_BATCH_SIZE = 100;
const WRITE_DELAY_MS = 1200;
const RATE_LIMIT_DELAY_MS = 6000;
const MAX_RETRIES = 4;

function assertConfigured() {
  if (!isAppwriteConfigured()) {
    throw new Error('Appwrite não configurado: preencha VITE_APPWRITE_DATABASE_ID no arquivo .env e reinicie o servidor.');
  }
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getStatusCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = Number((error as { code?: unknown }).code);
    return Number.isFinite(code) ? code : null;
  }
  return null;
}

function isRateLimitError(error: unknown) {
  return getStatusCode(error) === 429;
}

async function withRetry<T>(operation: () => Promise<T>, actionLabel: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
        throw new Error(getAppwriteErrorMessage(error));
      }

      const delay = RATE_LIMIT_DELAY_MS * attempt;
      console.warn(`${actionLabel}: limite do Appwrite atingido. Nova tentativa em ${Math.round(delay / 1000)}s...`);
      await wait(delay);
    }
  }

  throw new Error(getAppwriteErrorMessage(lastError));
}

export async function listAllDocuments<T>(collectionId: string, batchSize = DEFAULT_BATCH_SIZE): Promise<T[]> {
  assertConfigured();
  const docs: T[] = [];
  let offset = 0;

  try {
    while (true) {
      const response = await withRetry(
        () => databases.listDocuments(DATABASE_ID, collectionId, [
          Query.limit(batchSize),
          Query.offset(offset),
        ]),
        `Listagem da collection ${collectionId}`,
      );

      docs.push(...(response.documents as unknown as T[]));

      if (response.documents.length < batchSize) break;
      offset += batchSize;
      await wait(250);
    }

    return docs;
  } catch (error) {
    throw new Error(getAppwriteErrorMessage(error));
  }
}

export async function findOneByField<T>(collectionId: string, field: string, value: string): Promise<T | null> {
  assertConfigured();
  try {
    const response = await withRetry(
      () => databases.listDocuments(DATABASE_ID, collectionId, [
        Query.equal(field, value),
        Query.limit(1),
      ]),
      `Busca na collection ${collectionId}`,
    );

    return response.documents[0] ? (response.documents[0] as unknown as T) : null;
  } catch (error) {
    throw new Error(getAppwriteErrorMessage(error));
  }
}

export async function createDocument<T>(collectionId: string, payload: Record<string, unknown>): Promise<T> {
  assertConfigured();
  await wait(WRITE_DELAY_MS);

  try {
    const response = await withRetry(
      () => databases.createDocument(DATABASE_ID, collectionId, ID.unique(), payload),
      `Criação na collection ${collectionId}`,
    );
    return response as unknown as T;
  } catch (error) {
    throw new Error(getAppwriteErrorMessage(error));
  }
}

export async function updateDocument<T>(collectionId: string, documentId: string, payload: Record<string, unknown>): Promise<T> {
  assertConfigured();
  await wait(WRITE_DELAY_MS);

  try {
    const response = await withRetry(
      () => databases.updateDocument(DATABASE_ID, collectionId, documentId, payload),
      `Atualização na collection ${collectionId}`,
    );
    return response as unknown as T;
  } catch (error) {
    throw new Error(getAppwriteErrorMessage(error));
  }
}

export async function deleteDocument(collectionId: string, documentId: string): Promise<void> {
  assertConfigured();
  await wait(WRITE_DELAY_MS);

  try {
    await withRetry(
      () => databases.deleteDocument(DATABASE_ID, collectionId, documentId),
      `Exclusão na collection ${collectionId}`,
    );
  } catch (error) {
    throw new Error(getAppwriteErrorMessage(error));
  }
}
