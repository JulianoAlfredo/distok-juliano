import { useCallback, useEffect, useState } from 'react';

export type Density = 'comfortable' | 'compact';

type Prefs = {
  density: Density;
};

const KEY = 'distok_prefs';
const DEFAULT: Prefs = { density: 'comfortable' };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function save(p: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Prefs>(load);

  const update = useCallback((partial: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }, []);

  // Aplica densidade como atributo no <html> para CSS seletivo
  useEffect(() => {
    document.documentElement.setAttribute('data-density', prefs.density);
  }, [prefs.density]);

  return { prefs, update };
}
