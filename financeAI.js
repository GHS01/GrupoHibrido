// User financial data access for AI assistant
function getUserFinancialData() {
  const userId = sessionStorage.getItem('userId');
  if (!userId) return null;

  // Verificar si estamos usando Supabase o IndexedDB
  const isUsingSupabase = typeof window.supabaseIntegration !== 'undefined' &&
                         typeof window.supabaseIntegration.isUsingSupabase === 'function' &&
                         window.supabaseIntegration.isUsingSupabase();

  // Verificar si window.transactions existe
  if (!window.transactions || !Array.isArray(window.transactions)) {
    // Solo mostrar error en modo debug
    if (window.location.href.includes('debug=true')) {
      console.error('getUserFinancialData - Error: window.transactions no está definido o no es un array');
      console.log('window.transactions:', window.transactions);
    }
    return null;
  }

  // Get user transactions (compatible con ambos modos)
  // NOTA: En Supabase, las transacciones ya están transformadas a camelCase (userId en lugar de user_id)
  // Pero necesitamos considerar ambos formatos para mayor compatibilidad
  const userTransactions = window.transactions.filter(t => t.userId === userId || t.user_id === userId);

  // Calculate common financial metrics - asegurar que los valores sean numéricos
  const totalBalance = userTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  // Get current month and year using moment.js
  const currentMonthYear = moment().format('YYYY-MM');

  // Current month data - considerar ambos tipos (entrada/Ingreso y saida/Gasto)
  const currentMonthRevenue = userTransactions.filter(t =>
    (t.type === 'entrada' || t.type === 'Ingreso') &&
    t.date && t.date.startsWith(currentMonthYear)
  ).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const currentMonthExpenses = userTransactions.filter(t =>
    (t.type === 'saida' || t.type === 'Gasto') &&
    t.date && t.date.startsWith(currentMonthYear)
  ).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

  // En Supabase, la propiedad es cost_type, en IndexedDB es costType
  // Considerar ambos tipos de transacciones 'saida' y 'Gasto'
  const currentMonthFixedCosts = userTransactions.filter(t => {
    // Verificar ambos formatos de propiedad (cost_type y costType)
    const costType = t.cost_type || t.costType;
    // Verificar ambos tipos de transacciones (saida y Gasto)
    return (t.type === 'saida' || t.type === 'Gasto') &&
           costType === 'fijo' &&
           t.date && t.date.startsWith(currentMonthYear);
  }).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

  const currentMonthVariableCosts = userTransactions.filter(t => {
    // Verificar ambos formatos de propiedad (cost_type y costType)
    const costType = t.cost_type || t.costType;
    // Verificar ambos tipos de transacciones (saida y Gasto)
    return (t.type === 'saida' || t.type === 'Gasto') &&
           costType === 'variable' &&
           t.date && t.date.startsWith(currentMonthYear);
  }).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

  // Last month data - considerar ambos tipos (entrada/Ingreso y saida/Gasto)
  const lastMonthDate = moment().subtract(1, 'month');
  const lastMonthYear = lastMonthDate.format('YYYY-MM');

  const lastMonthRevenue = userTransactions.filter(t =>
    (t.type === 'entrada' || t.type === 'Ingreso') &&
    t.date && t.date.startsWith(lastMonthYear)
  ).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const lastMonthExpenses = userTransactions.filter(t =>
    (t.type === 'saida' || t.type === 'Gasto') &&
    t.date && t.date.startsWith(lastMonthYear)
  ).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

  // KPIs
  const currentGrossMargin = currentMonthRevenue > 0
    ? (currentMonthRevenue - currentMonthExpenses) / currentMonthRevenue * 100
    : 0;

  const revenueGrowth = lastMonthRevenue > 0
    ? (currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100
    : 0;

  // Top expense categories - considerar ambos tipos (saida/Gasto)
  const expensesByCategory = userTransactions
    .filter(t => (t.type === 'saida' || t.type === 'Gasto') &&
                t.date && t.date.startsWith(currentMonthYear))
    .reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = 0;
      acc[t.category] += Math.abs(parseFloat(t.amount || 0));
      return acc;
    }, {});

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Savings data - Obtener el nombre de usuario del elemento en la página
  const username = document.getElementById('profileUsername').textContent.split(' ')[0];

  // Obtener el saldo de ahorros desde la variable global window.savingsBalance
  // Esta variable se establece tanto en modo IndexedDB como en modo Supabase
  const savingsBalance = typeof window.savingsBalance !== 'undefined' ? window.savingsBalance : 0;

  // Imprimir información de depuración en la consola
  console.log('getUserFinancialData - Información de depuración:');
  console.log('- isUsingSupabase:', isUsingSupabase);
  console.log('- userId:', userId);
  console.log('- userTransactions:', userTransactions.length);
  console.log('- currentMonthFixedCosts:', currentMonthFixedCosts);
  console.log('- currentMonthVariableCosts:', currentMonthVariableCosts);
  console.log('- window.savingsBalance:', window.savingsBalance);
  console.log('- savingsBalance (local):', savingsBalance);

  // Mostrar detalles de las transacciones de costos fijos para depuración
  if (window.location.href.includes('debug=true')) {
    console.log('Detalle de transacciones de costos fijos:');
    userTransactions.filter(t => {
      const costType = t.cost_type || t.costType;
      return (t.type === 'saida' || t.type === 'Gasto') &&
             costType === 'fijo' &&
             t.date && t.date.startsWith(currentMonthYear);
    }).forEach((t, i) => {
      console.log(`Transacción ${i+1}:`, {
        id: t.id,
        type: t.type,
        costType: t.costType || t.cost_type,
        amount: t.amount,
        date: t.date,
        category: t.category
      });
    });
  }

  // Función para formatear números con separadores de miles
  const formatNumber = (num) => {
    return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return {
    username,
    totalBalance,
    savingsBalance,
    currentMonthRevenue,
    currentMonthExpenses,
    currentMonthFixedCosts,
    currentMonthVariableCosts,
    currentGrossMargin,
    revenueGrowth,
    topExpenseCategories,
    formatNumber
  };
}

