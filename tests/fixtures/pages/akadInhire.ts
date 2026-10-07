import type { RawPageMaterials } from "../../../src/extension/job-extraction/types.js";

/**
 * Verbatim transcription of the real, public akadseguros.inhire.app job
 * posting (re-fetched 2026-10-06 — the page is reachable again). Contains
 * only public job-ad copy — no candidate data. Replaces the earlier,
 * incomplete sanitized version (intro copy only) that was transcribed from a
 * screenshot and was missing the entire Responsabilidades / O que você
 * precisa ter / Você se destacará se tiver sections — that gap was the root
 * cause of a real bug (job analyzed as near-empty, Match Engine returned a
 * false 100/100 "Strong Match" from title/seniority alone — see
 * CAREER_PILOT_JOB_MATCH_CHROME_SDD.md section 40.1).
 * (spec now lives under SDD/).
 *
 * Correction (2026-10-06, manual Chrome validation): an earlier version of
 * this fixture dropped the bullet "Remover objetivos de negócio em metas
 * claras e mensuráveis para o time", assuming it was a text-extraction
 * artifact (it duplicates the preceding bullet with only "Traduzir" swapped
 * for "Remover"). The real Chrome extension, run against the live page,
 * showed this exact bullet as a distinct requirement — confirming it is
 * genuine (if redundant) content really present on the page, not an
 * extraction bug. Restored below; see section 40.1 for the full trace.
 */
