# Screenshot API

API para obtener previews (screenshots) de sitios web. Usa Playwright para capturar la página y devuelve la imagen.

## Requisitos

- Node.js 18+
- Dependencias del navegador: Playwright instala Chromium al hacer `npm install`. En Linux puede ser necesario instalar libs del sistema (ver [Playwright](https://playwright.dev/docs/intro)).

## Instalación

```bash
npm install
```

La primera vez, Playwright descargará Chromium (~200 MB).

## Uso

```bash
npm run dev   # desarrollo con --watch
npm start     # producción
```

Por defecto el servidor escucha en el puerto **4000** (configurable con la variable de entorno `PORT`).

## Endpoints

### GET /screenshot

Genera una captura de la URL indicada.

| Query    | Tipo    | Descripción                          | Por defecto |
|----------|---------|--------------------------------------|-------------|
| `url`    | string  | URL del sitio (http o https)         | requerido   |
| `width`  | number  | Ancho del viewport (px), máx 1920    | 1280        |
| `height` | number  | Alto del viewport (px), máx 1080     | 800         |
| `format` | string  | `jpeg` o `png`                       | jpeg        |
| `fullPage` | string | `true` para captura de toda la página | false     |

**Ejemplo**

```text
GET http://localhost:4000/screenshot?url=https://example.com&width=800&height=500
```

Respuesta: imagen (Content-Type: image/jpeg o image/png) con cabecera `Cache-Control: public, max-age=86400`.

En caso de error: 400 (URL inválida) o 502 (fallo al capturar), body JSON con `error` y opcionalmente `detail`.

### GET /health

Comprueba que el servicio está activo. Responde `{ "status": "ok" }`.

## Uso desde el portfolio (Nuxt)

En tu API de Nuxt (`server/api/screenshot.get.ts`) puedes llamar a este servicio en lugar de PageShot:

```ts
const apiUrl = process.env.SCREENSHOT_API_URL || 'http://localhost:4000'
const res = await fetch(`${apiUrl}/screenshot?url=${encodeURIComponent(url)}&width=800&height=500`)
```

Configura `SCREENSHOT_API_URL` en producción con la URL pública de este servicio.

## Licencia

ISC