// Función para recargar datos desde Supabase
async function reloadDataFromSupabase() {
  // Verificar si estamos usando Supabase
  const isUsingSupabase = typeof window.supabaseIntegration !== 'undefined' &&
                         typeof window.supabaseIntegration.isUsingSupabase === 'function' &&
                         window.supabaseIntegration.isUsingSupabase();

  // Solo mostrar logs en modo debug
  const isDebugMode = window.location.href.includes('debug=true');

  if (isDebugMode) {
    console.log('reloadDataFromSupabase - ¿Está usando Supabase?', isUsingSupabase);
  }

  if (!isUsingSupabase) {
    if (isDebugMode) {
      console.log('No se está usando Supabase, no se recargan los datos');
    }
    return false;
  }

  try {
    if (isDebugMode) {
      console.log('Recargando datos desde Supabase...');
    }

    // Intentar usar la función refreshData de supabaseService
    if (typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.refreshData === 'function') {
      if (isDebugMode) {
        console.log('Usando window.supabaseService.refreshData()');
      }
      const result = await window.supabaseService.refreshData();
      return true;
    }
    // Intentar usar la función refreshData de realtimeSync
    else if (typeof window.realtimeSync !== 'undefined' && typeof window.realtimeSync.refreshData === 'function') {
      if (isDebugMode) {
        console.log('Usando window.realtimeSync.refreshData()');
      }
      const result = await window.realtimeSync.refreshData();
      return true;
    }
    // Intentar cargar los datos directamente
    else if (typeof window.supabaseClient !== 'undefined' || typeof window.getSupabaseClient === 'function') {
      if (isDebugMode) {
        console.log('Intentando cargar datos directamente desde Supabase');
      }

      // Obtener el cliente de Supabase
      const supabase = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabaseClient;

      if (!supabase) {
        if (isDebugMode) {
          console.error('Cliente de Supabase no disponible');
        }
        return false;
      }

      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isDebugMode) {
          console.warn('No hay usuario autenticado');
        }
        return false;
      }

      // Cargar transacciones
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (transactionsError) {
        if (isDebugMode) {
          console.error('Error al cargar transacciones:', transactionsError);
        }
      } else {
        // Convertir de snake_case a camelCase
        window.transactions = transactions.map(t => ({
          id: t.id,
          userId: t.user_id,
          type: t.type,
          costType: t.cost_type,
          amount: t.amount,
          category: t.category,
          date: t.date,
          description: t.description
        }));
      }

      // Cargar ahorros
      const { data: savings, error: savingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (savingsError) {
        if (isDebugMode) {
          console.error('Error al cargar ahorros:', savingsError);
        }
      } else if (savings) {
        window.savingsBalance = savings.balance;
      }

      return true;
    } else {
      if (isDebugMode) {
        console.warn('No se encontró ninguna función para recargar datos');
      }
      return false;
    }
  } catch (error) {
    console.error('Error al recargar datos desde Supabase:', error);
    return false;
  }
}

