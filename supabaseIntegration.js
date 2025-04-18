// Integración de Supabase en la aplicación
import { supabase } from './supabaseClient.js';
import * as supabaseService from './supabaseService.js';
import { addMigrationButton } from './migrationUI.js';

// Variable para controlar si se usa Supabase o IndexedDB
let useSupabase = false;

// Función para inicializar la integración con Supabase
export async function initSupabaseIntegration() {
  try {
    // Verificar si el usuario ha migrado a Supabase
    const hasMigrated = localStorage.getItem('useSupabase') === 'true';
    
    if (hasMigrated) {
      useSupabase = true;
      console.log('Usando Supabase como base de datos');
      
      // Verificar si hay una sesión activa
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Hay una sesión activa, cargar los datos del usuario
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Obtener el perfil del usuario
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (error) {
            console.error('Error al obtener el perfil del usuario:', error);
            return false;
          }
          
          // Guardar el ID del usuario en sessionStorage para mantener compatibilidad
          sessionStorage.setItem('userId', user.id);
          sessionStorage.setItem('isAdmin', profile.is_admin);
          
          // Mostrar la interfaz principal
          document.getElementById('loginSection').style.display = 'none';
          document.querySelector('.navbar').style.display = 'flex';
          document.getElementById('content').style.display = 'block';
          
          // Cargar los datos del usuario
          await loadUserData(user.id);
          
          return true;
        }
      }
      
      // No hay sesión activa, mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';
      
      return false;
    } else {
      // No ha migrado, usar IndexedDB y mostrar el botón de migración
      useSupabase = false;
      console.log('Usando IndexedDB como base de datos');
      
      // Agregar el botón de migración a la sección de configuración
      setTimeout(() => {
        addMigrationButton();
      }, 1000);
      
      return false;
    }
  } catch (error) {
    console.error('Error al inicializar la integración con Supabase:', error);
    return false;
  }
}

// Función para verificar si se está usando Supabase
export function isUsingSupabase() {
  return useSupabase;
}

// Función para activar el uso de Supabase
export function enableSupabase() {
  useSupabase = true;
  localStorage.setItem('useSupabase', 'true');
}

// Función para desactivar el uso de Supabase
export function disableSupabase() {
  useSupabase = false;
  localStorage.removeItem('useSupabase');
}

// Funciones de autenticación
export async function registerUser(username, email, password, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  if (useSupabase) {
    return await supabaseService.signUp(email, password, username, isAdmin, teamId, teamName, teamCode);
  } else {
    // Usar la función original de IndexedDB
    return await window.registerUser(username, password);
  }
}

export async function loginUser(email, password) {
  if (useSupabase) {
    const result = await supabaseService.signIn(email, password);
    
    if (result.user) {
      // Guardar el ID del usuario en sessionStorage para mantener compatibilidad
      sessionStorage.setItem('userId', result.user.id);
      sessionStorage.setItem('isAdmin', result.profile.is_admin);
      
      // Mostrar la interfaz principal
      document.getElementById('loginSection').style.display = 'none';
      document.querySelector('.navbar').style.display = 'flex';
      document.getElementById('content').style.display = 'block';
      
      // Cargar los datos del usuario
      await loadUserData(result.user.id);
      
      return result;
    }
    
    return null;
  } else {
    // Usar la función original de IndexedDB
    return await window.loginUser(email, password);
  }
}

export async function logoutUser() {
  if (useSupabase) {
    await supabaseService.signOut();
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('isAdmin');
    
    // Mostrar la pantalla de inicio de sesión
    document.getElementById('loginSection').style.display = 'block';
    document.querySelector('.navbar').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    
    return true;
  } else {
    // Usar la función original de IndexedDB
    return await window.logout();
  }
}

// Funciones CRUD para transacciones
export async function addTransaction(transaction) {
  if (useSupabase) {
    return await supabaseService.addTransaction(transaction);
  } else {
    // Usar la función original de IndexedDB
    return await window.addToDb('transactions', transaction);
  }
}

export async function updateTransaction(transaction) {
  if (useSupabase) {
    return await supabaseService.updateTransaction(transaction);
  } else {
    // Usar la función original de IndexedDB
    return await window.putToDb('transactions', transaction);
  }
}

export async function deleteTransaction(id) {
  if (useSupabase) {
    return await supabaseService.deleteTransaction(id);
  } else {
    // Usar la función original de IndexedDB
    return await window.deleteFromDb('transactions', id);
  }
}

export async function getUserTransactions() {
  if (useSupabase) {
    return await supabaseService.getUserTransactions();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allTransactions = await window.getAllFromDb('transactions');
    return allTransactions.filter(t => t.userId === userId);
  }
}

// Funciones CRUD para categorías
export async function addCategory(category) {
  if (useSupabase) {
    return await supabaseService.addCategory(category);
  } else {
    // Usar la función original de IndexedDB
    return await window.addToDb('categories', category);
  }
}

