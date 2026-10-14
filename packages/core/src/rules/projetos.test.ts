import { describe, expect, it } from 'vitest';
import type { Projeto } from '../model';
import { marcoAtrasado, marcosEmOrdem, resumoProjeto } from './projetos';

const T = '2026-10-01T15:00:00.000Z';
const nas: Projeto = {
  id: 'nas',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  nome: 'NAS',
  descricao: '',
  cor: '#0ea5e9',
  arquivado: false,
  marcos: [
    { id: 'm1', titulo: 'Instalar o sistema', data: null, concluido: false },
    { id: 'm2', titulo: 'Comprar peças', data: '2026-11-30', concluido: false },
    { id: 'm3', titulo: 'Definir orçamento', data: '2026-10-05', concluido: true },
    { id: 'm4', titulo: 'Escolher peças', data: '2026-10-20', concluido: false },
  ],
  acoes: [
    { id: 'a1', titulo: 'Pesquisar HDs', duracaoMin: 60, concluida: true },
    { id: 'a2', titulo: 'Comparar gabinetes', duracaoMin: 45, concluida: false },
  ],
  itens: [
    { id: 'i1', nome: 'Gabinete', precoCentavos: 150_000, comprado: true },
    { id: 'i2', nome: '2× HD 8 TB', precoCentavos: 220_000, comprado: false },
  ],
};

describe('projetos', () => {
  it('ordena marcos: em aberto por data, sem data depois, concluídos no fim', () => {
    expect(marcosEmOrdem(nas.marcos).map((m) => m.id)).toEqual(['m4', 'm2', 'm1', 'm3']);
  });

  it('resume marcos, próxima ação e itens', () => {
    expect(resumoProjeto(nas)).toMatchObject({
      marcosFeitos: 1,
      marcosTotal: 4,
      proximoMarco: { id: 'm4' },
      proximaAcao: { id: 'a2' },
      acoesAbertas: 1,
      totalItens: 370_000,
      comprado: 150_000,
      faltaComprar: 220_000,
    });
  });

  it('marco atrasado: em aberto e com data passada', () => {
    expect(marcoAtrasado(nas.marcos[3]!, '2026-10-21')).toBe(true);
    expect(marcoAtrasado(nas.marcos[3]!, '2026-10-20')).toBe(false);
    expect(marcoAtrasado(nas.marcos[2]!, '2026-12-01')).toBe(false);
    expect(marcoAtrasado(nas.marcos[0]!, '2026-12-01')).toBe(false);
  });
});
