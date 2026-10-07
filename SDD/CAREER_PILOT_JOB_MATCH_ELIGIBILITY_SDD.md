# Career Pilot — Job Match & Eligibility Analysis SDD

## 1. Objetivo

Adicionar ao Career Pilot uma camada responsável por analisar a aderência entre:

1. a vaga atualmente aberta no navegador;
2. o profile profissional ativo.

A funcionalidade deverá produzir um **Career Match Score**, identificar aderências, gaps, requisitos obrigatórios não comprovados e possíveis critérios de elegibilidade.

O objetivo é ajudar o candidato a decidir rapidamente se vale a pena prosseguir com uma candidatura e evitar erros básicos antes do preenchimento do formulário.

Esta feature **não realiza candidatura automática** e **não submete a candidatura**.

Esta SDD é uma especificação futura. A implementação somente deverá ocorrer quando explicitamente solicitada.

---

## 1.1 Fases do CareerPilot (roadmap)

Decisão de sequenciamento (2026-10-06): o Job Match é especificado agora, mas
implementado em duas fatias — lógica pura primeiro, integração com o Chrome
depois — para não transformar o CareerPilot em uma extensão gigante antes da
hora.

```text
FASE 1  Profile Reader                         (concluído)
FASE 2  Job Match — lógica pura                (concluído — 2026-10-06)
FASE 3  Chrome Extension Shell                 (SDD futura, separada)
FASE 4  Job Match + Chrome                     (integra FASE 2 com FASE 3)
FASE 5  Form Intelligence                      (futuro)
FASE 6  Autofill com revisão                   (futuro)
```

Esta SDD (Job Match & Eligibility) cobre apenas a FASE 2: `JobRequirements`,
normalização, `MatchEngine`, score e eligibility — tudo testável com texto de
vaga em fixture, sem depender do navegador. A captura real da página (DOM,
content script, `manifest.json`, popup) é escopo de uma SDD futura de
"Extension Shell / Chrome Integration" (FASE 3), não desta.

---

## 2. Contexto arquitetural

O Career Pilot possui uma camada de Profile Reader & Knowledge Retrieval responsável por:

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

Essa camada fornece conhecimento estruturado e rastreável sobre o candidato.

O Job Match deverá consumir essa capacidade, evitando criar um segundo mecanismo independente de conhecimento do candidato.

Arquitetura futura:

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
Profile Retriever
      |
      v
Career Context
      |
      +-----------------------+
                              |
Job Page                     |
   |                          |
   v                          |
Job Description Extractor     |
   |                          |
   v                          |
Job Requirements -------------+
          |
          v
     Match Engine
          |
          v
     Match Result
          |
          +--> Career Match Score
          +--> Matched Requirements
          +--> Gaps
          +--> Eligibility Warnings
          +--> Recommendation
          +--> Evidence
```

---

## 3. Princípios

A implementação deverá seguir:

- local-first;
- sem backend próprio;
- sem banco de dados;
- sem persistência de dados da vaga;
- sem persistência do resultado do match;
- sem candidatura automática;
- sem submissão automática;
- explicável;
- rastreável;
- baseada no profile ativo;
- independente de uma plataforma específica de recrutamento;
- preparada para evolução semântica futura;
- simples na V1.

O Match Engine deverá utilizar o `ProfileRetriever` existente sempre que possível.

Não criar um segundo mecanismo independente de RAG ou conhecimento do candidato.

---

## 4. Runtime

A análise deverá ocorrer localmente dentro da extensão Chrome.

```text
Current Job Page
      |
      v
Extract Job Content
      |
      v
Normalize Requirements
      |
      v
Query Active Profile
      |
      v
Evaluate Match
      |
      v
