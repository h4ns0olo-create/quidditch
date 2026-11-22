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
- **Reloj** visible para todos. Desde la mitad del partido (en 20 min: desde el minuto 10) la snitch aparece de vez en cuando.
- **Quaffle** (cazadores, barra): 10 s para pasar o lanzar o se pierde. 2 pases buenos para lanzar (con 1 solo
  cazador, tiro directo). Al perderla (pase fallido, gol, atajada, bludger o tardar) pasa al otro equipo.
- **Tiro:** cazador (barra) contra guardián (aguja), misma zona y velocidad. Gana quien acierta primero:
  si el guardián ataja antes de que el cazador lance, es atajada; si el cazador lanza antes, es gol (10 puntos).
- **Bludgers** (golpeadores, círculo): una cada 20 s por equipo contra quien lleva la quaffle; los golpeadores
  rivales tienen 3 s para repelerla.
- **Snitch** (buscadores): aparece **solo un instante** (0,8 s la primera vez; cada vez que se escapa, la siguiente dura menos, hasta 0,4 s) y se va volando. El primero
  que la toca a tiempo la atrapa: +150 y termina el partido (gana quien tenga más puntos). Si nadie la atrapa, vuelve a
  aparecer más tarde, hasta que alguien la atrape. Tocar antes (o tocar la polilla) hace que esa vez se te escape.
- **Fin por tiempo:** gana quien tenga más puntos. Empate: muerte súbita de snitch.
- **Informe final** con el resultado y las jugadas de cada jugador, visible para todos los que sigan en la sala.
- Los jugadores no ven el registro de jugadas (solo los invitados). Los comentaristas escriben y sus comentarios
  aparecen como banners para todos.

**Entrenamientos** (paso 4):
- Al crear la sala se elige **Partido oficial** o **Entrenamiento**.
- Entrenamiento: se elige el tamaño: 3 contra 3 (2 cazadores + guardián, sin snitch), 4 contra 4 con buscador,
  4 contra 4 con golpeador o 5 contra 5. Sin comentaristas, y todos ven las jugadas. Se puede elegir la misma casa dos veces ("Slytherin 1" contra "Slytherin 2") o dos casas distintas.
- **Clave de capitanes** (`CAPITAN_PASSWORD` en Render): sirve solo para crear y dirigir entrenamientos.
  La contraseña de administración sirve para todo.
- **Administrar y jugar a la vez:** cualquiera con la contraseña toca "🔑 Activar administración" (abajo, en
  Invitados) sin perder su posición. Quien crea la sala ya entra con la administración activada.

**Gráficos** (paso 5): estadio con gradas, torres y banderines de las casas; jugadores dibujados sobre escoba
(cada posición con su detalle: quaffle, bate, guantes o alas); animaciones en el campo para todos (la quaffle vuela
en los pases y tiros, las bludgers, la snitch revoloteando); brillo en quien está jugando un reto; "¡GOL!" con
confeti; escenas en cada minijuego; podio con el jugador destacado al final; y sonidos (botón 🔊 para apagarlos).

**Duelos, práctica libre y dificultad** (paso 6):
- **⚔️ Duelos** (sala aparte, con la clave de administración o de capitanes): el capitán elige a dos aspirantes a
  **buscador** (gana quien atrapa la snitch primero) o **guardián** (gana quien ataja primero, con la aguja en lo
  verde, tras el aviso "¡TIRO!"). Al mejor de 3, 5 o 7 (por defecto 5). Los demás miran con comentarios automáticos.
  Al final: ganador, reacción media y mejor tiempo de cada uno.
- **🎯 Práctica libre** (botón en la portada, sin sala): cada uno practica el minijuego de su posición; 3 vidas, cada
  acierto sube de nivel y se guarda el récord en el celular. En la del buscador, la snitch se deja ver cada vez menos
  (de 0,8 s hasta 0,25 s).
- **Dificultad que sube:** en partidos y entrenamientos la zona se achica y la marca acelera con el reloj; en los
  duelos, ronda a ronda; en la práctica, nivel a nivel.
- **Señuelos:** una polilla dorada (parecida a la snitch pero con alas anchas, sin bolita, más ámbar y sin iluminar el
  fondo). Tocarla pierde la ronda. Salen desde la 2.ª aparición de la snitch y en la muerte súbita, desde la ronda 3
  en los duelos y desde el nivel 3 en la práctica.

Todavía NO incluye: corrección del marcador por la administración.

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
