# Career Pilot — Profile Reader & Knowledge Retrieval SDD

## 1. Objetivo

Implementar no repositório:

```text
git@github.com:silvars/career-pilot.git
```

a primeira camada responsável por:

1. selecionar um profile;
2. carregar os arquivos Markdown do profile;
3. interpretar sua estrutura;
4. criar uma representação de documentos em memória;
5. indexar o conteúdo;
6. permitir recuperar os documentos mais relevantes para uma pergunta;
7. disponibilizar esse contexto para as próximas camadas do Career Pilot.

A fonte dos dados será o repositório:

```text
git@github.com:silvars/career-pilot-profile.git
```

Profile inicial:

```text
profiles/rodrigo-matos/
```

---

# 2. Princípios

A implementação deve ser:

- local-first;
- sem backend próprio;
- sem banco de dados;
- sem persistência de dados do candidato;
- sem vector database na V1;
- independente de um candidato específico;
- preparada para múltiplos profiles;
- preparada para embeddings futuramente.

Os dados carregados devem permanecer apenas em memória durante a execução da aplicação.

## 2.1 Runtime

Esta camada roda dentro da extensão Chrome do Career Pilot (ex.: service worker /
background script). Não há chamada de rede ao GitHub em tempo de execução — ver
seção 6 (Profile Source & Vendoring). Isso elimina preocupações de CORS, rate
limit de API e necessidade de autenticação em runtime.

---

# 3. Arquitetura

```text
Profile Source
      |
      v
Profile Loader
      |
      v
Markdown Parser
      |
      v
Document Model
      |
      v
In-Memory Index
      |
      v
Retriever
      |
      v
Relevant Documents
      |
      v
Career Context
```

Responsabilidades:

- **Profile Loader:** localizar e carregar os arquivos do profile.
- **Markdown Parser:** transformar Markdown em documentos estruturados.
- **Document Model:** representar cada unidade de conhecimento.
- **In-Memory Index:** manter os documentos indexados durante a sessão.
- **Retriever:** receber uma consulta e retornar documentos relevantes.
- **Career Context:** combinar documentos recuperados para uso posterior.

---

# 4. Profile Source

O Career Pilot não deve assumir que o profile é Rodrigo.

O profile deve ser configurável.

Exemplo:

```text
profileId = rodrigo-matos
```

A fonte padrão da V1 será:

```text
career-pilot-profile
```

Essa fonte é vendorizada (copiada) para dentro do `career-pilot` em build time —
não é buscada pela rede em runtime. Ver seção 6.

com:

```text
profiles/rodrigo-matos/
```

A implementação deve permitir futuramente:

```text
profiles/
├── rodrigo-matos/
├── profile-2/
└── profile-3/
```

---

# 5. Profile Manifest

Criar um manifesto para cada profile:

```text
profiles/rodrigo-matos/profile.json
```

Exemplo:

```json
{
  "id": "rodrigo-matos",
  "name": "Rodrigo Matos Silva",
  "version": "1.0.0",
  "documents": [
    {
      "path": "identity/personal.md",
      "type": "identity"
    },
    {
      "path": "identity/professional-summary.md",
      "type": "identity"
    },
    {
      "path": "experience/career-history.md",
      "type": "experience"
    },
    {
      "path": "skills/technical.md",
      "type": "skills"
    },
    {
      "path": "projects/personal/geoalert.md",
      "type": "project"
    }
  ]
}
```

O manifesto é a fonte oficial de quais documentos fazem parte do profile.

`type` deve corresponder à pasta raiz do documento dentro de
`profiles/<profileId>/` (`identity`, `experience`, `skills`, `projects`,
`achievements`, `stories`, `sources`). Não inventar categorias novas.

O manifesto da V1 deve listar os 31 documentos reais hoje existentes em
`profiles/rodrigo-matos/` (não apenas os 5 do exemplo acima).

Não fazer crawling arbitrário do GitHub na V1.

---

# 6. Profile Synchronization

The profile repository is an external source of knowledge.

The Career Pilot must use a local vendored copy of the selected profile at
runtime.

## 6.1 Repository layout

```text
career-pilot/
├── src/
├── scripts/
│   └── sync-profile.ts
└── vendor/
    └── profiles/
        └── rodrigo-matos/
```

- `scripts/sync-profile.ts` — the synchronization script (see below);
- `vendor/profiles/<profileId>/` — the local vendored copy of a profile,
  committed to the `career-pilot` repository. This is the only directory the
  `Profile Loader` (section 7) reads from at runtime.

Profile updates are explicit and manual.

Create:

```text
scripts/sync-profile.ts
```

The synchronization process must:

1. identify the configured profile repository;
2. retrieve the configured profile version;
3. copy the selected profile into the local vendored profile directory;
4. preserve the profile structure;
5. fail explicitly if the requested version cannot be retrieved.

The synchronization MUST NOT run automatically when the application starts.

The synced profile becomes the local source used by the application.

The developer/user is responsible for:

```text
sync
  ↓
review changes
  ↓
commit
```

The exact Git mechanism (`git archive`, `git show`, GitHub API or equivalent)
may be selected during implementation, provided that the result is a
deterministic local copy.