export const AKAD_INHIRE_RAW_MATERIALS: RawPageMaterials = {
  url: "https://akadseguros.inhire.app/vagas/96e4f480-c681-4e55-aa1c-7156a67a1aee/engineering-manager",
  documentTitle: "Engineering Manager - Akad Seguros",
  canonicalUrl: undefined,
  metaDescription: undefined,
  ogTitle: undefined,
  jsonLdTexts: [],
  elements: [
    { tag: "H1", text: "Engineering Manager" },
    {
      tag: "P",
      text: "Você já pensou em trabalhar em uma empresa que surgiu para fazer diferente e ser uma nova forma de pensar em seguros?",
    },
    {
      tag: "P",
      text: "Somos uma seguradora versátil e moderna, que oferece respostas sob medida de maneira simples, justas e transparentes.",
    },
    {
      tag: "P",
      text: "Construiremos o amanhã e caminharemos lado a lado. E faremos isso juntos, pois acreditamos no poder transformador das pessoas.",
    },
    {
      tag: "P",
      text: "Tudo isso para ver gente realizada cuidando dos nossos produtos e soluções. Fazemos tudo para que nossos clientes possam fazer mais!",
    },
    {
      tag: "P",
      text: "Se você deseja trabalhar em uma empresa que sempre está desenvolvendo soluções inovadoras em um mercado cheio de oportunidades, junte-se ao nosso time de Akadians e tenha a experiência de escrever a história conosco!",
    },
    {
      tag: "P",
      text: "Somos uma empresa aberta para todas as pessoas. Trabalhamos em um ambiente que estimula novas ideias, o compartilhamento de experiências e valoriza a pluralidade e diversidade.",
    },
    { tag: "P", text: "Aqui, nos sentimos à vontade para sermos nós mesmos!" },
    {
      tag: "H2",
      text: "Sobre a vaga",
    },
    {
      tag: "P",
      text: "Na Akad Seguros, estamos levando a tecnologia para o centro das decisões do negócio.",
    },
    {
      tag: "P",
      text: 'Aqui, a Engenharia é co-responsável pelo resultado do produto e do negócio, não a função de execução. Trabalhamos em squads pequenos, autônomos e multidisciplinares, organizados por problema de negócio — não por tecnologia. Cada squad é dono de ponta a ponta dos seus sistemas: do discovery à operação em produção ("you build it, you run it"). Somos um time menor, mais sênior e generalista: não dividimos pessoas entre backend e frontend, nem entre times de desenvolvimento e de sustentação. Preferimos decisões distribuídas, tomadas o mais próximo possível do problema, dentro de princípios e padrões compartilhados.',
    },
    {
      tag: "P",
      text: "A liderança técnica acontece por influência, mentoria e contexto — nunca por autoridade hierárquica. Isso vale também para a liderança de pessoas: Engineering Managers constroem times capazes de tomar boas decisões com autonomia, em vez de tomar todas as decisões por eles.",
    },
    {
      tag: "P",
      text: "Buscamos um(a) Engineering Manager para ajudar a formar um squad de alta performance. Seu papel vai além de acompanhar entregas: Você vai desenvolver pessoas, construir um ambiente de autonomia e segurança psicológica, e garantir que o squad gere valor de forma consistente e sustentável — em parceria direta com Product Managers e Staff Engineers.",
    },
    {
      tag: "P",
      text: "Essa posição é para quem já tem o papel de gestão consolidado: alguém que opera com plena autonomia, inclusive em contextos de maior complexidade e ambiguidade, e que já demonstrou consistência liderando pessoas e squads técnicos.",
    },
    { tag: "H2", text: "Responsabilidades:" },
    {
      tag: "LI",
      text: "• Desenvolver pessoas engenheiras através de feedback contínuo, 1:1s e acompanhamento próximo de carreira",
    },
    {
      tag: "LI",
      text: "• Construir um ambiente de alta performance, autonomia e segurança psicológica dentro do squad",
    },
    { tag: "LI", text: "• Traduzir objetivos de negócio em metas claras e mensuráveis para o time" },
    { tag: "LI", text: "• Remover objetivos de negócio em metas claras e mensuráveis para o time" },
    {
      tag: "LI",
      text: "• Trabalhar em parceria contínua com Product Managers, equilibrando impacto de negócio e capacidade de entrega",
    },
    {
      tag: "LI",
      text: "• Trabalhar em parceria contínua com Staff Engineers, equilibrando velocidade e sustentabilidade técnica",
    },
    {
      tag: "LI",
      text: "• Participar ativamente de discussões de produto, discovery, planejamento e estratégia do domínio",
    },
    { tag: "LI", text: "• Identificar e desenvolver sucessores, fortalecendo continuamente o time" },
    { tag: "LI", text: "• Promover colaboração genuína entre Engenharia, Produto e Design" },
    {
      tag: "LI",
      text: "• Contribuir para a saúde operacional do squad: confiabilidade, observabilidade, redução de débito técnico e de toil",
    },
    { tag: "H2", text: "O que você precisa ter?" },
    {
      tag: "LI",
      text: "• Experiência sólida gerenciando pessoas em times de engenharia de software, com histórico consistente de feedback, 1:1s e desenvolvimento de carreira",
    },
    {
      tag: "LI",
      text: "• Autonomia para atuar em contextos de maior complexidade e ambiguidade, sem depender de supervisão constante",
    },
    {
      tag: "LI",
      text: "• Vivência real construindo e operando software em produção — você entende as decisões técnicas do seu time o suficiente para apoiá-las e questioná-las",
    },
    {
      tag: "LI",
      text: "• Facilidade para transformar objetivos de negócio, ainda que ambíguos, em direcionamento técnico claro para o time",
    },
    {
      tag: "LI",
      text: "• Habilidade para remover bloqueios organizacionais e simplificar processos, em vez de adicionar camadas de controle",
    },
    {
      tag: "LI",
      text: "• Foco genuíno em resultado de negócio e de cliente — não apenas em execução de tarefas ou volume de entregas",
    },
    {
      tag: "LI",
      text: "• Comunicação clara com públicos técnicos e não técnicos, incluindo Produto, Design e liderança executiva",
    },
    {
      tag: "LI",
      text: "• Vontade de se manter próximo da tecnologia, mesmo sem estar no dia a dia da implementação",
    },
    { tag: "H2", text: "Você se destacará se tiver..." },
    {
      tag: "LI",
      text: '• Experiência liderando squads em ambientes de alta autonomia e ownership end-to-end ("you build it, you run it")',
    },
    {
      tag: "LI",
      text: "• Vivência em times generalistas, sem separação rígida entre backend, frontend, dados e QA",
    },
    { tag: "LI", text: "• Experiência no setor de seguros, financeiro ou outro mercado regulado" },
    {
      tag: "LI",
      text: "• Participação anterior em discovery e estratégia de produto, além da gestão de entrega",
    },
    {
      tag: "LI",
      text: "• Familiaridade com práticas de confiabilidade, observabilidade, SLIs/SLOs e error budgets",
    },
    {
      tag: "P",
      text: "Aqui, o desafio é real. Se você busca um ambiente com cultura de autonomia, entrega de valor para o cliente e desafios técnicos de alto nível com possibilidade de gerar grande impacto — venha fazer parte do time Akad.",
    },
    { tag: "H2", text: "O que oferecemos:" },
    { tag: "LI", text: "• Oportunidade de carreira e desenvolvimento" },
    { tag: "LI", text: "• Um time de excelência técnica, focado na melhoria contínua e inovação" },
    {
      tag: "LI",
      text: "• Programa de participação nos resultados atrelado a sua performance individual",
    },
    { tag: "LI", text: "• Benefícios diferenciados" },
    { tag: "LI", text: "• Ambiente de trabalho leve, descontraído e flexível" },
    { tag: "LI", text: "• Modelo de trabalho 100% Remoto" },
    { tag: "H2", text: "Sobre a empresa" },
    {
      tag: "P",
      text: "Viemos para fazer diferente e somos uma nova forma de pensar em seguros. Somos líderes em nossas especialidades e nos atentamos ao que é mais importante: o respeito. Com você, com nossos corretores, segurados e parceiros.",
    },
    { tag: "H2", text: "Benefícios:" },
    {
      tag: "P",
      text: "Programa de Participação nos Lucros, Seguro de Saúde e Odontológico para colaboradores e dependentes, Seguro de Vida, Vale Refeição e Vale Alimentação, Convênios e parcerias com Instituições de Ensino, Auxílio Creche ou Auxílio Babá, Totalpass, Dayoff no mês de aniversário e Programa Conte Comigo.",
    },
  ],
  visibleText: "",
};

