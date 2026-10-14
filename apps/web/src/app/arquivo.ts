export type ResultadoEntrega = 'compartilhado' | 'baixado' | 'cancelado';

/**
 * Entrega um arquivo ao usuário. No celular usa a folha de compartilhamento (no iPhone:
 * "Salvar em Arquivos"); no computador, ou se o compartilhamento falhar, baixa o arquivo.
 * Precisa ser chamado direto do toque (o iOS exige o gesto), então o conteúdo já deve estar pronto.
 */
export async function entregarArquivo(conteudo: string, nome: string, tipo: string): Promise<ResultadoEntrega> {
  const arquivo = new File([conteudo], nome, { type: tipo });
  const toque = matchMedia('(pointer: coarse)').matches;
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}
