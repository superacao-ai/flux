'use client';

import { useState, useEffect } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

interface Configuracao {
  chave: string;
  valor: string;
  descricao?: string;
}

const configuracoesDisponiveis = [
  { chave: 'whatsapp_suporte', label: 'WhatsApp Suporte', descricao: 'Número para atendimento geral (ex: 5511999998888)', icon: 'fa-headset' },
  { chave: 'whatsapp_financeiro', label: 'WhatsApp Financeiro', descricao: 'Número para assuntos financeiros (ex: 5511999997777)', icon: 'fa-dollar-sign' },
];

const mensagensDescansoDefault = [
  "Aproveite o dia para descansar.",
  "Dia de recuperação. Cuide-se!",
  "Sem compromissos hoje. Até a próxima!",
  "Dia livre. Nos vemos em breve!",
  "Descanse bem. Até a próxima aula!",
  "Aproveite seu dia de folga.",
  "Sem aulas programadas. Bom descanso!",
  "Dia de pausa. Recupere as energias.",
  "Nenhuma aula agendada. Até breve!",
  "Aproveite para relaxar. Nos vemos logo!"
];

export default function ConfiguracoesPage() {
  const [configuracoes, setConfiguracoes] = useState<Record<string, string>>({});
  const [mensagensDescanso, setMensagensDescanso] = useState<string[]>(mensagensDescansoDefault);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvandoMensagens, setSalvandoMensagens] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const res = await fetch('/api/configuracoes');
      const data = await res.json();
      
      if (data.success && data.data) {
        const configMap: Record<string, string> = {};
        data.data.forEach((c: any) => {
          if (c.chave === 'mensagens_descanso' && c.valor) {
            try {
              const msgs = JSON.parse(c.valor);
              if (Array.isArray(msgs) && msgs.length > 0) {
                setMensagensDescanso(msgs);
              }
            } catch {
              // mantém as mensagens default
            }
          } else {
            configMap[c.chave] = c.valor || '';
          }
        });
        setConfiguracoes(configMap);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracao = async (chave: string, valor: string) => {
    setSalvando(chave);
    setMensagem(null);
    
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMensagem({ tipo: 'sucesso', texto: 'Configuração salva com sucesso!' });
        setTimeout(() => setMensagem(null), 3000);
      } else {
        setMensagem({ tipo: 'erro', texto: 'Erro ao salvar configuração' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
    } finally {
      setSalvando(null);
    }
  };

  const salvarMensagensDescanso = async () => {
    setSalvandoMensagens(true);
    setMensagem(null);
    
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'mensagens_descanso', valor: JSON.stringify(mensagensDescanso) })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMensagem({ tipo: 'sucesso', texto: 'Mensagens salvas com sucesso!' });
        setTimeout(() => setMensagem(null), 3000);
      } else {
        setMensagem({ tipo: 'erro', texto: 'Erro ao salvar mensagens' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
    } finally {
      setSalvandoMensagens(false);
    }
  };

  const adicionarMensagem = () => {
    if (novaMensagem.trim()) {
      setMensagensDescanso([...mensagensDescanso, novaMensagem.trim()]);
      setNovaMensagem('');
    }
  };

  const removerMensagem = (index: number) => {
    setMensagensDescanso(mensagensDescanso.filter((_, i) => i !== index));
  };

  const restaurarPadrao = () => {
    setMensagensDescanso(mensagensDescansoDefault);
  };

  const handleChange = (chave: string, valor: string) => {
    // Remove tudo que não for número
    const apenasNumeros = valor.replace(/\D/g, '');
    setConfiguracoes(prev => ({ ...prev, [chave]: apenasNumeros }));
  };

  const formatarNumero = (numero: string) => {
    if (!numero) return '';
    // Formato: +55 (11) 99999-9999
    const limpo = numero.replace(/\D/g, '');
    if (limpo.length === 13) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    if (limpo.length === 12) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
    }
    if (limpo.length === 11) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    return limpo;
  };

  if (carregando) {
    return (
      <ProtectedPage tab="configuracoes" title="Configurações - Superação Flux" fullWidth>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center py-20">
              <i className="fas fa-spinner fa-spin text-4xl text-primary-600"></i>
              <span className="ml-3 text-gray-600">Carregando configurações...</span>
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="configuracoes" title="Configurações - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header Desktop */}
          <div className="hidden md:block mb-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-cog text-primary-600"></i>
              Configurações do Sistema
            </h1>
            <p className="text-sm text-gray-600 mt-1">Configure os dados de contato que aparecem para os alunos</p>
          </div>
        
          {/* Header Mobile */}
          <div className="md:hidden mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Configurações</h1>
            <p className="text-xs text-gray-500 mt-0.5">Contatos e configurações do sistema</p>
          </div>

          {/* Mensagem de feedback */}
          {mensagem && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <i className={`fas ${mensagem.tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {mensagem.texto}
            </div>
          )}

          {/* Contatos WhatsApp */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-500 to-green-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fab fa-whatsapp"></i>
                Contatos WhatsApp
              </h2>
              <p className="text-green-100 text-sm mt-1">
                Estes números aparecem na área do aluno para contato
              </p>
            </div>
          
            <div className="p-4 space-y-4">
              {configuracoesDisponiveis.map((config) => (
                <div key={config.chave} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <i className={`fas ${config.icon} text-green-600`}></i>
                    </div>
                    <div>
                      <label className="font-medium text-gray-900">{config.label}</label>
                      <p className="text-xs text-gray-500">{config.descricao}</p>
                    </div>
                  </div>
                
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fab fa-whatsapp text-gray-400"></i>
                      </div>
                      <input
                        type="text"
                        value={configuracoes[config.chave] || ''}
                        onChange={(e) => handleChange(config.chave, e.target.value)}
                        placeholder="5511999998888"
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => salvarConfiguracao(config.chave, configuracoes[config.chave] || '')}
                      disabled={salvando === config.chave}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {salvando === config.chave ? (
                        <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                        <i className="fas fa-save"></i>
                      )}
                      Salvar
                    </button>
                  </div>
                
                  {configuracoes[config.chave] && (
                    <p className="text-xs text-gray-500 mt-2">
                      <i className="fas fa-phone mr-1"></i>
                      Formatado: {formatarNumero(configuracoes[config.chave])}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Informação */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
              <div className="text-sm text-blue-700">
                <p className="font-medium">Como funciona:</p>
                <ul className="mt-1 space-y-1 list-disc list-inside text-blue-600">
                  <li>Os números devem incluir código do país (55 para Brasil)</li>
                  <li>Formato: 5511999998888 (país + DDD + número)</li>
                  <li>Estes contatos aparecerão na área do aluno para suporte</li>
                  <li>O telefone dos professores é cadastrado no perfil de cada professor</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mensagens de Descanso */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fas fa-couch"></i>
                Mensagens de Dia sem Aula
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                Mensagens que aparecem quando o aluno não tem aula no dia
              </p>
            </div>
          
            <div className="p-4">
              {/* Adicionar nova mensagem */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  placeholder="Digite uma nova mensagem"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && adicionarMensagem()}
                />
                <button
                  onClick={adicionarMensagem}
                  disabled={!novaMensagem.trim()}
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>

              {/* Lista de mensagens */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {mensagensDescanso.map((msg, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 group">
                    <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                    <span className="flex-1 text-gray-700">{msg}</span>
                    <button
                      onClick={() => removerMensagem(index)}
                      className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remover mensagem"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>

              {/* Ações */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={restaurarPadrao}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
                >
                  <i className="fas fa-undo mr-1"></i>
                  Restaurar padrão
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={salvarMensagensDescanso}
                  disabled={salvandoMensagens}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {salvandoMensagens ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className="fas fa-save"></i>
                  )}
                  Salvar Mensagens
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                <i className="fas fa-info-circle mr-1"></i>
                Cada vez que o aluno acessar a página sem aulas no dia, uma mensagem aleatória será exibida.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
