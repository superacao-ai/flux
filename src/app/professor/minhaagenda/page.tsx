"use client";

import React from 'react';
import RequireAuth from '@/components/RequireAuth';
import Layout from '@/components/Layout';
import MinhaAgendaClient from '@/components/MinhaAgendaClient';

export default function MinhaAgendaPage() {
  return (
    <RequireAuth showLoginRedirect={false}>
      <Layout title="Minha Agenda - Superação Flux">
        <MinhaAgendaClient />
      </Layout>
    </RequireAuth>
  );
}