The sync implementation must support pinning a specific commit, tag or
version. Do not implicitly consume the latest repository state.

Runtime access to the vendored copy (e.g. via `chrome.runtime.getURL(...)` +
`fetch(...)` inside the extension) is covered in section 7 (Profile Loader).
Do not implement GitHub authentication. Do not store a GitHub token. Do not
fetch the profile from `github.com`/`raw.githubusercontent.com` at runtime
in V1.

---

# 7. Profile Loader

Criar:

```typescript
interface ProfileLoader {
  loadProfile(profileId: string): Promise<Profile>;
}
```

Responsabilidades:

1. carregar `profile.json` a partir dos arquivos vendorizados localmente (seção 6);
2. validar o manifesto;
3. carregar os documentos declarados;
4. transformar cada documento em `ProfileDocument`;
5. retornar o profile completo em memória.

Erros:

```text
PROFILE_NOT_FOUND
MANIFEST_NOT_FOUND
MANIFEST_INVALID
DOCUMENT_NOT_FOUND
DOCUMENT_LOAD_ERROR
```

Não ignorar silenciosamente documentos inválidos.

---

# 8. Profile Model

```typescript
interface Profile {
  id: string;
  name: string;
  version: string;
  documents: ProfileDocument[];
}
```

---

# 9. Document Model

```typescript
interface ProfileDocument {
  id: string;
  profileId: string;
  path: string;
  type: string;
  title?: string;
  content: string;
  sections: DocumentSection[];
  tags: string[];
}
```

Se metadata adicional estiver disponível no Markdown, preservá-la.

---

# 10. Markdown Parsing

O parser deve:

1. identificar título;
2. identificar headings;
3. identificar seções;
4. preservar conteúdo;
5. identificar metadata quando existir;
6. identificar tags quando existirem.

Exemplo:

```markdown
# Java

## Experience

More than 20 years working with Java.

## Context

Backend, architecture and distributed systems.
```

Deve resultar conceitualmente em:

```text
Document
  title: Java

  Section
    title: Experience
    content: ...

  Section
    title: Context
    content: ...
```

---

# 11. Semantic Documents

O retrieval não deve tratar um arquivo Markdown inteiro como uma única unidade quando ele possuir múltiplas seções independentes.

Preferir unidades como:

```text
organization
responsibilities
leadership
technology
impact
```

O objetivo é permitir retrieval mais preciso.

---

# 12. In-Memory Index

Criar um índice somente em memória.

```typescript
interface ProfileIndex {
  documents: ProfileDocument[];
  chunks: ProfileChunk[];
}
```

Não persistir:

- índice;
- embeddings;
- perguntas;
- respostas;
- dados da candidatura;
- histórico.

---

# 13. Chunks

Criar chunks semanticamente relevantes.

Exemplos:

```text
Java experience
Engineering management
Team leadership
Cloud experience
Legacy modernization
GeoAlert project
Cost reduction
Leadership story
```

Não dividir simplesmente por tamanho fixo.

Preferir:

```text
Heading
Section
Subsection
```

como limites naturais.

---

# 14. Chunk Model

```typescript
interface ProfileChunk {
  id: string;
  profileId: string;
  documentId: string;
  type: string;
  title?: string;
  content: string;
  path: string;
  tags: string[];
}
```

---

# 15. Retrieval

Criar:

```typescript
interface ProfileRetriever {
  search(
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;
}
```

Exemplo:

```typescript
interface RetrievalResult {
  chunk: ProfileChunk;
  score: number;
}
```

---

# 16. V1 Retrieval

Não utilizar vector database.

Não utilizar embeddings externos.

A V1 deve implementar retrieval local em memória.

O algoritmo pode combinar:

- token matching;
- normalized text matching;
- title matching;
- section matching;
- tag matching;
- basic relevance scoring.

A implementação deve ser simples e substituível.

---

# 17. Retrieval Abstraction

O restante da aplicação NÃO deve depender do algoritmo utilizado.

```text
ProfileRetriever
      |
      +-- KeywordRetriever
      |
      +-- SemanticRetriever (future)
      |
      +-- EmbeddingRetriever (future)
```

A implementação atual será:

```text
KeywordRetriever
```

---

# 18. Retrieval Examples

Query:

```text
How many people have you managed?
```

Deve encontrar conteúdo relacionado a:

```text
team
people
leadership
management
engineering management
organization
```

Query:

```text
Tell me about your experience with Java and distributed systems.
```

Deve recuperar conteúdo relacionado a:

```text
Java
backend
distributed systems
architecture
high availability
```

O retrieval deve trabalhar com termos relacionados sempre que possível,
não apenas igualdade exata.

---

# 19. Top K

Permitir limitar resultados:

```typescript
{
  topK: 5
}
```

Default:

```text
topK = 5
```

Não retornar todo o profile para cada pergunta.

---

# 20. Minimum Score

O retriever deve possuir um threshold mínimo.

Resultados abaixo do threshold devem ser descartados.

Se nenhum resultado atingir o threshold:

```text
NO_RELEVANT_CONTEXT
```

