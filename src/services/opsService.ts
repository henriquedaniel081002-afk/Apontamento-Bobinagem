import { COLLECTIONS } from '@/lib/appwrite';
import type { OP } from '@/types';
import { findOneByField, listAllDocuments } from './appwriteCrud';

export const buscarOP = async (op: string): Promise<OP | null> => {
  const chave = op.trim().toUpperCase();
  if (!chave) return null;
  return findOneByField<OP>(COLLECTIONS.ops, 'op', chave);
};

export const listarOps = async (): Promise<OP[]> => {
  return listAllDocuments<OP>(COLLECTIONS.ops);
};
