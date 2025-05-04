// Servicio para el chat de equipo
import { getSupabaseClient } from './supabaseConfig.js';
import { v4 as uuidv4 } from 'https://jspm.dev/uuid';

// Función para obtener mensajes del equipo
export async function getTeamMessages(teamId) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('get_team_messages', {
        team_id_param: teamId
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al obtener mensajes con RPC:', rpcError);
      
      // Fallback: consulta directa
      const { data, error } = await supabase
        .from('team_messages')
        .select(`
          id,
          team_id,
          user_id,
          message,
          has_attachment,
          created_at,
          updated_at,
          users:user_id (username)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Transformar los datos para que coincidan con el formato esperado
      return data.map(msg => ({
        ...msg,
        username: msg.users ? msg.users.username : 'Usuario desconocido'
      }));
    }
  } catch (error) {
    console.error('Error al obtener mensajes del equipo:', error);
    throw error;
  }
}

// Función para enviar un mensaje al equipo
export async function sendTeamMessage(teamId, userId, message, mentionedUsers = []) {
  try {
    const supabase = getSupabaseClient();
    const messageId = uuidv4();
    
    // Detectar si hay menciones en el mensaje
    const hasMentions = mentionedUsers.length > 0;
    
    // Intentar usar la función RPC personalizada si hay menciones
    if (hasMentions) {
      try {
        const { data, error } = await supabase.rpc('create_message_with_mentions', {
          team_id_param: teamId,
          user_id_param: userId,
          message_text: message,
          mentioned_users: mentionedUsers
        });
        
        if (error) throw error;
        return data;
      } catch (rpcError) {
        console.error('Error al enviar mensaje con menciones:', rpcError);
        // Continuar con el método estándar
      }
    }
    
    // Método estándar: insertar el mensaje
    const { data, error } = await supabase
      .from('team_messages')
      .insert([
        {
          id: messageId,
          team_id: teamId,
          user_id: userId,
          message: message,
          has_attachment: false
        }
      ])
      .select();
    
    if (error) throw error;
    
    // Si hay menciones, insertarlas manualmente
    if (hasMentions) {
      const mentionPromises = mentionedUsers.map(mentionedUserId => {
        return supabase
          .from('message_mentions')
          .insert([
            {
              message_id: messageId,
              user_id: mentionedUserId
            }
          ]);
      });
      
      await Promise.all(mentionPromises);
    }
    
    return data[0];
  } catch (error) {
    console.error('Error al enviar mensaje al equipo:', error);
    throw error;
  }
}

// Función para enviar un mensaje con archivo adjunto
export async function sendTeamMessageWithFile(teamId, userId, message, file) {
  try {
    const supabase = getSupabaseClient();
    
    // 1. Subir el archivo al bucket de almacenamiento
    const fileName = `${uuidv4()}-${file.name}`;
    const filePath = `team_files/${teamId}/${fileName}`;
    
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('team_files')
      .upload(filePath, file);
    
    if (fileError) throw fileError;
    
    // 2. Crear el mensaje con la referencia al archivo
    const messageId = uuidv4();
    const { data: messageData, error: messageError } = await supabase
      .from('team_messages')
      .insert([
        {
          id: messageId,
          team_id: teamId,
          user_id: userId,
          message: message,
          has_attachment: true
        }
      ])
      .select();
    
    if (messageError) throw messageError;
    
    // 3. Registrar el archivo en la tabla team_files
    const { data: fileRecordData, error: fileRecordError } = await supabase
      .from('team_files')
      .insert([
        {
          message_id: messageId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: filePath
        }
      ]);
    
    if (fileRecordError) throw fileRecordError;
    
    return messageData[0];
  } catch (error) {
    console.error('Error al enviar mensaje con archivo:', error);
    throw error;
  }
}

// Función para obtener archivos de un mensaje
export async function getMessageFiles(messageId) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('get_message_files', {
        message_id_param: messageId
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al obtener archivos con RPC:', rpcError);
      
      // Fallback: consulta directa
      const { data, error } = await supabase
        .from('team_files')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error al obtener archivos del mensaje:', error);
    throw error;
  }
}

// Función para descargar un archivo
export async function downloadFile(filePath) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .storage
      .from('team_files')
      .download(filePath);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    throw error;
  }
}

// Función para marcar un mensaje como leído
export async function markMessageAsRead(messageId, userId) {
  try {
    const supabase = getSupabaseClient();
    
    // Verificar si ya está marcado como leído
    const { data: existingRead, error: checkError } = await supabase
      .from('message_reads')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    // Si ya está marcado, no hacer nada
    if (existingRead) return existingRead;
    
    // Marcar como leído
    const { data, error } = await supabase
      .from('message_reads')
      .insert([
        {
          message_id: messageId,
          user_id: userId
        }
      ])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
    throw error;
  }
}

// Función para obtener mensajes no leídos
export async function getUnreadMessages(teamId, userId) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('team_messages')
      .select(`
        id,
        team_id,
        user_id,
        message,
        has_attachment,
        created_at,
        updated_at,
        users:user_id (username)
      `)
      .eq('team_id', teamId)
      .not('user_id', 'eq', userId)
      .not(
        'id', 'in', 
        supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', userId)
      );
    
    if (error) throw error;
    
    // Transformar los datos para que coincidan con el formato esperado
    return data.map(msg => ({
      ...msg,
      username: msg.users ? msg.users.username : 'Usuario desconocido'
    }));
  } catch (error) {
    console.error('Error al obtener mensajes no leídos:', error);
    throw error;
  }
}

// Función para añadir una reacción a un mensaje
export async function addReaction(messageId, userId, reaction) {
  try {
    const supabase = getSupabaseClient();
    
    // Verificar si ya existe la reacción
    const { data: existingReaction, error: checkError } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    // Si ya existe, no hacer nada
    if (existingReaction) return existingReaction;
    
    // Añadir la reacción
    const { data, error } = await supabase
      .from('message_reactions')
      .insert([
        {
          message_id: messageId,
          user_id: userId,
          reaction: reaction
        }
      ])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error al añadir reacción:', error);
    throw error;
  }
}

// Función para eliminar una reacción
export async function removeReaction(messageId, userId, reaction) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error al eliminar reacción:', error);
    throw error;
  }
}

// Función para obtener reacciones de un mensaje
export async function getMessageReactions(messageId) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('get_message_reactions', {
        message_id_param: messageId
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al obtener reacciones con RPC:', rpcError);
      
      // Fallback: consulta directa
      const { data, error } = await supabase
        .from('message_reactions')
        .select(`
          reaction,
          users:user_id (id, username)
        `)
        .eq('message_id', messageId);
      
      if (error) throw error;
      
      // Agrupar por reacción
      const reactionGroups = {};
      data.forEach(item => {
        if (!reactionGroups[item.reaction]) {
          reactionGroups[item.reaction] = {
            reaction: item.reaction,
            count: 0,
            users: []
          };
        }
        
        reactionGroups[item.reaction].count++;
        reactionGroups[item.reaction].users.push(item.users);
      });
      
      return Object.values(reactionGroups);
    }
  } catch (error) {
    console.error('Error al obtener reacciones del mensaje:', error);
    throw error;
  }
}

// Función para crear un mensaje en un hilo
export async function createThreadMessage(parentMessageId, userId, message, mentionedUsers = []) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('create_thread_message', {
        parent_message_id_param: parentMessageId,
        user_id_param: userId,
        message_text: message,
        mentioned_users: mentionedUsers
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al crear mensaje en hilo con RPC:', rpcError);
      
      // Fallback: método manual
      // 1. Obtener el team_id del mensaje padre
      const { data: parentMessage, error: parentError } = await supabase
        .from('team_messages')
        .select('team_id')
        .eq('id', parentMessageId)
        .single();
      
      if (parentError) throw parentError;
      
      // 2. Crear el nuevo mensaje
      const messageId = uuidv4();
      const { data: messageData, error: messageError } = await supabase
        .from('team_messages')
        .insert([
          {
            id: messageId,
            team_id: parentMessage.team_id,
            user_id: userId,
            message: message,
            has_attachment: false
          }
        ])
        .select();
      
      if (messageError) throw messageError;
      
      // 3. Crear la relación de hilo
      const { error: threadError } = await supabase
        .from('message_threads')
        .insert([
          {
            parent_message_id: parentMessageId,
            message_id: messageId
          }
        ]);
      
      if (threadError) throw threadError;
      
      // 4. Si hay menciones, insertarlas
      if (mentionedUsers.length > 0) {
        const mentionPromises = mentionedUsers.map(mentionedUserId => {
          return supabase
            .from('message_mentions')
            .insert([
              {
                message_id: messageId,
                user_id: mentionedUserId
              }
            ]);
        });
        
        await Promise.all(mentionPromises);
      }
      
      return messageData[0];
    }
  } catch (error) {
    console.error('Error al crear mensaje en hilo:', error);
    throw error;
  }
}

// Función para obtener mensajes de un hilo
export async function getThreadMessages(parentMessageId) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('get_thread_messages', {
        parent_message_id_param: parentMessageId
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al obtener mensajes de hilo con RPC:', rpcError);
      
      // Fallback: consulta directa
      const { data, error } = await supabase
        .from('message_threads')
        .select(`
          message_id,
          team_messages:message_id (
            id,
            user_id,
            message,
            has_attachment,
            created_at,
            users:user_id (username)
          )
        `)
        .eq('parent_message_id', parentMessageId)
        .order('created_at', { foreignTable: 'team_messages', ascending: true });
      
      if (error) throw error;
      
      // Transformar los datos para que coincidan con el formato esperado
      return data.map(thread => ({
        id: thread.team_messages.id,
        user_id: thread.team_messages.user_id,
        username: thread.team_messages.users ? thread.team_messages.users.username : 'Usuario desconocido',
        message: thread.team_messages.message,
        has_attachment: thread.team_messages.has_attachment,
        created_at: thread.team_messages.created_at
      }));
    }
  } catch (error) {
    console.error('Error al obtener mensajes de hilo:', error);
    throw error;
  }
}

// Función para obtener menciones de un mensaje
export async function getMessageMentions(messageId) {
  try {
    const supabase = getSupabaseClient();
    
    // Intentar usar la función RPC personalizada
    try {
      const { data, error } = await supabase.rpc('get_message_mentions', {
        message_id_param: messageId
      });
      
      if (error) throw error;
      return data;
    } catch (rpcError) {
      console.error('Error al obtener menciones con RPC:', rpcError);
      
      // Fallback: consulta directa
      const { data, error } = await supabase
        .from('message_mentions')
        .select(`
          user_id,
          users:user_id (username)
        `)
        .eq('message_id', messageId);
      
      if (error) throw error;
      
      // Transformar los datos para que coincidan con el formato esperado
      return data.map(mention => ({
        user_id: mention.user_id,
        username: mention.users ? mention.users.username : 'Usuario desconocido'
      }));
    }
  } catch (error) {
    console.error('Error al obtener menciones del mensaje:', error);
    throw error;
  }
}

// Función para obtener usuarios del equipo (para menciones)
export async function getTeamUsers(teamId) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .eq('team_id', teamId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener usuarios del equipo:', error);
    throw error;
  }
}

// Función para buscar mensajes
export async function searchMessages(teamId, searchTerm) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('team_messages')
      .select(`
        id,
        team_id,
        user_id,
        message,
        has_attachment,
        created_at,
        updated_at,
        users:user_id (username)
      `)
      .eq('team_id', teamId)
      .ilike('message', `%${searchTerm}%`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Transformar los datos para que coincidan con el formato esperado
    return data.map(msg => ({
      ...msg,
      username: msg.users ? msg.users.username : 'Usuario desconocido'
    }));
  } catch (error) {
    console.error('Error al buscar mensajes:', error);
    throw error;
  }
}

// Función para compartir una transacción en el chat
export async function shareTransaction(teamId, userId, transactionId, message) {
  try {
    const supabase = getSupabaseClient();
    
    // 1. Obtener los datos de la transacción
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (transactionError) throw transactionError;
    
    // 2. Crear un mensaje con la transacción
    const transactionJson = JSON.stringify(transactionData);
    const fullMessage = `${message}\n\n[TRANSACTION]${transactionJson}[/TRANSACTION]`;
    
    // 3. Enviar el mensaje
    return await sendTeamMessage(teamId, userId, fullMessage);
  } catch (error) {
    console.error('Error al compartir transacción:', error);
    throw error;
  }
}

// Función para compartir un reporte en el chat
export async function shareReport(teamId, userId, reportType, reportData, message) {
  try {
    // 1. Crear un mensaje con el reporte
    const reportJson = JSON.stringify({
      type: reportType,
      data: reportData
    });
    const fullMessage = `${message}\n\n[REPORT]${reportJson}[/REPORT]`;
    
    // 2. Enviar el mensaje
    return await sendTeamMessage(teamId, userId, fullMessage);
  } catch (error) {
    console.error('Error al compartir reporte:', error);
    throw error;
  }
}

// Configurar suscripción en tiempo real para nuevos mensajes
export function subscribeToNewMessages(teamId, callback) {
  const supabase = getSupabaseClient();
  
  return supabase
    .channel('team_messages_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_messages',
        filter: `team_id=eq.${teamId}`
      },
      payload => {
        callback(payload.new);
      }
    )
    .subscribe();
}

// Configurar suscripción en tiempo real para reacciones
export function subscribeToReactions(messageId, callback) {
  const supabase = getSupabaseClient();
  
  return supabase
    .channel(`reactions_channel_${messageId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'message_reactions',
        filter: `message_id=eq.${messageId}`
      },
      payload => {
        callback(payload);
      }
    )
    .subscribe();
}

// Configurar suscripción en tiempo real para hilos
export function subscribeToThreads(parentMessageId, callback) {
  const supabase = getSupabaseClient();
  
  return supabase
    .channel(`threads_channel_${parentMessageId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_threads',
        filter: `parent_message_id=eq.${parentMessageId}`
      },
      payload => {
        callback(payload.new);
      }
    )
    .subscribe();
}
