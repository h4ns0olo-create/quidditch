# ❄️ Baile de Navidad — el Sombrero Seleccionador de parejas

Página aparte del Quidditch: **no usa Render** (no gasta tus horas). La página va gratis en **Netlify** y los
datos se guardan gratis en **Supabase**.

## Cómo funciona
- Cada persona crea su perfil: nombre, **PIN de 4 números**, casa, cómo se identifica, con quién le gustaría ir,
  **cómo le gustaría ir** (💞 en plan romántico, 🤝 en plan amistad o ✨ le da igual; se ve en su perfil),
  una frase, **de 1 a 3 fotos** e **intereses** (mínimo 8). En "Perfil" hay una **vista previa** de cómo te ven. Categorías: música, animales, comida, color, películas
  y series, hobbies, deportes y asignatura favorita (las 11 de la comunidad); cada una con "Otro: escribe el tuyo".
- **Ya tengo pareja:** eliges a tu pareja de la lista y ella lo confirma. Luego se pueden mandar regalos.
- **El Sombrero Seleccionador 🎩:** te presenta **una persona a la vez**, empezando por las que más se parecen a ti
  (mismo grupo, los dos se sienten a gusto y **al menos 3 cosas en común**; se cambia en `#admin`). Deslizas la tarjeta
  (o tocas los botones): **💚 me gusta** o **✖️ paso**. Las fotos se pasan con las flechitas o tocando los lados de la foto.
  Nadie ve a quién pasas. Cuando ya viste a todos, el Sombrero **vuelve a barajar** y te enseña otra vez a quienes pasaste.
  - **¡Match!** Si los dos se dan 💚, sale la pantalla de match y se desbloquea la **invitación con regalo y carta**.
    Solo puedes tener una invitación pendiente a la vez. Si acepta (con regalo y carta de vuelta) → ¡van juntos al baile!
  - Si rechaza → "*Fulano ha rechazado tu invitación*"; si no responde en **12 horas**, la invitación **caduca**.
- **Regalos:** 23 dibujados (ramos de flores, pasteles, peluches de criaturas mágicas…), en `regalos.js`, cada uno con su
  descripción; o **tu propio regalo** (foto + qué es). Para quitar uno: bórralo en `regalos.js` y en `baile_regalos()` de `supabase.sql`.
- **Canción 🎵 (opcional) con cualquier regalo:** pegas un enlace de **YouTube** (eliges desde qué minuto suena) o de
  **Spotify** (suena desde el principio), y puedes escribir **la parte de la letra que le dedicas**. Quien lo recibe la escucha
  ahí mismo, con el reproductor dentro del regalo (buzón, invitaciones e invitación por link).
- **Cortar el hilo dorado ✂️:** una pareja confirmada solo se deshace si **los dos firman**. Quien quiere cortarlo escribe
  el motivo y firma con el dedo; la otra persona ve la solicitud (motivo + firma) y puede **firmar** (las tijeras mágicas
  cortan el hilo con una animación y los dos quedan libres) o decir que prefiere seguir juntos.
- **Invitación por link 💌:** si tu pareja **no está en la comunidad**, en "Ya tengo con quién ir" creas una invitación con su
  nombre, un regalo y una carta, y te damos un **link** para mandárselo. Lo abre como un sobre con sello de lacre que se abre
  con una animación; puede responder **una sola vez** ("¡Sí, acepto!" con un mensaje, o "Ahora no"). Si acepta, cuentan como pareja.
  Cualquiera con el link puede ver la invitación (la página lo advierte).
- **Profesores 🎓:** en "Tu casa" hay un botón "Soy profesor/a". Los profesores solo ven e invitan a otros profesores
  (y solo les mandan regalos a ellos); los alumnos nunca ven ni invitan a profesores. Además tienen la pestaña
  **☕ Sala de profesores**: qué alumnos están registrados en cada casa, quién busca y qué parejas de alumnos ya van juntas
  (sin fotos). Lo de otros profesores es privado: nadie (ni otros profesores) ve con quién van ni quién busca.
