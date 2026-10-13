import { useEffect, useSyncExternalStore } from 'react';

export type Tema = 'sistema' | 'claro' | 'escuro';

const CHAVE = 'rumo:tema';
const ouvintes = new Set<() => void>();

function ler(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

let atual: Tema = ler();

export function definirTema(tema: Tema) {
  atual = tema;
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Preferência só deste aparelho; sem storage, vale até fechar o app.
  }
  ouvintes.forEach((f) => f());
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}

/** Mantém a classe `dark` no <html> de acordo com a preferência e com o sistema. */
export function useTemaAplicado() {
  const tema = useTema();
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () =>
      document.documentElement.classList.toggle('dark', tema === 'escuro' || (tema === 'sistema' && mq.matches));
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
}
