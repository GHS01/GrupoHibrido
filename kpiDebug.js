// Script para depurar los KPIs
console.log('Iniciando depuración de KPIs...');

// Verificar que las variables globales necesarias estén definidas
console.log('Verificando variables globales...');
console.log('window.transactions:', window.transactions ? `Definida (${window.transactions.length} transacciones)` : 'No definida');
console.log('window.savingsHistory:', window.savingsHistory ? `Definida (${window.savingsHistory.length} entradas)` : 'No definida');
console.log('window.savingsBalance:', window.savingsBalance !== undefined ? `Definido (${window.savingsBalance})` : 'No definido');
console.log('window.categories:', window.categories ? `Definida (${window.categories.length} categorías)` : 'No definida');

// Obtener el ID de usuario actual
const userId = sessionStorage.getItem('userId');
console.log('ID de usuario:', userId);

// Filtrar transacciones del usuario
const userTransactions = window.transactions ? window.transactions.filter(t => t.userId === userId || t.user_id === userId) : [];
console.log('Transacciones del usuario:', userTransactions.length);

// Mostrar las primeras 5 transacciones
console.log('Primeras 5 transacciones:');
userTransactions.slice(0, 5).forEach((t, i) => {
  console.log(`Transacción ${i + 1}:`, {
    id: t.id,
    userId: t.userId || t.user_id,
    type: t.type,
    amount: t.amount,
    date: t.date,
    category: t.category,
    costType: t.costType || t.cost_type
  });
});

// Calcular KPIs manualmente
console.log('Calculando KPIs manualmente...');

// Obtener mes actual y anterior
const currentDate = moment();
const prevMonthDate = moment().subtract(1, 'month');
const currentPrefix = currentDate.format('YYYY-MM');
const prevPrefix = prevMonthDate.format('YYYY-MM');

console.log('Mes actual:', currentPrefix);
console.log('Mes anterior:', prevPrefix);

// Calcular ingresos y gastos del mes actual
const currentMonthRevenue = userTransactions
  .filter(t => (t.type === 'entrada' || t.type === 'Ingreso') && t.date && t.date.startsWith(currentPrefix))
  .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

const currentMonthCosts = userTransactions
  .filter(t => (t.type === 'saida' || t.type === 'Gasto') && t.date && t.date.startsWith(currentPrefix))
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

// Calcular ingresos y gastos del mes anterior
const prevMonthRevenue = userTransactions
  .filter(t => (t.type === 'entrada' || t.type === 'Ingreso') && t.date && t.date.startsWith(prevPrefix))
  .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

const prevMonthCosts = userTransactions
  .filter(t => (t.type === 'saida' || t.type === 'Gasto') && t.date && t.date.startsWith(prevPrefix))
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

// Calcular costos fijos del mes actual
const currentMonthFixedCosts = userTransactions
  .filter(t => (t.type === 'saida' || t.type === 'Gasto') && 
              (t.costType === 'fijo' || t.cost_type === 'fijo') && 
              t.date && t.date.startsWith(currentPrefix))
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

// Calcular margen bruto
const currentGrossMargin = currentMonthRevenue > 0 ? 
  (currentMonthRevenue - currentMonthCosts) / currentMonthRevenue * 100 : 0;

const prevGrossMargin = prevMonthRevenue > 0 ? 
  (prevMonthRevenue - prevMonthCosts) / prevMonthRevenue * 100 : 0;

// Calcular crecimiento de ingresos
const revenueGrowth = prevMonthRevenue > 0 ? 
  (currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue * 100 : 0;

// Calcular punto de equilibrio
const breakeven = currentGrossMargin > 0 ? 
  currentMonthFixedCosts / (currentGrossMargin / 100) : 0;

// Mostrar resultados
console.log('Resultados de KPIs:');
console.log('Ingresos mes actual:', currentMonthRevenue);
console.log('Gastos mes actual:', currentMonthCosts);
console.log('Ingresos mes anterior:', prevMonthRevenue);
console.log('Gastos mes anterior:', prevMonthCosts);
console.log('Costos fijos mes actual:', currentMonthFixedCosts);
console.log('Margen bruto actual:', currentGrossMargin.toFixed(1) + '%');
console.log('Margen bruto anterior:', prevGrossMargin.toFixed(1) + '%');
console.log('Crecimiento de ingresos:', revenueGrowth.toFixed(1) + '%');
console.log('Punto de equilibrio:', breakeven);

// Verificar los elementos del DOM
console.log('Verificando elementos del DOM...');
const grossMarginElement = document.getElementById('grossMargin');
const revenueGrowthElement = document.getElementById('revenueGrowth');
const breakevenElement = document.getElementById('breakeven');

console.log('Elemento grossMargin:', grossMarginElement ? `Encontrado (${grossMarginElement.textContent})` : 'No encontrado');
console.log('Elemento revenueGrowth:', revenueGrowthElement ? `Encontrado (${revenueGrowthElement.textContent})` : 'No encontrado');
console.log('Elemento breakeven:', breakevenElement ? `Encontrado (${breakevenElement.textContent})` : 'No encontrado');

// Llamar a la función calculateKPIs
console.log('Llamando a la función calculateKPIs...');
if (typeof calculateKPIs === 'function') {
  try {
    calculateKPIs();
    console.log('Función calculateKPIs ejecutada correctamente');
  } catch (error) {
    console.error('Error al ejecutar calculateKPIs:', error);
  }
} else {
  console.error('La función calculateKPIs no está definida');
}

console.log('Depuración de KPIs completada');
