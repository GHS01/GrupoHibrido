// Inicialización de la aplicación con soporte para Supabase
import { initSupabaseIntegration, isUsingSupabase } from './supabaseIntegration.js';

// Función para inicializar la aplicación
export async function initializeApp() {
  try {
    console.log('Inicializando aplicación...');
    
    // Inicializar IndexedDB
    await openDatabase();
    
    // Verificar si se debe usar Supabase
    const useSupabase = await initSupabaseIntegration();
    
    if (useSupabase) {
      console.log('Usando Supabase como base de datos');
    } else {
      console.log('Usando IndexedDB como base de datos');
      
      // Cargar datos de IndexedDB
      await loadDataFromIndexedDB();
    }
    
    // Inicializar la interfaz de usuario
    initializeUI();
    
    console.log('Aplicación inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    return false;
  }
}

// Función para cargar datos de IndexedDB
async function loadDataFromIndexedDB() {
  try {
    // Obtener el ID de usuario de la sesión
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;
    
    // Cargar transacciones
    const allTransactions = await getAllFromDb('transactions');
    window.transactions = allTransactions.filter(t => t.userId === userId);
    
    // Cargar categorías
    const allCategories = await getAllFromDb('categories');
    window.categories = allCategories;
    
    // Cargar ahorros
    const allSavings = await getAllFromDb('savings');
    const userSavings = allSavings.find(s => s.userId === userId);
    
    if (userSavings) {
      window.savingsBalance = userSavings.balance;
      window.savingsHistory = userSavings.history;
    } else {
      window.savingsBalance = 0;
      window.savingsHistory = [];
    }
  } catch (error) {
    console.error('Error al cargar datos de IndexedDB:', error);
  }
}

// Función para inicializar la interfaz de usuario
function initializeUI() {
  // Inicializar gráficos
  initializeCharts();
  
  // Inicializar formularios
  initializeForms();
  
  // Inicializar filtros
  initializeFilters();
  
  // Actualizar dashboard
  updateDashboard();
}

// Función para obtener la configuración de Supabase
export async function getSupabaseConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    return {
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey
    };
  } catch (error) {
    console.error('Error al obtener la configuración de Supabase:', error);
    return null;
  }
}
