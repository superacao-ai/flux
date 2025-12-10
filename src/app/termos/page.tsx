'use client';

import Link from 'next/link';

export default function TermosPage() {
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
            <i className="fas fa-file-contract text-primary-600"></i>
            <span className="font-semibold text-gray-800">Superação Flux</span>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Termos de Uso
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>

          <div className="prose prose-gray max-w-none">
            {/* Aceitação */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-check-circle text-primary-600"></i>
                1. Aceitação dos Termos
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ao acessar e utilizar o sistema <strong>Superação Flux</strong>, você concorda com estes Termos de Uso e com nossa <Link href="/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>. Se você não concordar com qualquer parte destes termos, não utilize o sistema.
              </p>
            </section>

            {/* Descrição */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-info-circle text-primary-600"></i>
                2. Descrição do Serviço
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O Superação Flux é um sistema de gestão de agenda desenvolvido exclusivamente para o <strong>Studio Superação</strong>. O sistema permite:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Visualização de horários de aulas</li>
                <li>Solicitação de reagendamentos</li>
                <li>Consulta de presenças e faltas</li>
                <li>Gerenciamento de créditos de reposição</li>
                <li>Recebimento de avisos e comunicados</li>
              </ul>
            </section>

            {/* Cadastro */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-user-plus text-primary-600"></i>
                3. Cadastro e Acesso
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Para utilizar o sistema, você deve:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Ser aluno matriculado no Studio Superação</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Manter a confidencialidade de seus dados de acesso (CPF e data de nascimento)</li>
                <li>Notificar imediatamente sobre qualquer uso não autorizado de sua conta</li>
              </ul>
            </section>

            {/* Responsabilidades do Usuário */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-user-check text-primary-600"></i>
                4. Responsabilidades do Usuário
              </h2>
              <p className="text-gray-600 mb-4">Ao usar o sistema, você se compromete a:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Usar o sistema apenas para os fins a que se destina</li>
                <li>Não tentar acessar áreas restritas ou contas de outros usuários</li>
                <li>Não utilizar o sistema para atividades ilegais ou prejudiciais</li>
                <li>Manter seus dados cadastrais atualizados</li>
                <li>Respeitar os horários e regras de reagendamento estabelecidas</li>
              </ul>
            </section>

            {/* Reagendamentos */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-calendar-alt text-primary-600"></i>
                5. Política de Reagendamentos
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                As solicitações de reagendamento estão sujeitas às seguintes regras:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Reagendamentos devem ser solicitados com antecedência mínima conforme configuração do sistema</li>
                <li>A aprovação está sujeita à disponibilidade de vagas</li>
                <li>Créditos de reposição têm prazo de validade</li>
                <li>O não comparecimento sem aviso pode resultar em perda do crédito</li>
              </ul>
            </section>

            {/* Propriedade Intelectual */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-copyright text-primary-600"></i>
                6. Propriedade Intelectual
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Todo o conteúdo do sistema, incluindo mas não limitado a textos, gráficos, logos, ícones, imagens e software, é de propriedade do Studio Superação e está protegido por leis de propriedade intelectual. É proibida a reprodução, distribuição ou modificação sem autorização prévia.
              </p>
            </section>

            {/* Limitação de Responsabilidade */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-primary-600"></i>
                7. Limitação de Responsabilidade
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O Studio Superação não se responsabiliza por:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Interrupções temporárias do serviço por manutenção ou problemas técnicos</li>
                <li>Danos decorrentes do uso indevido do sistema pelo usuário</li>
                <li>Perda de dados causada por falhas não atribuíveis ao sistema</li>
                <li>Decisões tomadas com base nas informações do sistema</li>
              </ul>
            </section>

            {/* Disponibilidade */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-server text-primary-600"></i>
                8. Disponibilidade do Sistema
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Nos esforçamos para manter o sistema disponível 24 horas por dia, 7 dias por semana. No entanto, o acesso pode ser temporariamente interrompido para manutenções programadas, atualizações ou em casos de força maior. Sempre que possível, comunicaremos antecipadamente sobre interrupções planejadas.
              </p>
            </section>

            {/* Modificações */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-edit text-primary-600"></i>
                9. Modificações nos Termos
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após sua publicação no sistema. O uso continuado do sistema após as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            {/* Encerramento */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-ban text-primary-600"></i>
                10. Encerramento de Conta
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O acesso ao sistema pode ser suspenso ou encerrado:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Por solicitação do próprio usuário</li>
                <li>Ao término da matrícula no Studio Superação</li>
                <li>Por violação destes Termos de Uso</li>
                <li>Por inatividade prolongada</li>
              </ul>
            </section>

            {/* Legislação */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-gavel text-primary-600"></i>
                11. Legislação Aplicável
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será submetida ao foro da comarca onde se localiza o Studio Superação.
              </p>
            </section>

            {/* Contato */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-envelope text-primary-600"></i>
                12. Contato
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Para dúvidas sobre estes Termos de Uso, entre em contato:
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
          </div>
        </div>

        {/* Link para Privacidade */}
        <div className="text-center mt-6">
          <Link href="/privacidade" className="text-primary-600 hover:underline text-sm">
            <i className="fas fa-shield-alt mr-2"></i>
            Ver Política de Privacidade
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Studio Superação. Todos os direitos reservados.</p>
        </div>
      </main>
    </div>
  );
}
