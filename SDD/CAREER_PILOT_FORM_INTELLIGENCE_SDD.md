# CAREER PILOT — FASE 5

# FORM INTELLIGENCE
**Status:** DONE — 4 fatias concluídas, validado em formulário real (Greenhouse)
**Phase:** 5
**Previous Phase:** FASE 4.1 — Local Semantic Retrieval
**Next Phase:** FASE 6 — Autofill (NÃO iniciada — ver seção "STOP" ao final)
**Objective:** Transformar a página de candidatura em uma estrutura semântica de formulário (campos → tipo semântico → evidência do Profile → resposta sugerida), sem nunca preencher o DOM, selecionar opções ou submeter.

---

## 1. Escopo entregue, por fatia

### Fatia 1 — Form Field Extraction
- `src/form-intelligence/types/formField.ts` — `FormField`, `FormElementType`, `FieldSource`, `FormOption`.
- `src/form-intelligence/extraction/rawFormElement.ts` + `formFieldBuilder.ts` — transformação pura (sem DOM) de uma snapshot bruta em `FormField[]`, com cascata de prioridade de label (LABEL > ARIA_LABELLEDBY > ARIA_LABEL > PLACEHOLDER > NAME > ID > NONE).
- `src/form-intelligence/normalization/textNormalizer.ts` — normalização de texto + humanização de identificadores (`currentJobTitle` → "Current Job Title").
- `src/extension/content/formExtractor.ts` — `collectRawFormMaterials()`, camada fina de DOM (label `for`/wrapping, `aria-labelledby`, grupos de radio via `fieldset/legend`, combobox via `role`/`datalist`).
- Agrupamento de radio por `name` em um único `FormField` com `options`; checkbox mantido avulso (decisão: consolidar múltiplos checkboxes em uma pergunta é problema de classificação, não de extração).

### Fatia 2 — Semantic Field Classification
- `src/form-intelligence/types/fieldIntent.ts` — `SemanticFieldType` (21 valores), `AnswerStrategy`, `FieldIntent`.
- `src/form-intelligence/classification/semanticFieldDictionary.ts` + `fieldClassifier.ts` — classificação determinística por keyword/regex (EN + PT-BR), ordenada por especificidade, sem LLM. Reaproveita `extractSkills`/`SKILL_VOCABULARY` de `job-match/skillVocabulary.ts` para `SKILL_EXPERIENCE`.
- Fallback: `CUSTOM_QUESTION` (pergunta reconhecível, tipo não identificado) vs `UNKNOWN` (nenhum sinal).

### Fatia 3 — Answer Generation + Hybrid Retrieval
- `src/form-intelligence/types/fieldAnswer.ts`, `formIntelligenceResult.ts` — `FieldAnswer`, `RetrievalEvidence`, `FormIntelligenceResult`, `FormSummary`.
- `src/form-intelligence/answer/canonicalProfileExtractors.ts` — extração determinística (regex) de fatos canônicos já existentes no Profile (email, LinkedIn, GitHub, portfolio, localização, nome, `current_title`, "N+ years" explícito).
- `src/form-intelligence/answer/answerGenerator.ts` — reaproveita **integralmente** `ProfileRetriever`/`HybridRetriever` da FASE 4.1 (zero mecanismo novo de retrieval); `AnswerStrategy` é sempre rebaixável para `USER_REQUIRED`, nunca promovida.
- `src/form-intelligence/formIntelligence.ts` — pipeline completo `buildFormIntelligenceResult()`.

### Fatia 4 — Integration / Messaging / Popup
- Mensagens `EXTRACT_FORM`/`ANALYZE_FORM`/`GET_FORM_INTELLIGENCE` (`messages.ts`, `message-handler.ts`).
- `FormIntelligenceRuntimeState` no `extension-state.ts` (mesmo padrão do `JobMatchRuntimeState`).
- `content-script.ts` responde `EXTRACT_FORM`; `service-worker.ts` orquestra `analyzeForm()` (extração → classificação → `HybridRetriever` → respostas → resultado) e `getFormIntelligence()`.
- Popup: seção "Form Intelligence" somente leitura (`formIntelligenceViewModel.ts` + `popup.html`/`popup.ts`/`popup.css`) — total de campos, entendidos, respondíveis, precisam de input, precisam de revisão, e lista por campo (tipo semântico, resposta, confidence, source, requiresReview).

