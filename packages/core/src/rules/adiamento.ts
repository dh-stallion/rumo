import { ativo, type Adiamento, type AlvoAdiamento } from '../model';

export function estaAdiado(
  alvoTipo: AlvoAdiamento,
  alvoId: string,
  adiamentos: readonly Adiamento[],
  agora: Date,
): boolean {
  return adiamentos.some(
    (a) =>
      ativo(a) && a.alvoTipo === alvoTipo && a.alvoId === alvoId && new Date(a.ate) > agora,
  );
}