---

# 21. Career Context

Criar:

```typescript
interface CareerContextBuilder {
  build(
    query: string,
    results: RetrievalResult[]
  ): CareerContext;
}
```

Resultado conceitual:

```text
Career Context

Candidate:
Rodrigo Matos Silva

Relevant information:

1. Engineering management
   ...

2. Team leadership
   ...

3. Grupo Casas Bahia
   ...

Sources:
   ...
```

---

# 22. Source Traceability

Todo contexto recuperado deve preservar:

```text
profileId
documentId
path
chunkId
```

Assim será possível posteriormente informar a origem da informação.

---

# 23. No Hallucination

O retrieval não deve criar informações.

O retriever somente retorna conteúdo existente no profile.

Se não existir informação relevante:

```text
NO_RELEVANT_CONTEXT
```

Não substituir ausência de contexto por conhecimento inventado.

---

# 24. Profile Reload

Permitir recarregar o profile:

```typescript
await profileManager.reload("rodrigo-matos");
```

`reload()` only reloads the already synchronized local (vendored) profile.

It MUST NOT:

- execute the profile synchronization (section 6);
- access GitHub;
- download the profile;
- update the vendored files;
- change the selected profile version.

The flow is:

```text
Profile update:

career-pilot-profile
        ↓
manual sync (scripts/sync-profile.ts)
        ↓
local vendored profile
        ↓
review
        ↓
commit
        ↓
Career Pilot reload
```

`reload()` must:

1. descartar o índice atual;
2. ler o profile vendorizado local;
3. reconstruir o parsing do Markdown;
4. reconstruir os chunks;
5. reconstruir o índice.

Profile synchronization and profile reload are separate operations.

---

# 25. Cache

Não criar cache persistente na V1.

É permitido cachear documentos somente em memória durante a sessão.

Esta regra é sobre runtime: depois que o `Profile Loader` lê os arquivos
vendorizados (seção 6) e monta o `Profile`/`ProfileIndex` em memória, nenhuma
cópia adicional desses dados deve ser escrita em runtime para:

- localStorage;
- IndexedDB;
- filesystem (fora do bundle vendorizado da extensão);
- cookies;
- backend;
- database.

Os arquivos em `vendor/profiles/` não são "cache" — são o artefato estático
empacotado com a extensão (seção 6), não escrito em runtime.

---

# 26. Multiple Profiles

Permitir:

```typescript
loadProfile("rodrigo-matos")
```

e futuramente:

```typescript
loadProfile("another-profile")
```

Somente um profile deve ser utilizado para uma determinada sessão de
candidatura.

Não misturar informações de profiles diferentes.

---

# 27. Profile Manager

Criar:

```typescript
interface ProfileManager {
  load(profileId: string): Promise<Profile>;
  getActiveProfile(): Profile | null;
  reload(profileId: string): Promise<Profile>;
  clear(): void;
}
```

`clear()` deve remover os dados carregados da memória.

---

# 28. Error Handling

Erros devem ser explícitos:

```text
PROFILE_NOT_FOUND
MANIFEST_NOT_FOUND
MANIFEST_INVALID
DOCUMENT_NOT_FOUND
DOCUMENT_LOAD_ERROR
MARKDOWN_INVALID
NO_RELEVANT_CONTEXT
```

Não esconder erros de carregamento.

---

# 29. Tests

Criar testes para:

### Profile Loader

- carregar profile válido;
- profile inexistente;
- manifesto inexistente;
- manifesto inválido;
- documento inexistente.

### Markdown Parser

- título;
- headings;
- sections;
- metadata;
- conteúdo vazio.

### Chunking

- criação de chunks;
- preservação de contexto;
- identificação de headings.

### Retriever

Testar queries:

```text
Java
AWS
engineering management
people management
distributed systems
leadership
GeoAlert
legacy modernization
```

Verificar se os documentos esperados aparecem no Top K.

### Profile Isolation

Garantir que uma consulta para um profile não retorne dados de outro.

---

# 30. Não implementar ainda

Nesta SDD NÃO implementar:

- LLM;
- geração de respostas;
- OpenAI API;
- Gemini API;
- embeddings;
- vector database;
- RAG externo;
- backend;
- autenticação;
- submissão automática;
- browser automation;
- scraping de vagas.

Esta etapa implementa somente:

```text
PROFILE
  ↓
LOAD
  ↓
PARSE
  ↓
CHUNK
  ↓
INDEX
  ↓
RETRIEVE
  ↓
CONTEXT
```

---

# 31. Definition of Done

A implementação estará concluída quando for possível executar:

```typescript
const profile =
  await profileManager.load("rodrigo-matos");

const results =
  await retriever.search(
    "How many people have you managed?",
    { topK: 5 }
  );

const context =
  contextBuilder.build(
    "How many people have you managed?",
    results
  );
```

e obter somente informações existentes no:

```text
career-pilot-profile
└── profiles/
    └── rodrigo-matos/
```

com rastreabilidade até o arquivo de origem.

A implementação deve ser simples, modular e preparada para substituir o
retriever local por um retriever semântico/embeddings no futuro.
