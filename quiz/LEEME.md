# Quiz de clases — guía

Mini web para los quizzes de las clases del rol. Es un **proyecto y un servicio aparte** del Quidditch:
vive en esta carpeta `quiz/` y en Render es otro servicio, con su propia dirección.

## Qué hace (versión 2)
- **Aspecto:** hoja de cuaderno rayada de Hogwarts (margen rojo, agujeros de carpeta, notas a mano, papelitos
  con cinta). Cada asignatura tiene su dibujito y cada casa su escudo con su animal (león, tejón, águila, serpiente).
  Los dibujos están hechos a mano en `public/dibujos.js` y las tipografías van dentro de `public/fuentes/`
  (licencia libre), así que no depende de ningún servicio externo.
- **Profesor:** entra con la contraseña de su asignatura (solo ve la suya). Escribe **de 5 a 10 preguntas** en el
  formulario (botones "+ Añadir pregunta" y "− Quitar la última") o pega todo el texto. Al abrir el quiz recibe un
  **código** (en una pizarra) y un **enlace** para compartir por Instagram. Ve en directo quién entró y cuánto lleva.
  Puede **borrar un intento** hecho por error. Cuando quiera, toca **Cerrar quiz y publicar resultados**.
- **Alumno:** entra con el código, el nombre de su personaje y su casa. Responde a su ritmo, sin volver atrás,
  con tiempo por pregunta (por defecto 20 s). Las preguntas y las alternativas salen en otro orden para cada uno.
  Al terminar ve "Esperando resultados…" hasta que el profesor publica.
- **Cómo se cuentan los puntos de cada casa** (lo elige el profesor; la página se lo explica con un ejemplo):
  - **Promedio por alumno (por defecto, recomendado):** aciertos de la casa ÷ alumnos que participaron. Así no gana
    la casa que tuvo más gente conectada, sino la que, en proporción, sabe más.
  - **Suma:** cada acierto es un punto para su casa. Solo es justo si las casas tienen más o menos los mismos alumnos.
  Mientras el quiz está abierto, el panel avisa si las casas tienen distinto número de alumnos.
- **Resultados:** la lista con los nombres solo si el profesor la activa. **Imagen PNG** (hoja de cuaderno con el
  dibujito de la asignatura, la casa ganadora, medallas de 1.º a 4.º y todos los alumnos por casa, hasta 80):
  el profesor siempre la puede descargar; los alumnos solo si él lo permite.
- **Reglas:** 1 punto por acierto. Máximo 80 participantes y 20 por casa. Un nombre no se puede repetir en el
  mismo quiz (da igual mayúsculas o tildes) y el celular recuerda que ya respondió. El tiempo lo controla el
  servidor: recargar la página no lo reinicia y una respuesta tardía no cuenta. Un solo quiz activo por curso:
  abrir otro reemplaza al anterior. Varios cursos pueden tener quiz abierto a la vez.
- **Borrado automático:** 30 minutos después de publicar, al abrir otro quiz en ese curso, o 3 horas después de
  abrirlo si nunca se publicó.

### Formato para pegar las preguntas
```
1. ¿Qué criatura vigila la cámara?
a) Un hipogrifo
b) Un dragón *
c) Un escreguto

2. ¿De qué color es la poción?
a) Azul
b) Verde *
c) Roja
```
La correcta se marca con un asterisco `*`. Al tocar "Pasar al formulario", las preguntas aparecen en el
formulario para revisarlas antes de abrir el quiz.

## Las contraseñas de los cursos
Se guardan las 12 en **una sola variable** de Render llamada `CLAVES_CURSOS`, así:
```
1=fenix; 2=bezoar; 3=mandragora; 4=duende; 5=patronus; 6=lumos; 7=escoba; 8=traslador; 9=numerologia; 10=telescopio; 11=futhark; 12=bolacristal
```
(número del curso, signo `=`, contraseña; separadas por punto y coma `;`). Son ejemplos: **inventa las tuyas**.
- No uses `;` dentro de una contraseña. Mayúsculas y tildes dan igual al escribirla.
- Cada curso necesita una contraseña distinta. Si dos se repiten, esos dos cursos no podrán entrar.
- Para el prototipo basta con poner solo el curso 1, por ejemplo `1=fenix`.

| N.º | Curso | N.º | Curso |
|---|---|---|---|
| 1 | Cuidado de criaturas mágicas | 7 | Vuelo |
| 2 | Pociones (años mayores) | 8 | Aparición |
| 3 | Pociones (años menores) | 9 | Aritmancia |
| 4 | Historia de la magia | 10 | Astronomía |
| 5 | DCLAO | 11 | Runas antiguas |
| 6 | Encantamientos | 12 | Adivinación |

Para comprobar que quedó bien: abre `https://TU-DIRECCION.onrender.com/salud`. Debe decir
`"cursosConfigurados":12` (o 1 si solo pusiste el curso 1).

Para cambiar una contraseña: Render → tu servicio del quiz → **Environment** → editar `CLAVES_CURSOS` →
**Save Changes**. El servicio se reinicia solo (los quizzes abiertos en ese momento se pierden: hazlo cuando no
haya clase).

## Publicarlo gratis en Render (paso a paso)
Necesitas dos cuentas gratuitas, ninguna pide tarjeta:
- **GitHub** (github.com): guarda el código. Es como una carpeta en internet; yo escribo ahí el código.
- **Render** (render.com): hace funcionar la página y te da la dirección para compartir. Lee el código de GitHub.

Si ya tienes las cuentas del Quidditch, usa las mismas. Si no:
1. Crea la cuenta en github.com (correo y contraseña).
2. Crea la cuenta en render.com con el botón **GitHub** (así quedan conectadas).

Crear el servicio del quiz:
1. En Render, arriba a la derecha, toca **+ New** → **Web Service**.
2. Elige el repositorio **quidditch** (si no aparece, toca *Configure GitHub* y dale permiso a ese repositorio).
3. Rellena:
   - **Name:** `quiz-clases` (esto forma la dirección, p. ej. `https://quiz-clases.onrender.com`)
   - **Branch:** la rama donde está el quiz (la que te indique; luego será `main`)
   - **Root Directory:** `quiz`  ← importante, así Render usa solo esta carpeta
   - **Runtime / Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. Más abajo, en **Environment Variables**, toca **Add Environment Variable**:
   - **Key:** `CLAVES_CURSOS`
   - **Value:** tu lista de contraseñas (ver arriba)
5. Toca **Deploy Web Service**. Tarda unos minutos. Cuando diga **Live**, arriba aparece tu dirección.

Si en algún momento Render pide una tarjeta, **no la pongas**: cancela y avísame.

## Cosas del plan gratuito
- Si nadie entra durante 15 minutos, el servicio se duerme. La primera visita después tarda **cerca de 1 minuto**.
  **Consejo para cada profesor:** abrir la página 1–2 minutos antes de la clase; así ya está despierta.
  (No hay "pings" automáticos para mantenerlo despierto, a propósito.)
- Si Render reinicia el servicio, se pierden los quizzes abiertos (no hay base de datos). Habría que abrirlo de nuevo.

## Probarlo en una computadora (opcional, para quien programe)
Necesita Node.js 18 o más nuevo. No tiene dependencias.
```bash
cd quiz
npm start          # sin CLAVES_CURSOS, el curso 1 usa la contraseña "prueba"
```
Abre http://localhost:3000 (profesores: botón "Soy profesor/a" o http://localhost:3000/?profe).

Pruebas automáticas con 80 alumnos simulados (menos de 1 minuto):
```bash
cd quiz
npm test
```
