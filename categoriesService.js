// Servicio para gestionar categorías con soporte para Supabase

// Función para cargar categorías
async function loadCategories() {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';
    
    if (useSupabase) {
      console.log('Cargando categorías desde Supabase...');
      
      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        return [];
      }
      
      // Obtener categorías del usuario
      const { data: userCategories, error: userError } = await getSupabaseClient()
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
        
      if (userError) {
        console.error('Error al cargar categorías del usuario:', userError);
        return [];
      }
      
      // Obtener categorías globales (sin user_id)
      const { data: globalCategories, error: globalError } = await getSupabaseClient()
        .from('categories')
        .select('*')
        .is('user_id', null);
        
      if (globalError) {
        console.error('Error al cargar categorías globales:', globalError);
        return userCategories || [];
      }
      
      // Combinar categorías
      const allCategories = [...(globalCategories || []), ...(userCategories || [])];
      
      // Convertir de snake_case a camelCase para mantener compatibilidad
      const formattedCategories = allCategories.map(c => ({
        name: c.name,
        color: c.color,
        userId: c.user_id
      }));
      
      console.log(`${formattedCategories.length} categorías cargadas desde Supabase`);
      
      // Actualizar la variable global
      window.categories = formattedCategories;
      
      return formattedCategories;
    } else {
      // Usar IndexedDB
      const storedCategories = await getAllFromDb('categories');
      
      // Si no hay categorías, crear las predeterminadas
      if (!storedCategories || storedCategories.length === 0) {
        const defaultCategories = [{
          name: 'Operativos',
          color: 'rgb(255, 99, 132)'
        }, {
          name: 'Salarios',
          color: 'rgb(54, 162, 235)'
        }, {
          name: 'Impuestos',
          color: 'rgb(255, 205, 86)'
        }, {
          name: 'Marketing',
          color: 'rgb(75, 192, 192)'
        }, {
          name: 'Otros',
          color: 'rgb(153, 102, 255)'
        }];
        
        // Guardar categorías predeterminadas
        for (const category of defaultCategories) {
          await addToDb('categories', category);
        }
        
        window.categories = defaultCategories;
        return defaultCategories;
      }
      
      window.categories = storedCategories;
      return storedCategories;
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error);
    return [];
  }
}

// Función para agregar una categoría
async function addCategory(category) {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';
    
    if (useSupabase) {
      console.log('Agregando categoría en Supabase:', category);
      
      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }
      
      // Preparar la categoría para Supabase
      const supabaseCategory = {
        name: category.name,
        color: category.color,
        user_id: user.id
      };
      
      // Insertar la categoría
      const { data, error } = await getSupabaseClient()
        .from('categories')
        .insert([supabaseCategory])
        .select();
        
      if (error) {
        console.error('Error al agregar categoría:', error);
        throw error;
      }
      
      console.log('Categoría agregada correctamente:', data[0]);
      
      // Actualizar la lista local de categorías
      if (!window.categories) window.categories = [];
      window.categories.push(category);
      
      return data[0];
    } else {
      // Usar IndexedDB
      await addToDb('categories', category);
      
      // Actualizar la lista local de categorías
      if (!window.categories) window.categories = [];
      window.categories.push(category);
      
      return category;
    }
  } catch (error) {
    console.error('Error al agregar categoría:', error);
    throw error;
  }
}

// Función para eliminar una categoría
async function deleteCategory(categoryName) {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';
    
    if (useSupabase) {
      console.log('Eliminando categoría en Supabase:', categoryName);
      
      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }
      
      // Eliminar la categoría
      const { error } = await getSupabaseClient()
        .from('categories')
        .delete()
        .eq('name', categoryName)
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error al eliminar categoría:', error);
        throw error;
      }
      
      console.log('Categoría eliminada correctamente');
      
      // Actualizar la lista local de categorías
      if (window.categories) {
        window.categories = window.categories.filter(c => c.name !== categoryName);
      }
      
      return true;
    } else {
      // Usar IndexedDB
      await deleteFromDb('categories', categoryName);
      
      // Actualizar la lista local de categorías
      if (window.categories) {
        window.categories = window.categories.filter(c => c.name !== categoryName);
      }
      
      return true;
    }
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
}

// Función para actualizar la lista de categorías en la interfaz
function updateCategoryList() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;
  
  categoryList.innerHTML = '';
  
  if (!window.categories) return;
  
  window.categories.forEach((category, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${category.name}</td>
      <td>
        <div class="color-preview" style="background-color: ${category.color}"></div>
      </td>
      <td>
        <button class="delete-category-btn" onclick="deleteCategory(${index})">x</button>
      </td>
    `;
    categoryList.appendChild(row);
  });
  
  // Actualizar el selector de categorías en el formulario de transacciones
  const categorySelect = document.getElementById('transactionCategory');
  if (categorySelect) {
    categorySelect.innerHTML = window.categories.map(category => 
      `<option value="${category.name}">${category.name}</option>`
    ).join('');
  }
  
  // Actualizar el filtro de categorías en el historial
  const historyCategoryFilter = document.getElementById('historyCategoryFilter');
  if (historyCategoryFilter) {
    historyCategoryFilter.innerHTML = '<option value="">Todas</option>' + 
      window.categories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');
  }
}

// Exponer las funciones globalmente
window.loadCategories = loadCategories;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.updateCategoryList = updateCategoryList;
