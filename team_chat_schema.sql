-- Esquema para el chat de equipo en Supabase

-- Tabla de mensajes del chat
CREATE TABLE team_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  has_attachment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de archivos adjuntos
CREATE TABLE team_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES team_messages(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de lecturas de mensajes (para saber quién ha leído cada mensaje)
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES team_messages(id),
  user_id UUID NOT NULL REFERENCES users(id),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Tabla de reacciones a mensajes
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES team_messages(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reaction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);

-- Tabla de hilos de conversación
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_message_id UUID NOT NULL REFERENCES team_messages(id),
  message_id UUID NOT NULL REFERENCES team_messages(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_message_id, message_id)
);

-- Tabla de menciones de usuarios
CREATE TABLE message_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES team_messages(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Habilitar Row Level Security en todas las tablas
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para team_messages
CREATE POLICY "Users can view messages from their team" ON team_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND team_id = team_messages.team_id
    )
  );

CREATE POLICY "Users can insert messages to their team" ON team_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND team_id = team_messages.team_id
    )
  );

CREATE POLICY "Users can update their own messages" ON team_messages
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own messages" ON team_messages
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Políticas de seguridad para team_files
CREATE POLICY "Users can view files from their team" ON team_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = team_files.message_id
    )
  );

CREATE POLICY "Users can insert files to their team" ON team_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_messages 
      WHERE team_messages.id = team_files.message_id AND team_messages.user_id = auth.uid()
    )
  );

-- Políticas de seguridad para message_reads
CREATE POLICY "Users can view message reads from their team" ON message_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = message_reads.message_id
    )
  );

CREATE POLICY "Users can insert their own message reads" ON message_reads
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Políticas de seguridad para message_reactions
CREATE POLICY "Users can view reactions from their team" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = message_reactions.message_id
    )
  );

CREATE POLICY "Users can insert their own reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own reactions" ON message_reactions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Políticas de seguridad para message_threads
CREATE POLICY "Users can view threads from their team" ON message_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = message_threads.parent_message_id
    )
  );

CREATE POLICY "Users can insert threads to their team" ON message_threads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = message_threads.message_id
    )
  );

-- Políticas de seguridad para message_mentions
CREATE POLICY "Users can view mentions from their team" ON message_mentions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_messages 
      JOIN users ON users.team_id = team_messages.team_id
      WHERE users.id = auth.uid() AND team_messages.id = message_mentions.message_id
    )
  );

CREATE POLICY "Users can insert mentions to their team" ON message_mentions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_messages 
      WHERE team_messages.id = message_mentions.message_id AND team_messages.user_id = auth.uid()
    )
  );

-- Índices para mejorar el rendimiento
CREATE INDEX idx_team_messages_team_id ON team_messages(team_id);
CREATE INDEX idx_team_messages_user_id ON team_messages(user_id);
CREATE INDEX idx_team_messages_created_at ON team_messages(created_at);
CREATE INDEX idx_team_files_message_id ON team_files(message_id);
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX idx_message_threads_parent_message_id ON message_threads(parent_message_id);
CREATE INDEX idx_message_threads_message_id ON message_threads(message_id);
CREATE INDEX idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX idx_message_mentions_user_id ON message_mentions(user_id);

-- Función para obtener mensajes de un equipo con información de usuario
CREATE OR REPLACE FUNCTION get_team_messages(team_id_param UUID)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  user_id UUID,
  username TEXT,
  message TEXT,
  has_attachment BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.team_id,
    tm.user_id,
    u.username,
    tm.message,
    tm.has_attachment,
    tm.created_at,
    tm.updated_at
  FROM 
    team_messages tm
  JOIN 
    users u ON tm.user_id = u.id
  WHERE 
    tm.team_id = team_id_param
  ORDER BY 
    tm.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener archivos de un mensaje
