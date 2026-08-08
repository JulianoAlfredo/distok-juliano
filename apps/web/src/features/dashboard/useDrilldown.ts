import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { DrilldownEnvelope } from './types';

const DEBOUNCE_MS = 350;

const EMPTY_ENVELOPE: DrilldownEnvelope<never, never> = { items: [], total: 0, page: 1, pages: 1 };

/** Hook genérico de estado para uma modal de drill-down do dashboard.
 *
 * - Debounça ~350ms antes de disparar o fetch (evita uma request por tecla).
 * - Qualquer troca de filtro (via setFilter) reseta a página para 1.
 * - Guarda contra resposta obsoleta: um requestId incrementado a cada disparo
 *   garante que só a resposta do request mais recente é aplicada — sem isso,
 *   digitar rápido pode fazer a resposta de uma tecla anterior (que chega
 *   depois, fora de ordem) sobrescrever o resultado da busca atual.
 */
export function useDrilldown<TItem, TFilters extends object, TSummary = undefined>(
  endpoint: string,
  initialFilters: TFilters,
) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DrilldownEnvelope<TItem, TSummary>>(
    EMPTY_ENVELOPE as unknown as DrilldownEnvelope<TItem, TSummary>,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      const params: Record<string, unknown> = { ...filters, page };
      for (const k of Object.keys(params)) {
        if (params[k] === '' || params[k] == null || params[k] === false) delete params[k];
      }
      api
        .get(endpoint, { params })
        .then(({ data: res }) => {
          if (id !== requestId.current) return; // resposta obsoleta — ignora
          setData(res);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setError(true);
        })
        .finally(() => {
          if (id !== requestId.current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // filtersKey representa `filters` por valor — é a dependência real do efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, filtersKey]);

  return { data, filters, setFilter, page, setPage, loading, error };
}
