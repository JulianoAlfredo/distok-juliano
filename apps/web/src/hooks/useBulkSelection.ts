import { useMemo, useState } from 'react';

/** Gerencia seleção múltipla de itens por id para ações em lote em tabelas. */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => items.map((i) => i.id), [items]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (visibleIds.every((id) => prev.has(id)) && visibleIds.length > 0) return new Set();
      return new Set(visibleIds);
    });
  }

  function clear() { setSelected(new Set()); }

  return {
    selectedIds: Array.from(selected),
    isSelected: (id: string) => selected.has(id),
    allSelected,
    someSelected,
    count: selected.size,
    toggle,
    toggleAll,
    clear,
  };
}
