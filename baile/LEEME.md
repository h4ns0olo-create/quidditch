# ❄️ Baile de Navidad — el Sombrero Seleccionador de parejas

Página aparte del Quidditch: **no usa Render** (no gasta tus horas). La página va gratis en **Netlify** y los
datos se guardan gratis en **Supabase**.

## Cómo funciona
- Cada persona crea su perfil: nombre, **PIN de 4 números**, casa, cómo se identifica, con quién le gustaría ir,
  una frase, **de 1 a 3 fotos** e **intereses** (mínimo 8). Categorías: música, animales, comida, color, películas
  y series, hobbies, deportes y asignatura favorita de Hogwarts; cada una con "Otro: escribe el tuyo".
- **Ya tengo pareja:** eliges a tu pareja de la lista y ella lo confirma. Luego se pueden mandar regalos.
- **Que el Sombrero me ayude:** el Sombrero te presenta a la persona libre con la que más coincides (lo raro cuenta más:
  coincidir en "Metal" pesa más que en "Pizza"). **Solo propone si tienen al menos 3 cosas en común** (se cambia en
  `#admin`); si no hay nadie así, espera a que se registre más gente. Ves sus fotos, su casa, su frase y en qué coinciden.
  - **Invitar al baile:** eliges un regalo de la lista (18 regalos dibujados, en `regalos.js`) **o tu propio regalo**
    (foto + qué es), y un mensaje (frases hechas o uno propio de máx. 140 letras). La otra persona ve tu regalo y tu mensaje.
  - Si **los dos dicen que sí** → ¡pareja! (con celebración y los regalos van al buzón).
  - Si **cualquiera dice que no** → a la otra persona le sale "*Fulano ha rechazado tu invitación*" y a los dos se les
    presenta a otra persona. Esa pareja no se vuelve a proponer.
  - Si alguien no responde en **12 horas**, la propuesta **caduca** (a quien invitó le sale "*Tu invitación a Fulano ha
    caducado*", que no es un rechazo) y los dos quedan libres.
- **Prefiero no ir con…** (secreto, hasta 3 personas): el Sombrero nunca te las presenta.
- **Correo Lechuza 🦉:** las parejas se mandan regalos con nota. Opción **🎁 sorpresa**: se abre el día del baile.
- **Sin chat**: solo regalos y notas cortas.
- **Administración:** abre la página con `#admin` al final (ej. `https://tu-pagina.netlify.app/#admin`).
  Ves a todos, pausas/abres el Sombrero, cambias el **mínimo de cosas en común**, **emparejas a mano** (para que nadie se quede sin pareja al final),
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
update baile_config set valor = '2026-12-04 23:59:59-05' where clave = 'cierre';   -- fin del Sombrero (-05 = Perú/Colombia; -06 = México)
update baile_config set valor = '2026-12-05 00:00:00-05' where clave = 'baile';    -- se abren las sorpresas
update baile_config set valor = 'no' where clave = 'nota_libre';                   -- solo frases hechas
```
El Sombrero también se puede pausar o abrir desde la página de administración.

## Bueno saber
- Supabase gratis: 500 MB (sobra: cada foto se comprime en el celular a ~100 KB). Si el proyecto pasa
  **7 días sin uso** se pausa (se reactiva desde su panel); durante el baile no pasará.
- El orden importa un poco: el Sombrero junta a quien esté libre en ese momento. Si quieres que se registre más gente
  antes de las primeras propuestas, **pausa el Sombrero** desde `#admin` y ábrelo cuando quieras.
- Las fotos solo las ven tu pareja y las personas que el Sombrero te presentó.