function toggleChatbot() {
  const chatbot = document.getElementById('finance-chatbot');
  const whatsappBubble = document.querySelector('.whatsapp-bubble');

  if (chatbot.classList.contains('show')) {
    chatbot.classList.remove('show');
    // Mostrar la burbuja de WhatsApp cuando se cierra el chatbot
    if (whatsappBubble) {
      whatsappBubble.style.display = 'flex';
    }
  } else {
    chatbot.classList.add('show');
    document.getElementById('user-input').focus();

    // Ocultar la burbuja de WhatsApp cuando se abre el chatbot
    if (whatsappBubble) {
      whatsappBubble.style.display = 'none';
    }

    // Recargar datos desde Supabase antes de mostrar el mensaje de bienvenida
    reloadDataFromSupabase().then(() => {
      // Show welcome message if this is the first time opening the chat
      if (conversationHistory.length === 0) {
        showWelcomeMessage();
      }
    });
  }
}

// Function to display welcome message with options
function showWelcomeMessage() {
  const userData = getUserFinancialData();
  const username = userData ? userData.username : 'estimado usuario';

  const welcomeMessage = `<h3>¡Hola ${username}!</h3>
  <p>Soy Neutro, tu asistente personal de finanzas. Estoy aquí para ayudarte con cualquier consulta financiera o contable que tengas.</p>
  <p>¿En qué puedo ayudarte hoy?</p>
  <div class="chatbot-options">
    <button class="chatbot-option-btn" onclick="selectOption('resumen financiero')">Resumen financiero</button>
    <button class="chatbot-option-btn" onclick="selectOption('consejos de ahorro')">Consejos de ahorro</button>
    <button class="chatbot-option-btn" onclick="selectOption('análisis de gastos')">Análisis de gastos</button>
  </div>`;

  // Remove any existing bot messages
  const messagesContainer = document.getElementById('chatbot-messages');
  messagesContainer.innerHTML = '';

  // Add the welcome message
  addMessageToChat(welcomeMessage, 'bot');
}

// Function to handle option selection
function selectOption(option) {
  // Add the selected option as a user message
  addMessageToChat(option, 'user');

  // Add the option to conversation history
  conversationHistory.push({
    role: "user",
    content: option
  });

  // Process the selected option
  processUserMessage(option);
}

