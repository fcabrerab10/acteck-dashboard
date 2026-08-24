// useDraft — Autosave de borradores de formularios a localStorage
//
// Uso típico:
//   const initial = hydrateDraft(DRAFT_KEY, defaults, hasContent);   // sync, safe en useState
//   const [titulo, setTitulo] = useState(initial.value.titulo);
//   ...
//   useDraftAutosave(DRAFT_KEY, { titulo, ... }, saving || savedRef.current, hasContent);
//   useBeforeUnloadGuard(hasContent({ titulo, ... }) && !saving && !savedRef.current);
//   ...
//   // al éxito del submit:
//   savedRef.current = true; localStorage.removeItem(DRAFT_KEY);

import { useEffect } from 'react';

export function hydrateDraft(key, defaults, hasContent) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: defaults, recovered: false };
    const parsed = JSON.parse(raw);
    const merged = { ...defaults, ...parsed };
    if (hasContent(merged)) return { value: merged, recovered: true };
    return { value: defaults, recovered: false };
  } catch {
    return { value: defaults, recovered: false };
  }
}

export function useDraftAutosave(key, values, disabled, hasContent) {
  useEffect(() => {
    if (disabled) return;
    try {
      if (hasContent(values)) {
        localStorage.setItem(key, JSON.stringify({ ...values, _savedAt: new Date().toISOString() }));
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  }, [key, disabled, JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function discardDraft(key) {
  try { localStorage.removeItem(key); } catch {}
}

// useBeforeUnloadGuard — Bloquea cierre/refresh mientras haya cambios sin guardar
export function useBeforeUnloadGuard(active) {
  useEffect(() => {
    if (!active) return;
    function handler(e) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}

// Compat: mantener export antiguo por si algo lo usa (no-op wrapper)
export function useDraft({ key, defaults, values, saving, hasContent }) {
  useDraftAutosave(key, values || defaults, !!saving, hasContent);
  return {
    initial: hydrateDraft(key, defaults, hasContent).value,
    markSaved: () => discardDraft(key),
    discard: () => discardDraft(key),
    recovered: hydrateDraft(key, defaults, hasContent).recovered,
    savedRef: { current: false },
  };
}
