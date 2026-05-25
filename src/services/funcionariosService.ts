import { COLLECTIONS } from '@/lib/appwrite';
import type { Funcionario } from '@/types';
import { findOneByField, listAllDocuments } from './appwriteCrud';

export const buscarFuncionarioPorMatricula = async (matricula: string): Promise<Funcionario | null> => {
  const chave = matricula.trim().toUpperCase();
  if (!chave) return null;
  return findOneByField<Funcionario>(COLLECTIONS.funcionarios, 'matricula', chave);
};

export const listarFuncionarios = async (): Promise<Funcionario[]> => {
  return listAllDocuments<Funcionario>(COLLECTIONS.funcionarios);
};
