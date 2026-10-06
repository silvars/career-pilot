# Career Form Assistant (Career Pilot)

Current project concept: a local-first Chrome extension that detects job-application forms, understands field semantics and tells the user how many fields it can fill from a local career profile.

## Design principles

- no backend
- no account
- no automatic submission
- local Markdown career knowledge
- explicit user review before filling
- Portuguese/English choice
- semantic field recognition instead of site-specific selectors
- future optional AI generation for open questions

This project is particularly relevant as evidence of AI-native product thinking and privacy-conscious browser automation.

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
