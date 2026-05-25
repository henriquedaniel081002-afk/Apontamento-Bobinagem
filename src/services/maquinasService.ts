import { COLLECTIONS } from '@/lib/appwrite';
import type { Maquina } from '@/types';
import { findOneByField, listAllDocuments } from './appwriteCrud';

export const listarMaquinas = async (): Promise<Maquina[]> => {
  const maquinas = await listAllDocuments<Maquina>(COLLECTIONS.maquinas);
  return maquinas.sort((a, b) => a.codigo_maquina.localeCompare(b.codigo_maquina));
};

export const buscarMaquinaPorCodigo = async (codigo_maquina: string): Promise<Maquina | null> => {
  const chave = codigo_maquina.trim().toUpperCase();
  if (!chave) return null;
  return findOneByField<Maquina>(COLLECTIONS.maquinas, 'codigo_maquina', chave);
};
