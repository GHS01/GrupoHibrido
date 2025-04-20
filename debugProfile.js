// Función para depurar la carga de perfil (solo para uso interno, no visible en la UI)
function debugProfile() {
  const userId = sessionStorage.getItem('userId');
  console.log('ID de usuario en sesión:', userId);

  console.log('Transacciones cargadas:', window.transactions ? window.transactions.length : 0);
  if (window.transactions && window.transactions.length > 0) {
    console.log('Muestra de transacciones:');
    window.transactions.slice(0, 3).forEach((t, i) => {
      console.log(`Transacción ${i + 1}:`, t);
    });
  }

  console.log('Balance de ahorros:', window.savingsBalance);

  console.log('Historial de ahorros cargado:', window.savingsHistory ? window.savingsHistory.length : 0);
  if (window.savingsHistory && window.savingsHistory.length > 0) {
    console.log('Muestra de historial:');
    window.savingsHistory.slice(0, 3).forEach((h, i) => {
      console.log(`Historial ${i + 1}:`, h);
    });
  }

  // Verificar que las funciones de filtrado estén usando el ID correcto
  const userTransactions = window.transactions.filter(t => {
    const tUserId = t.userId ? String(t.userId) : null;
    const tUserIdSupabase = t.user_id ? String(t.user_id) : null;
    const userIdStr = String(userId);
    return tUserId === userIdStr || tUserIdSupabase === userIdStr;
  });

  console.log('Transacciones filtradas por ID de usuario:', userTransactions.length);

  return {
    userId,
    transactionsCount: window.transactions ? window.transactions.length : 0,
    savingsBalance: window.savingsBalance,
    savingsHistoryCount: window.savingsHistory ? window.savingsHistory.length : 0,
    filteredTransactionsCount: userTransactions.length
  };
}

// Exponer la función globalmente para uso interno
window.debugProfile = debugProfile;

// Nota: Esta función ya no es accesible desde la UI, solo desde la consola o el código
