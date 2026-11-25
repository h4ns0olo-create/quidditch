# Copa de las Casas: marcador de puntos

Marcador público de los puntos de las cuatro casas, con tubos de gemas que se
actualizan solos en todos los celulares. Es un proyecto aparte del juego de
Quidditch: vive en esta carpeta (`marcador/`) y se publica por separado, gratis,
en Cloudflare.

- **Página pública:** `https://marcador-casas.<tu-subdominio>.workers.dev/`
- **Personal:** la misma dirección + `/personal`

## Cómo funciona (en palabras simples)

- **Cloudflare Workers** sirve las páginas. Es gratis y no "se duerme".
- **Un Durable Object** (un pequeño "guardián") guarda los puntos y el registro
  en una base de datos SQLite permanente. Atiende los cambios de uno en uno, así
  que si dos personas suman a la vez, no se pierde ninguno.
- **WebSocket**: cada celular queda conectado y recibe los puntos nuevos al
  instante. Si se corta la conexión, la página reconecta sola.
- **Las contraseñas** no están en el código: se guardan como *secretos* en
  Cloudflare.

## Límites del plan gratuito (revisados el 25-11-2026)

| Qué | Gratis por día | Lo que usaría este marcador |
|---|---|---|
| Peticiones al Worker | 100 000 | Unas pocas por visita |
| Peticiones al Durable Object | 100 000 | 1 por conexión + 1 por cada 20 "ping" |
| Filas escritas en SQLite | 100 000 | Unas 3 por cambio de puntos |
| Filas leídas en SQLite | 5 millones | Muy pocas (el estado se guarda en memoria) |
| Almacenamiento | 5 GB en total | Unos pocos kilobytes |
| Páginas, estilos y dibujos | Ilimitado y gratis | |

Con 80 personas mirando varias horas al día se usa menos del 5 % del límite.
Si alguna vez se pasara, Cloudflare no cobra nada: solo deja de funcionar hasta
las 00:00 (hora UTC), cuando el contador se reinicia.

## Pasos para publicarlo

### 1. Crear la cuenta de Cloudflare (gratis, sin tarjeta)

1. Entra a **https://dash.cloudflare.com/sign-up**
2. Escribe tu correo y una contraseña, y toca **Create Account**.
3. Abre el correo que te manda Cloudflare y toca el enlace para verificarlo.
4. Si en algún momento te pide tarjeta de crédito, **detente y avísame**. Para
   esto no hace falta.

### 2. Conectar este repositorio de GitHub (hecho el 25-11-2026)

1. En el panel de Cloudflare: menú **Build → Compute → Workers & Pages** → **Create**
   (o el botón **Create app** de la portada).
2. Elige **GitHub**, autoriza a Cloudflare y elige el repositorio `quidditch`.
3. En **Set up your application**:
   - **Project name:** `marcador-casas` (tiene que ser exactamente este)
   - **Build command:** vacío
   - **Deploy command:** `npx wrangler deploy`
   - **Advanced settings → Path:** `/marcador`
   - **API token:** "Create new token"
   - **Variable name / value:** vacío (¡las contraseñas NO van aquí!)
4. Toca **Deploy**. La primera vez falla con "root directory not found" porque
   usa la rama `main`. Se arregla en **Settings → Builds → Production branch**:
   `claude/harry-potter-house-scoreboard-0hwz57`. Desde entonces, cada cambio que
   se sube a esa rama se publica solo.

### 3. Poner las 14 contraseñas (secretos)

Worker `marcador-casas` → **Settings** → **Variables and Secrets** → **Add**.
Para cada fila de la tabla: en **Type** elige **Secret**, escribe el nombre
exacto en **Variable name** y la contraseña en **Value**. Con **Add variable**
agregas la siguiente. Al terminar, toca **Deploy**.

| Variable name | Para quién |
|---|---|
| `CLAVE_CRIATURAS` | Cuidado de criaturas mágicas |
| `CLAVE_POCIONES_MAYORES` | Pociones (años mayores) |
| `CLAVE_POCIONES_MENORES` | Pociones (años menores) |
| `CLAVE_HISTORIA` | Historia de la magia |
| `CLAVE_DCLAO` | DCLAO |
| `CLAVE_ENCANTAMIENTOS` | Encantamientos |
| `CLAVE_VUELO` | Vuelo |
| `CLAVE_APARICION` | Aparición |
| `CLAVE_ARITMANCIA` | Aritmancia |
| `CLAVE_ASTRONOMIA` | Astronomía |
| `CLAVE_RUNAS` | Runas antiguas |
| `CLAVE_ADIVINACION` | Adivinación |
| `CLAVE_DIRECTORA` | Directora |
| `CLAVE_DESARROLLADOR` | Tú (desarrolladora) |

Reglas de las contraseñas:
- Mínimo 6 caracteres (mejor 10 o más). Las más cortas se ignoran.
- Las 14 tienen que ser distintas.
- Para cambiar una, edita el secreto y toca **Deploy**. Las sesiones abiertas
  con la contraseña vieja se cierran solas.
- Los secretos se conservan aunque el código se vuelva a publicar.

## Qué puede hacer cada contraseña

| | Sumar/restar | Ver el registro | Herramientas (deshacer, fijar, reiniciar, máximo) |
|---|---|---|---|
| Curso (12) | ✔ | | |
| Directora | ✔ | ✔ (solo lectura) | |
| Desarrolladora | ✔ | ✔ | ✔ |

- Máximo 100 puntos por cambio (la desarrolladora puede cambiarlo, hasta 1000).
- Ninguna casa puede quedar en negativo.
- Tras 5 contraseñas equivocadas seguidas desde el mismo lugar, se bloquea 15 minutos.
- Todo esto lo revisa el servidor, no solo la pantalla.

## Para programar (no hace falta para usarlo)

```bash
cd marcador
npm install
# crea .dev.vars con CLAVE_...="prueba-..." (ver test/prueba-carga.mjs)
npx wrangler dev        # servidor local en http://127.0.0.1:8787
npm test                # 80 visitantes, 260 cambios simultáneos, permisos
```

Archivos:
- `src/worker.js`: servidor (puntos, contraseñas, registro, tiempo real)
- `public/index.html`, `marcador.js`, `marcador.css`: página pública
- `public/personal.html`, `personal.js`, `personal.css`: pantallas del personal
- `public/gemas.js`: dibujo de tubos, gemas y animales (SVG hecho desde cero)
- `public/escena.js`: cielo, luna, castillo, lago y niebla
- `public/envivo.js`: conexión en vivo con reconexión automática