export async function updateCategory(category) {
  if (useSupabase) {
    return await supabaseService.updateCategory(category);
  } else {
    // Usar la función original de IndexedDB
    return await window.putToDb('categories', category);
  }
}

export async function deleteCategory(name) {
  if (useSupabase) {
    return await supabaseService.deleteCategory(name);
  } else {
    // Usar la función original de IndexedDB
    return await window.deleteFromDb('categories', name);
  }
}

export async function getAllCategories() {
  if (useSupabase) {
    return await supabaseService.getAllCategories();
  } else {
    // Usar la función original de IndexedDB
    return await window.getAllFromDb('categories');
  }
}

// Funciones para ahorros
export async function getUserSavings() {
  if (useSupabase) {
    return await supabaseService.getUserSavings();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allSavings = await window.getAllFromDb('savings');
    return allSavings.find(s => s.userId === userId) || { balance: 0, history: [] };
  }
}

export async function updateSavingsBalance(balance) {
  if (useSupabase) {
    return await supabaseService.updateSavingsBalance(balance);
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const savingsEntry = {
      date: new Date().toISOString().split('T')[0],
      type: 'Saldo Inicial',
      description: 'Configuración de saldo inicial',
      amount: balance,
      balance: balance,
      userId: userId
    };
    
    const savingsData = {
      id: Date.now(),
      balance: balance,
      history: [savingsEntry],
      userId: userId
    };
    
    return await window.putToDb('savings', savingsData);
  }
}

export async function getSavingsHistory() {
  if (useSupabase) {
    return await supabaseService.getSavingsHistory();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allSavings = await window.getAllFromDb('savings');
    const userSavings = allSavings.find(s => s.userId === userId);
    return userSavings ? userSavings.history : [];
  }
}

// Funciones para usuarios
export async function getAllUsers() {
  if (useSupabase) {
    return await supabaseService.getAllUsers();
  } else {
    // Usar la función original de IndexedDB
    return await window.getAllFromDb('users');
  }
}

// Función para cargar los datos del usuario
async function loadUserData(userId) {
  if (useSupabase) {
    // Obtener el perfil del usuario
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      return;
    }
    
    // Actualizar la interfaz con los datos del usuario
    document.getElementById('profileUsername').textContent = profile.username;
    const adminBadge = profile.is_admin ? '<span class="admin-badge"><span class="text">Administrador</span><span class="icon">🎖️</span></span>' : '<span class="admin-badge">Usuario Normal</span>';
    document.getElementById('profileUsername').innerHTML += ` ${adminBadge}`;
    
    // Mostrar información del equipo de trabajo
    const teamInfoElements = document.querySelectorAll('.team-info');
    const teamCodeSection = document.getElementById('teamCodeSection');
    
    if (profile.team_id && profile.team_name) {
      teamInfoElements.forEach(element => {
        element.textContent = profile.team_name;
      });
      
      if (profile.team_code) {
        updateTeamCodeDisplay(profile.team_code);
        
        if (teamCodeSection) {
          teamCodeSection.style.display = profile.is_admin ? 'block' : 'none';
        }
      }
    } else {
      teamInfoElements.forEach(element => {
        element.textContent = "No asignado";
      });
      
      if (teamCodeSection) {
        teamCodeSection.style.display = 'none';
      }
    }
    
    // Actualizar la interfaz de administrador
    updateAdminInterface();
    
    // Cargar transacciones, categorías y ahorros
    await loadTransactions();
    await loadCategories();
    await loadSavings();
    
    // Actualizar el dashboard
    updateDashboard();
  } else {
    // Usar la función original de IndexedDB
    return await window.loadUserData(userId);
  }
}

// Función para cargar las transacciones
async function loadTransactions() {
  if (useSupabase) {
    const transactions = await supabaseService.getUserTransactions();
    window.transactions = transactions;
  }
}

// Función para cargar las categorías
async function loadCategories() {
  if (useSupabase) {
    const categories = await supabaseService.getAllCategories();
    window.categories = categories;
  }
}

// Función para cargar los ahorros
async function loadSavings() {
  if (useSupabase) {
    const savings = await supabaseService.getUserSavings();
    window.savingsBalance = savings.balance;
    
    const history = await supabaseService.getSavingsHistory();
    window.savingsHistory = history;
  }
}

// Función para actualizar la interfaz de administrador
function updateAdminInterface() {
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
  const adminSection = document.getElementById('adminSection');
  
  if (adminSection) {
    adminSection.style.display = isAdmin ? 'block' : 'none';
  }
}

// Función para actualizar la visualización del código de equipo
function updateTeamCodeDisplay(code) {
  const teamCodeDisplay = document.getElementById('teamCodeDisplay');
  const adminTeamCodeDisplay = document.getElementById('adminTeamCodeDisplay');
  
  if (teamCodeDisplay) {
    teamCodeDisplay.textContent = code;
  }
  
  if (adminTeamCodeDisplay) {
    adminTeamCodeDisplay.textContent = code;
  }
}
