/**
 * Job posting text fixtures for the Job Match tests. Every expected status
 * documented in each comment was verified empirically against the real
 * vendored rodrigo-matos profile (not hand-calculated) before being encoded
 * as an assertion.
 */

export const STRONG_MATCH_JOB = `Senior Engineering Manager

Location: Brazil

Responsibilities:
- Lead engineering teams and drive architecture decisions
- Own technical strategy for distributed systems

Requirements:
- Java and Spring Boot
- AWS
- Kubernetes
- Microservices and API design
- People management experience

Preferred:
- Kafka
- Docker

English required.
`;

export const GOOD_MATCH_JOB = `Senior Engineering Manager

Location: Brazil

Responsibilities:
- Own technical strategy for distributed systems
- Coordinate release schedules across multiple time zones

Requirements:
- Java
- Terraform
- Kubernetes

Preferred:
- Kafka

English required.
`;

export const PARTIAL_MATCH_JOB = `Data Engineer

Location: Germany

Responsibilities:
- Build Spark and Hadoop ETL pipelines
- Tune data warehouse query performance

Requirements:
- Scala
- Apache Airflow orchestration
- Snowflake data modeling

Mandarin required.
`;

export const LOW_MATCH_JOB = `Embedded Firmware Engineer

Location: Japan

Responsibilities:
- Debug oscilloscope signal traces
- Calibrate analog sensor arrays
- Write RTOS interrupt handlers

Requirements:
- Terraform
- Firmware bring-up for ARM Cortex boards
- JTAG hardware debugging
- Real-time operating systems
`;

// Required skill "Terraform" has zero evidence anywhere in the profile ->
// MISSING (SDD section 14's own canonical example).
export const MISSING_REQUIRED_SKILL_JOB = `Platform Engineer

Requirements:
- Java
- Terraform
- Kubernetes
`;

// Profile has no seniority evidence for "Junior" -> SENIORITY MISSING.
export const SENIORITY_MISMATCH_JOB = `Junior Software Engineer

Requirements:
- Java
`;

// Profile lists "English — advanced" (no "native") and no German at all ->
// native English is UNCLEAR, German is MISSING.
export const LANGUAGE_JOB = `Backend Engineer

Requirements:
- Native English required.
- German required.
`;

// Profile never mentions remote/hybrid/on-site -> WORK_MODEL MISSING.
export const LOCATION_WARNING_JOB = `Backend Engineer (Remote)

This position is fully remote.

Requirements:
- Java
`;

export const BASELINE_NO_ELIGIBILITY_JOB = `Software Engineer

Requirements:
- Java
`;

// Same as the baseline above, with eligibility-related sentences added. Score
// must stay identical (SDD sections 20-21): eligibility never affects it.
export const ELIGIBILITY_JOB = `Software Engineer

We strongly encourage women and people with disabilities to apply.

Candidates must be authorized to work in this country. US citizen required.

Active security clearance required.

Requirements:
- Java
`;