// Function to process user message after option selection
async function processUserMessage(message) {
  // Show thinking animation
  const thinkingId = addThinkingAnimation();

  try {
    // Recargar datos desde Supabase antes de procesar el mensaje
    await reloadDataFromSupabase();

    // Get user financial data if available
    const financialData = getUserFinancialData();

    // Build system message with financial context
    let systemMessage = "Eres 'Neutro', un asistente financiero profesional especializado en finanzas y contabilidad. Tu nombre es Neutro y debes responder de manera amigable y profesional. Responde solo a preguntas relacionadas con temas financieros, contables, inversiones, ahorro, impuestos y temas relacionados. Si te preguntan sobre otros temas, indica amablemente que solo puedes ayudar con temas de finanzas y contabilidad. Mantén tus respuestas organizadas con títulos (h2, h3), listas numeradas para procesos (ol, li), viñetas para puntos importantes (ul, li), y párrafos bien estructurados. Usa HTML básico para formatear tus respuestas: <h2>, <h3>, <ul>, <li>, <ol>, <strong>, <p>. Utiliza subtítulos para secciones como 'Consejos:' o 'Recomendaciones:'. Sé conciso pero informativo, en un tono profesional y útil.";

    systemMessage += "\n\nMuy importante: No repitas saludos ni presentaciones en cada respuesta. No incluyas '¡Hola [nombre]! Soy Neutro, tu asistente financiero' en cada mensaje, excepto en el primer mensaje o cuando te pregunten específicamente quién eres. Para el resto de interacciones, responde directamente al tema sin repetir tu presentación.";

    systemMessage += "\n\nEstá totalmente prohibido recomendar o sugerir el uso de aplicaciones financieras o de contabilidad externas. No menciones nombres de aplicaciones específicas ni sugieras buscar herramientas externas. Enfócate en dar consejos y sugerencias que el usuario pueda implementar directamente.";

    // Add financial context if available
    if (financialData) {
      const revenueGrowthColor = getValueColorClass(financialData.revenueGrowth);
      const grossMarginColor = getValueColorClass(financialData.currentGrossMargin);
      const balanceColor = getValueColorClass(financialData.totalBalance, true);
      const savingsColor = getValueColorClass(financialData.savingsBalance, true);
      const revenueColor = getValueColorClass(financialData.currentMonthRevenue, true);
      const expensesColor = getValueColorClass(-financialData.currentMonthExpenses, true); // Negative because lower expenses are better
      const fixedCostsColor = getValueColorClass(-financialData.currentMonthFixedCosts, true); // Negative because lower costs are better
      const variableCostsColor = getValueColorClass(-financialData.currentMonthVariableCosts, true); // Negative because lower costs are better

      systemMessage += `\n\nInformación financiera del usuario:\nNombre: ${financialData.username}`;
      systemMessage += `\nBalance total: <span class="${balanceColor}">S/. ${financialData.formatNumber(financialData.totalBalance)}</span>`;
      systemMessage += `\nSaldo de ahorros: <span class="${savingsColor}">S/. ${financialData.formatNumber(financialData.savingsBalance)}</span>`;
      systemMessage += `\nIngresos del mes actual: <span class="${revenueColor}">S/. ${financialData.formatNumber(financialData.currentMonthRevenue)}</span>`;
      systemMessage += `\nGastos del mes actual: <span class="${expensesColor}">S/. ${financialData.formatNumber(financialData.currentMonthExpenses)}</span>`;
      systemMessage += `\nCostos fijos del mes: <span class="${fixedCostsColor}">S/. ${financialData.formatNumber(financialData.currentMonthFixedCosts)}</span>`;
      systemMessage += `\nCostos variables del mes: <span class="${variableCostsColor}">S/. ${financialData.formatNumber(financialData.currentMonthVariableCosts)}</span>`;
      systemMessage += `\nMargen bruto: <span class="${grossMarginColor}">${financialData.currentGrossMargin.toFixed(1)}%</span>`;
      systemMessage += `\nCrecimiento de ingresos: <span class="${revenueGrowthColor}">${financialData.revenueGrowth.toFixed(1)}%</span>`;

      if (financialData.topExpenseCategories.length > 0) {
        systemMessage += "\n\nCategorías de gastos principales:";
        financialData.topExpenseCategories.forEach(([category, amount]) => {
          systemMessage += `\n- ${category}: S/. ${financialData.formatNumber(amount)}`;
        });
      }
    }

    // Only keep the last 10 messages to manage context window
    const recentMessages = conversationHistory.slice(-10);

    // Call the AI model through our server API
    const response = await fetch('api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          ...recentMessages
        ]
      })
    });

    const completion = await response.json();

    // Remove thinking animation
    removeThinkingAnimation(thinkingId);

    // Add AI response to the chat
    let botResponse = completion.content;

    // Limpiar cualquier prefijo de formato que pueda estar causando problemas
    botResponse = botResponse.replace(/^```html\s*/i, '');
    botResponse = botResponse.replace(/^```\s*/i, '');
    botResponse = botResponse.replace(/\s*```$/i, '');
    botResponse = botResponse.replace(/^\d+px;">/i, '');

    // Process the response to apply color formatting
    if (financialData) {
      botResponse = applyFinancialColorsToResponse(botResponse, financialData);
    }

    addMessageToChat(botResponse, 'bot');

    // Add AI response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: botResponse
    });

  } catch (error) {
    console.error('Error al obtener respuesta del asistente:', error);
    removeThinkingAnimation(thinkingId);
    addMessageToChat('Lo siento, tuve un problema al procesar tu pregunta. Por favor, intenta de nuevo.', 'bot');
  }
}

// Function to determine color class based on value trend
function getValueColorClass(value, isAbsoluteValue = false) {
  if (isAbsoluteValue) {
    // For absolute values like balances, revenue, etc.
    if (value === 0) return 'financial-neutral';
    return value > 0 ? 'financial-positive' : 'financial-negative';
  } else {
    // For comparative values like growth rates, margins
    if (Math.abs(value) < 0.5) return 'financial-neutral'; // Near zero or minimal change
    return value > 0 ? 'financial-positive' : 'financial-negative';
  }
}

// Function to apply color formatting to financial values in the response
function applyFinancialColorsToResponse(response, financialData) {
  // Apply colors to balance total
  response = response.replace(
    /Balance total:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(numValue, true);
      return `Balance total: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to savings
  response = response.replace(
    /Saldo de ahorros:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(numValue, true);
      return `Saldo de ahorros: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to monthly income
  response = response.replace(
    /Ingresos del mes actual:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(numValue, true);
      return `Ingresos del mes actual: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to monthly expenses
  response = response.replace(
    /Gastos del mes actual:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(-numValue, true); // Negative as lower expenses are better
      return `Gastos del mes actual: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to fixed costs
  response = response.replace(
    /Costos fijos del mes:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(-numValue, true); // Negative as lower costs are better
      return `Costos fijos del mes: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to variable costs
  response = response.replace(
    /Costos variables del mes:?\s*S\/\.\s*([\d,\.]+)/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(-numValue, true); // Negative as lower costs are better
      return `Costos variables del mes: <span class="${colorClass}">S/. ${value}</span>`;
    }
  );

  // Apply colors to gross margin
  response = response.replace(
    /Margen bruto:?\s*([\d,\.]+)%/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(numValue);
      return `Margen bruto: <span class="${colorClass}">${value}%</span>`;
    }
  );

  // Apply colors to revenue growth
  response = response.replace(
    /Crecimiento de ingresos:?\s*([\d,\.]+)%/gi,
    (match, value) => {
      const numValue = parseFloat(value.replace(/,/g, ''));
      const colorClass = getValueColorClass(numValue);
      return `Crecimiento de ingresos: <span class="${colorClass}">${value}%</span>`;
    }
  );

  return response;
}

