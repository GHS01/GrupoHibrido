// Servicio para gestionar categorías con soporte para Supabase

// Función para cargar categorías
async function loadCategories() {
  try {
    // Limpiar las categorías existentes para evitar mezclar datos de diferentes usuarios
    window.categories = [];

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

      console.log(`Cargando categorías para el usuario: ${user.id}`);

      // Primero, eliminar todas las categorías con prefijo EXCLUIR_ del usuario
      // para limpiar la base de datos
      const { error: cleanupError } = await getSupabaseClient()
        .from('categories')
        .delete()
        .eq('user_id', user.id)
        .like('name', 'EXCLUIR_%');

      if (cleanupError) {
        console.error('Error al limpiar categorías EXCLUIR_:', cleanupError);
      } else {
        console.log('Categorías EXCLUIR_ eliminadas correctamente');
      }

      // Ya no cargamos categorías globales directamente
      // Solo registramos que estamos saltando este paso
      console.log('Omitiendo carga de categorías globales para evitar problemas de privacidad');
      const globalCategories = [];
      console.log('0 categorías globales cargadas');

      // Obtener categorías del usuario usando la función RPC segura
      const { data: userCategories, error: userError } = await getSupabaseClient()
        .rpc('get_categories_safely', { user_id_param: user.id });

      if (userError) {
        console.error('Error al cargar categorías del usuario:', userError);
        return [];
      }

      // Verificar si necesitamos copiar categorías globales al usuario
      if (globalCategories && globalCategories.length > 0) {
        // Crear un conjunto con los nombres de las categorías del usuario
        const userCategoryNames = new Set(userCategories.map(c => c.name));

        // Filtrar las categorías globales que el usuario no tiene
        const categoriesToCopy = globalCategories
          .filter(c => !userCategoryNames.has(c.name))
          .map(c => ({
            name: c.name,
            color: c.color,
            user_id: user.id
          }));

        if (categoriesToCopy.length > 0) {
          console.log(`Copiando ${categoriesToCopy.length} categorías globales para el usuario...`);

          // Insertar las categorías copiadas
          const { error: copyError } = await getSupabaseClient()
            .from('categories')
            .insert(categoriesToCopy);

          if (copyError) {
            console.error('Error al copiar categorías globales para el usuario:', copyError);
          } else {
            console.log(`${categoriesToCopy.length} categorías globales copiadas para el usuario`);
          }
        }
      }

      // Recargar las categorías del usuario después de las operaciones usando la función RPC segura
      const { data: updatedUserCategories, error: reloadError } = await getSupabaseClient()
        .rpc('get_categories_safely', { user_id_param: user.id });

      if (reloadError) {
        console.error('Error al recargar categorías del usuario:', reloadError);
        return [];
      }

      // Filtrar cualquier categoría con prefijo EXCLUIR_ que pudiera quedar
      const filteredCategories = (updatedUserCategories || []).filter(
        c => !c.name.startsWith('EXCLUIR_')
      );

      // Convertir de snake_case a camelCase para mantener compatibilidad
      const formattedCategories = filteredCategories.map(c => ({
        name: c.name,
        color: c.color,
        userId: c.user_id
      }));

      console.log(`${formattedCategories.length} categorías cargadas desde Supabase para el usuario ${user.id}`);

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

      // Intentar usar la función RPC segura para insertar categorías
      // Esta función debe estar definida en Supabase y tener los permisos adecuados
      try {
        console.log('Intentando agregar categoría con RPC segura...');
        const { data: rpcData, error: rpcError } = await getSupabaseClient().rpc(
          'insert_category_safely',
          {
            category_name: category.name,
            category_color: category.color,
            category_user_id: user.id
          }
        );

        if (rpcError) {
          console.warn('Error al usar RPC segura, intentando método alternativo:', rpcError);
          // Continuar con el método alternativo
        } else {
          console.log('Categoría agregada correctamente con RPC:', rpcData);

          // Verificar si la respuesta contiene los datos de la categoría
          if (rpcData) {
            console.log('Respuesta RPC completa:', rpcData);

            // Intentar extraer los datos de diferentes formatos posibles
            let categoryData = null;

            if (rpcData.success === true && rpcData.data) {
              // Formato esperado: {success: true, data: {...}}
              categoryData = rpcData.data;
              console.log('Datos de la categoría en formato success/data:', categoryData);
            } else if (rpcData.name && rpcData.color) {
              // La respuesta es directamente el objeto de categoría
              categoryData = rpcData;
              console.log('Datos de la categoría en formato directo:', categoryData);
            } else if (Array.isArray(rpcData) && rpcData.length > 0) {
              // La respuesta es un array con el objeto de categoría
              categoryData = rpcData[0];
              console.log('Datos de la categoría en formato array:', categoryData);
            }

            if (categoryData) {
              // Crear un objeto de categoría con los datos devueltos
              const insertedCategory = {
                name: categoryData.name,
                color: categoryData.color,
                user_id: categoryData.user_id || user.id // Usar user_id de la respuesta o el ID del usuario actual
              };

              console.log('Categoría formateada para agregar a la lista local:', insertedCategory);

              // Actualizar la lista local de categorías
              if (!window.categories) window.categories = [];
              window.categories.push(insertedCategory);

              // Actualizar la interfaz de usuario
              updateCategoryList();

              // Recargar las categorías para asegurar que la interfaz esté actualizada
              await loadCategories();

              return categoryData;
            } else {
              console.warn('No se pudieron extraer datos de categoría válidos de la respuesta RPC:', rpcData);
              // Continuar con el método alternativo
            }
          } else {
            console.warn('La respuesta RPC es nula o indefinida');
            // Continuar con el método alternativo
          }
        }
      } catch (rpcError) {
        console.warn('Excepción al usar RPC segura:', rpcError);
        // Continuar con el método alternativo
      }

      // Método alternativo: Usar SQL directo a través de RPC
      try {
        console.log('Intentando agregar categoría con SQL directo...');
        const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc(
          'execute_sql',
          {
            sql_query: `INSERT INTO categories (name, color, user_id) VALUES ('${category.name}', '${category.color}', '${user.id}') RETURNING *;`
          }
        );

        if (sqlError) {
          console.error('Error al agregar categoría con SQL directo:', sqlError);
          throw sqlError;
        }

        console.log('Categoría agregada correctamente con SQL directo:', sqlData);

        // Actualizar la lista local de categorías
        if (!window.categories) window.categories = [];
        window.categories.push(category);

        // Recargar las categorías para asegurar que la interfaz esté actualizada
        await loadCategories();

        return sqlData;
      } catch (sqlError) {
        console.error('Excepción al usar SQL directo:', sqlError);

        // Último intento: método estándar
        console.log('Intentando método estándar como último recurso...');
        const { data, error } = await getSupabaseClient()
          .from('categories')
          .insert([supabaseCategory])
          .select();

        if (error) {
          console.error('Error al agregar categoría con método estándar:', error);
          throw error;
        }

        console.log('Categoría agregada correctamente con método estándar:', data[0]);

        // Actualizar la lista local de categorías
        if (!window.categories) window.categories = [];
        window.categories.push(category);

        // Recargar las categorías para asegurar que la interfaz esté actualizada
        await loadCategories();

        return data[0];
      }
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

      // Buscar la categoría en la lista local
      const category = window.categories.find(c => c.name === categoryName);
      if (!category) {
        console.error('Categoría no encontrada:', categoryName);
        throw new Error('Categoría no encontrada');
      }

      // Intentar usar la función RPC segura para eliminar categorías
      try {
        console.log('Intentando eliminar categoría con RPC segura...');
        const { data: rpcData, error: rpcError } = await getSupabaseClient().rpc(
          'delete_category_safely',
          {
            category_name: categoryName,
            category_user_id: user.id
          }
        );

        if (rpcError) {
          console.warn('Error al usar RPC segura para eliminar, intentando método alternativo:', rpcError);
          // Continuar con el método alternativo
        } else {
          console.log('Respuesta RPC completa para eliminación:', rpcData);

          // Verificar si la operación fue exitosa
          if (rpcData && rpcData.success === true) {
            console.log('Categoría eliminada correctamente con RPC:', rpcData);

            // Eliminar la categoría de la lista local
            if (window.categories) {
              window.categories = window.categories.filter(c => c.name !== categoryName);
            }

            // Recargar las categorías para asegurar que la interfaz esté actualizada
            await loadCategories();

            // Actualizar la interfaz
            updateCategoryList();

            // Mostrar notificación de éxito
            showNotification('Éxito', 'Categoría eliminada correctamente', 'success');

            return true;
          } else {
            console.warn('La eliminación con RPC no fue exitosa:', rpcData ? rpcData.message : 'Sin mensaje');
            // Continuar con el método alternativo
          }
        }
      } catch (rpcError) {
        console.warn('Excepción al usar RPC segura para eliminar:', rpcError);
        // Continuar con el método alternativo
      }

      // Método alternativo: Usar SQL directo a través de RPC
      try {
        console.log('Intentando eliminar categoría con SQL directo...');
        const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc(
          'execute_sql',
          {
            sql_query: `DELETE FROM categories WHERE name = '${categoryName}' AND user_id = '${user.id}' RETURNING *;`
          }
        );

        if (sqlError) {
          console.error('Error al eliminar categoría con SQL directo:', sqlError);
          throw sqlError;
        }

        console.log('Respuesta SQL completa para eliminación:', sqlData);

        // Verificar si se eliminaron filas
        if (sqlData && Array.isArray(sqlData) && sqlData.length > 0) {
          console.log('Categoría eliminada correctamente con SQL directo:', sqlData);

          // Eliminar la categoría de la lista local
          if (window.categories) {
            window.categories = window.categories.filter(c => c.name !== categoryName);
          }

          // Recargar las categorías para asegurar que la interfaz esté actualizada
          await loadCategories();

          // Actualizar la interfaz
          updateCategoryList();

          // Mostrar notificación de éxito
          showNotification('Éxito', 'Categoría eliminada correctamente', 'success');

          return true;
        } else {
          console.warn('No se encontraron filas eliminadas con SQL directo');
          // Continuar con el método estándar
        }
      } catch (sqlError) {
        console.error('Excepción al usar SQL directo para eliminar:', sqlError);

        // Último intento: método estándar
        console.log('Intentando método estándar como último recurso para eliminar...');
        const { data, error } = await getSupabaseClient()
          .from('categories')
          .delete()
          .eq('name', categoryName)
          .eq('user_id', user.id)
          .select(); // Agregar select para obtener los datos eliminados

        if (error) {
          console.error('Error al eliminar categoría con método estándar:', error);
          throw error;
        }

        console.log('Respuesta estándar completa para eliminación:', data);

        // Verificar si se eliminaron filas
        if (data && Array.isArray(data) && data.length > 0) {
          console.log('Categoría eliminada correctamente con método estándar:', data);

          // Eliminar la categoría de la lista local
          if (window.categories) {
            window.categories = window.categories.filter(c => c.name !== categoryName);
          }

          // Recargar las categorías para asegurar que la interfaz esté actualizada
          await loadCategories();

          // Actualizar la interfaz
          updateCategoryList();

          // Mostrar notificación de éxito
          showNotification('Éxito', 'Categoría eliminada correctamente', 'success');

          return true;
        } else {
          console.warn('No se encontraron filas eliminadas con método estándar');
          showNotification('Advertencia', 'No se pudo eliminar la categoría. Es posible que no exista o no tengas permisos.', 'warning');
          return false;
        }
      }
    } else {
      // Usar IndexedDB
      await deleteFromDb('categories', categoryName);

      // Actualizar la lista local de categorías
      if (window.categories) {
        window.categories = window.categories.filter(c => c.name !== categoryName);
      }

      // Actualizar la interfaz
      updateCategoryList();

      // Mostrar notificación de éxito
      showNotification('Éxito', 'Categoría eliminada correctamente', 'success');

      return true;
    }
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    showNotification('Error', `No se pudo eliminar la categoría: ${error.message}`, 'error');
    throw error;
  }
}

