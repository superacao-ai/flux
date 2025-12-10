'use client';

import Link from 'next/link';

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
            <i className="fas fa-arrow-left"></i>
            <span className="font-medium">Voltar</span>
          </Link>
          <div className="flex items-center gap-2">
            <i className="fas fa-shield-alt text-primary-600"></i>
            <span className="font-semibold text-gray-800">Superação Flux</span>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>

          <div className="prose prose-gray max-w-none">
            {/* Introdução */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-info-circle text-primary-600"></i>
                1. Introdução
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O <strong>Studio Superação</strong> (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Superação&quot;) está comprometido em proteger a privacidade de nossos alunos e usuários. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais através do sistema <strong>Superação Flux</strong>.
              </p>
            </section>

            {/* Dados Coletados */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-database text-primary-600"></i>
                2. Dados que Coletamos
              </h2>
              <p className="text-gray-600 mb-4">Coletamos as seguintes informações:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Dados de identificação:</strong> Nome completo, CPF, data de nascimento</li>
                <li><strong>Dados de contato:</strong> E-mail, telefone</li>
                <li><strong>Dados de uso:</strong> Horários de aulas, presenças, faltas, reagendamentos</li>
                <li><strong>Dados de acesso:</strong> Logs de login, endereço IP (para segurança)</li>
              </ul>
            </section>

            {/* Finalidade */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-bullseye text-primary-600"></i>
                3. Finalidade do Tratamento
              </h2>
              <p className="text-gray-600 mb-4">Utilizamos seus dados para:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Gerenciar sua matrícula e agendamento de aulas</li>
                <li>Registrar presenças e faltas</li>
                <li>Permitir reagendamentos e reposições</li>
                <li>Enviar comunicados importantes sobre suas aulas</li>
                <li>Garantir a segurança de sua conta</li>
                <li>Cumprir obrigações legais e regulatórias</li>
              </ul>
            </section>

            {/* Base Legal */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-gavel text-primary-600"></i>
                4. Base Legal (LGPD)
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O tratamento de seus dados pessoais está fundamentado nas seguintes bases legais da Lei Geral de Proteção de Dados (Lei nº 13.709/2018):
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li><strong>Execução de contrato:</strong> Necessário para prestar os serviços contratados</li>
                <li><strong>Consentimento:</strong> Para comunicações de marketing (quando aplicável)</li>
                <li><strong>Legítimo interesse:</strong> Para melhorar nossos serviços e segurança</li>
              </ul>
            </section>

            {/* Compartilhamento */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-share-alt text-primary-600"></i>
                5. Compartilhamento de Dados
              </h2>
              <p className="text-gray-600 leading-relaxed">
                <strong>Não vendemos, alugamos ou compartilhamos</strong> seus dados pessoais com terceiros para fins comerciais. Seus dados podem ser compartilhados apenas:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Com professores e equipe administrativa para gestão das aulas</li>
                <li>Com prestadores de serviços essenciais (hospedagem, banco de dados)</li>
                <li>Quando exigido por lei ou ordem judicial</li>
              </ul>
            </section>

            {/* Segurança */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-lock text-primary-600"></i>
                6. Segurança dos Dados
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Implementamos medidas técnicas e organizacionais para proteger seus dados:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Criptografia de senhas e dados sensíveis</li>
                <li>Conexões seguras (HTTPS)</li>
                <li>Controle de acesso baseado em funções</li>
                <li>Monitoramento de atividades suspeitas</li>
                <li>Backups regulares</li>
              </ul>
            </section>

            {/* Direitos */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-user-shield text-primary-600"></i>
                7. Seus Direitos
              </h2>
              <p className="text-gray-600 mb-4">
                Conforme a LGPD, você tem direito a:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Acesso:</strong> Solicitar cópia de seus dados pessoais</li>
                <li><strong>Correção:</strong> Corrigir dados incompletos ou incorretos</li>
                <li><strong>Exclusão:</strong> Solicitar a exclusão de seus dados (quando aplicável)</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação:</strong> Retirar seu consentimento a qualquer momento</li>
              </ul>
              <p className="text-gray-600 mt-4">
                Para exercer seus direitos, entre em contato conosco pelo e-mail ou telefone disponíveis no sistema.
              </p>
            </section>

            {/* Retenção */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-clock text-primary-600"></i>
                8. Retenção de Dados
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Seus dados serão mantidos enquanto houver relacionamento ativo com o Studio Superação, e pelo período necessário para cumprimento de obrigações legais após o encerramento da matrícula.
              </p>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-cookie-bite text-primary-600"></i>
                9. Cookies e Tecnologias Similares
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Utilizamos cookies essenciais para:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Manter você logado no sistema</li>
                <li>Lembrar suas preferências</li>
                <li>Garantir a segurança das sessões</li>
              </ul>
            </section>

            {/* Contato */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-envelope text-primary-600"></i>
                10. Contato
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Para dúvidas, solicitações ou reclamações sobre privacidade, entre em contato:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <p className="text-gray-700 font-medium">Studio Superação</p>
                <p className="text-gray-600 text-sm mt-2">
                  <i className="fas fa-envelope mr-2 text-gray-400"></i>
                  contatosuperacaotreino@gmail.com
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  <i className="fab fa-whatsapp mr-2 text-gray-400"></i>
                  (11) 91234-5678
                </p>
              </div>
            </section>

            {/* Alterações */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-edit text-primary-600"></i>
                11. Alterações nesta Política
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas serão comunicadas através do sistema ou por e-mail. Recomendamos revisar esta página regularmente.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Studio Superação. Todos os direitos reservados.</p>
        </div>
      </main>
    </div>
  );
}
