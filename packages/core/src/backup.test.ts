import { describe, expect, it } from 'vitest';
import { contarRegistros, criarBackup, validarBackup, type TabelasBackup } from './backup';
import { adiamento, atividade, pessoa, sessao, SP } from './test/fabricas';

const tabelas = (): TabelasBackup => ({
  atividades: [atividade({ id: 'a1' }), atividade({ id: 'a2', excluidoEm: '2026-10-10T10:00:00.000Z' })],
  sessoes: [sessao(SP('2026-10-12T10:00'), { id: 's1' })],
  pessoas: [pessoa({ id: 'p1', ultimoContato: '2026-10-01T15:00:00.000Z' })],
  eventos: [
    {
      id: 'e1',
      criadoEm: '2026-10-01T15:00:00.000Z',
      atualizadoEm: '2026-10-01T15:00:00.000Z',
      excluidoEm: null,
      titulo: 'Dentista',
      inicio: '2026-10-14T18:00:00.000Z',
      fim: '2026-10-14T19:00:00.000Z',
      fixo: true,
      pessoaId: 'p1',
      rrule: null,
    },
  ],
  adiamentos: [adiamento({ alvoId: 'a1', ate: '2026-10-14T03:00:00.000Z' })],
  preferencias: [
    {
      id: 'preferencias',
      criadoEm: '2026-10-01T15:00:00.000Z',
      atualizadoEm: '2026-10-01T15:00:00.000Z',
      excluidoEm: null,
      inicioSemana: 0,
      convitePlanejar: false,
      semanaConviteTratada: '2026-10-12',
    },
  ],
});

/** Simula salvar em arquivo e ler de volta. */
const viaArquivo = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown;

describe('validarBackup', () => {
  it('aceita um backup recém-exportado, idêntico depois de ir e voltar do arquivo', () => {
    const backup = criarBackup(tabelas(), SP('2026-10-13T12:00'));
    const r = validarBackup(viaArquivo(backup));
    expect(r).toEqual({ ok: true, backup });
  });

  it('recusa arquivos que não são backup do Rumo', () => {
    for (const lixo of [null, 42, 'texto', [], { foo: 1 }]) {
      expect(validarBackup(lixo)).toEqual({ ok: false, erros: ['Este arquivo não é um backup do Rumo.'] });
    }
  });

  it('recusa versão desconhecida', () => {
    const b = { ...criarBackup(tabelas()), versao: 99 };
    const r = validarBackup(viaArquivo(b));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erros[0]).toMatch(/Versão de backup não suportada \(99\)/);
  });

  it('aponta, em português, qual registro e campo estão errados', () => {
    const t = tabelas() as unknown as { atividades: Record<string, unknown>[]; sessoes: Record<string, unknown>[] };
    t.atividades[1]!.categoria = 'trabalho';
    delete t.sessoes[0]!.inicio;
    const r = validarBackup(viaArquivo(criarBackup(t as unknown as TabelasBackup)));
    expect(r).toEqual({
      ok: false,
      erros: ['atividade nº 2, campo "categoria": valor inválido', 'sessão nº 1, campo "inicio": ausente'],
    });
  });

  it('distingue campo ausente de campo com tipo errado', () => {
    const t = tabelas() as unknown as { atividades: Record<string, unknown>[] };
    t.atividades[0]!.pausada = 'sim';
    delete t.atividades[0]!.categoria;
    const r = validarBackup(viaArquivo(criarBackup(t as unknown as TabelasBackup)));
    expect(!r.ok && r.erros).toEqual([
      'atividade nº 1, campo "categoria": ausente',
      'atividade nº 1, campo "pausada": valor inválido',
    ]);
  });

  it('recusa datas em formato inválido e tabela ausente', () => {
    const b = viaArquivo(criarBackup(tabelas())) as { tabelas: Record<string, unknown> & { pessoas: { ultimoContato: string }[] } };
    b.tabelas.pessoas[0]!.ultimoContato = '01/10/2026';
    delete b.tabelas.eventos;
    const r = validarBackup(b);
    expect(!r.ok && r.erros).toEqual(['pessoa nº 1, campo "ultimoContato": formato inválido', 'tabela "eventos": ausente']);
  });

  it('backup de antes do convite semanal recebe os valores padrão', () => {
    const antigo = viaArquivo(criarBackup(tabelas())) as { tabelas: { preferencias: Record<string, unknown>[] } };
    delete antigo.tabelas.preferencias[0]!.convitePlanejar;
    delete antigo.tabelas.preferencias[0]!.semanaConviteTratada;
    const r = validarBackup(antigo);
    expect(r.ok && r.backup.tabelas.preferencias[0]).toMatchObject({ convitePlanejar: true, semanaConviteTratada: null });
  });

  it('recusa ids repetidos', () => {
    const t = tabelas();
    t.atividades[1] = { ...t.atividades[1]!, id: 'a1' };
    const r = validarBackup(viaArquivo(criarBackup(t)));
    expect(!r.ok && r.erros).toEqual(['tabela "atividades": id repetido (a1)']);
  });
});

describe('contarRegistros', () => {
  it('conta só registros não excluídos', () => {
    expect(contarRegistros(tabelas())).toEqual({ atividades: 1, sessoes: 1, pessoas: 1, eventos: 1 });
  });
});
