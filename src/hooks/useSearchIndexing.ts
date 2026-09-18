import { useEffect } from 'react';
// SPA hint, not a substitute for future SSR/meta HTTP headers or access control.
export function useSearchIndexing(allowed: boolean) {
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const meta = existing || document.createElement('meta');
    const previous = meta.content;
    meta.name = 'robots'; meta.content = allowed ? 'index,follow' : 'noindex,nofollow';
    if (!existing) document.head.appendChild(meta);
    return () => { if (existing) meta.content = previous; else meta.remove(); };
  }, [allowed]);
}
