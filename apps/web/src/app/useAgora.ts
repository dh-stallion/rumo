import { useEffect, useState } from 'react';

/**
 * "Agora" que se atualiza a cada minuto e quando o app volta ao primeiro plano
 * (o PWA no iPhone pode ficar dias suspenso e reabrir no dia seguinte).
 */
export function useAgora(intervaloMs = 60_000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setAgora(new Date());
    const id = window.setInterval(tick, intervaloMs);
    const onVisivel = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisivel);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisivel);
    };
  }, [intervaloMs]);
  return agora;
}
