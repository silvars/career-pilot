# Rodrigo Matos Silva — Career Profile

This folder is the source of truth for a local-first Career Form Assistant and career knowledge base.

## Purpose

Provide structured, factual, reusable context for:

- job application form filling
- CV tailoring
- application questions
- interview preparation
- English/Portuguese applications
- career-agent retrieval later

## Privacy model

The browser extension should read these files locally. No backend is required for V1.

Do not put highly sensitive identifiers such as CPF, passwords, API keys, authentication tokens or financial credentials in this profile.

Sensitive form fields (e.g. phone, CPF) must live in a separate local-only file (`identity/personal.local.md`), excluded via the repository `.gitignore` and never committed.

## Source hierarchy

1. `rodrigomatos.tech` — current public professional profile and quantified achievements.
2. Rodrigo's LinkedIn profile/export — merged in `sources/linkedin.md`.
3. Public GitHub profile and repositories.
4. Rodrigo's own project sites, especially GeoAlert.
5. User-provided career context and verified conversation history.
6. Generated interpretation — must always be marked as interpretation, not fact.

## Core principle

Never invent experience, metrics, technologies, responsibilities or outcomes.

The assistant may reframe verified experience for a specific vacancy, but must preserve factual meaning.

## Folder map

| Directory | Guarda |
|---|---|
| `identity/` | Quem sou profissionalmente |
| `experience/` | Onde trabalhei e o que fiz |
| `skills/` | O que sei |
| `projects/` | O que construí |
| `achievements/` | Resultados e impacto |
| `stories/` | Histórias para entrevistas |
| `answers/` | Respostas reutilizáveis (ainda não populado) |
| `sources/` | De onde vieram as informações |
