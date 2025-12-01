"use client";

import React from 'react';
import ProtectedPage from '@/components/ProtectedPage';
import ProfessorAgendaClient from '@/components/ProfessorAgendaClient';

export default function ProfessorAgendaPage() {
  return (
    <ProtectedPage tab="professor:minhaagenda" title="Minha Agenda - Superação Flux">
      <ProfessorAgendaClient />
    </ProtectedPage>
  );
}