Display Result
```

Os dados utilizados durante a análise deverão permanecer somente em memória.

Não escrever em:

- localStorage;
- IndexedDB;
- cookies;
- backend;
- banco de dados;
- filesystem de runtime.

---

## 5. Escopo da feature

A feature deverá responder:

1. Essa vaga parece aderente ao profile?
2. O nível/cargo é compatível?
3. Quais skills da vaga aparecem no profile?
4. Quais requisitos obrigatórios não possuem evidência?
5. Quais requisitos são parcialmente atendidos?
6. Quais informações são incertas?
7. Existem critérios de elegibilidade que merecem atenção?
8. Por que o score foi calculado dessa forma?

A feature não deverá decidir automaticamente se o usuário deve ou não se candidatar.

A decisão continua sendo do usuário.

---

## 6. Job Description Extraction

Criar uma abstração:

```typescript
interface JobAnalyzer {
  analyze(page: JobPage): Promise<JobRequirements>;
}
```

A implementação deverá ser desacoplada da plataforma de recrutamento.

Futuramente poderão existir adapters para:

```text
LinkedIn
Greenhouse
Lever
Workday
Indeed
outros
```

A V1 não deverá implementar crawling genérico de toda a web.

A origem inicial deverá ser a página de vaga atualmente aberta no navegador —
mas **a captura dessa página não é responsabilidade desta SDD** (ver seção
6.1). O `JobAnalyzer` recebe um `JobPage` já pronto; de onde esse `JobPage`
vem é definido por uma abstração separada.

### 6.1 JobPageSource — fronteira explícita com o Chrome

```typescript
interface JobPageSource {
  getCurrentJobPage(): Promise<JobPage>;
}
```

Implementações:

```text
FixtureJobPageSource   — V1 desta SDD: devolve um JobPage a partir de texto
                         fixo, usado em testes e no desenvolvimento da lógica
                         de match.

