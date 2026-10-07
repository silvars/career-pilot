/**
 * Structural element types FASE 5 understands (SDD "Form Intelligence"
 * section 2). Semantic typing (what the field *means*) is a later slice —
 * this only captures what kind of control it is.
 */
export type FormElementType = "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX" | "RADIO" | "COMBOBOX";

/**
 * Which signal ultimately provided a field's effective label (SDD section
 * 1: "não depender somente de name ou id", "priorizar a semântica visível
 * para o usuário"). Ordered by reliability, most to least visible/explicit:
 * LABEL > ARIA_LABELLEDBY > ARIA_LABEL > PLACEHOLDER > NAME > ID > NONE.
 */
export type FieldSource = "LABEL" | "ARIA_LABELLEDBY" | "ARIA_LABEL" | "PLACEHOLDER" | "NAME" | "ID" | "NONE";

export interface FormOption {
  value?: string;
  label: string;
}

export interface FormField {
  id: string;
  elementType: FormElementType;

  label?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;

  options?: FormOption[];

  required: boolean;

  value?: string;

  section?: string;

  source: FieldSource;
}
