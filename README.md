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

Cabeceras útiles:

- `X-Cache`: `HIT` si la imagen vino de Redis, `MISS` si se generó con Playwright.
- `X-Response-Time`: tiempo aproximado del request en el servidor.
- `X-Revalidate: scheduled`: solo en `HIT`; indica que se programó una comprobación en segundo plano contra el origen (no retrasa la respuesta).

En caso de error: 400 (URL inválida) o 502 (fallo al capturar), body JSON con `error` y opcionalmente `detail`.

## Caché en Redis y revalidación

La API puede guardar la imagen en Redis y metadatos HTTP (`ETag` / `Last-Modified`) obtenidos al navegar con Playwright.

| Variable | Descripción |
|----------|-------------|
| `REDIS_URL` | URL de conexión Redis (ej. `redis://:password@host:6379`). |
| `CACHE_TTL` | Segundos de vida de la entrada en Redis. **`0` = sin caducidad** (no se usa `EX`; persiste hasta borrado o invalidación). Por defecto `1800` (30 min). |
| `REVALIDATE_ENABLED` | `true`/`false`. Si es `true`, tras cada respuesta **HIT** se lanza en background un `HEAD` (o `GET` condicional si el servidor no admite `HEAD`) para detectar cambios y **borrar** la clave en Redis si el origen indica recurso modificado. No bloquea la respuesta al cliente. |
| `REVALIDATE_LOCK_SECONDS` | Evita tormentas de peticiones concurrentes al mismo recurso (lock por clave de caché). Por defecto `30`. |
| `REVALIDATE_REQUEST_TIMEOUT_MS` | Timeout por petición de revalidación. Por defecto `10000`. |

**Limitaciones:** muchos sitios no envían `ETag`/`Last-Modified` fiables en el documento HTML, o el contenido visible depende de JavaScript; en esos casos no habrá revalidación automática (no hay validadores guardados) y la imagen solo cambiará si caduca el TTL o borras la clave en Redis. La miniatura puede quedar “vieja” hasta la **siguiente** petición que complete el chequeo en background tras un cambio real en el origen.

### GET /health

Comprueba que el servicio está activo. Responde `{ "status": "ok" }`.

## Uso desde el portfolio (Nuxt)

En tu API de Nuxt (`server/api/screenshot.get.ts`) puedes llamar a este servicio en lugar de PageShot:

```ts
const apiUrl = process.env.SCREENSHOT_API_URL || 'http://localhost:4000'
const res = await fetch(`${apiUrl}/screenshot?url=${encodeURIComponent(url)}&width=800&height=500`)
```

Configura `SCREENSHOT_API_URL` en producción con la URL pública de este servicio.

## Despliegue en CapRover

El proyecto incluye `Dockerfile` y `captain-definition` listos para CapRover.

1. Crea una nueva app en CapRover (ej. `screenshot-api`).
2. Conecta el repo (GitHub/GitLab) o despliega con `caprover deploy`.
3. CapRover detectará el `captain-definition` y construirá la imagen con el Dockerfile.
4. La app escucha en el puerto que CapRover asigne (por defecto 80).
5. Configura el dominio en CapRover (ej. `screenshot-api.tudominio.com`).

**Nota:** La primera captura puede tardar unos segundos mientras Chromium arranca. Si Chromium falla, revisa en CapRover → App Configs que el contenedor tenga memoria suficiente (recomendado ≥512 MB).

Configura `REDIS_URL` y, si quieres caché sin caducidad en Redis, `CACHE_TTL=0` (ver sección anterior).

## Licencia

ISC
