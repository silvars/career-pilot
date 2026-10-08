# CareerPilot — Field Semantic Mapping (Internal Implementation Notes)

> Moved out of `vendor/profiles/rodrigo-matos/projects/personal/career-pilot.md`
> on 2026-10-08. Reason: this is CareerPilot's own implementation spec, not a
> fact about the candidate's career — it was being indexed into the profile's
> retrieval corpus and incorrectly matched as evidence for real "why do you
> want to work here?"-style application questions (FASE 6.3 real-Chrome
> validation finding; `OPEN_QUESTION`'s own example text is lexically almost
> identical to the real question). See
> `vendor/profiles/rodrigo-matos/projects/personal/career-pilot.md` for the
> (now career-only) project description. This file is not part of any
> profile manifest and is never loaded by `ProfileLoader`/the retriever.

## Field semantic mapping

The extension should map variations into canonical fields.

### PERSONAL_NAME
Examples: Full name, Nome completo, Legal name, Candidate name

### EMAIL
Examples: Email, E-mail, Email address, Seu melhor email

### PHONE
Examples: Phone, Mobile, Cell phone, Telefone, Celular

### LINKEDIN_URL
Examples: LinkedIn, LinkedIn profile, LinkedIn URL

### GITHUB_URL
Examples: GitHub, GitHub profile, GitHub URL

### CITY
Examples: City, Current city, Location, Cidade

### COUNTRY
Examples: Country, Country of origin, País

### SALARY_EXPECTATION
Examples: Expected salary, Salary expectation, Minimum acceptable salary, Compensation, Pretensão salarial

### RESUME_UPLOAD
Examples: Resume, CV, Curriculum, Currículo

### OPEN_QUESTION
Examples: Why do you want to work here?, Tell us about yourself, Describe your experience, Why are you a good fit?

These should not be auto-filled in V1 unless the user explicitly requests AI-generated answers.

## Language policy

The user chooses Portuguese or English. The extension should never silently translate a personal fact.

Language affects: generated answers, summaries, field labels shown by the extension. Personal facts remain canonical.

## Submission policy

NEVER submit the application automatically. The extension may: (1) scan, (2) classify, (3) report fillability, (4) fill after explicit user confirmation. The user reviews and submits manually.
