// Script para probar la migración de IndexedDB a Supabase
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Configuración de Supabase
const supabaseUrl = 'https://dtptlcnrjksepidiyeku.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Datos de prueba para la migración
const testData = {
  users: [
    {
      id: uuidv4(),
      username: 'usuario_prueba4',
      email: 'usuario_prueba4@example.com',
      password: 'password123',
      isAdmin: true,
      teamId: null,
      teamName: null,
      teamCode: null
    }
  ],
  teams: [
    {
      id: uuidv4(),
      name: 'Equipo de Prueba',
      code: 'EQUI-5678',
      password: 'password123',
      createdBy: 'usuario_prueba4@example.com'
    }
  ],
  categories: [
    {
      name: 'Alimentación',
      color: '#FF5733'
    },
    {
      name: 'Transporte',
      color: '#33FF57'
    },
    {
      name: 'Vivienda',
      color: '#3357FF'
    },
    {
      name: 'Entretenimiento',
      color: '#F3FF33'
    }
  ],
  transactions: [
    {
      id: uuidv4(),
      userId: null, // Se asignará después
      type: 'entrada',
      costType: 'fijo',
      amount: 1000,
      category: 'Salario',
      date: new Date().toISOString().split('T')[0],
      description: 'Salario mensual'
    },
    {
      id: uuidv4(),
      userId: null, // Se asignará después
      type: 'saida',
      costType: 'variable',
      amount: 200,
      category: 'Alimentación',
      date: new Date().toISOString().split('T')[0],
      description: 'Compra semanal'
    }
  ],
  savings: [
    {
      id: uuidv4(),
      userId: null, // Se asignará después
      balance: 800,
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          type: 'Ingreso',
          description: 'Salario mensual',
          amount: 1000,
          balance: 1000
        },
        {
          date: new Date().toISOString().split('T')[0],
          type: 'Gasto',
          description: 'Compra semanal',
          amount: -200,
          balance: 800
        }
      ]
    }
  ]
};

// Función para probar la migración
async function testMigration() {
  try {
    console.log('Iniciando prueba de migración...');

    // 1. Registrar un usuario de prueba
    console.log('Registrando usuario de prueba...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testData.users[0].email,
      password: testData.users[0].password,
    });

    if (authError) {
      console.error('Error al registrar usuario:', authError);
      return;
    }

    console.log('Usuario registrado con éxito:', authData.user.id);

    // Asignar el ID de usuario a las transacciones y ahorros
    testData.users[0].id = authData.user.id;
    testData.transactions.forEach(transaction => {
      transaction.userId = authData.user.id;
    });
    testData.savings[0].userId = authData.user.id;

    // 2. Crear perfil de usuario
    console.log('Creando perfil de usuario...');
    const { error: profileError } = await supabase
      .from('users')
      .insert([{
        id: testData.users[0].id,
        username: testData.users[0].username,
        email: testData.users[0].email,
        password: testData.users[0].password,
        is_admin: testData.users[0].isAdmin,
        team_id: testData.users[0].teamId,
        team_name: testData.users[0].teamName,
        team_code: testData.users[0].teamCode
      }]);

    if (profileError) {
      console.error('Error al crear perfil de usuario:', profileError);
      return;
    }

    console.log('Perfil de usuario creado con éxito');

    // 3. Crear equipo
    console.log('Creando equipo...');
    const { error: teamError } = await supabase
      .from('teams')
      .insert([{
        id: testData.teams[0].id,
        name: testData.teams[0].name,
        code: testData.teams[0].code,
        password: testData.teams[0].password,
        created_by: testData.teams[0].createdBy
      }]);

    if (teamError) {
      console.error('Error al crear equipo:', teamError);
      return;
    }

    console.log('Equipo creado con éxito');

    // 4. Crear categorías
    console.log('Creando categorías...');
    for (const category of testData.categories) {
      const { error: categoryError } = await supabase
        .from('categories')
        .insert([{
          name: category.name,
          color: category.color
        }]);

      if (categoryError) {
        console.error(`Error al crear categoría ${category.name}:`, categoryError);
        return;
      }
    }

    console.log('Categorías creadas con éxito');

    // 5. Crear transacciones
    console.log('Creando transacciones...');
    for (const transaction of testData.transactions) {
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          id: transaction.id,
          user_id: transaction.userId,
          type: transaction.type,
          cost_type: transaction.costType,
          amount: transaction.amount,
          category: transaction.category,
          date: transaction.date,
          description: transaction.description
        }]);

      if (transactionError) {
        console.error(`Error al crear transacción:`, transactionError);
        return;
      }
    }

    console.log('Transacciones creadas con éxito');

    // 6. Crear ahorros
    console.log('Creando ahorros...');
    const { data: savingsData, error: savingsError } = await supabase
      .from('savings')
      .insert([{
        id: testData.savings[0].id,
        user_id: testData.savings[0].userId,
        balance: testData.savings[0].balance
      }])
      .select();

    if (savingsError) {
      console.error('Error al crear ahorros:', savingsError);
      return;
    }

    console.log('Ahorros creados con éxito');

    // 7. Crear historial de ahorros
    console.log('Creando historial de ahorros...');
    for (const historyItem of testData.savings[0].history) {
      const { error: historyError } = await supabase
        .from('savings_history')
        .insert([{
          id: uuidv4(),
          savings_id: testData.savings[0].id,
          user_id: testData.savings[0].userId,
          date: historyItem.date,
          type: historyItem.type,
          description: historyItem.description,
          amount: historyItem.amount,
          balance: historyItem.balance
        }]);

      if (historyError) {
        console.error(`Error al crear historial de ahorros:`, historyError);
        return;
      }
    }

    console.log('Historial de ahorros creado con éxito');

    // 8. Verificar los datos migrados
    console.log('Verificando datos migrados...');

    // Verificar usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', testData.users[0].id)
      .single();

    if (userError) {
      console.error('Error al verificar usuario:', userError);
      return;
    }

    console.log('Usuario verificado:', userData);

    // Verificar transacciones
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', testData.users[0].id);

    if (transactionsError) {
      console.error('Error al verificar transacciones:', transactionsError);
      return;
    }

    console.log('Transacciones verificadas:', transactionsData);

    // Verificar ahorros
    const { data: savingsVerifyData, error: savingsVerifyError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', testData.users[0].id)
      .single();

    if (savingsVerifyError) {
      console.error('Error al verificar ahorros:', savingsVerifyError);
      return;
    }

    console.log('Ahorros verificados:', savingsVerifyData);

    // Verificar historial de ahorros
    const { data: historyData, error: historyError } = await supabase
      .from('savings_history')
      .select('*')
      .eq('user_id', testData.users[0].id);

    if (historyError) {
      console.error('Error al verificar historial de ahorros:', historyError);
      return;
    }

    console.log('Historial de ahorros verificado:', historyData);

    console.log('Prueba de migración completada con éxito');
  } catch (error) {
    console.error('Error en la prueba de migración:', error);
  }
}

// Ejecutar la prueba de migración
testMigration();
