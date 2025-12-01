"use client";

import React from 'react';
import ProtectedPage from '@/components/ProtectedPage';
import MinhaAgendaClient from '@/components/MinhaAgendaClient';

export default function MinhaAgendaPage() {
  return (
    <ProtectedPage tab="professor:minhaagenda" title="Minha Agenda - Superação Flux">
      <MinhaAgendaClient />
    </ProtectedPage>
  );
}
