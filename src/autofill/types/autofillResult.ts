export interface AutofillFieldResult {
  fieldId: string;
  success: boolean;
  expectedValue?: string;
  actualValue?: string;
  error?: string;
}

export interface AutofillResultSummary {
  attempted: number;
  filled: number;
  failed: number;
  skipped: number;
}

export interface AutofillResult {
  success: boolean;
  fields: AutofillFieldResult[];
  summary: AutofillResultSummary;
}
