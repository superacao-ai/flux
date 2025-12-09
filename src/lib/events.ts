// Eventos customizados para comunicação entre componentes

/**
 * Dispara evento para atualizar contagens de pendentes na sidebar
 * Chamar após: aprovar/rejeitar experimental, criar/aprovar reagendamento, enviar aula, etc.
 */
export function refreshPendingCounts() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('refreshPendingCounts'));
  }
}
