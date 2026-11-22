# Quidditch entre amigos — prototipo (paso 1)

Qué incluye este primer paso:
- Una página web para el celular (en español, vertical, sin instalar nada).
- La administradora crea la sala con su contraseña y un código (ej.: `FIESTA`).
- Cada persona entra con nombre, casa y código. Máximo 20; no se repiten nombres.
- Elegir posición en el Equipo A o B (14 plazas únicas) o mirar como invitado.
- Si alguien se desconecta, su plaza queda guardada 1 minuto; al volver a abrir la página la recupera sola.
- "Prueba de pases": un cazador toma la pelota, elige a qué compañero pasar y le aparece la barra.
  Si toca en el verde, pase bueno; si falla o no toca en 6 s, la pelota pasa al otro equipo.

Todavía NO incluye: capitanes, cuenta regresiva, partido con reloj, tiro, bludgers, snitch, marcador ni informe final (son los siguientes pasos).

## Probarlo en tu computadora (opcional)
Necesita Node.js 18 o más nuevo.
```bash
npm install
```
```bash
ADMIN_PASSWORD=tu-clave npm start
```
Abre http://localhost:3000

Pruebas automáticas (20 clientes simulados):
```bash
npm test
```

## Publicarlo gratis en Render
1. Sube esta carpeta a un repositorio de GitHub (puede ser privado).
2. En https://render.com crea una cuenta, pulsa **New → Blueprint** y elige el repositorio.
   Render lee el archivo `render.yaml` y lo configura solo (plan gratuito).
3. Te pedirá **ADMIN_PASSWORD**: escribe la contraseña secreta de administración.
4. Al terminar te da una dirección tipo `https://quidditch-amigos.onrender.com`. Esa es la que compartes.

Importante del plan gratuito:
- Si nadie entra durante 15 minutos, se apaga. La primera visita después tarda ~1 minuto en despertar.
  **Abre la página unos minutos antes del evento.**
- Si se reinicia, las salas se borran (no hay base de datos). Habría que crear la sala de nuevo.

## Ajustes
En `server.js`, arriba del todo: tiempo de la barra (`limiteMs`), velocidad (`periodoMs`),
ancho del verde (`anchoZona`) y margen para la latencia (`tolerancia`).
