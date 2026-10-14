import type { Locator, Page } from '@playwright/test';

/**
 * Gestos de toque de verdade (eventos touchstart/move/end pelo protocolo do Chromium),
 * para exercitar rolagem nativa e o sensor de toque longo do dnd-kit.
 */
export async function gestos(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const enviar = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function trajeto(de: { x: number; y: number }, ate: { x: number; y: number }, passos: number, msPorPasso: number) {
    for (let i = 1; i <= passos; i++) {
      await enviar('touchMove', de.x + ((ate.x - de.x) * i) / passos, de.y + ((ate.y - de.y) * i) / passos);
      await esperar(msPorPasso);
    }
  }

  return {
    /** Deslizar rápido (rolagem), sem segurar. */
    async deslizar(de: { x: number; y: number }, ate: { x: number; y: number }) {
      await enviar('touchStart', de.x, de.y);
      await trajeto(de, ate, 8, 16);
      await enviar('touchEnd');
      await esperar(400); // inércia + encaixe
    },
    /** Toque longo e arraste até um ponto; `pararEm` permite inspecionar antes de soltar. */
    async segurarEArrastar(
      de: { x: number; y: number },
      ate: { x: number; y: number },
      { segurarMs = 400, pararEm }: { segurarMs?: number; pararEm?: () => Promise<void> } = {},
    ) {
      await enviar('touchStart', de.x, de.y);
      await esperar(segurarMs);
      await trajeto(de, ate, 12, 20);
      await esperar(80);
      if (pararEm) await pararEm();
      await enviar('touchEnd');
      await esperar(150);
    },
  };
}

export async function centro(loc: Locator) {
  const r = (await loc.boundingBox())!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Datas (YYYY-MM-DD) das colunas de dia inteiramente visíveis na grade. */
export function diasVisiveis(page: Page) {
  return page.evaluate(() => {
    const grade = document.querySelector<HTMLElement>('[data-grade]')!;
    const g = grade.getBoundingClientRect();
    return [...grade.querySelectorAll<HTMLElement>('[data-dia]')]
      .filter((c) => {
        const r = c.getBoundingClientRect();
        return r.left >= g.left + 44 - 1 && r.right <= g.right + 1;
      })
      .map((c) => c.dataset.dia!);
  });
}

/** Coordenadas na tela de um horário ("HH:MM") numa coluna de dia ("YYYY-MM-DD"). */
export async function pontoNaGrade(page: Page, dia: string, hora: string, deslocX = 0.5) {
  return page.evaluate(
    ({ dia, hora, deslocX }) => {
      const col = document.querySelector<HTMLElement>(`[data-dia="${dia}"]`)!;
      const r = col.getBoundingClientRect();
      const [h, m] = hora.split(':').map(Number);
      return { x: r.left + r.width * deslocX, y: r.top + ((h! * 60 + m!) * 56) / 60 };
    },
    { dia, hora, deslocX },
  );
}

/** Rola a grade na vertical para deixar um horário perto do topo. */
export async function rolarGradePara(page: Page, hora: number) {
  await page.evaluate((hora) => {
    const g = document.querySelector<HTMLElement>('[data-grade]')!;
    g.scrollTop = hora * 56 - 20;
  }, hora);
}
