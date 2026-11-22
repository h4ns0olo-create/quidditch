# Quidditch entre amigos — prototipo (paso 1)

Qué incluye (paso 2):
- Página para el celular con los colores y emblemas de las casas 🦁🐍🦅🦡 y un mapa del campo con las posiciones
  (cazador = círculo, golpeador = rombo, guardián = escudo, buscador = estrella; la quaffle es la bolita roja).
- El administrador crea la sala con su contraseña, un código y las dos casas que juegan.
- Entrada con nombre, casa y código. Máximo 20; no se repiten nombres. Plaza guardada 1 minuto si alguien se desconecta.
- Jugadas de prueba (en el lobby):
  - **Pase** (cazadores, barra): 2 pases buenos permiten lanzar. Pueden ir y volver entre 2 cazadores;
    si un equipo se queda con 1 solo cazador, puede lanzar directo.
  - **Lanzar a la meta**: botón especial. El cazador hace la barra y el guardián rival la aguja; gol si el
    cazador acierta más cerca del centro que el guardián. Gol = 10 puntos.
  - **Bludger** (golpeadores, círculo): cuando el rival tiene la quaffle, un golpeador la batea (una cada 20 s por
    equipo). Si acierta, los golpeadores rivales tienen 3 s para repelerla; si nadie lo logra, se pierde la quaffle.
- Los jugadores no ven el registro de jugadas: solo lo ven los invitados. Los comentaristas escriben y sus
  comentarios aparecen como banners arriba en la pantalla de todos.

Todavía NO incluye: capitanes, cuenta regresiva, partido con reloj, snitch, corrección de marcador ni informe final.

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
En `server.js`, arriba del todo: puntos por gol, espera entre bludgers,
y en `RETOS` el ancho de la zona (`ancho`), la velocidad (`periodo`) y el tiempo (`limite`) de cada minijuego.
