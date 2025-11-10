"use client";

import React from 'react';
import Layout from '@/components/Layout';
import MinhaAgendaClient from '@/components/MinhaAgendaClient';

export default function MinhaAgendaPage() {
  return (
    <Layout title="Minha Agenda - Superação Flux">
      <MinhaAgendaClient />
    </Layout>
  );
}