ChromeJobPageSource    — feature futura ("Extension Shell / Chrome
                         Integration", FASE 3 do roadmap, seção 1.1). Lê a
                         aba atual via content script. Fora de escopo aqui.
```

Esta SDD implementa e testa `JobAnalyzer`, `JobRequirements`, normalização,
`MatchEngine`, score e eligibility usando `FixtureJobPageSource`. A troca para
`ChromeJobPageSource`, quando implementada, não deve exigir mudanças nessas
camadas — só a implementação da fonte.

---

## 7. Job Page Model

```typescript
interface JobPage {
  url?: string;
  title?: string;
  text: string;
  platform?: string;
}
```

Não persistir o conteúdo. `text` é fornecido por uma implementação de
`JobPageSource` (seção 6.1) — nesta SDD, sempre `FixtureJobPageSource`.

---

## 8. Job Requirements Model

```typescript
interface JobRequirements {
  title?: string;
  seniority?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperience: string[];
  responsibilities: string[];
  languages: string[];
  location?: string;
  workModel?: string;
  eligibilityRequirements: EligibilityRequirement[];
}
```

---

## 9. Requirement Types

Classificar, quando possível:

```text
TITLE
SENIORITY
REQUIRED_SKILL
PREFERRED_SKILL
REQUIRED_EXPERIENCE
RESPONSIBILITY
LANGUAGE
LOCATION
WORK_MODEL
ELIGIBILITY
```

---

## 10. Requirement Status

Cada requisito deverá possuir:

```text
MATCHED
PARTIAL
MISSING
UNCLEAR
```

`MATCHED`: evidência suficiente no profile.

`PARTIAL`: evidência relacionada, mas não suficiente para aderência completa.

`MISSING`: não foi encontrada evidência relevante no profile.

`UNCLEAR`: não existe informação suficiente para concluir.

**Ausência de evidência não deve ser automaticamente interpretada como ausência de conhecimento.**

---

## 11. Match Requirement Model

```typescript
interface MatchRequirement {
  requirement: string;
  type: RequirementType;
  status: MatchStatus;
  score: number;
  evidence: MatchEvidence[];
}
```

---

## 12. Profile Integration

O Match Engine deverá consumir o profile ativo.

```typescript
const profile =
  profileManager.getActiveProfile();

const match =
  await matchEngine.evaluate(
    jobRequirements,
    profile
  );
```

Quando necessário, deverá utilizar:

```typescript
profileRetriever.search(...)
```

Exemplo:

```text
Job requirement:
"Experience managing engineering teams"

        ↓

ProfileRetriever

        ↓

Relevant profile chunks

        ↓

Match evidence
```

---

## 13. Evidence

Toda conclusão de aderência deverá, quando possível, possuir evidência rastreável.

Reutilizar:

```text
profileId
documentId
path
chunkId
```

Modelo:

```typescript
interface MatchEvidence {
  profileId: string;
  documentId: string;
  path: string;
  chunkId: string;
  excerpt?: string;
}
```

A evidência deve apontar para informação realmente existente no profile.

---

## 14. No Hallucination

O Match Engine não poderá criar experiência, skill ou conhecimento que não exista no profile.

Exemplo:

Vaga:

```text
Terraform required
```

Profile sem evidência:

```text
Terraform
```

Resultado:

```text
MISSING
```

Não:

```text
MATCHED
```

Se houver informação insuficiente:

```text
UNCLEAR
```

---

## 15. Match Criteria

### 15.1 Cargo e senioridade

Comparar:

- título da vaga;
- senioridade;
- nível de liderança;
- natureza da posição.

Exemplos:

```text
Engineering Manager
Senior Engineering Manager
Tech Lead
Staff Engineer
Principal Engineer
Director of Engineering
Software Engineering Manager
```

### 15.2 Technical Skills

Exemplos:

```text
Java
Spring Boot
AWS
GCP
Kubernetes
Kafka
React
Python
Distributed Systems
APIs
Microservices
```

### 15.3 Experience

Exemplos:

```text
engineering leadership
people management
architecture
e-commerce
payments
marketplace
financial services
cloud
modernization
distributed systems
```

### 15.4 Responsibilities

Exemplos:

```text
Lead engineering teams
Drive architecture decisions
Manage managers
Own technical strategy
Improve engineering productivity
```

### 15.5 Language

Detectar:

```text
English required
Fluent English
Business English
Portuguese required
```

Sem evidência suficiente no profile:

```text
UNCLEAR
```

### 15.6 Location / Work Model

Detectar:

```text
Remote
Hybrid
On-site
Brazil
United States
Europe
```

Não assumir elegibilidade geográfica ou autorização de trabalho.

---

## 16. Scoring

Criar:

```text
Career Match Score: 0–100
```

Pesos iniciais sugeridos:

| Critério | Peso |
|---|---:|
| Cargo / Senioridade | 20% |
| Required Skills | 30% |
| Experience | 20% |
| Responsibilities | 15% |
| Language | 10% |
| Location / Work Model | 5% |

Total: 100%.

Os pesos são configuração interna, não uma preferência exposta ao usuário na
V1:

```typescript
interface MatchScoringConfig {
  seniorityWeight: number;
  requiredSkillsWeight: number;
  experienceWeight: number;
  responsibilitiesWeight: number;
  languageWeight: number;
  locationWeight: number;
}

const DEFAULT_MATCH_SCORING: MatchScoringConfig = {
  seniorityWeight: 20,
  requiredSkillsWeight: 30,
  experienceWeight: 20,
  responsibilitiesWeight: 15,
  languageWeight: 10,
  locationWeight: 5,
};
```

`MatchEngine.evaluate(job, profile, scoringConfig?)` aceita um
`MatchScoringConfig` opcional; na ausência, usa `DEFAULT_MATCH_SCORING`. Isso
mantém o cálculo configurável/testável por código sem exigir UI de
preferências na V1.

A V1 não deverá utilizar modelo estatístico complexo.

---

## 17. Required vs Preferred

Requisitos obrigatórios deverão ter prioridade sobre requisitos desejáveis.

Exemplo:

```text
Required:
Java
AWS
8+ years experience
English

Preferred:
Kafka
Kubernetes
GCP
```

Um requisito obrigatório ausente deverá gerar alerta independentemente do score final.

---

## 18. Score Calculation

A implementação deverá calcular aderência por critério e combinar os valores de forma ponderada.

Exemplo:

```text
Seniority:        95
Required Skills:  90
Experience:       95
Responsibilities: 90
Language:         80
Location:        100
```

O cálculo deverá ser:

- determinístico;
- explicável;
- testável;
- configurável;
- sem esconder requisitos obrigatórios.

---

## 19. Recommendation

```text
90–100  STRONG_MATCH
75–89   GOOD_MATCH
60–74   PARTIAL_MATCH
0–59    LOW_MATCH
```

Exemplo:

```text
Career Match: 82%
Recommendation: GOOD_MATCH

Warnings:
- Required skill "Terraform" not found.
- Work authorization could not be verified.
```

---

## 20. Eligibility

Critérios de elegibilidade deverão ser tratados separadamente do Career Match Score.

Exemplos:

```text
Women-only affirmative opportunity
Affirmative opportunity for Black candidates
People with disabilities
Veteran program
Work authorization required
US citizenship required
Security clearance required
```

A feature poderá detectar e apresentar `Eligibility Warning`.

Esses critérios não deverão ser usados para reduzir o Career Match Score com base em características protegidas do candidato.

### 20.1 Eligibility Dictionary (catálogo curado V1)

A detecção usa um dicionário curado e determinístico, não heurísticas livres:

```typescript
const ELIGIBILITY_DICTIONARY: Record<string, string[]> = {
  AFFIRMATIVE_PROGRAM: [
    "affirmative action",
    "affirmative opportunity",
    "women only",
    "women applicants",
    "black candidates",
    "people with disabilities",
  ],
  WORK_AUTHORIZATION: [
    "work authorization",
    "authorized to work",
    "right to work",
  ],
  CITIZENSHIP: [
    "us citizen",
    "u.s. citizen",
    "citizenship required",
  ],
  SECURITY_CLEARANCE: [
    "security clearance",
    "security clearance required",
  ],
};
```

**Detecção de elegibilidade não é decisão de elegibilidade.** Uma frase como
"We welcome women in technology" não deve ser automaticamente tratada como
"Women-only opportunity" com a mesma certeza de uma frase explícita como
"This position is reserved for women candidates". Por isso cada detecção
preserva a frase original e um nível de confiança (ver seção 22) — o usuário
vê o trecho-fonte e decide a interpretação, o sistema não decide por ele.

---

## 21. Protected Characteristics

O Career Match Score mede **aderência profissional**.

Não utilizar como fator de score:

- sexo;
- gênero;
- raça;
- etnia;
- religião;
- deficiência;
- orientação sexual;
- idade;
- ou outras características pessoais protegidas.

Exemplo correto:

```text
Career Match Score: 87%

Eligibility:
⚠ Job description indicates an affirmative opportunity for women.
```

Exemplo incorreto:

```text
Career Match Score: 0%
because candidate does not belong to the target group.
```

O sistema deve informar a existência do critério quando detectado, deixando a decisão para o usuário.

---

## 22. Eligibility Warning Model

```typescript
interface EligibilityWarning {
  type: string;
  description: string;
  source: string;
  detectedPhrase: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
}
```

Tipos possíveis (chaves do `ELIGIBILITY_DICTIONARY`, seção 20.1):

```text
AFFIRMATIVE_PROGRAM
WORK_AUTHORIZATION
CITIZENSHIP
SECURITY_CLEARANCE
OTHER
```

`detectedPhrase` preserva o trecho original da vaga que disparou a detecção;
`confidence` reflete o quão literal/inequívoca foi a correspondência no
dicionário. Nenhum desses campos participa do cálculo do Career Match Score.

---

## 23. Match Result

```typescript
interface MatchResult {
  score: number;
  recommendation: MatchRecommendation;

  matchedRequirements: MatchRequirement[];
  partialRequirements: MatchRequirement[];
  missingRequirements: MatchRequirement[];
  unclearRequirements: MatchRequirement[];

  eligibilityWarnings: EligibilityWarning[];

  evidence: MatchEvidence[];

  profileId: string;
}
```

---

## 24. Explainability

A UI futura deverá apresentar algo semelhante a:

```text
CareerPilot Match
-----------------

87% — GOOD MATCH

Cargo
✓ Engineering Manager

Technical Skills
✓ Java
✓ AWS
✓ Kubernetes
✓ Kafka
△ Terraform

Leadership
✓ Engineering teams
✓ People management
✓ Architecture

Language
✓ English

Warnings
⚠ Terraform not found in profile
⚠ Work authorization not verified
```

Não exibir apenas o percentual.

---

## 25. User Decision

O Match Engine não deverá:

- impedir o usuário de se candidatar;
- bloquear o formulário;
- submeter candidatura;
- decidir automaticamente que uma vaga não vale a pena.

Ele deverá fornecer informação para apoiar a decisão.

---

## 26. Platform Independence

Separar:

```text
Job Page Extraction
        |
        v
JobRequirements
        |
        v
Match Engine
```

A lógica de matching não deverá conhecer detalhes específicos de plataformas.

---

## 27. Abstractions

```typescript
interface MatchEngine {
  evaluate(
    job: JobRequirements,
    profile: Profile
  ): Promise<MatchResult>;
}
```

Implementação inicial:

```text
RuleBasedMatchEngine
```

Futuras:

```text
SemanticMatchEngine
EmbeddingMatchEngine
LLMEnhancedMatchEngine
```

Não implementar as versões futuras nesta feature.

---

## 28. Retrieval Strategy

A V1 deverá utilizar o retrieval local já existente:

```text
Job Requirement
      |
      v
Normalize requirement
      |
      v
ProfileRetriever.search(...)
      |
      v
Relevant Profile Chunks
      |
      v
Evaluate evidence
```

Não carregar todo o profile para cada requisito.

---

## 29. Requirement Normalization

Implementar normalização simples.

Exemplos:

```text
Java 17+
Java
Java programming
```

podem ser relacionados a:

```text
Java
```

E:

```text
People management
People leadership
Team management
```

podem ser relacionados a:

```text
People / Team Leadership
```

A normalização usa um dicionário curado e determinístico — não ontologia nem
NLP:

```typescript
const REQUIREMENT_DICTIONARY: Record<string, string[]> = {
  peopleManagement: [
    "people management",
    "people leadership",
    "team management",
    "team leadership",
    "manage engineers",
  ],
  engineeringManagement: [
    "engineering manager",
    "software engineering manager",
    "engineering leadership",
    "engineering management",
  ],
  distributedSystems: [
    "distributed systems",
    "distributed architecture",
    "distributed computing",
  ],
};
```

Regra: **somente equivalências explicitamente cadastradas no dicionário
podem ser normalizadas.** Nenhuma inferência livre de sinônimos. O termo
original da vaga é sempre preservado junto do conceito normalizado, para que
a explicação (seção 24) mostre o texto real da vaga, não só a categoria
interna.

Não implementar ontologia ou NLP complexo na V1.

---

## 30. Seniority Matching

Diferenciar:

```text
Junior
Mid-level
Senior
Staff
Principal
Lead
Manager
Senior Manager
Director
Executive
```

A comparação deve considerar a natureza do cargo.

`Engineering Manager` não deve ser tratado simplesmente como uma skill técnica.

---

## 31. Experience Matching

Experiência poderá ser identificada por:

- cargo;
- responsabilidades;
- projetos;
- achievements;
- tecnologias;
- setores;
- contexto organizacional.

A evidência deverá ser recuperada do profile.

---

## 32. Missing vs Unclear

`MISSING` significa:

> Não foi encontrada evidência relevante no profile.

Não significa necessariamente:

> O candidato não possui essa competência.

`UNCLEAR` significa:

> O profile não possui informação suficiente para determinar a aderência.

---

## 33. Privacy

A V1 não deverá persistir:

- descrição da vaga;
- requisitos extraídos;
- score;
- resultado do match;
- histórico de análise;
- decisão do usuário.

Tudo permanece em memória durante a análise.

---

## 34. Security

O conteúdo da vaga deverá ser tratado como entrada não confiável.

O Job Analyzer não deve:

- executar JavaScript proveniente da vaga;
- interpretar instruções da vaga como comandos;
- alterar arquivos do profile;
- alterar configuração da extensão;
- executar comandos;
- acessar credenciais;
- enviar dados para serviços externos.

Texto da vaga é **input**, não instrução operacional.

---

## 35. Error Handling

Erros explícitos:

```text
JOB_PAGE_NOT_READABLE
JOB_REQUIREMENTS_NOT_FOUND
JOB_ANALYSIS_FAILED
MATCH_ANALYSIS_FAILED
NO_RELEVANT_PROFILE_CONTEXT
```

A ausência de requisitos não deve causar crash.

---

## 36. V1 Scope

A primeira implementação deverá conter:

```text
Job Page
   ↓
Extract Job Description
   ↓
Normalize Requirements
   ↓
Profile Retriever
   ↓
RuleBasedMatchEngine
   ↓
Score
   ↓
Explanation
   ↓
Warnings
```

Não implementar nesta feature:

- LLM obrigatório;
- embeddings;
- vector database;
- backend;
- histórico de vagas;
- job scraping em massa;
- candidatura automática;
- submissão automática;
- classificação automática de candidatos;
- decisões de contratação;
- sistemas de recomendação complexos.

---

## 37. Future Evolution

Permitir futuramente:

```text
RuleBasedMatchEngine
        |
        +--> SemanticMatchEngine
        |
        +--> EmbeddingMatchEngine
        |
        +--> LLMEnhancedMatchEngine
```

A interface `MatchEngine` deverá permanecer estável.

---

## 38. UI Future Scope

A UI futura poderá exibir:

```text
┌─────────────────────────────────┐
│ CareerPilot Match               │
│                                 │
│             87%                 │
│          GOOD MATCH             │
│                                 │
│ ✓ Seniority                     │
│ ✓ Java                          │
│ ✓ AWS                           │
│ ✓ Leadership                    │
│ △ Terraform                     │
│                                 │
│ ⚠ Work authorization unclear    │
│                                 │
│ [View details]                  │
└─────────────────────────────────┘
```

Deverá permitir entender:

- score;
- critérios atendidos;
- gaps;
- warnings;
- evidências.

---

## 39. Tests

### Job Requirement Extraction

Testar:

- título;
- senioridade;
- required skills;
- preferred skills;
- experiência;
- idioma;
- localização;
- work model;
- eligibility requirements.

### Requirement Normalization

Testar:

- equivalência simples de skills;
- variações de títulos;
- variações de termos de liderança;
- normalização semântica básica.

### Match Engine

Testar:

- strong match;
- good match;
- partial match;
- low match;
- missing required skill;
- partial skill match;
- unclear requirement;
- seniority mismatch;
- language mismatch;
- location warning.

### Required Requirements

Garantir que requisito obrigatório ausente gere warning.

### Eligibility

Garantir que:

- critérios protegidos não alterem o Career Match Score;
- critérios de elegibilidade sejam apresentados separadamente;
- work authorization seja tratada como requisito/eligibility;
- citizenship seja tratada como eligibility;
- affirmative opportunities não sejam convertidas em score discriminatório.

### Explainability

Garantir que match positivo relevante possua evidência rastreável.

### Profile Isolation

Garantir que somente o profile ativo seja utilizado.

### No Hallucination

Garantir que requisitos sem evidência não sejam classificados como `MATCHED`.

---

## 40. Backlog

Status geral: **FASE 2 (lógica) implementada e testada em 2026-10-06** —
`src/job-match/`, 42 testes novos (74 no total do career-pilot). MATCH-016,
MATCH-017 e MATCH-018 permanecem fora de escopo (ver seção 1.1).

### MATCH-000 — JobPageSource Abstraction — ✅ DONE

Criar a interface `JobPageSource` (seção 6.1) e a implementação
`FixtureJobPageSource` usada por toda a V1 lógica desta SDD.
`ChromeJobPageSource` fica para a SDD futura de Extension Shell (FASE 3).

*Implementado em* `src/job-match/jobPageSource.ts`.

### MATCH-001 — JobRequirements Model — ✅ DONE

Criar modelos de domínio para requisitos de vaga.

*Implementado em* `src/job-match/types.ts`.

### MATCH-002 — Job Page Analyzer — ✅ DONE

Criar abstração de análise da página atual, consumindo um `JobPage` obtido
via `JobPageSource`.

*Implementado em* `src/job-match/jobAnalyzer.ts` (`RuleBasedJobAnalyzer`).

### MATCH-003 — Requirement Extraction — ✅ DONE

Extrair título, senioridade, skills, experiência, responsabilidades, idioma, localização e modelo de trabalho.

*Implementado em* `src/job-match/jobAnalyzer.ts`.

### MATCH-004 — Requirement Normalization — ✅ DONE

Implementar normalização básica a partir do `REQUIREMENT_DICTIONARY` curado
(seção 29): apenas equivalências explicitamente cadastradas, preservando o
termo original da vaga para explainability.

*Implementado em* `src/job-match/requirementDictionary.ts`.

### MATCH-005 — Match Engine Interface — ✅ DONE

Criar a interface `MatchEngine`.

*Implementado em* `src/job-match/matchEngine.ts`.

### MATCH-006 — Rule Based Match Engine — ✅ DONE

Implementar o primeiro motor baseado em regras.

*Implementado em* `src/job-match/matchEngine.ts` (`RuleBasedMatchEngine`).

### MATCH-007 — Profile Retriever Integration — ✅ DONE

Integrar o Match Engine ao `ProfileRetriever`.

*`RuleBasedMatchEngine` reconstrói o índice via `buildIndex`/`KeywordRetriever`
já existentes (FASE 1) — nenhum mecanismo de retrieval novo foi criado.*

### MATCH-008 — Requirement Status — ✅ DONE

Implementar:

```text
MATCHED
PARTIAL
MISSING
UNCLEAR
```

*Thresholds determinísticos sobre o score do retriever existente (`src/job-match/matchEngine.ts`).*

### MATCH-009 — Career Match Score — ✅ DONE

Implementar cálculo ponderado.

*Implementado via `MatchScoringConfig`/`DEFAULT_MATCH_SCORING` (seção 16) e agregação por categoria em `src/job-match/matchEngine.ts`.*

### MATCH-010 — Required Requirement Warnings — ✅ DONE

Implementar alertas para requisitos obrigatórios sem evidência.

*Requisitos `REQUIRED_SKILL`/`REQUIRED_EXPERIENCE` ausentes aparecem em `missingRequirements` independentemente do score final (testado).*

### MATCH-011 — Eligibility Detection — ✅ DONE

Implementar detecção de critérios de elegibilidade a partir do
`ELIGIBILITY_DICTIONARY` curado (seção 20.1), preservando `detectedPhrase` e
`confidence` em cada `EligibilityWarning`. Detecção gera aviso/contexto, nunca
uma decisão de elegibilidade.

*Implementado em* `src/job-match/eligibilityDictionary.ts`.

### MATCH-012 — Protected Criteria Separation — ✅ DONE

Garantir que características protegidas não alterem o score profissional.

*Testado explicitamente: mesmo job com/sem texto de elegibilidade produz o
mesmo score (`tests/job-match/matchEngine.test.ts`).*

### MATCH-013 — Match Evidence — ✅ DONE

Implementar evidências com rastreabilidade ao profile.

*`MatchEvidence` reaproveita `profileId`/`documentId`/`path`/`chunkId` do
Profile Reader (FASE 1); requisitos `MISSING` sempre têm `evidence: []`
(testado — No Hallucination).*

### MATCH-014 — Match Explanation — ✅ DONE (estrutura de dados)

Implementar estrutura para explicar o score.

*O `MatchResult` estruturado (requirement + type + status + score + evidence
por item, mais `eligibilityWarnings` separado) já contém tudo que a UI futura
(MATCH-016) precisa para renderizar a visão da seção 24. Nenhum formatter de
texto/HTML foi criado — isso é responsabilidade da UI, fora de escopo aqui.*

### MATCH-015 — Match Engine Tests — ✅ DONE

Implementar testes unitários e de integração.

*42 testes novos em* `tests/job-match/` *(74 no total do career-pilot, todos
passando). Cobre os casos da seção 39: extração, normalização, status,
scoring, required vs preferred, elegibilidade/características protegidas,
explainability, isolamento de profile e no-hallucination.*

### MATCH-016 — CareerPilot Match UI — ⏳ PLANNED (fora de escopo desta implementação)

Adicionar score, gaps, warnings e evidências.

*Depende do Extension Shell (MATCH-018, FASE 3).*

### MATCH-017 — Platform Adapter — ⏳ PLANNED (fora de escopo desta implementação)

Criar abstração para adapters de plataformas de vagas.

*Não necessário para a V1 — `JobAnalyzer` já é desacoplado de plataforma
(texto puro via `JobPage.text`).*

### MATCH-018 — Extension Shell / Chrome Integration (SDD futura, separada) — ⏳ PLANNED

Não faz parte desta SDD. Cobre `manifest.json`, content script, popup e
`ChromeJobPageSource` (seção 6.1) — pré-requisito apenas para o DoD de
integração com o Chrome (seção 42), não para o DoD lógico (seção 41).

---

## 41. Definition of Done — Lógica (escopo desta SDD) — ✅ ATINGIDO

Usando `FixtureJobPageSource` (seção 6.1) — sem Chrome, sem DOM, sem
extensão — é possível executar (ver `tests/job-match/definitionOfDone.test.ts`):

```typescript
const currentJobPage =
  await jobPageSource.getCurrentJobPage();

const job =
  await jobAnalyzer.analyze(currentJobPage);

const match =
  await matchEngine.evaluate(
    job,
    profileManager.getActiveProfile()
  );
```

e obter:

```json
{
  "score": 87,
  "recommendation": "GOOD_MATCH",
  "matchedRequirements": [],
  "partialRequirements": [],
  "missingRequirements": [],
  "unclearRequirements": [],
  "eligibilityWarnings": [],
  "evidence": [],
  "profileId": "rodrigo-matos"
}
```

O resultado deverá ser:

- explicável;
- determinístico na V1;
- rastreável;
- baseado somente no profile ativo;
- sem informações inventadas;
- sem persistência;
- independente de plataforma;
- separado de critérios de elegibilidade protegidos;
- preparado para evolução semântica.

---

## 42. Definition of Done — Product Behavior (FASE 4, depende da FASE 3)

**Fora do escopo de implementação desta SDD.** Este DoD só é alcançável depois
da SDD futura de Extension Shell / Chrome Integration (seção 1.1, FASE 3) —
é registrado aqui para manter visível o objetivo final do produto.

Para uma vaga real, o usuário deverá conseguir:

1. abrir a vaga no navegador;
2. acionar o CareerPilot;
3. visualizar o score de aderência;
4. entender os principais critérios que geraram o score;
5. visualizar skills atendidas;
6. visualizar gaps;
7. visualizar requisitos obrigatórios sem evidência;
8. visualizar critérios de elegibilidade separadamente;
9. decidir se deseja continuar com a candidatura.

O CareerPilot não deverá submeter a candidatura.

---

## 43. Out of Scope

Explicitamente fora desta SDD:

- busca automática de vagas;
- scraping em massa;
- candidatura automática;
- preenchimento automático;
- envio automático;
- criação de currículo;
- geração automática de cover letter;
- aplicação em massa;
- backend;
- banco de dados;
- analytics de candidaturas;
- tracking de histórico;
- ranking de candidatos;
- decisão de contratação;
- classificação de pessoas com base em características protegidas.

---

## 44. Relação com o Profile Reader SDD

Esta feature depende conceitualmente de:

```text
Profile Loader
Markdown Parser
Document Model
Chunking
In-Memory Index
Profile Retriever
Career Context
```

Não duplicar essas responsabilidades.

Fluxo:

```text
career-pilot-profile
        ↓
Profile Loader
        ↓
Profile Retriever
        ↓
Job Match Engine
```

O Profile Reader é responsável pelo conhecimento do candidato.

O Job Analyzer é responsável pelo conhecimento da vaga.

O Match Engine é responsável pela comparação.

---

## 45. Dependency

Pré-requisito recomendado:

```text
Profile Reader & Knowledge Retrieval
```

deve estar implementado e testado antes da implementação completa do Job Match.
**Status: concluído** (ver `PROFILE_READER_RETRIEVAL_SDD.md`, mesmo diretório).

A feature pode ser especificada e adicionada ao backlog antes disso, mas sua implementação deverá reutilizar as abstrações definitivas do Profile Reader.

A implementação lógica (seção 41) não depende de nenhuma outra feature além do
Profile Reader. Apenas o DoD de produto (seção 42) depende também da SDD
futura de Extension Shell / Chrome Integration (seção 1.1, FASE 3) — essa
dependência não bloqueia o início desta SDD, só o seu DoD de produto.

---

## 46. Status

```text
FASE 2 (lógica): IMPLEMENTED
FASE 3/4 (Chrome): PLANNED
```

A lógica desta SDD (seções 1-41, exceto UI/adapters/Chrome) foi implementada
e testada em 2026-10-06. Ver `src/job-match/` e `tests/job-match/` no
repositório `career-pilot`. MATCH-016 (UI), MATCH-017 (Platform Adapter) e
MATCH-018 (Extension Shell/Chrome) permanecem `PLANNED`, fora de escopo desta
implementação (ver seção 1.1).

Decisões de escopo fechadas em 2026-10-06 (ver seções 1.1, 6.1, 16, 20.1 e
29): separação explícita entre lógica de match (esta SDD) e integração com o
Chrome (SDD futura); normalização e eligibility usam dicionários curados
determinísticos, não NLP; pesos de score são configuração interna, não
preferência de usuário na V1.

### Notas de implementação (achados reais, não hipotéticos)

- Extração de seções (`Requirements:`/`Preferred:`/`Responsibilities:`) tinha
  um bug de vazamento: texto livre após uma lista com marcadores, separado só
  por linha em branco (sem novo cabeçalho), era incorretamente anexado à
  última seção aberta. Corrigido: uma linha em branco seguida de uma linha
  sem marcador de lista encerra a seção corrente.
- A avaliação de idioma "native" checava a presença da palavra em todo o
  chunk recuperado, o que causava contaminação cruzada entre idiomas (ex.:
  "Portuguese — native" fazia "native English" ser erroneamente confirmado).
  Corrigido para exigir que o nome do idioma e "native" apareçam na mesma
  linha do profile.
- Duas frases do `ELIGIBILITY_DICTIONARY` da mesma categoria podiam gerar
  dois avisos redundantes a partir da mesma sentença (ex.: "security
  clearance" + "security clearance required"). Deduplicado por
  categoria+sentença, não por categoria+frase.
- Verificado empiricamente (não só por inspeção de código) que o score é
  idêntico com e sem texto de elegibilidade no mesmo job posting — a
  separação exigida pelas seções 20-21 está testada, não só presumida.

---

## 47. Resumo

```text
                CAREERPILOT
                     |
        +------------+------------+
        |                         |
        v                         v
   Candidate                  Job Page
    Profile                       |
        |                         v
        v                  Job Analyzer
 Profile Reader                  |
        |                         v
        +-----------> Match Engine
                           |
                 +---------+---------+
                 |         |         |
                 v         v         v
               Score     Gaps    Eligibility
                 |
                 v
             Decision
```

Objetivo:

> **Antes de preencher uma vaga, o CareerPilot deve ajudar o usuário a entender rapidamente o quanto aquela vaga combina com seu perfil e quais pontos merecem atenção.**

O score é um apoio à decisão, não uma decisão automática.