---

## 2. Safety gate — características protegidas (achado real, não hipotético)

Durante a validação obrigatória em formulário real (Greenhouse, seção EEO/auto-declaração), descobriu-se que perguntas como **"Which gender do you identify as?"** caíam na classificação genérica `CUSTOM_QUESTION` → `PROFILE_RETRIEVAL` e retornavam texto do Profile completamente irrelevante — violação direta da regra "nunca inferir: gênero; raça; religião; outras características pessoais".

**Corrigido em `answerGenerator.ts`**: gate de segurança universal, aplicado **antes** de qualquer estratégia rodar, independente do que a classificação decidiu. Bloqueia por keyword (EN+PT-BR) perguntas sobre:
- gênero (`gender`/`genero`)
- raça (`race`/`raca`)
- etnia (`ethnicity`/`etnia`, incluindo `hispanic`/`latino`)
- deficiência (`disability`/`deficiencia`)
- status de veterano (`veteran`)
- orientação sexual (`sexual orientation`/`orientacao sexual`)
- religião (`religion`/`religiao`)
- gravidez (`pregnan`/`gravidez`)

Esses campos **sempre** retornam `source: "USER_REQUIRED"`, `evidence: []`, independentemente do `SemanticFieldType`/`AnswerStrategy` atribuído pela classificação. Testado explicitamente (`answerGenerator.test.ts`).

---

## 3. Validação real (Greenhouse, vaga pública, sem dados pessoais)

| Métrica | Valor real medido |
|---|---|
| Campos detectados | 31 |
| Campos classificados (≠ UNKNOWN) | 18 |
| Campos com resposta (PROFILE/PROFILE_RETRIEVAL/DERIVED) | 16 |
| USER_REQUIRED | 2 (telefone; pergunta de gênero após o fix) |
| UNKNOWN | 13 |

Confirmado:
- `HybridRetriever` integrado e usado de ponta a ponta (ex.: pergunta sobre experiência em SaaS/backend respondida via retrieval híbrido).
- `USER_REQUIRED` funcionando corretamente (telefone — nunca existe no Profile público; gênero — bloqueado pelo safety gate).
- **Nenhum campo foi alterado**: verificado programaticamente, após toda a análise, que nenhum `input`/`textarea`/`select` da página real tinha qualquer valor preenchido.
- **Nenhum submit/autofill implementado** — a extensão nunca escreve no DOM, nunca seleciona opções, nunca clica, nunca submete.

---

## 4. Testes / Typecheck / Build

```
tests 338/338 PASS
typecheck PASS
build PASS
```

---

## 5. Limitações conhecidas

- **Campos UNKNOWN podem ser inputs-espelho de componentes React/combobox**: bibliotecas de formulário (observado no Greenhouse real) frequentemente renderizam um input oculto sem `label`/`aria-label`/`name`/`id` útil ao lado do componente visível — a extração corretamente não tem sinal algum para esses, e eles ficam `UNKNOWN` por padrão (comportamento seguro, não um bug).
- **`confidence` é determinística, não probabilística**: deriva apenas de qual sinal casou (label/aria/options/placeholder/section/identifier) e de regras fixas — não é uma medida estatística real de certeza, não deve ser interpretada como tal por quem consumir o resultado.
- **O modelo semântico real só roda dentro do runtime da extensão (Offscreen Document)**: testes automatizados e scripts de validação usam embeddings fake (determinísticos) para exercitar o mecanismo do `HybridRetriever`; a qualidade semântica real já foi medida separadamente na FASE 4.1 (Recall@3/Recall@5/MRR reais, via Chrome real) e não foi re-medida aqui.

---

## 6. STOP

FASE 5 está **encerrada**. Por instrução explícita: **não iniciar FASE 6** (Autofill) neste momento. Nenhuma submissão, preenchimento de DOM, seleção de campos ou clique foi implementado — esse é o limite exato desta fase.
