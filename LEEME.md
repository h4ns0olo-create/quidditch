# Quidditch — juego para el evento

Cómo funciona (paso 3):
- **El administrador** crea la sala con su contraseña, un código y las dos casas que juegan. Luego entra como
  **Invitado → Administración** (pide la contraseña) y desde ahí elige la duración (10, 15 o 20 min) y lanza la moneda.
- **Entrada:** nombre, casa y código. Si tu casa no juega, no te deja entrar con ella (entra como Invitado).
  Con tu casa solo puedes elegir posiciones de tu equipo. Como Invitado: comentarista de cada equipo (máx. 2),
  prefecto o administración.
- **Una vez elegida la función no se puede cambiar.** Si alguien se equivoca: "Salir de la sala" (libera al instante)
  y volver a entrar. Si se desconecta sin querer, su plaza le espera 1 minuto. Durante el partido, si alguien se va,
  su plaza queda vacía hasta el final.
- **Inicio:** moneda al azar con los animales de las dos casas; empieza con la quaffle la que sale. Cuenta atrás 3-2-1.
- **Reloj** visible para todos. La snitch aparece a la mitad y a los 3/4 (en 20 min: minuto 10 y 15).
- **Quaffle** (cazadores, barra): 10 s para pasar o lanzar o se pierde. 2 pases buenos para lanzar (con 1 solo
  cazador, tiro directo). Al perderla (pase fallido, gol, atajada, bludger o tardar) pasa al otro equipo.
- **Tiro:** cazador (barra) contra guardián (aguja), misma zona y velocidad. Gana quien acierta primero:
  si el guardián ataja antes de que el cazador lance, es atajada; si el cazador lanza antes, es gol (10 puntos).
- **Bludgers** (golpeadores, círculo): una cada 20 s por equipo contra quien lleva la quaffle; los golpeadores
  rivales tienen 3 s para repelerla.
- **Snitch** (buscadores): al mejor de 3 rondas. "Espera…", aparece la snitch y gana quien toca primero; tocar antes
  pierde la ronda. Quien la atrapa suma 150 y termina el partido (gana quien tenga más puntos).
- **Fin por tiempo:** gana quien tenga más puntos. Empate: muerte súbita de snitch.
- **Informe final** con el resultado y las jugadas de cada jugador, visible para todos los que sigan en la sala.
- Los jugadores no ven el registro de jugadas (solo los invitados). Los comentaristas escriben y sus comentarios
  aparecen como banners para todos.

Todavía NO incluye: capitanes que confirman el inicio y corrección del marcador por la administración.

## Probarlo en tu computadora (opcional)
Necesita Node.js 18 o más nuevo.
```bash
npm install
```
```bash
ADMIN_PASSWORD=tu-clave npm start
```
Abre http://localhost:3000

Pruebas automáticas (20 clientes simulados, tardan unos 2-3 minutos):
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
En `server.js`, arriba del todo: puntos por gol y snitch, duraciones, momentos de la snitch, tiempo para pasar, espera entre bludgers,
y en `RETOS` el ancho de la zona (`ancho`), la velocidad (`periodo`) y el tiempo (`limite`) de cada minijuego.