// Función para editar una categoría
async function editCategory(originalName, updatedCategory) {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';

    if (useSupabase) {
      console.log('Editando categoría en Supabase:', originalName, '->', updatedCategory);

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      // Buscar la categoría en la lista local
      const category = window.categories.find(c => c.name === originalName);
      if (!category) {
        console.error('Categoría no encontrada:', originalName);
        throw new Error('Categoría no encontrada');
      }

      // Intentar usar la función RPC segura para actualizar categorías
      try {
        console.log('Intentando actualizar categoría con RPC segura...');
        const { data: rpcData, error: rpcError } = await getSupabaseClient().rpc(
          'update_category_safely',
          {
            original_name: originalName,
            new_name: updatedCategory.name,
            new_color: updatedCategory.color,
            category_user_id: user.id
          }
        );

        if (rpcError) {
          console.warn('Error al usar RPC segura para actualizar, intentando método alternativo:', rpcError);
          // Continuar con el método alternativo
        } else {
          console.log('Categoría actualizada correctamente con RPC:', rpcData);

          // Recargar las categorías para asegurar que la interfaz esté actualizada
          await loadCategories();

          // Actualizar la interfaz
          updateCategoryList();

          // Mostrar notificación de éxito
          showNotification('Éxito', 'Categoría actualizada correctamente', 'success');

          return rpcData;
        }
      } catch (rpcError) {
        console.warn('Excepción al usar RPC segura para actualizar:', rpcError);
        // Continuar con el método alternativo
      }

      // Método alternativo: Usar SQL directo a través de RPC
      try {
        console.log('Intentando actualizar categoría con SQL directo...');
        const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc(
          'execute_sql',
          {
            sql_query: `UPDATE categories SET name = '${updatedCategory.name}', color = '${updatedCategory.color}' WHERE name = '${originalName}' AND user_id = '${user.id}' RETURNING *;`
          }
        );

        if (sqlError) {
          console.error('Error al actualizar categoría con SQL directo:', sqlError);
          throw sqlError;
        }

        console.log('Categoría actualizada correctamente con SQL directo:', sqlData);

        // Recargar las categorías para asegurar que la interfaz esté actualizada
        await loadCategories();

        // Actualizar la interfaz
        updateCategoryList();

        // Mostrar notificación de éxito
        showNotification('Éxito', 'Categoría actualizada correctamente', 'success');

        return sqlData;
      } catch (sqlError) {
        console.error('Excepción al usar SQL directo para actualizar:', sqlError);

        // Último intento: método estándar
        console.log('Intentando método estándar como último recurso para actualizar...');
        const { data, error } = await getSupabaseClient()
          .from('categories')
          .update({
            name: updatedCategory.name,
            color: updatedCategory.color
          })
          .eq('name', originalName)
          .eq('user_id', user.id)
          .select();

        if (error) {
          console.error('Error al editar categoría con método estándar:', error);
          throw error;
        }

        console.log('Categoría editada correctamente con método estándar:', data[0]);

        // Recargar las categorías para asegurar que la interfaz esté actualizada
        await loadCategories();

        // Actualizar la interfaz
        updateCategoryList();

        // Mostrar notificación de éxito
        showNotification('Éxito', 'Categoría actualizada correctamente', 'success');

        return data[0];
      }
    } else {
      // Usar IndexedDB
      // Primero eliminar la categoría original
      await deleteFromDb('categories', originalName);

      // Luego agregar la categoría actualizada
      await addToDb('categories', updatedCategory);

      // Actualizar la lista local de categorías
      if (window.categories) {
        const index = window.categories.findIndex(c => c.name === originalName);
        if (index !== -1) {
          window.categories[index] = updatedCategory;
        }
      }

      // Actualizar la interfaz
      updateCategoryList();

      // Mostrar notificación de éxito
      showNotification('Éxito', 'Categoría actualizada correctamente', 'success');

      return updatedCategory;
    }
  } catch (error) {
    console.error('Error al editar categoría:', error);
    showNotification('Error', `No se pudo actualizar la categoría: ${error.message}`, 'error');
    throw error;
  }
}

