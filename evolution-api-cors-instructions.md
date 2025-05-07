# Configuración de CORS para Evolution API

## Introducción

CORS (Cross-Origin Resource Sharing) es un mecanismo de seguridad implementado por los navegadores web que impide que una página web haga solicitudes a un dominio diferente al que la sirve, a menos que el servidor de destino lo permita explícitamente mediante encabezados HTTP específicos.

En el caso de Evolution API, necesitamos configurar CORS para permitir solicitudes desde tu dominio (`https://grupo-hibrid.vercel.app`).

## Opciones para resolver el problema de CORS

### Opción 1: Configurar CORS en Evolution API

Si tienes acceso al servidor donde se ejecuta Evolution API, puedes configurar CORS directamente:

1. Accede al archivo de configuración de Evolution API (normalmente en el directorio de instalación)
2. Busca la sección de configuración de CORS o middleware
3. Añade tu dominio a la lista de orígenes permitidos

### Opción 2: Usar el proxy integrado de Evolution API

Evolution API tiene una función de proxy integrada que puedes configurar desde la interfaz de administración:

1. Accede a la interfaz de administración de Evolution API
2. Ve a la sección "Configurations" > "Proxy"
3. Habilita el proxy
4. Configura los siguientes parámetros:
   - Protocol: http
   - Host: localhost (o la IP del servidor donde se ejecuta tu aplicación)
   - Port: 3000 (o el puerto donde se ejecuta tu aplicación)
   - Username: (déjalo en blanco si no necesitas autenticación)
   - Password: (déjalo en blanco si no necesitas autenticación)

### Opción 3: Usar un proxy del lado del servidor (implementado)

Hemos implementado un proxy del lado del servidor en tu aplicación de Vercel que actúa como intermediario entre tu frontend y Evolution API. Esta solución evita los problemas de CORS porque las solicitudes se hacen desde el servidor, no desde el navegador.

El proxy está implementado en:
- `/pages/api/proxy.js`

Y se utiliza en:
- `whatsappIntegration.js`

## Solución actual

Actualmente estamos usando la Opción 3: un proxy del lado del servidor en tu aplicación de Vercel. Esta solución debería funcionar correctamente y no requiere cambios en la configuración de Evolution API.

## Próximos pasos

1. Probar la integración con el proxy del lado del servidor
2. Si el proxy funciona correctamente, no es necesario configurar CORS en Evolution API
3. Si el proxy no funciona, considera configurar CORS directamente en Evolution API (Opción 1) o usar el proxy integrado de Evolution API (Opción 2)

## Recursos adicionales

- [Documentación de Evolution API](https://doc.evolution-api.com/)
- [Documentación de CORS en MDN](https://developer.mozilla.org/es/docs/Web/HTTP/CORS)
- [Documentación de Vercel API Routes](https://vercel.com/docs/concepts/functions/serverless-functions)
