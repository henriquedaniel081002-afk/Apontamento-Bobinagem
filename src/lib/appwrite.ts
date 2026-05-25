import { Client, Databases, Query, ID, AppwriteException } from 'appwrite';

export const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6a0b5873002a0a6dd7ff';

// ATENÇÃO: no Appwrite, Database ID não é necessariamente o nome exibido.
// Use exatamente o ID copiado em Databases > seu banco > Settings > Database ID.
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '6a0b591e0034a52ea213';

// ATENÇÃO: Collection ID também pode ser diferente do nome exibido.
// Se você criou as tabelas com IDs automáticos, preencha estas variáveis no .env.
export const COLLECTIONS = {
  funcionarios: import.meta.env.VITE_APPWRITE_COLLECTION_FUNCIONARIOS_ID || 'funcionarios',
  maquinas: import.meta.env.VITE_APPWRITE_COLLECTION_MAQUINAS_ID || 'maquinas',
  ops: import.meta.env.VITE_APPWRITE_COLLECTION_OPS_ID || 'ops',
  apontamentos: import.meta.env.VITE_APPWRITE_COLLECTION_APONTAMENTOS_ID || 'apontamentos',
};

export const appwriteConfig = {
  endpoint: APPWRITE_ENDPOINT,
  projectId: APPWRITE_PROJECT_ID,
  databaseId: DATABASE_ID,
  collections: COLLECTIONS,
};

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const databases = new Databases(client);

export function isAppwriteConfigured() {
  return Boolean(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && DATABASE_ID);
}

export function getAppwriteErrorMessage(error: unknown) {
  if (error instanceof AppwriteException) {
    if (error.code === 404 && String(error.message).toLowerCase().includes('database')) {
      return `Banco de dados não encontrado. Verifique VITE_APPWRITE_DATABASE_ID. Valor atual: "${DATABASE_ID || 'vazio'}".`;
    }
    if (error.code === 404 && String(error.message).toLowerCase().includes('collection')) {
      return 'Collection não encontrada. Verifique os IDs das collections no arquivo .env.';
    }
    if (error.code === 401 || error.code === 403) {
      return 'Sem permissão no Appwrite. Verifique as permissões das collections para teste sem login.';
    }
    return `Erro Appwrite ${error.code}: ${error.message}`;
  }

  if (error instanceof Error) return error.message;
  return 'Erro desconhecido ao comunicar com o Appwrite.';
}

export { client, databases, Query, ID };