// Función para actualizar la lista de categorías en la interfaz
function updateCategoryList() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  categoryList.innerHTML = '';

  if (!window.categories) return;

  // Filtrar categorías para no mostrar las que empiezan con "EXCLUIR_" y asegurar que solo se muestren las del usuario actual
  const currentUserId = sessionStorage.getItem('userId');
  const filteredCategories = window.categories.filter(c => {
    // No mostrar categorías con prefijo EXCLUIR_
    if (c.name.startsWith('EXCLUIR_')) return false;

    // Si la categoría tiene userId, verificar que coincida con el usuario actual
    if (c.userId && c.userId !== currentUserId) return false;

    return true;
  });

  filteredCategories.forEach((category, index) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center shadow-sm mb-2 rounded';

    // Crear el contenedor para el nombre y el color
    const categoryInfo = document.createElement('div');
    categoryInfo.className = 'd-flex align-items-center';

    // Crear el indicador de color
    const colorIndicator = document.createElement('div');
    colorIndicator.className = 'color-indicator me-2';
    colorIndicator.style.backgroundColor = category.color;
    colorIndicator.style.width = '24px';
    colorIndicator.style.height = '24px';
    colorIndicator.style.borderRadius = '50%';
    colorIndicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

    // Crear el nombre de la categoría
    const categoryName = document.createElement('span');
    categoryName.textContent = category.name;
    categoryName.style.fontWeight = '500';

    // Agregar el color y el nombre al contenedor
    categoryInfo.appendChild(colorIndicator);
    categoryInfo.appendChild(categoryName);

    // Crear los botones de acción
    const actionButtons = document.createElement('div');
    actionButtons.className = 'btn-group';

    // Botón de editar
    const editButton = document.createElement('button');
    editButton.className = 'btn btn-sm btn-primary me-2';
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.title = 'Editar categoría';
    editButton.onclick = function() { startEditCategory(category.name); };

    // Botón de eliminar
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-sm btn-danger';
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.title = 'Eliminar categoría';
    deleteButton.onclick = function() {
      if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${category.name}"?`)) {
        deleteCategory(category.name);
      }
    };

    // Agregar los botones al contenedor de acciones
    actionButtons.appendChild(editButton);
    actionButtons.appendChild(deleteButton);

    // Agregar todo al elemento de lista
    li.appendChild(categoryInfo);
    li.appendChild(actionButtons);

    categoryList.appendChild(li);
  });

  // Actualizar el selector de categorías en el formulario de transacciones
  const categorySelect = document.getElementById('transactionCategory');
  if (categorySelect) {
    categorySelect.innerHTML = filteredCategories.map(category =>
      `<option value="${category.name}">${category.name}</option>`
    ).join('');
  }

  // Actualizar el filtro de categorías en el historial
  const historyCategoryFilter = document.getElementById('historyCategoryFilter');
  if (historyCategoryFilter) {
    historyCategoryFilter.innerHTML = '<option value="">Todas</option>' +
      filteredCategories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');
  }
}