CREATE OR REPLACE FUNCTION get_message_files(message_id_param UUID)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tf.id,
    tf.message_id,
    tf.file_name,
    tf.file_type,
    tf.file_size,
    tf.file_path,
    tf.created_at
  FROM 
    team_files tf
  WHERE 
    tf.message_id = message_id_param
  ORDER BY 
    tf.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener reacciones de un mensaje
CREATE OR REPLACE FUNCTION get_message_reactions(message_id_param UUID)
RETURNS TABLE (
  reaction TEXT,
  count BIGINT,
  users JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mr.reaction,
    COUNT(*) as count,
    jsonb_agg(
      jsonb_build_object(
        'user_id', u.id,
        'username', u.username
      )
    ) as users
  FROM 
    message_reactions mr
  JOIN 
    users u ON mr.user_id = u.id
  WHERE 
    mr.message_id = message_id_param
  GROUP BY 
    mr.reaction
  ORDER BY 
    count DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener menciones de un mensaje
CREATE OR REPLACE FUNCTION get_message_mentions(message_id_param UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username
  FROM 
    message_mentions mm
  JOIN 
    users u ON mm.user_id = u.id
  WHERE 
    mm.message_id = message_id_param;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener mensajes de un hilo
CREATE OR REPLACE FUNCTION get_thread_messages(parent_message_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  message TEXT,
  has_attachment BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.user_id,
    u.username,
    tm.message,
    tm.has_attachment,
    tm.created_at
  FROM 
    message_threads mt
  JOIN 
    team_messages tm ON mt.message_id = tm.id
  JOIN 
    users u ON tm.user_id = u.id
  WHERE 
    mt.parent_message_id = parent_message_id_param
  ORDER BY 
    tm.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para crear un mensaje con menciones
CREATE OR REPLACE FUNCTION create_message_with_mentions(
  team_id_param UUID,
  user_id_param UUID,
  message_text TEXT,
  mentioned_users UUID[]
)
RETURNS UUID AS $$
DECLARE
  new_message_id UUID;
BEGIN
  -- Insertar el mensaje
  INSERT INTO team_messages (team_id, user_id, message)
  VALUES (team_id_param, user_id_param, message_text)
  RETURNING id INTO new_message_id;
  
  -- Insertar menciones si hay usuarios mencionados
  IF mentioned_users IS NOT NULL AND array_length(mentioned_users, 1) > 0 THEN
    INSERT INTO message_mentions (message_id, user_id)
    SELECT new_message_id, unnest(mentioned_users);
  END IF;
  
  RETURN new_message_id;
END;
$$ LANGUAGE plpgsql;

-- Función para crear un mensaje en un hilo
CREATE OR REPLACE FUNCTION create_thread_message(
  parent_message_id_param UUID,
  user_id_param UUID,
  message_text TEXT,
  mentioned_users UUID[]
)
RETURNS UUID AS $$
DECLARE
  new_message_id UUID;
  team_id_var UUID;
BEGIN
  -- Obtener el team_id del mensaje padre
  SELECT team_id INTO team_id_var
  FROM team_messages
  WHERE id = parent_message_id_param;
  
  -- Insertar el mensaje
  INSERT INTO team_messages (team_id, user_id, message)
  VALUES (team_id_var, user_id_param, message_text)
  RETURNING id INTO new_message_id;
  
  -- Insertar en la tabla de hilos
  INSERT INTO message_threads (parent_message_id, message_id)
  VALUES (parent_message_id_param, new_message_id);
  
  -- Insertar menciones si hay usuarios mencionados
  IF mentioned_users IS NOT NULL AND array_length(mentioned_users, 1) > 0 THEN
    INSERT INTO message_mentions (message_id, user_id)
    SELECT new_message_id, unnest(mentioned_users);
  END IF;
  
  RETURN new_message_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el campo updated_at en team_messages
CREATE OR REPLACE FUNCTION update_team_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_messages_updated_at
BEFORE UPDATE ON team_messages
FOR EACH ROW
EXECUTE FUNCTION update_team_messages_updated_at();
