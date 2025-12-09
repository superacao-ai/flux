/**
 * Sistema de Feriados Brasileiros
 * Calcula feriados nacionais fixos e móveis automaticamente
 */

interface Feriado {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'nacional' | 'municipal' | 'personalizado';
  recorrente: boolean; // Se repete todo ano
}

/**
 * Calcula a data da Páscoa para um determinado ano (Algoritmo de Meeus)
 */
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(ano, mes - 1, dia);
}

/**
 * Retorna todos os feriados nacionais de um ano
 */
export function getFeriadosNacionais(ano: number): Feriado[] {
  const feriados: Feriado[] = [];
  
  // Feriados fixos
  const feriadosFixos = [
    { mes: 0, dia: 1, nome: 'Ano Novo' },
    { mes: 3, dia: 21, nome: 'Tiradentes' },
    { mes: 4, dia: 1, nome: 'Dia do Trabalho' },
    { mes: 8, dia: 7, nome: 'Independência do Brasil' },
    { mes: 9, dia: 12, nome: 'Nossa Senhora Aparecida' },
    { mes: 10, dia: 2, nome: 'Finados' },
    { mes: 10, dia: 15, nome: 'Proclamação da República' },
    { mes: 11, dia: 25, nome: 'Natal' },
  ];

  feriadosFixos.forEach(({ mes, dia, nome }) => {
    const data = new Date(ano, mes, dia);
    feriados.push({
      data: formatarData(data),
      nome,
      tipo: 'nacional',
      recorrente: true,
    });
  });

  // Feriados móveis (baseados na Páscoa)
  const pascoa = calcularPascoa(ano);
  
  // Carnaval (47 dias antes da Páscoa)
  const carnaval = new Date(pascoa);
  carnaval.setDate(pascoa.getDate() - 47);
  feriados.push({
    data: formatarData(carnaval),
    nome: 'Carnaval',
    tipo: 'nacional',
    recorrente: true,
  });

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(pascoa.getDate() - 2);
  feriados.push({
    data: formatarData(sextaSanta),
    nome: 'Sexta-feira Santa',
    tipo: 'nacional',
    recorrente: true,
  });

  // Corpus Christi (60 dias depois da Páscoa)
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);
  feriados.push({
    data: formatarData(corpusChristi),
    nome: 'Corpus Christi',
    tipo: 'nacional',
    recorrente: true,
  });

  return feriados.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Formata data para YYYY-MM-DD
 */
function formatarData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Verifica se uma data é feriado
 */
export function isFeriado(data: string | Date, feriadosPersonalizados: Feriado[] = []): boolean {
  const dataStr = typeof data === 'string' ? data : formatarData(data);
  const ano = new Date(dataStr).getFullYear();
  
  const todosOsFeriados = [
    ...getFeriadosNacionais(ano),
    ...feriadosPersonalizados,
  ];
  
  return todosOsFeriados.some(f => f.data === dataStr);
}

/**
 * Retorna o nome do feriado de uma data específica
 */
export function getNomeFeriado(data: string | Date, feriadosPersonalizados: Feriado[] = []): string | null {
  const dataStr = typeof data === 'string' ? data : formatarData(data);
  const ano = new Date(dataStr).getFullYear();
  
  const todosOsFeriados = [
    ...getFeriadosNacionais(ano),
    ...feriadosPersonalizados,
  ];
  
  const feriado = todosOsFeriados.find(f => f.data === dataStr);
  return feriado ? feriado.nome : null;
}

/**
 * Retorna todos os feriados de um período
 */
export function getFeriadosPeriodo(
  dataInicio: string | Date,
  dataFim: string | Date,
  feriadosPersonalizados: Feriado[] = []
): Feriado[] {
  const inicio = typeof dataInicio === 'string' ? new Date(dataInicio) : dataInicio;
  const fim = typeof dataFim === 'string' ? new Date(dataFim) : dataFim;
  
  const anos = new Set<number>();
  for (let d = new Date(inicio); d <= fim; d.setFullYear(d.getFullYear() + 1)) {
    anos.add(d.getFullYear());
  }
  
  const todosFeriados: Feriado[] = [];
  anos.forEach(ano => {
    todosFeriados.push(...getFeriadosNacionais(ano));
  });
  todosFeriados.push(...feriadosPersonalizados);
  
  const inicioStr = formatarData(inicio);
  const fimStr = formatarData(fim);
  
  return todosFeriados
    .filter(f => f.data >= inicioStr && f.data <= fimStr)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Retorna feriados personalizados do localStorage (fallback)
 */
export function getFeriadosPersonalizados(): Feriado[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('feriados_personalizados');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Busca feriados personalizados da API (dias sem expediente cadastrados)
 */
export async function fetchFeriadosPersonalizados(inicio?: string, fim?: string): Promise<Feriado[]> {
  if (typeof window === 'undefined') return [];
  
  try {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    
    let url = '/api/feriados';
    const params = new URLSearchParams();
    if (inicio) params.append('inicio', inicio);
    if (fim) params.append('fim', fim);
    if (params.toString()) url += `?${params.toString()}`;
    
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];
    
    return json.data.map((f: any) => ({
      data: new Date(f.data).toISOString().split('T')[0],
      nome: f.motivo || 'Sem Expediente',
      tipo: 'personalizado' as const,
      recorrente: false,
    }));
  } catch {
    return [];
  }
}

/**
 * Adiciona um feriado/dia sem expediente via API
 */
export async function adicionarFeriadoAPI(data: string, motivo?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    const res = await fetch('/api/feriados', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data, motivo }),
    });
    
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Remove um feriado/dia sem expediente via API
 */
export async function removerFeriadoAPI(data: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    const res = await fetch(`/api/feriados?data=${data}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Salva feriados personalizados no localStorage
 */
export function salvarFeriadosPersonalizados(feriados: Feriado[]): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('feriados_personalizados', JSON.stringify(feriados));
}

/**
 * Adiciona um feriado personalizado
 */
export function adicionarFeriadoPersonalizado(feriado: Omit<Feriado, 'tipo'>): void {
  const feriados = getFeriadosPersonalizados();
  feriados.push({ ...feriado, tipo: 'personalizado' });
  salvarFeriadosPersonalizados(feriados);
}

/**
 * Remove um feriado personalizado
 */
export function removerFeriadoPersonalizado(data: string): void {
  const feriados = getFeriadosPersonalizados();
  const novos = feriados.filter(f => f.data !== data);
  salvarFeriadosPersonalizados(novos);
}

export type { Feriado };
