# GHS Finanzas - Aplicación Financiera con IA

Una aplicación de finanzas y contabilidad con asistente IA integrado.

## Características

- Gestión de usuarios y equipos
- Registro de transacciones financieras
- Visualización de datos y estadísticas
- Chat con IA para consultas financieras
- Gestión de categorías y presupuestos
- Almacenamiento local con IndexedDB o en la nube con Supabase
- Sincronización entre dispositivos (con Supabase)
- Trabajo colaborativo en equipo (con Supabase)

## Requisitos

- Node.js 14 o superior
- NPM o Yarn

## Desarrollo local

1. Clona este repositorio
2. Instala las dependencias:
   ```
   npm install
   ```
3. Crea un archivo `.env` con las siguientes variables:
   ```
   OPENROUTER_API_KEY=tu_clave_api_openrouter
   PORT=3000
   ADMIN_ACCESS_CODE=tu_codigo_admin
   NODE_ENV=development
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu_clave_anon_publica
   ```
4. Inicia el servidor de desarrollo:
   ```
   npm run dev
   ```
5. Visita `http://localhost:3000` en tu navegador

## Despliegue en Vercel

### 1. Preparación

1. Asegúrate de tener una cuenta en [Vercel](https://vercel.com)
2. Conecta tu repositorio de GitHub, GitLab o Bitbucket a Vercel
3. Configura las variables de entorno en Vercel:
   - `OPENROUTER_API_KEY`: Tu clave API de OpenRouter
   - `ADMIN_ACCESS_CODE`: El código para crear cuentas de administrador
   - `NODE_ENV`: Establece como `production`
   - `SUPABASE_URL`: URL de tu proyecto en Supabase
   - `SUPABASE_ANON_KEY`: Clave anónima pública de Supabase

### 2. Configuración del proyecto

El archivo `vercel.json` ya contiene la configuración necesaria para el despliegue, incluyendo:
- Rutas para archivos estáticos
- Configuración para el servidor Node.js
- Redirecciones y encabezados necesarios

### 3. Despliegue

1. Desde el dashboard de Vercel:
   - Importa tu repositorio
   - Verifica las variables de entorno
   - Haz clic en "Deploy"

2. O desde la línea de comandos:
   ```
   npm install -g vercel
   vercel login
   vercel --prod
   ```

## Estructura de archivos

- `server.js`: Servidor Express con APIs para OpenRouter
- `index.html`: Aplicación principal
- `financeAI.js`: Lógica de interacción con la IA
- `style.css` y `neomorphic-buttons.css`: Estilos de la aplicación
- `vercel.json`: Configuración para despliegue en Vercel
- `supabaseClient.js`: Cliente para interactuar con Supabase
- `supabaseService.js`: Servicios para operaciones CRUD con Supabase
- `migrationService.js`: Servicios para migrar datos de IndexedDB a Supabase
- `migrationUI.js`: Interfaz de usuario para la migración
- `supabaseIntegration.js`: Integración de Supabase en la aplicación
- `appInit.js`: Inicialización de la aplicación con soporte para Supabase

## Funcionamiento con base de datos

La aplicación puede utilizar dos sistemas de almacenamiento:

### IndexedDB (Local)

- Almacenamiento en el navegador del usuario
- No requiere conexión a internet
- Los datos solo están disponibles en el dispositivo actual
- Ideal para uso personal en un solo dispositivo

### Supabase (Nube)

- Base de datos PostgreSQL en la nube
- Requiere conexión a internet
- Los datos están disponibles en cualquier dispositivo
- Permite trabajo colaborativo en equipo
- Incluye autenticación segura y políticas de acceso

### Migración

La aplicación incluye una herramienta para migrar datos de IndexedDB a Supabase. Para más detalles, consulta el archivo `migrationGuide.md`.

## API Endpoints

- `/api/ping`: Verificar estado del servidor
- `/api/config`: Obtener configuración del administrador
- `/api/models`: Listar modelos de IA disponibles
- `/api/chat/completions`: Enviar mensajes a la IA

## Modelos de IA disponibles

- Google Gemini Flash
- Google Gemini Pro
- Anthropic Claude 3 Haiku
- Meta Llama 3
- OpenAI GPT-3.5 Turbo (fallback)

## Licencia

Todos los derechos reservados.