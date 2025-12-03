'use client';

import { useState, useEffect } from 'react';
import { 
  getFeriadosNacionais, 
  getFeriadosPersonalizados, 
  adicionarFeriadoPersonalizado, 
  removerFeriadoPersonalizado,
  type Feriado 
} from '@/lib/feriados';
import { toast } from 'react-toastify';

interface FeriadosCalendarioProps {
  anoAtual?: number;
}

export default function FeriadosCalendario({ anoAtual = new Date().getFullYear() }: FeriadosCalendarioProps) {
  const [ano, setAno] = useState(anoAtual);
  const [feriadosNacionais, setFeriadosNacionais] = useState<Feriado[]>([]);
  const [feriadosPersonalizados, setFeriadosPersonalizados] = useState<Feriado[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [novoFeriado, setNovoFeriado] = useState({
    data: '',
    nome: '',
    recorrente: false,
  });

  useEffect(() => {
    carregarFeriados();
  }, [ano]);

  const carregarFeriados = () => {
    const nacionais = getFeriadosNacionais(ano);
    const personalizados = getFeriadosPersonalizados().filter(f => {
      const anoFeriado = new Date(f.data).getFullYear();
      return f.recorrente || anoFeriado === ano;
    });
    
    setFeriadosNacionais(nacionais);
    setFeriadosPersonalizados(personalizados);
  };

  const handleAdicionarFeriado = () => {
    if (!novoFeriado.data || !novoFeriado.nome) {
      toast.warning('Preencha todos os campos');
      return;
    }

    adicionarFeriadoPersonalizado(novoFeriado);
    toast.success('Feriado adicionado com sucesso!');
    setShowModal(false);
    setNovoFeriado({ data: '', nome: '', recorrente: false });
    carregarFeriados();
  };

  const handleRemoverFeriado = (data: string) => {
    if (confirm('Deseja remover este feriado personalizado?')) {
      removerFeriadoPersonalizado(data);
      toast.success('Feriado removido!');
      carregarFeriados();
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' });
  };

  const todosFeriados = [...feriadosNacionais, ...feriadosPersonalizados].sort((a, b) => 
    a.data.localeCompare(b.data)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <i className="fas fa-calendar-day text-primary-600"></i>
            Feriados
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAno(ano - 1)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <i className="fas fa-chevron-left text-gray-600"></i>
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[80px] text-center">
              {ano}
            </span>
            <button
              onClick={() => setAno(ano + 1)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <i className="fas fa-plus"></i>
          Adicionar Feriado
        </button>
      </div>

      <div className="space-y-2">
        {todosFeriados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-calendar-times text-4xl mb-3 text-gray-300"></i>
            <p>Nenhum feriado encontrado para {ano}</p>
          </div>
        ) : (
          todosFeriados.map((feriado, index) => (
            <div
              key={`${feriado.data}-${index}`}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold ${
                  feriado.tipo === 'nacional' ? 'bg-blue-600' : 
                  feriado.tipo === 'municipal' ? 'bg-purple-600' : 
                  'bg-green-600'
                }`}>
                  <i className={`fas ${
                    feriado.tipo === 'nacional' ? 'fa-flag' : 
                    feriado.tipo === 'municipal' ? 'fa-building' : 
                    'fa-star'
                  }`}></i>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{feriado.nome}</h3>
                  <p className="text-sm text-gray-600">{formatarData(feriado.data)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  feriado.tipo === 'nacional' ? 'bg-blue-100 text-blue-700' :
                  feriado.tipo === 'municipal' ? 'bg-purple-100 text-purple-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {feriado.tipo === 'nacional' ? 'Nacional' : 
                   feriado.tipo === 'municipal' ? 'Municipal' : 
                   'Personalizado'}
                </span>
                {feriado.recorrente && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    <i className="fas fa-sync-alt mr-1"></i>
                    Anual
                  </span>
                )}
                {feriado.tipo === 'personalizado' && (
                  <button
                    onClick={() => handleRemoverFeriado(feriado.data)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Remover feriado"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Adicionar Feriado */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-primary-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <i className="fas fa-plus-circle"></i>
                Adicionar Feriado
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Feriado
                </label>
                <input
                  type="text"
                  value={novoFeriado.nome}
                  onChange={(e) => setNovoFeriado({ ...novoFeriado, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Aniversário do Studio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={novoFeriado.data}
                  onChange={(e) => setNovoFeriado({ ...novoFeriado, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recorrente"
                  checked={novoFeriado.recorrente}
                  onChange={(e) => setNovoFeriado({ ...novoFeriado, recorrente: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="recorrente" className="text-sm text-gray-700">
                  Repetir todo ano
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdicionarFeriado}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
