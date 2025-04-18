-- Esquema de base de datos para Supabase

-- Tabla de equipos
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios (extendiendo la tabla auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- Solo para compatibilidad con la migración, la autenticación real se hace con auth.users
  is_admin BOOLEAN DEFAULT FALSE,
  team_id UUID REFERENCES teams(id),
  team_name TEXT,
  team_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de transacciones
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  cost_type TEXT CHECK (cost_type IN ('fijo', 'variable')),
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de categorías
CREATE TABLE categories (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ahorros
CREATE TABLE savings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  balance DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de historial de ahorros
CREATE TABLE savings_history (
  id UUID PRIMARY KEY,
  savings_id UUID NOT NULL REFERENCES savings(id),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  amount DECIMAL NOT NULL,
  balance DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de seguridad (RLS)

-- Habilitar RLS en todas las tablas
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_history ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view users in their team" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE AND team_id = users.team_id
    )
  );

-- Políticas para teams
CREATE POLICY "Users can view their own team" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND team_id = teams.id
    )
  );

CREATE POLICY "Admins can update their own team" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE AND team_id = teams.id
    )
  );

-- Políticas para transactions
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own transactions" ON transactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own transactions" ON transactions
  FOR DELETE USING (user_id = auth.uid());

-- Políticas para categories
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Políticas para savings
CREATE POLICY "Users can view their own savings" ON savings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own savings" ON savings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own savings" ON savings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Políticas para savings_history
CREATE POLICY "Users can view their own savings history" ON savings_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert into their own savings history" ON savings_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Índices para mejorar el rendimiento
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_savings_user_id ON savings(user_id);
CREATE INDEX idx_savings_history_savings_id ON savings_history(savings_id);
CREATE INDEX idx_savings_history_user_id ON savings_history(user_id);
CREATE INDEX idx_savings_history_date ON savings_history(date);
CREATE INDEX idx_users_team_id ON users(team_id);

-- Función para actualizar el timestamp de actualización en savings
CREATE OR REPLACE FUNCTION update_savings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_savings_timestamp
BEFORE UPDATE ON savings
FOR EACH ROW
EXECUTE FUNCTION update_savings_updated_at();

-- Función para actualizar automáticamente el saldo de ahorros al insertar una transacción
CREATE OR REPLACE FUNCTION update_savings_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  savings_record RECORD;
  new_balance DECIMAL;
  transaction_amount DECIMAL;
BEGIN
  -- Obtener el registro de ahorros del usuario
  SELECT * INTO savings_record FROM savings WHERE user_id = NEW.user_id;
  
  -- Si no existe, crear uno
  IF NOT FOUND THEN
    INSERT INTO savings (id, user_id, balance)
    VALUES (gen_random_uuid(), NEW.user_id, 0)
    RETURNING * INTO savings_record;
  END IF;
  
  -- Calcular el nuevo saldo
  IF NEW.type = 'entrada' THEN
    transaction_amount := NEW.amount;
  ELSE
    transaction_amount := -ABS(NEW.amount);
  END IF;
  
  new_balance := savings_record.balance + transaction_amount;
  
  -- Actualizar el saldo
  UPDATE savings
  SET balance = new_balance, updated_at = NOW()
  WHERE id = savings_record.id;
  
  -- Registrar en el historial
  INSERT INTO savings_history (
    id, savings_id, user_id, date, type, description, amount, balance
  ) VALUES (
    gen_random_uuid(),
    savings_record.id,
    NEW.user_id,
    NEW.date,
    CASE WHEN NEW.type = 'entrada' THEN 'Ingreso' ELSE 'Gasto' END,
    NEW.description,
    transaction_amount,
    new_balance
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_savings_after_transaction
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_savings_on_transaction();

-- Función para actualizar el saldo de ahorros al eliminar una transacción
CREATE OR REPLACE FUNCTION update_savings_on_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  savings_record RECORD;
  new_balance DECIMAL;
  transaction_amount DECIMAL;
BEGIN
  -- Obtener el registro de ahorros del usuario
  SELECT * INTO savings_record FROM savings WHERE user_id = OLD.user_id;
  
  -- Si no existe, no hacer nada
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;
  
  -- Calcular el nuevo saldo (inverso a la inserción)
  IF OLD.type = 'entrada' THEN
    transaction_amount := -OLD.amount;
  ELSE
    transaction_amount := ABS(OLD.amount);
  END IF;
  
  new_balance := savings_record.balance + transaction_amount;
  
  -- Actualizar el saldo
  UPDATE savings
  SET balance = new_balance, updated_at = NOW()
  WHERE id = savings_record.id;
  
  -- Registrar en el historial
  INSERT INTO savings_history (
    id, savings_id, user_id, date, type, description, amount, balance
  ) VALUES (
    gen_random_uuid(),
    savings_record.id,
    OLD.user_id,
    CURRENT_DATE,
    'Eliminación',
    'Transacción eliminada: ' || OLD.description,
    transaction_amount,
    new_balance
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_savings_after_transaction_delete
AFTER DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_savings_on_transaction_delete();
