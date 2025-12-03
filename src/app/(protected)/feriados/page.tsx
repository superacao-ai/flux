'use client';

import ProtectedPage from '@/components/ProtectedPage';
import FeriadosCalendario from '@/components/FeriadosCalendario';

export default function FeriadosPage() {
  return (
    <ProtectedPage tab="configuracoes" title="Feriados - Superação Flux" requireAdmin>
      <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <FeriadosCalendario />
      </div>
    </ProtectedPage>
  );
}