// Función para iniciar la edición de una categoría
function startEditCategory(categoryName) {
  // Buscar la categoría en la lista
  const category = window.categories.find(c => c.name === categoryName);
  if (!category) {
    console.error('Categoría no encontrada:', categoryName);
    return;
  }

  // Cambiar el modo del formulario a edición
  document.getElementById('editCategoryMode').value = 'edit';
  document.getElementById('originalCategoryName').value = categoryName;

  // Llenar el formulario con los datos de la categoría
  document.getElementById('newCategoryName').value = category.name;
  document.getElementById('newCategoryColor').value = category.color;

  // Actualizar la vista previa del color
  updateColorPreview();

  // Cambiar el título y el texto del botón
  document.getElementById('categoryFormTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Editar Categoría';
  document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save me-1"></i> Guardar Cambios';

  // Mostrar el botón de cancelar
  document.getElementById('cancelEditBtn').style.display = 'block';
}

// Función para cancelar la edición de una categoría
function cancelCategoryEdit() {
  // Restablecer el modo del formulario
  document.getElementById('editCategoryMode').value = 'add';
  document.getElementById('originalCategoryName').value = '';

  // Limpiar el formulario
  document.getElementById('newCategoryName').value = '';
  document.getElementById('newCategoryColor').value = '#3498db';

  // Actualizar la vista previa del color
  updateColorPreview();

  // Restablecer el título y el texto del botón
  document.getElementById('categoryFormTitle').innerHTML = '<i class="fas fa-plus-circle me-2"></i>Añadir Nueva Categoría';
  document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save me-1"></i> Añadir Categoría';

  // Ocultar el botón de cancelar
  document.getElementById('cancelEditBtn').style.display = 'none';
}

// Función para manejar el envío del formulario de categorías
async function handleCategoryFormSubmit(event) {
  event.preventDefault();

  const mode = document.getElementById('editCategoryMode').value;
  const originalName = document.getElementById('originalCategoryName').value;
  const name = document.getElementById('newCategoryName').value;
  const color = document.getElementById('newCategoryColor').value;

  try {
    if (mode === 'edit') {
      // Editar categoría existente
      const updatedCategory = { name, color };
      await editCategory(originalName, updatedCategory);
      showNotification('¡Éxito!', 'Categoría actualizada correctamente', 'success');
    } else {
      // Agregar nueva categoría
      const newCategory = { name, color };
      await addCategory(newCategory);
      showNotification('¡Éxito!', 'Categoría agregada correctamente', 'success');
    }

    // Actualizar la interfaz
    updateCategoryList();

    // Restablecer el formulario
    document.getElementById('addCategoryForm').reset();
    cancelCategoryEdit();
  } catch (error) {
    console.error('Error al procesar el formulario de categorías:', error);
    showNotification('Error', `Error al ${mode === 'edit' ? 'actualizar' : 'agregar'} la categoría: ${error.message}`, 'error');
  }
}

// Función para actualizar la vista previa del color
function updateColorPreview() {
  const colorInput = document.getElementById('newCategoryColor');
  const colorPreview = document.getElementById('colorPreview');

  if (colorInput && colorPreview) {
    colorPreview.style.backgroundColor = colorInput.value;
  }
}

// Configurar el event listener para el formulario cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  const categoryForm = document.getElementById('addCategoryForm');
  if (categoryForm) {
    categoryForm.addEventListener('submit', handleCategoryFormSubmit);
  }

  // Agregar event listener para actualizar la vista previa del color
  const colorInput = document.getElementById('newCategoryColor');
  if (colorInput) {
    colorInput.addEventListener('input', updateColorPreview);
    // Inicializar la vista previa
    updateColorPreview();
  }

  // Cargar las categorías al inicio
  loadCategories().then(() => {
    updateCategoryList();
  }).catch(error => {
    console.error('Error al cargar categorías:', error);
  });
});

// Exponer las funciones globalmente
window.loadCategories = loadCategories;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.updateCategoryList = updateCategoryList;
window.editCategory = editCategory;
window.startEditCategory = startEditCategory;
window.cancelCategoryEdit = cancelCategoryEdit;
window.handleCategoryFormSubmit = handleCategoryFormSubmit;
