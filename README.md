# ITAM Apontamento Industrial

Sistema web industrial de apontamento individual de produção.

## Stack

- React + Vite + TypeScript
- Appwrite Cloud
- XLSX para importação Excel

## Como rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

No Windows, se não tiver `cp`, crie manualmente um arquivo chamado `.env` na raiz do projeto e copie o conteúdo de `.env.example`.

## Configuração obrigatória do Appwrite

O erro mais comum é usar o **nome exibido** do banco no lugar do **Database ID real**.

No Appwrite, faça assim:

1. Acesse o projeto `ITAM Apontamento`.
2. Vá em **Databases**.
3. Abra o banco criado.
4. Vá em **Settings**.
5. Copie exatamente o campo **Database ID**.
6. Cole no `.env`:

```env
VITE_APPWRITE_DATABASE_ID=SEU_DATABASE_ID_REAL
```

Depois faça o mesmo para as collections se os IDs reais forem diferentes dos nomes:

```env
VITE_APPWRITE_COLLECTION_FUNCIONARIOS_ID=funcionarios
VITE_APPWRITE_COLLECTION_MAQUINAS_ID=maquinas
VITE_APPWRITE_COLLECTION_OPS_ID=ops
VITE_APPWRITE_COLLECTION_APONTAMENTOS_ID=apontamentos
```

Se o Appwrite criou IDs automáticos, substitua os valores acima pelos IDs reais em **Collection > Settings > Collection ID**.

## Permissões para teste sem login

Como o login ainda não foi implementado, para testar localmente as collections precisam permitir operações do client.

Durante o MVP, habilite permissões compatíveis com teste nas collections:

- Read
- Create
- Update

Depois, quando implementar login, essas permissões devem ser substituídas por regras seguras.

## Abas esperadas no Excel

O arquivo Excel precisa conter as abas:

- `funcionarios`
- `maquinas`
- `ops`

## Colunas esperadas

### funcionarios

- matricula
- nome
- setor
- data_admissao
- turno
- ativo

### maquinas

- codigo_maquina
- setor
- ativa

### ops

- op
- potencia
- linha
- desenho
- produto
- qtd_produzir
- ativa

## Regra de sincronização

- Está no Excel e não está no sistema: cria
- Está no Excel e já está no sistema: atualiza
- Está no sistema e não está no Excel: inativa

O sistema não apaga histórico e não apaga apontamentos.
