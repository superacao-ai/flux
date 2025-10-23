"use client";

import React from 'react';
import Layout from '@/components/Layout';
import ProfessorAgendaClient from '@/components/ProfessorAgendaClient';

export default function ProfessorAgendaPage() {
  return (
    <Layout title="Minha Agenda - Superação Flux">
      <ProfessorAgendaClient />
    </Layout>
  );
}