- **Barra de abajo:** Inicio · Buzón (invitaciones, cartas y regalos) · Regalos · Perfil.
- **Prefiero no ir con…** (secreto, hasta 3 personas): el Sombrero nunca te las presenta.
- **Regalos 🎁:** cualquiera puede mandarle un regalo con carta a quien quiera, **con su nombre o en secreto** (lo elige
  cada vez; hasta 10 al día). Quien recibe puede tocar "No quiero recibir más de esta persona". Si mandaste regalos en
  secreto y luego invitas a esa persona al baile, puedes contarle que eran tuyos.
  En `#admin` el organizador ve quién manda a quién (solo por seguridad).
- **Correo Lechuza 🦉:** las parejas se mandan regalos con nota. Opción **🎁 sorpresa**: se abre el día del baile.
- **Sin chat**: solo regalos y cartas.
- **Administración:** abre la página con `#admin` al final (ej. `https://tu-pagina.netlify.app/#admin`).
  Ves a todos, abres/pausas las **invitaciones**, cambias el **mínimo de cosas en común**, **emparejas a mano** (para que nadie se quede sin pareja al final),
  deshaces parejas, cambias PIN olvidados y borras perfiles.

## Ponerlo en marcha (una sola vez, ~15 minutos)

### 1. Base de datos (Supabase)
1. Entra en https://supabase.com → **Start your project** → crea cuenta (puede ser con GitHub).
2. **New project**: nombre `baile-navidad`, inventa una contraseña de base de datos (guárdala), región la más
   cercana (p. ej. *South America (São Paulo)* o *East US*). Plan **Free**. Espera ~2 minutos.
3. Menú izquierdo → **SQL Editor** → **New query**. Copia y pega **todo** el archivo `baile/supabase.sql`.
4. Busca `CAMBIA-ESTA-CLAVE` y pon tu clave de administración. Pulsa **Run**. Debe decir *Success*.
5. Ve a **Project Settings → API Keys** (o el botón **Connect**) y copia:
   - **Project URL** (tipo `https://abcdefgh.supabase.co`)
   - la clave **publishable** (`sb_publishable_…`) o la **anon public** (es pública, no pasa nada por ponerla en la página).
   ⚠️ **Nunca** uses la `service_role` / `secret`.
6. Pega los dos datos en `baile/config.js` (se puede editar directo en GitHub con el lápiz ✏️).

### 2. La página (Netlify)
1. Entra en https://app.netlify.com → crea cuenta con GitHub.
2. **Add new site → Import an existing project → GitHub** → elige el repositorio `quidditch`.
3. **Branch to deploy**: la rama donde esté el baile. **Base directory**: `baile`. Deja el comando de build vacío.
   **Publish directory**: `baile`. Pulsa **Deploy**.
4. Te da una dirección tipo `https://algo-raro.netlify.app`. En **Site configuration → Change site name** puedes
   ponerle algo como `baile-hogwarts` → `https://baile-hogwarts.netlify.app`. ¡Esa es la que compartes!
5. Cada vez que cambies algo en GitHub, Netlify lo publica solo.

## Ajustes
Están al principio de `supabase.sql` (tabla `baile_config`). Para cambiar uno después, en el SQL Editor:
```sql
update baile_config set valor = '24' where clave = 'horas';                       -- horas para responder
update baile_config set valor = '2026-12-04 23:59:59-03' where clave = 'cierre';   -- fin del Sombrero (-03 = Argentina)
update baile_config set valor = '2026-12-05 00:00:00-03' where clave = 'baile';    -- se abren las sorpresas
update baile_config set valor = 'no' where clave = 'nota_libre';                   -- solo frases hechas
```
El Sombrero también se puede pausar o abrir desde la página de administración.

## Bueno saber
- Supabase gratis: 500 MB (sobra: cada foto se comprime en el celular a ~100 KB). Si el proyecto pasa
  **7 días sin uso** se pausa (se reactiva desde su panel); durante el baile no pasará.
- Si quieres que se registre más gente antes de que empiecen las invitaciones, **pausa las invitaciones** desde `#admin`
  (la gente puede ir viendo perfiles) y ábrelas cuando quieras.
- **Actualizar la base de datos:** si cambia `supabase.sql`, vuelve a pegarlo entero en el SQL Editor y pulsa Run.
  No se borra nada y tu clave de organizador se queda igual.
- Las fotos solo las ven las personas compatibles contigo, tu pareja y con quien te escribiste invitaciones.
