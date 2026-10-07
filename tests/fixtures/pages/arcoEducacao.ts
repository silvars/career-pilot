import type { RawPageMaterials } from "../../../src/extension/job-extraction/types.js";

/**
 * Verbatim (trimmed) transcription of the real, public Arco Educação job
 * posting on Greenhouse (fetched 2026-10-07). pt-BR posting with yet more
 * header phrasing variants not covered by the Akad/InHire-derived header
 * list ("Quais serão os seus desafios com a gente:", "O que esperamos que
 * você tenha:", "O que seria um diferencial:") — drove the substring-based
 * `matchesAnyHeader` + a few new curated entries in jobAnalyzer.ts.
 * Candidate-facing application form fields were excluded.
 */
export const ARCO_EDUCACAO_RAW_MATERIALS: RawPageMaterials = {
  url: "https://job-boards.greenhouse.io/arcoeducacao/jobs/6115757004",
  documentTitle: "Engineering Manager I - Arco Educação",
  canonicalUrl: undefined,
  metaDescription: undefined,
  ogTitle: undefined,
  jsonLdTexts: [],
  elements: [
    { tag: "H1", text: "Engineering Manager I" },
    { tag: "P", text: "Remoto" },
    {
      tag: "P",
      text: "Somos a Arcotech, o time de tecnologia do Grupo Arco Educação, a maior empresa de educação básica da América Latina. Nossas soluções hoje funcionam como o \"cérebro\" de mais de 11 mil escolas, o que representa 1 a cada 4 escolas particulares do Brasil.",
    },
    {
      tag: "P",
      text: "Estamos em busca de um(a) Engineering Manager I para liderar um dos nossos times de engenharia. Aqui, esperamos uma liderança que equilibre gestão de pessoas, excelência técnica e execução, conectando estratégia e tecnologia para entregar soluções de alto impacto para o negócio.",
    },
    {
      tag: "P",
      text: "Essa é uma posição com forte atuação junto a diferentes áreas da empresa. Você será responsável por desenvolver o time, garantir a execução das entregas e participar ativamente de decisões técnicas, arquitetura e refinamentos.",
    },
    { tag: "H3", text: "Quais serão os seus desafios com a gente:" },
    { tag: "LI", text: "• Traduzir os objetivos estratégicos da empresa em metas claras e acionáveis para o time" },
    {
      tag: "LI",
      text: "• Liderar um time de engenharia de 4 a 6 engenheiros, apoiando o desenvolvimento técnico e de carreira das pessoas, conduzindo feedbacks, acompanhando performance e apoiando decisões relacionadas ao ciclo de gestão",
    },
    {
      tag: "LI",
      text: "• Garantir uma execução consistente das entregas, liderando projetos complexos, acompanhando métricas de sucesso e removendo impedimentos para o time",
    },
    {
      tag: "LI",
      text: "• Atuar como referência técnica para a equipe, participando de decisões de arquitetura, refinamentos, code reviews e discussões técnicas",
    },
    { tag: "LI", text: "• Revisar e otimizar fluxos de trabalho para aumentar a produtividade da equipe" },
    {
      tag: "LI",
      text: "• Garantir alinhamento contínuo com Product Managers (PMs), Designers, outros Engineering Managers e áreas parceiras",
    },
    {
      tag: "LI",
      text: "• Promover a adoção de Inteligência Artificial no dia a dia da engenharia, incentivando o uso de ferramentas e práticas que aumentem a produtividade e a qualidade das entregas",
    },
    { tag: "H3", text: "O que esperamos que você tenha:" },
    { tag: "LI", text: "• Experiência prévia liderando equipes de engenharia de software" },
    {
      tag: "LI",
      text: "• Background sólido em desenvolvimento de software, com capacidade para participar ativamente de discussões técnicas, apoiar decisões de arquitetura e evoluir tecnicamente o time",
    },
    {
      tag: "LI",
      text: "• Experiência em gestão de pessoas, incluindo desenvolvimento de carreira, feedbacks, gestão de performance e tomada de decisões relacionadas ao ciclo de pessoas",
    },
    {
      tag: "LI",
      text: "• Experiência liderando a execução de projetos complexos e coordenando entregas entre múltiplos times e stakeholders",
    },
    { tag: "LI", text: "• Experiência com metodologias ágeis e boas práticas de desenvolvimento de software" },
    { tag: "LI", text: "• Conhecimento em estratégias de escalabilidade e construção de soluções com visão de longo prazo" },
    {
      tag: "LI",
      text: "• Boa capacidade de comunicação, influência e gestão de stakeholders em diferentes níveis da organização",
    },
    { tag: "H3", text: "O que seria um diferencial:" },
    {
      tag: "LI",
      text: "• Experiência liderando um time que já opera de forma AI-first, com agentes e ferramentas de IA integrados no fluxo de desenvolvimento",
    },
    {
      tag: "LI",
      text: "• Vivência em produto de educação ou serviços financeiros, ou em outro domínio com forte exigência de confiabilidade e compliance",
    },
    {
      tag: "P",
      text: "Um dos pilares da Arcotech é a diversidade. Nossa motivação é nos manter em movimento, inovando e levando as tecnologias educacionais a patamares ainda não vistos.",
    },
  ],
  visibleText: "",
};
