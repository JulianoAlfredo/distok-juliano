import { useState, useCallback } from 'react';

/** Controla quais linhas de uma tabela estão "expandidas" (mostrando campos secundários no cartão mobile). */
export function useExpandedRows() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);

  return { isExpanded, toggle };
}
