import { useCallback, useState } from 'react';

type Errors = Record<string, string>;

/**
 * Gerencia erros de campo de formulário.
 * Uso: const { errors, setError, clearError, clearAll, hasErrors } = useFieldErrors();
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Errors>({});

  const setError = useCallback((field: string, msg: string) => {
    setErrors((e) => ({ ...e, [field]: msg }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const hasErrors = Object.keys(errors).length > 0;

  /** Valida um campo e atualiza o erro. Retorna true se válido. */
  const validate = useCallback((field: string, value: string, rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    patternMsg?: string;
    custom?: (v: string) => string | null;
  }): boolean => {
    const v = value?.trim() ?? '';
    if (rules.required && !v) {
      setErrors((e) => ({ ...e, [field]: 'Campo obrigatório' }));
      return false;
    }
    if (rules.minLength && v.length < rules.minLength) {
      setErrors((e) => ({ ...e, [field]: `Mínimo ${rules.minLength} caracteres` }));
      return false;
    }
    if (rules.maxLength && v.length > rules.maxLength) {
      setErrors((e) => ({ ...e, [field]: `Máximo ${rules.maxLength} caracteres` }));
      return false;
    }
    if (rules.pattern && v && !rules.pattern.test(v)) {
      setErrors((e) => ({ ...e, [field]: rules.patternMsg ?? 'Formato inválido' }));
      return false;
    }
    if (rules.custom) {
      const msg = rules.custom(v);
      if (msg) { setErrors((e) => ({ ...e, [field]: msg })); return false; }
    }
    clearError(field);
    return true;
  }, [clearError]);

  return { errors, setError, clearError, clearAll, hasErrors, validate };
}
