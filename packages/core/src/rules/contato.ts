import type { Pessoa } from '../model';
import { diasEntre, FUSO_PADRAO } from '../time';

/** Dias desde o último contato; sem registro, conta a partir do cadastro. */
export function diasSemContato(pessoa: Pessoa, agora: Date, fuso = FUSO_PADRAO): number {
  return diasEntre(new Date(pessoa.ultimoContato ?? pessoa.criadoEm), agora, fuso);
}

/** Pendente quando chega a hora: frequência 7 → aparece no 7º dia. */
export function contatoPendente(pessoa: Pessoa, agora: Date, fuso = FUSO_PADRAO): boolean {
  if (pessoa.pausada || pessoa.frequenciaDias <= 0) return false;
  return diasSemContato(pessoa, agora, fuso) >= pessoa.frequenciaDias;
}
