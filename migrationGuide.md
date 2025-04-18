# Guía de Migración de IndexedDB a Supabase

Esta guía explica cómo migrar los datos de la aplicación GHS Finanzas de IndexedDB a Supabase.

## ¿Qué es Supabase?

Supabase es una alternativa de código abierto a Firebase que proporciona una base de datos PostgreSQL, autenticación, almacenamiento y funciones en tiempo real. Al migrar a Supabase, obtendrás:

- **Acceso desde cualquier dispositivo**: Tus datos estarán disponibles en la nube.
- **Mayor seguridad**: Autenticación robusta y políticas de seguridad a nivel de fila.
- **Sincronización en tiempo real**: Cambios reflejados instantáneamente en todos los dispositivos.
- **Respaldo automático**: Tus datos estarán seguros con copias de seguridad regulares.

## Requisitos previos

1. Cuenta en Supabase (gratuita para proyectos pequeños)
2. Proyecto creado en Supabase
3. Credenciales de API de Supabase (URL y clave anónima)

## Pasos para la migración

### 1. Configuración del entorno

1. Crea un archivo `.env` en la raíz del proyecto basado en `.env.example`
2. Completa las variables de entorno de Supabase:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-clave-anon-publica
   ```

### 2. Instalación de dependencias

Ejecuta el siguiente comando para instalar las dependencias necesarias:

```bash
npm install
```

### 3. Migración de datos

1. Inicia sesión en la aplicación
2. Ve a la sección "Configuración"
3. Haz clic en el botón "Migrar a Supabase"
4. Sigue las instrucciones en pantalla para completar la migración

### 4. Verificación

Después de la migración:

1. Cierra sesión y vuelve a iniciar sesión
2. Verifica que todos tus datos estén disponibles
3. Prueba las funcionalidades principales de la aplicación

## Solución de problemas

### Error de autenticación

Si tienes problemas para iniciar sesión después de la migración:

1. Asegúrate de usar el correo electrónico correcto
2. Restablece tu contraseña haciendo clic en "¿Olvidaste tu contraseña?"
3. Si el problema persiste, contacta al soporte

### Datos faltantes

Si algunos datos no aparecen después de la migración:

1. Verifica que hayas completado todo el proceso de migración
2. Intenta actualizar la página
3. Si el problema persiste, contacta al soporte

## Ventajas de usar Supabase

- **Acceso multiplataforma**: Accede a tus datos desde cualquier dispositivo
- **Trabajo en equipo**: Comparte datos con miembros de tu equipo
- **Mayor seguridad**: Tus datos están protegidos con políticas de seguridad avanzadas
- **Mejor rendimiento**: Consultas más rápidas y eficientes
- **Escalabilidad**: La aplicación puede crecer sin problemas de rendimiento

## Preguntas frecuentes

### ¿Puedo seguir usando la aplicación sin migrar?

Sí, la aplicación seguirá funcionando con IndexedDB, pero no podrás acceder a tus datos desde otros dispositivos.

### ¿Se eliminarán mis datos locales después de la migración?

No, tus datos locales permanecerán intactos. La migración copia tus datos a Supabase sin eliminar los datos locales.

### ¿Puedo volver a usar IndexedDB después de migrar?

Sí, puedes cambiar entre IndexedDB y Supabase en la sección de configuración.

### ¿La migración tiene algún costo?

No, la migración es gratuita. Supabase ofrece un plan gratuito que es suficiente para la mayoría de los usuarios.

### ¿Mis datos están seguros en Supabase?

Sí, Supabase implementa medidas de seguridad avanzadas y políticas de acceso a nivel de fila para proteger tus datos.