// Modify the existing sendMessage function
async function sendMessage() {
  const userInput = document.getElementById('user-input');
  const message = userInput.value.trim();

  if (message === '') return;

  // Add user message to the chat
  addMessageToChat(message, 'user');
  userInput.value = '';

  // Add the user message to the conversation history
  conversationHistory.push({
    role: "user",
    content: message
  });

  // Recargar datos desde Supabase antes de procesar el mensaje
  await reloadDataFromSupabase();

  // Process the user message
  await processUserMessage(message);
}

function getFinancialInsights() {
  const data = getUserFinancialData();
  if (!data) return null;

  const insights = [];

  // Balance insights
  if (data.totalBalance < 0) {
    insights.push("Tu balance total es negativo. Considera revisar tus gastos y establecer un plan para reducir deudas.");
  } else if (data.totalBalance < data.currentMonthExpenses) {
    insights.push("Tu balance total es menor que tus gastos mensuales. Esto podría indicar un riesgo de liquidez.");
  }

  // Revenue vs Expenses
  if (data.currentMonthExpenses > data.currentMonthRevenue) {
    insights.push("Tus gastos son mayores que tus ingresos este mes. Esto puede llevar a problemas financieros si continúa.");
  }

  // Gross margin
  if (data.currentGrossMargin < 15) {
    insights.push("Tu margen bruto está por debajo del 15%, lo cual es bajo para la mayoría de los negocios.");
  }

  // Expense distribution
  if (data.currentMonthFixedCosts > data.currentMonthRevenue * 0.5) {
    insights.push("Tus costos fijos representan más del 50% de tus ingresos, lo que puede limitar tu flexibilidad financiera.");
  }

  return insights;
}

function generateFinancialRecommendations() {
  const data = getUserFinancialData();
  if (!data) return null;

  const recommendations = [];

  // Income-based recommendations
  if (data.revenueGrowth < 0) {
    recommendations.push("Busca diversificar tus fuentes de ingresos ya que has experimentado una disminución en ingresos.");
  }

  // Expense-based recommendations
  if (data.currentMonthVariableCosts > data.currentMonthRevenue * 0.3) {
    recommendations.push("Considera revisar tus gastos variables que representan más del 30% de tus ingresos.");
  }

  // Saving recommendations
  if (data.savingsBalance < data.currentMonthExpenses * 3) {
    recommendations.push("Intenta aumentar tus ahorros para tener un fondo de emergencia equivalente a 3-6 meses de gastos.");
  }

  return recommendations;
}

// Exponer funciones globalmente para depuración
window.reloadDataFromSupabase = reloadDataFromSupabase;
window.getUserFinancialData = getUserFinancialData;