// Webhook para WhatsApp usando Evolution API
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// URL de Evolution API (configurar en variables de entorno)
// Usar URL pública en producción
const isProduction = process.env.NODE_ENV === 'production';
const EVOLUTION_API_URL = isProduction
  ? (process.env.EVOLUTION_API_URL || 'https://five-plums-bake.loca.lt') // URL pública en producción
  : 'http://localhost:8080';
const EVOLUTION_API_INSTANCE = process.env.EVOLUTION_API_INSTANCE || 'ghs';
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN || '0DC6168A59D5-416C-B4CA-9ADE525EEA5E';
const BOT_PHONE_NUMBER = '+51 997796929';

/**
 * Manejador principal para el webhook de WhatsApp
 */
module.exports = async (req, res) => {
  // Solo aceptar solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Webhook de WhatsApp recibido:', JSON.stringify(req.body));

    // Extraer datos del mensaje recibido
    const { message, from, type, instanceName } = req.body;

    // Verificar si es un mensaje de texto
    if (type !== 'text') {
      return res.status(200).json({ status: 'ignored', reason: 'not a text message' });
    }

    // Extraer número de teléfono (sin el @c.us o formato similar)
    const phoneNumber = from.split('@')[0];
    const messageText = message.text || '';

    console.log(`Mensaje recibido de ${phoneNumber}: ${messageText}`);

    // Buscar usuario por número de teléfono en Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !userData) {
      // Usuario no encontrado, enviar mensaje de error
      await sendWhatsAppMessage(phoneNumber,
        "Este número no está vinculado a ninguna cuenta. Por favor, vincule su número en la aplicación web: https://grupo-hibrid.vercel.app");
      return res.status(200).json({ status: 'success', action: 'user not found message sent' });
    }

    // Procesar comandos
    let responseMessage = '';

    if (messageText.toLowerCase().includes('balance') ||
        messageText.toLowerCase().includes('saldo') ||
        messageText.toLowerCase().includes('estado')) {
      // Obtener balance del usuario
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userData.id);

      if (transactionsError) {
        console.error('Error al obtener transacciones:', transactionsError);
        await sendWhatsAppMessage(phoneNumber, "Ocurrió un error al obtener sus datos financieros. Por favor, intente más tarde.");
        return res.status(200).json({ status: 'error', action: 'error message sent' });
      }

      // Calcular balance
      const balance = transactions.reduce((sum, t) => {
        if (t.type === 'entrada' || t.type === 'Ingreso') {
          return sum + parseFloat(t.amount || 0);
        } else if (t.type === 'saida' || t.type === 'Gasto') {
          return sum - parseFloat(t.amount || 0);
        }
        return sum;
      }, 0);

      // Obtener ahorros
      const { data: savings, error: savingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      const savingsBalance = savings ? parseFloat(savings.balance) : 0;

      responseMessage = `Hola ${userData.username},\n\n*Estado Financiero Actual*\n\n`;
      responseMessage += `💰 *Balance:* S/. ${balance.toFixed(2)}\n`;
      responseMessage += `🏦 *Ahorros:* S/. ${savingsBalance.toFixed(2)}\n\n`;
      responseMessage += `Para más detalles, puede consultar:\n- gastos\n- ingresos\n- ahorros`;
    }
    else if (messageText.toLowerCase().includes('gasto') || messageText.toLowerCase().includes('gastos')) {
      // Obtener gastos del mes actual
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const { data: expenses, error: expensesError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userData.id)
        .in('type', ['saida', 'Gasto'])
        .ilike('date', `${currentMonthStr}%`)
        .order('date', { ascending: false });

      if (expensesError) {
        console.error('Error al obtener gastos:', expensesError);
        await sendWhatsAppMessage(phoneNumber, "Ocurrió un error al obtener sus gastos. Por favor, intente más tarde.");
        return res.status(200).json({ status: 'error', action: 'error message sent' });
      }

      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

      responseMessage = `Hola ${userData.username},\n\n*Gastos del Mes Actual*\n\n`;
      responseMessage += `💸 *Total:* S/. ${totalExpenses.toFixed(2)}\n\n`;

      // Mostrar los últimos 5 gastos
      if (expenses.length > 0) {
        responseMessage += `*Últimos gastos:*\n`;
        const recentExpenses = expenses.slice(0, 5);
        recentExpenses.forEach(exp => {
          responseMessage += `- ${exp.description || 'Sin descripción'}: S/. ${parseFloat(exp.amount).toFixed(2)} (${exp.date})\n`;
        });
      } else {
        responseMessage += `No tienes gastos registrados este mes.`;
      }
    }
    else if (messageText.toLowerCase().includes('ingreso') || messageText.toLowerCase().includes('ingresos')) {
      // Obtener ingresos del mes actual
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const { data: incomes, error: incomesError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userData.id)
        .in('type', ['entrada', 'Ingreso'])
        .ilike('date', `${currentMonthStr}%`)
        .order('date', { ascending: false });

      if (incomesError) {
        console.error('Error al obtener ingresos:', incomesError);
        await sendWhatsAppMessage(phoneNumber, "Ocurrió un error al obtener sus ingresos. Por favor, intente más tarde.");
        return res.status(200).json({ status: 'error', action: 'error message sent' });
      }

      const totalIncomes = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);

      responseMessage = `Hola ${userData.username},\n\n*Ingresos del Mes Actual*\n\n`;
      responseMessage += `💵 *Total:* S/. ${totalIncomes.toFixed(2)}\n\n`;

      // Mostrar los últimos 5 ingresos
      if (incomes.length > 0) {
        responseMessage += `*Últimos ingresos:*\n`;
        const recentIncomes = incomes.slice(0, 5);
        recentIncomes.forEach(inc => {
          responseMessage += `- ${inc.description || 'Sin descripción'}: S/. ${parseFloat(inc.amount).toFixed(2)} (${inc.date})\n`;
        });
      } else {
        responseMessage += `No tienes ingresos registrados este mes.`;
      }
    }
    else if (messageText.toLowerCase().includes('ahorro') || messageText.toLowerCase().includes('ahorros')) {
      // Obtener ahorros
      const { data: savings, error: savingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      if (savingsError && savingsError.code !== 'PGRST116') {
        console.error('Error al obtener ahorros:', savingsError);
        await sendWhatsAppMessage(phoneNumber, "Ocurrió un error al obtener sus ahorros. Por favor, intente más tarde.");
        return res.status(200).json({ status: 'error', action: 'error message sent' });
      }

      if (savings) {
        responseMessage = `Hola ${userData.username},\n\n*Información de Ahorros*\n\n`;
        responseMessage += `🏦 *Saldo actual:* S/. ${parseFloat(savings.balance).toFixed(2)}\n\n`;

        // Obtener historial de ahorros
        const { data: history, error: historyError } = await supabase
          .from('savings_history')
          .select('*')
          .eq('user_id', userData.id)
          .order('date', { ascending: false })
          .limit(5);

        if (!historyError && history && history.length > 0) {
          responseMessage += `*Últimos movimientos:*\n`;
          history.forEach(h => {
            const type = parseFloat(h.amount) >= 0 ? '➕' : '➖';
            responseMessage += `- ${type} S/. ${Math.abs(parseFloat(h.amount)).toFixed(2)} (${h.date})\n`;
          });
        }
      } else {
        responseMessage = `Hola ${userData.username},\n\nNo tienes ahorros registrados.`;
      }
    }
    else {
      // Comando no reconocido
      responseMessage = `Hola ${userData.username},\n\nPuedes consultar tu información financiera con estos comandos:\n\n`;
      responseMessage += `- *balance* o *saldo*: Ver tu estado financiero general\n`;
      responseMessage += `- *gastos*: Ver tus gastos del mes actual\n`;
      responseMessage += `- *ingresos*: Ver tus ingresos del mes actual\n`;
      responseMessage += `- *ahorros*: Ver tu saldo de ahorros y movimientos\n\n`;
      responseMessage += `Para más detalles, visita la aplicación web: https://grupo-hibrid.vercel.app`;
    }

    // Enviar respuesta
    await sendWhatsAppMessage(phoneNumber, responseMessage);

    return res.status(200).json({ status: 'success', action: 'response sent' });
  } catch (error) {
    console.error('Error procesando webhook de WhatsApp:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

/**
 * Función para enviar mensajes a través de Evolution API
 */
async function sendWhatsAppMessage(phoneNumber, text) {
  try {
    // Según la documentación de Evolution API v2, el endpoint correcto es:
    // /message/sendText/{instance}
    const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_API_INSTANCE}`;

    // Asegurarse de que el número tenga el formato correcto (con código de país)
    if (!phoneNumber.includes('@')) {
      // Si no tiene @c.us, asumimos que es solo el número y lo formateamos
      if (!phoneNumber.includes('+')) {
        // Si no tiene +, asumimos que necesita el código de país
        phoneNumber = `+${phoneNumber}`;
      }
      // Añadir el sufijo @s.whatsapp.net que requiere WhatsApp
      phoneNumber = `${phoneNumber}@s.whatsapp.net`;
    }

    console.log(`Webhook - Enviando mensaje a: ${phoneNumber}`);
    console.log(`Webhook - URL de la API: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: text,
        delay: 1200
      })
    });

    // Registrar la respuesta completa para depuración
    console.log(`Webhook - Respuesta de Evolution API - Status: ${response.status}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'No se pudo parsear la respuesta de error' };
      }
      console.error('Webhook - Error en la respuesta de Evolution API:', errorData);
      throw new Error(`Error en Evolution API: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('Webhook - Respuesta exitosa de Evolution API:', responseData);
    return responseData;
  } catch (error) {
    console.error('Webhook - Error enviando mensaje de WhatsApp:', error);
    throw error;
  }
}
