# ❄️ Baile de Navidad — el Sombrero Seleccionador de parejas

Página aparte del Quidditch: **no usa Render** (no gasta tus horas). La página va gratis en **Netlify** y los
datos se guardan gratis en **Supabase**.

## Cómo funciona
- Cada persona crea su perfil: nombre, **PIN de 4 números**, casa, cómo se identifica, con quién le gustaría ir,
  **cómo le gustaría ir** (💞 en plan romántico, 🤝 en plan amistad o ✨ le da igual; se ve en su perfil),
  una frase, **de 1 a 3 fotos** e **intereses** (mínimo 8). En "Perfil" hay una **vista previa** de cómo te ven. Categorías: música, animales, comida, color, películas
  y series, hobbies, deportes y asignatura favorita de Hogwarts; cada una con "Otro: escribe el tuyo".
- **Ya tengo pareja:** eliges a tu pareja de la lista y ella lo confirma. Luego se pueden mandar regalos.
- **Buscar pareja:** al entrar vas bajando y aparecen los perfiles de las personas compatibles contigo (los dos se
  sienten a gusto yendo juntos y tienen **al menos 3 cosas en común**; se cambia en `#admin`). Quienes más se parecen a ti
  salen primero. Cada perfil: fotos (con flechitas ‹ › o deslizando), nombre, casa, frase y en qué coinciden.
  - **Invitar al baile:** eliges un regalo de la lista (9 regalos dibujados, en `regalos.js`) **o tu propio regalo**
    (foto + qué es), y una **carta** (hasta 500 letras). Llega como un sobre con sello de lacre que se abre al tocarlo.
  - Solo puedes tener **una invitación pendiente** a la vez (esperas la respuesta o la cancelas). Recibir, puedes varias.
  - Si la otra persona **acepta** (con un regalo y carta de vuelta) → ¡pareja! Si te había invitado y tú la invitas, es pareja directa.
  - Si **rechaza** → te sale "*Fulano ha rechazado tu invitación*" y ya no le puedes volver a invitar.
  - Si no responde en **12 horas**, la invitación **caduca** ("*Tu invitación a Fulano ha caducado*", que no es un rechazo).
- **Profesores 🎓:** en "Tu casa" hay un botón "Soy profesor/a". Los profesores solo ven e invitan a otros profesores
  (y solo les mandan regalos a ellos); los alumnos nunca ven ni invitan a profesores. Además tienen la pestaña
  **☕ Sala de profesores**: quién está registrado en cada casa, quién busca y qué parejas ya van juntas (sin fotos).
- **Barra de abajo:** Inicio · Buzón (invitaciones, cartas y regalos) · Regalos · Perfil.
- **Prefiero no ir con…** (secreto, hasta 3 personas): el Sombrero nunca te las presenta.
- **Regalos 🎁:** cualquiera puede mandarle un regalo con carta a quien quiera, **con su nombre o en secreto** (lo elige
  cada vez; hasta 5 al día). Quien recibe puede tocar "No quiero recibir más de esta persona". Si mandaste regalos en
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
