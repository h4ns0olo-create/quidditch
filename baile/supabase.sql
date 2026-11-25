-- =====================================================================
--  BAILE DE NAVIDAD — base de datos (Supabase)
--  Cómo usarlo: en Supabase → SQL Editor → New query → pega TODO este
--  archivo → cambia la clave de administración (más abajo) → Run.
--  Se puede volver a ejecutar sin perder datos (solo actualiza funciones
--  y la clave de administración).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- Ajustes
create table if not exists baile_config (clave text primary key, valor text not null);
insert into baile_config (clave, valor) values
  ('sombrero',   'si'),                        -- 'si' = el Sombrero propone parejas; 'no' = en pausa
  ('cierre',     '2026-12-04 23:59:59-05'),    -- hasta cuándo propone parejas (fecha, hora y zona horaria)
  ('baile',      '2026-12-05 00:00:00-05'),    -- cuándo se abren los regalos "sorpresa"
  ('horas',      '12'),                        -- horas para responder a una propuesta antes de que caduque
  ('minimo',     '3'),                         -- cosas en común que hacen falta como mínimo para que el Sombrero proponga
  ('nota_libre', 'si')                         -- 'si' = se puede escribir una nota propia; 'no' = solo frases hechas
on conflict (clave) do nothing;

-- 🔑 CLAVE DE ADMINISTRACIÓN: cambia CAMBIA-ESTA-CLAVE por la tuya antes de pulsar Run.
insert into baile_config (clave, valor)
values ('admin', extensions.crypt('CAMBIA-ESTA-CLAVE', extensions.gen_salt('bf')))
on conflict (clave) do update set valor = excluded.valor;

-- ---------------------------------------------------------------- Tablas
create table if not exists baile_personas (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  nombre_norm text not null unique,
  pin_hash    text not null,
  casa        text not null,
  soy         text not null,                    -- chica | chico | otro
  voy_con     text not null,                    -- chicas | chicos | cualquiera
  frase       text not null default '',
  intereses   text[] not null default '{}',
  estado      text not null default 'busca' check (estado in ('busca', 'tiene', 'pareja')),
  fotos_ver   int not null default 0,
  fallos      int not null default 0,
  bloqueo     timestamptz,
  creado      timestamptz not null default now()
);
create table if not exists baile_fotos (
  persona_id bigint not null references baile_personas(id) on delete cascade,
  orden      int not null,
  datos      text not null,
  primary key (persona_id, orden)
);
create table if not exists baile_sesiones (
  token      text primary key,
  persona_id bigint not null references baile_personas(id) on delete cascade,
  creado     timestamptz not null default now()
);
create table if not exists baile_vetos (
  persona_id bigint not null references baile_personas(id) on delete cascade,
  vetado_id  bigint not null references baile_personas(id) on delete cascade,
  primary key (persona_id, vetado_id)
);
create table if not exists baile_parejas (
  id      bigint generated always as identity primary key,
  a       bigint not null unique references baile_personas(id) on delete cascade,
  b       bigint not null unique references baile_personas(id) on delete cascade,
  origen  text not null,                        -- propia | sombrero | admin
  visto_a boolean not null default false,
  visto_b boolean not null default false,
  creada  timestamptz not null default now(),
  check (a < b)
);
create table if not exists baile_solicitudes (     -- "ya tengo pareja": la otra persona confirma
  id     bigint generated always as identity primary key,
  de     bigint not null references baile_personas(id) on delete cascade,
  para   bigint not null references baile_personas(id) on delete cascade,
  estado text not null default 'pendiente',       -- pendiente | aceptada | rechazada | cancelada
  visto  boolean not null default false,
  creada timestamptz not null default now()
);
create table if not exists baile_propuestas (      -- lo que propone el Sombrero
  id       bigint generated always as identity primary key,
  a        bigint not null references baile_personas(id) on delete cascade,
  b        bigint not null references baile_personas(id) on delete cascade,
  puntos   numeric not null default 0,
  comunes  text[] not null default '{}',
  estado   text not null default 'pendiente',     -- pendiente | pareja | no | caducada | cancelada
  resp_a   boolean,
  resp_b   boolean,
  regalo_a text, nota_a text,
  regalo_b text, nota_b text,
  visto_a  boolean not null default false,
  visto_b  boolean not null default false,
  creada   timestamptz not null default now(),
  cerrada  timestamptz,
  check (a < b)
);
create table if not exists baile_lechuzas (        -- regalos con nota
  id       bigint generated always as identity primary key,
  de       bigint not null references baile_personas(id) on delete cascade,
  para     bigint not null references baile_personas(id) on delete cascade,
  regalo   text not null,
  nota     text not null default '',
  sorpresa boolean not null default false,
  leida    boolean not null default false,
  creada   timestamptz not null default now()
);
create table if not exists baile_regalo_fotos (    -- fotos de los regalos propios
  id     bigint generated always as identity primary key,
  de     bigint not null references baile_personas(id) on delete cascade,
  datos  text not null,
  creada timestamptz not null default now()
);
alter table baile_propuestas add column if not exists foto_a bigint, add column if not exists foto_b bigint,
  add column if not exists titulo_a text, add column if not exists titulo_b text;
alter table baile_lechuzas add column if not exists foto bigint, add column if not exists titulo text;
create index if not exists baile_propuestas_pend on baile_propuestas (estado);
create index if not exists baile_lechuzas_para on baile_lechuzas (para);

-- Nadie lee las tablas directamente: todo pasa por la función baile(), que comprueba quién eres.
alter table baile_config      enable row level security;
alter table baile_personas    enable row level security;
alter table baile_fotos       enable row level security;
alter table baile_sesiones    enable row level security;
alter table baile_vetos       enable row level security;
alter table baile_parejas     enable row level security;
alter table baile_solicitudes enable row level security;
alter table baile_propuestas  enable row level security;
alter table baile_lechuzas    enable row level security;
alter table baile_regalo_fotos enable row level security;
revoke all on baile_config, baile_personas, baile_fotos, baile_sesiones, baile_vetos, baile_parejas,
  baile_solicitudes, baile_propuestas, baile_lechuzas, baile_regalo_fotos from anon, authenticated;

-- ---------------------------------------------------------------- Ayudantes
create or replace function baile_cfg(k text) returns text
language sql stable set search_path = public as $$ select valor from baile_config where clave = k $$;

create or replace function baile_norm(t text) returns text
language sql immutable as $$
  select translate(lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g')), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou')
$$;

create or replace function baile_compat(s1 text, v1 text, s2 text, v2 text) returns boolean
language sql immutable as $$
  select (v1 = 'cualquiera' or (v1 = 'chicas' and s2 = 'chica') or (v1 = 'chicos' and s2 = 'chico'))
     and (v2 = 'cualquiera' or (v2 = 'chicas' and s1 = 'chica') or (v2 = 'chicos' and s1 = 'chico'))
$$;

create or replace function baile_publico(pid bigint) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'casa', p.casa, 'frase', p.frase,
    'intereses', to_jsonb(p.intereses), 'fotos_ver', p.fotos_ver,
    'fotos_n', (select count(*) from baile_fotos f where f.persona_id = p.id))
  from baile_personas p where p.id = pid
$$;

create or replace function baile_comunes(x bigint, y bigint) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(i order by i), '{}')
  from unnest((select intereses from baile_personas where id = x)) i
  where i = any ((select intereses from baile_personas where id = y)::text[])
$$;

-- Forma una pareja y cancela todo lo pendiente de esas dos personas.
create or replace function baile_formar_pareja(x bigint, y bigint, origen text) returns void
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from baile_parejas where a in (x, y) or b in (x, y)) then
    raise exception 'Una de esas personas ya tiene pareja';
  end if;
  update baile_propuestas set estado = 'cancelada', cerrada = now(),
         visto_a = visto_a or a in (x, y), visto_b = visto_b or b in (x, y)
   where estado = 'pendiente' and (a in (x, y) or b in (x, y));
  update baile_solicitudes set estado = 'cancelada', visto = true
   where estado = 'pendiente' and (de in (x, y) or para in (x, y));
  insert into baile_parejas (a, b, origen) values (least(x, y), greatest(x, y), origen);
  update baile_personas set estado = 'pareja' where id in (x, y);
end $$;

-- Cancela la propuesta pendiente de una persona (p. ej. porque dice que ya tiene pareja).
create or replace function baile_cancelar_propuesta(pid bigint) returns void
language plpgsql set search_path = public as $$
begin
  update baile_propuestas set estado = 'cancelada', cerrada = now(),
         visto_a = visto_a or a = pid, visto_b = visto_b or b = pid
   where estado = 'pendiente' and (a = pid or b = pid);
end $$;

-- 🎩 El Sombrero: junta a quienes buscan pareja y no tienen propuesta, empezando por los más compatibles.
create or replace function baile_repartir() returns void
language plpgsql set search_path = public as $$
declare
  r record;
  usados bigint[] := '{}';
  total int;
  minimo int := coalesce(baile_cfg('minimo'), '1')::int;
begin
  update baile_propuestas set estado = 'caducada', cerrada = now()
   where estado = 'pendiente' and creada < now() - make_interval(hours => baile_cfg('horas')::int);
  if baile_cfg('sombrero') <> 'si' or now() > baile_cfg('cierre')::timestamptz then return; end if;
  select count(*) into total from baile_personas;
  for r in
    with libres as (
      select p.* from baile_personas p
      where p.estado = 'busca'
        and not exists (select 1 from baile_propuestas q where q.estado = 'pendiente' and (q.a = p.id or q.b = p.id))
    ), pesos as (                              -- lo que tiene poca gente cuenta más que lo que tiene todo el mundo
      select i, 1 + ln(greatest(total, 1)::numeric / count(*)) as peso
      from baile_personas, unnest(intereses) i group by i
    ), pares as (
      select x.id as a, y.id as b,
        coalesce((select sum(w.peso) from unnest(x.intereses) i join pesos w using (i) where i = any (y.intereses)), 0) as puntos,
        exists (select 1 from baile_propuestas q where q.a = x.id and q.b = y.id) as repetida,
        cardinality(array(select unnest(x.intereses) intersect select unnest(y.intereses))) as n
      from libres x join libres y on x.id < y.id
      where baile_compat(x.soy, x.voy_con, y.soy, y.voy_con)
        and not exists (select 1 from baile_vetos v
                        where (v.persona_id = x.id and v.vetado_id = y.id) or (v.persona_id = y.id and v.vetado_id = x.id))
        and not exists (select 1 from baile_propuestas q              -- un "no" es para siempre; lo caducado puede volver
                        where q.a = x.id and q.b = y.id and q.estado <> 'caducada')
    )
    select * from pares where n >= minimo            -- sin suficientes cosas en común, mejor esperar a que llegue más gente
    order by repetida, puntos desc, a, b
  loop
    if r.a = any (usados) or r.b = any (usados) then continue; end if;
    insert into baile_propuestas (a, b, puntos, comunes) values (r.a, r.b, r.puntos, baile_comunes(r.a, r.b));
    usados := usados || r.a || r.b;
  end loop;
end $$;

-- Regalo propio: valida y guarda la foto; devuelve su id (o null si es un regalo de la lista).
create or replace function baile_foto_regalo(me bigint, p jsonb) returns bigint
language plpgsql set search_path = public as $$
declare fid bigint;
begin
  if p->>'regalo' <> 'propio' then return null; end if;
  if length(trim(coalesce(p->>'titulo', ''))) < 2 then raise exception 'Escribe qué es tu regalo'; end if;
  if coalesce(p->>'foto', '') !~ '^data:image/(jpeg|png|webp);base64,' or length(p->>'foto') > 600000 then
    raise exception 'Sube una foto de tu regalo';
  end if;
  insert into baile_regalo_fotos (de, datos) values (me, p->>'foto') returning id into fid;
  return fid;
end $$;

-- Todo lo que ve una persona en su pantalla.
create or replace function baile_estado(me bigint) returns jsonb
language plpgsql set search_path = public as $$
declare
  yo baile_personas;
  par baile_parejas;
  q baile_propuestas;
  otro bigint;
  j jsonb;
  baile_t timestamptz := baile_cfg('baile')::timestamptz;
begin
  select * into yo from baile_personas where id = me;
  j := jsonb_build_object(
    'yo', baile_publico(me) || jsonb_build_object('soy', yo.soy, 'voy_con', yo.voy_con, 'estado', yo.estado),
    'cfg', jsonb_build_object('sombrero', baile_cfg('sombrero'), 'cierre', baile_cfg('cierre')::timestamptz,
      'baile', baile_t, 'horas', baile_cfg('horas')::int, 'minimo', baile_cfg('minimo')::int, 'nota_libre', baile_cfg('nota_libre') = 'si', 'ahora', now()),
    'resumen', jsonb_build_object('parejas', (select count(*) from baile_parejas),
      'buscando', (select count(*) from baile_personas where estado = 'busca')),
    'vetos', coalesce((select jsonb_agg(vetado_id) from baile_vetos where persona_id = me), '[]'));

  -- Pareja confirmada
  select * into par from baile_parejas where a = me or b = me;
  if found then
    otro := case when par.a = me then par.b else par.a end;
    j := j || jsonb_build_object('pareja', jsonb_build_object('id', par.id, 'origen', par.origen,
      'persona', baile_publico(otro), 'comunes', to_jsonb(baile_comunes(me, otro)),
      'nueva', not (case when par.a = me then par.visto_a else par.visto_b end)));
  end if;

  -- Propuesta del Sombrero
  select * into q from baile_propuestas where estado = 'pendiente' and (a = me or b = me);
  if found then
    otro := case when q.a = me then q.b else q.a end;
    j := j || jsonb_build_object('propuesta', jsonb_build_object('id', q.id, 'persona', baile_publico(otro),
      'comunes', to_jsonb(q.comunes),
      'vence', q.creada + make_interval(hours => baile_cfg('horas')::int),
      'mi_resp',   case when q.a = me then q.resp_a else q.resp_b end,
      'mi_regalo', case when q.a = me then q.regalo_a else q.regalo_b end,
      'mi_nota',   case when q.a = me then q.nota_a else q.nota_b end,
      'su_regalo', case when q.a = me then (case when q.resp_b then q.regalo_b end) else (case when q.resp_a then q.regalo_a end) end,
      'su_nota',   case when q.a = me then (case when q.resp_b then q.nota_b end) else (case when q.resp_a then q.nota_a end) end,
      'mi_titulo', case when q.a = me then q.titulo_a else q.titulo_b end,
      'mi_foto',   case when q.a = me then q.foto_a else q.foto_b end,
      'su_titulo', case when q.a = me then (case when q.resp_b then q.titulo_b end) else (case when q.resp_a then q.titulo_a end) end,
      'su_foto',   case when q.a = me then (case when q.resp_b then q.foto_b end) else (case when q.resp_a then q.foto_a end) end));
  end if;

  -- Avisos que aún no ha visto (propuestas que terminaron sin pareja, solicitudes rechazadas)
  j := j || jsonb_build_object('avisos', coalesce((
    select jsonb_agg(jsonb_build_object('tipo', x.estado, 'id', x.id,
      'nombre', (select nombre from baile_personas where id = case when x.a = me then x.b else x.a end),
      'mi_resp', case when x.a = me then x.resp_a else x.resp_b end,
      'su_resp', case when x.a = me then x.resp_b else x.resp_a end) order by x.id)
    from baile_propuestas x
    where x.estado in ('no', 'caducada', 'cancelada')
      and ((x.a = me and not x.visto_a) or (x.b = me and not x.visto_b))), '[]')
    || coalesce((
    select jsonb_agg(jsonb_build_object('tipo', 'solicitud_rechazada', 'id', s.id,
      'nombre', (select nombre from baile_personas where id = s.para)))
    from baile_solicitudes s where s.de = me and s.estado = 'rechazada' and not s.visto), '[]'));

  -- "Ya tengo pareja": solicitudes
  j := j || jsonb_build_object(
    'solicitudes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'persona', baile_publico(s.de)) order by s.id)
                             from baile_solicitudes s where s.para = me and s.estado = 'pendiente'), '[]'),
    'solicitud_enviada', (select jsonb_build_object('id', s.id, 'persona', baile_publico(s.para))
                          from baile_solicitudes s where s.de = me and s.estado = 'pendiente' order by s.id desc limit 1));

  -- Correo Lechuza
  j := j || jsonb_build_object(
    'lechuzas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id,
        'de', (select nombre from baile_personas where id = l.de),
        'de_casa', (select casa from baile_personas where id = l.de),
        'cerrada', l.sorpresa and now() < baile_t,
        'titulo', case when l.sorpresa and now() < baile_t then null else l.titulo end,
        'foto',   case when l.sorpresa and now() < baile_t then null else l.foto end,
        'regalo', case when l.sorpresa and now() < baile_t then null else l.regalo end,
        'nota',   case when l.sorpresa and now() < baile_t then null else l.nota end,
        'sorpresa', l.sorpresa, 'leida', l.leida, 'creada', l.creada) order by l.id desc)
      from baile_lechuzas l where l.para = me), '[]'),
    'enviadas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'regalo', l.regalo, 'nota', l.nota, 'titulo', l.titulo, 'foto', l.foto,
        'sorpresa', l.sorpresa, 'creada', l.creada) order by l.id desc)
      from baile_lechuzas l where l.de = me), '[]'));
  return j;
end $$;

-- ---------------------------------------------------------------- La única puerta de entrada
create or replace function baile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  accion text := p->>'accion';
  me bigint;
  yo baile_personas;
  q baile_propuestas;
  s baile_solicitudes;
  otro bigint;
  tok text;
  v text;
  i int;
  casas text[] := array['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];
  -- 🎁 Regalos permitidos (si quitas uno en regalos.js, quítalo también aquí). 'propio' = foto de tu propio regalo.
  regalos text[] := array['rosa', 'rana', 'grajeas', 'ramillete', 'copo', 'pastel', 'snitch', 'lechuza', 'amortentia', 'propio'];
  fid bigint;
  tit text;
begin
  perform pg_advisory_xact_lock(20261205);   -- una petición a la vez: nadie se queda con la misma pareja dos veces

  -- ======== Sin cuenta
  if accion = 'resumen' then
    return jsonb_build_object('parejas', (select count(*) from baile_parejas),
      'buscando', (select count(*) from baile_personas where estado = 'busca'),
      'personas', (select count(*) from baile_personas),
      'cierre', baile_cfg('cierre')::timestamptz, 'baile', baile_cfg('baile')::timestamptz);
  end if;

  if accion = 'nombres_libres' then        -- para elegir pareja al registrarse
    return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'casa', casa) order by nombre)
                     from baile_personas where estado <> 'pareja'), '[]');
  end if;

  if accion = 'registrar' then
    v := trim(regexp_replace(coalesce(p->>'nombre', ''), '\s+', ' ', 'g'));
    if length(v) < 2 or length(v) > 30 then raise exception 'Tu nombre debe tener entre 2 y 30 letras'; end if;
    if exists (select 1 from baile_personas where nombre_norm = baile_norm(v)) then
      raise exception 'Ya hay alguien registrado con ese nombre. Si eres tú, entra con tu PIN.';
    end if;
    if coalesce(p->>'pin', '') !~ '^[0-9]{4}$' then raise exception 'El PIN son 4 números'; end if;
    if not (p->>'casa' = any (casas)) then raise exception 'Elige tu casa'; end if;
    if coalesce(p->>'soy', '') not in ('chica', 'chico', 'otro') then raise exception 'Dinos cómo te identificas'; end if;
    if coalesce(p->>'voy_con', '') not in ('chicas', 'chicos', 'cualquiera') then raise exception 'Dinos con quién te gustaría ir'; end if;
    if coalesce(p->>'estado', '') not in ('busca', 'tiene') then raise exception 'Dinos si ya tienes pareja'; end if;
    if p->>'estado' = 'busca' and jsonb_array_length(coalesce(p->'fotos', '[]')) = 0 then
      raise exception 'Sube al menos una foto para que el Sombrero pueda presentarte';
    end if;
    insert into baile_personas (nombre, nombre_norm, pin_hash, casa, soy, voy_con, frase, intereses, estado)
    values (v, baile_norm(v), extensions.crypt(p->>'pin', extensions.gen_salt('bf')), p->>'casa', p->>'soy', p->>'voy_con',
            left(trim(coalesce(p->>'frase', '')), 120),
            coalesce((select array_agg(distinct left(x, 60)) from jsonb_array_elements_text(coalesce(p->'intereses', '[]')) x
                      where length(x) between 3 and 60), '{}'),
            p->>'estado')
    returning id into me;
    i := 0;
    for v in select jsonb_array_elements_text(coalesce(p->'fotos', '[]')) loop
      exit when i >= 3;
      if v !~ '^data:image/(jpeg|png|webp);base64,' or length(v) > 600000 then raise exception 'Una de las fotos no es válida'; end if;
      insert into baile_fotos (persona_id, orden, datos) values (me, i, v);
      i := i + 1;
    end loop;
    update baile_personas set fotos_ver = 1 where id = me;
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into baile_sesiones (token, persona_id) values (tok, me);
    if p->>'estado' = 'tiene' and nullif(p->>'pareja_id', '') is not null then
      perform baile(jsonb_build_object('accion', 'pedir_pareja', 'token', tok, 'para', p->'pareja_id'));
    end if;
    perform baile_repartir();
    return jsonb_build_object('token', tok, 'estado', baile_estado(me));
  end if;

  if accion = 'entrar' then
    select * into yo from baile_personas where nombre_norm = baile_norm(p->>'nombre');
    if not found then raise exception 'No encontramos ese nombre. ¿Ya creaste tu perfil?'; end if;
    if yo.bloqueo is not null and yo.bloqueo > now() then
      raise exception 'Demasiados intentos. Espera unos minutos o pide al organizador que te cambie el PIN.';
    end if;
    if yo.pin_hash <> extensions.crypt(coalesce(p->>'pin', ''), yo.pin_hash) then
      -- (se devuelve el error en vez de lanzarlo para que el contador de fallos se guarde)
      update baile_personas set fallos = case when fallos + 1 >= 5 then 0 else fallos + 1 end,
             bloqueo = case when fallos + 1 >= 5 then now() + interval '15 minutes' else bloqueo end
       where id = yo.id;
      return jsonb_build_object('error', 'PIN incorrecto');
    end if;
    update baile_personas set fallos = 0, bloqueo = null where id = yo.id;
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into baile_sesiones (token, persona_id) values (tok, yo.id);
    perform baile_repartir();
    return jsonb_build_object('token', tok, 'estado', baile_estado(yo.id));
  end if;

  -- ======== Administración (con clave)
  if accion like 'admin_%' then
    if (select valor from baile_config where clave = 'admin') <> extensions.crypt(coalesce(p->>'clave', ''), (select valor from baile_config where clave = 'admin')) then
      perform pg_sleep(1);
      raise exception 'Clave de administración incorrecta';
    end if;
    if accion = 'admin_sombrero' then
      update baile_config set valor = case when (p->>'abierto')::boolean then 'si' else 'no' end where clave = 'sombrero';
    elsif accion = 'admin_minimo' then
      if coalesce(p->>'minimo', '') !~ '^[0-9]$' then raise exception 'Elige un número del 0 al 9'; end if;
      update baile_config set valor = p->>'minimo' where clave = 'minimo';
    elsif accion = 'admin_emparejar' then
      if (p->>'a')::bigint = (p->>'b')::bigint then raise exception 'Elige dos personas distintas'; end if;
      perform baile_formar_pareja((p->>'a')::bigint, (p->>'b')::bigint, 'admin');
    elsif accion = 'admin_deshacer' then
      update baile_personas set estado = 'busca'
       where id in (select a from baile_parejas where id = (p->>'pareja')::bigint
                    union select b from baile_parejas where id = (p->>'pareja')::bigint);
      delete from baile_parejas where id = (p->>'pareja')::bigint;
    elsif accion = 'admin_borrar' then
      delete from baile_personas where id = (p->>'persona')::bigint;
    elsif accion = 'admin_pin' then
      if coalesce(p->>'pin', '') !~ '^[0-9]{4}$' then raise exception 'El PIN son 4 números'; end if;
      update baile_personas set pin_hash = extensions.crypt(p->>'pin', extensions.gen_salt('bf')), fallos = 0, bloqueo = null
       where id = (p->>'persona')::bigint;
      delete from baile_sesiones where persona_id = (p->>'persona')::bigint;
    elsif accion <> 'admin_panel' then
      raise exception 'Acción desconocida';
    end if;
    perform baile_repartir();
    return jsonb_build_object(
      'sombrero', baile_cfg('sombrero'), 'cierre', baile_cfg('cierre')::timestamptz, 'horas', baile_cfg('horas')::int,
      'minimo', baile_cfg('minimo')::int,
      'personas', coalesce((select jsonb_agg(jsonb_build_object(
          'id', x.id, 'nombre', x.nombre, 'casa', x.casa, 'soy', x.soy, 'voy_con', x.voy_con, 'estado', x.estado,
          'intereses', cardinality(x.intereses), 'fotos', (select count(*) from baile_fotos f where f.persona_id = x.id),
          'creado', x.creado,
          'propuesta_con', (select y.nombre from baile_propuestas q2 join baile_personas y on y.id = case when q2.a = x.id then q2.b else q2.a end
                            where q2.estado = 'pendiente' and (q2.a = x.id or q2.b = x.id)),
          'rechazos', (select count(*) from baile_propuestas q3 where q3.estado = 'no' and (q3.a = x.id or q3.b = x.id))
        ) order by x.nombre) from baile_personas x), '[]'),
      'parejas', coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'origen', pa.origen, 'creada', pa.creada,
          'a', (select nombre from baile_personas where id = pa.a), 'b', (select nombre from baile_personas where id = pa.b)
        ) order by pa.id) from baile_parejas pa), '[]'),
      'lechuzas', (select count(*) from baile_lechuzas));
  end if;

  -- ======== Con cuenta: a partir de aquí hace falta el token
  select persona_id into me from baile_sesiones where token = p->>'token';
  if me is null then return jsonb_build_object('error', 'sesion'); end if;
  select * into yo from baile_personas where id = me;

  if accion = 'estado' then
    perform baile_repartir();
    return baile_estado(me);

  elsif accion = 'salir' then
    delete from baile_sesiones where token = p->>'token';
    return jsonb_build_object('ok', true);

  elsif accion = 'fotos' then
    otro := (p->>'persona')::bigint;
    if otro <> me
       and not exists (select 1 from baile_parejas where (a = me and b = otro) or (a = otro and b = me))
       and not exists (select 1 from baile_propuestas where (a = least(me, otro) and b = greatest(me, otro)))
       and not exists (select 1 from baile_solicitudes where (de = me and para = otro) or (de = otro and para = me)) then
      raise exception 'No puedes ver esas fotos';
    end if;
    return coalesce((select jsonb_agg(datos order by orden) from baile_fotos where persona_id = otro), '[]');

  elsif accion = 'foto_regalo' then
    fid := (p->>'id')::bigint;
    if not exists (select 1 from baile_lechuzas where foto = fid and (de = me or (para = me and not (sorpresa and now() < baile_cfg('baile')::timestamptz))))
       and not exists (select 1 from baile_propuestas where (foto_a = fid and (a = me or (b = me and resp_a))) or (foto_b = fid and (b = me or (a = me and resp_b)))) then
      raise exception 'No puedes ver esa foto';
    end if;
    return to_jsonb((select datos from baile_regalo_fotos where id = fid));

  elsif accion = 'perfil' then
    if p ? 'casa' and not (p->>'casa' = any (casas)) then raise exception 'Elige tu casa'; end if;
    if p ? 'soy' and p->>'soy' not in ('chica', 'chico', 'otro') then raise exception 'Opción no válida'; end if;
    if p ? 'voy_con' and p->>'voy_con' not in ('chicas', 'chicos', 'cualquiera') then raise exception 'Opción no válida'; end if;
    update baile_personas set
      casa = coalesce(p->>'casa', casa),
      soy = coalesce(p->>'soy', soy),
      voy_con = coalesce(p->>'voy_con', voy_con),
      frase = coalesce(left(trim(p->>'frase'), 120), frase),
      intereses = case when p ? 'intereses' then
        coalesce((select array_agg(distinct left(x, 60)) from jsonb_array_elements_text(p->'intereses') x
                  where length(x) between 3 and 60), '{}') else intereses end
    where id = me;
    if p ? 'fotos' then
      if jsonb_array_length(p->'fotos') = 0 and yo.estado = 'busca' then
        raise exception 'Necesitas al menos una foto mientras buscas pareja';
      end if;
      delete from baile_fotos where persona_id = me;
      i := 0;
      for v in select jsonb_array_elements_text(p->'fotos') loop
        exit when i >= 3;
        if v !~ '^data:image/(jpeg|png|webp);base64,' or length(v) > 600000 then raise exception 'Una de las fotos no es válida'; end if;
        insert into baile_fotos (persona_id, orden, datos) values (me, i, v);
        i := i + 1;
      end loop;
      update baile_personas set fotos_ver = fotos_ver + 1 where id = me;
    end if;
    -- si cambió con quién quiere ir y su propuesta ya no encaja, se cancela
    select * into q from baile_propuestas where estado = 'pendiente' and (a = me or b = me);
    if found then
      otro := case when q.a = me then q.b else q.a end;
      if not (select baile_compat(x.soy, x.voy_con, y.soy, y.voy_con) from baile_personas x, baile_personas y where x.id = me and y.id = otro) then
        perform baile_cancelar_propuesta(me);
      end if;
    end if;

  elsif accion = 'vetos' then
    delete from baile_vetos where persona_id = me;
    insert into baile_vetos (persona_id, vetado_id)
    select me, x::bigint from jsonb_array_elements_text(coalesce(p->'ids', '[]')) x
    where x::bigint <> me and exists (select 1 from baile_personas where id = x::bigint)
    limit 3
    on conflict do nothing;
    if exists (select 1 from baile_propuestas q2 join baile_vetos v2 on v2.persona_id = me
               and v2.vetado_id = case when q2.a = me then q2.b else q2.a end
               where q2.estado = 'pendiente' and (q2.a = me or q2.b = me)) then
      perform baile_cancelar_propuesta(me);
    end if;

  elsif accion = 'nombres' then
    return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'casa', casa, 'estado', estado) order by nombre)
                     from baile_personas where id <> me), '[]');

  elsif accion = 'modo' then                 -- 'busca' (que me ayude el Sombrero) o 'tiene' (ya tengo con quién ir)
    if yo.estado = 'pareja' then raise exception 'Ya tienes pareja confirmada'; end if;
    if p->>'estado' = 'busca' then
      if not exists (select 1 from baile_fotos where persona_id = me) then
        raise exception 'Sube al menos una foto en tu perfil para que el Sombrero pueda presentarte';
      end if;
      update baile_solicitudes set estado = 'cancelada', visto = true where de = me and estado = 'pendiente';
      update baile_personas set estado = 'busca' where id = me;
    elsif p->>'estado' = 'tiene' then
      perform baile_cancelar_propuesta(me);
      update baile_personas set estado = 'tiene' where id = me;
    else
      raise exception 'Opción no válida';
    end if;

  elsif accion = 'pedir_pareja' then         -- "voy con esta persona": ella tiene que confirmarlo
    otro := (p->>'para')::bigint;
    if yo.estado = 'pareja' then raise exception 'Ya tienes pareja confirmada'; end if;
    if otro = me or not exists (select 1 from baile_personas where id = otro) then raise exception 'Elige a otra persona'; end if;
    if (select estado from baile_personas where id = otro) = 'pareja' then raise exception 'Esa persona ya tiene pareja confirmada'; end if;
    if exists (select 1 from baile_solicitudes where de = otro and para = me and estado = 'pendiente') then
      update baile_solicitudes set estado = 'aceptada' where de = otro and para = me and estado = 'pendiente';
      perform baile_formar_pareja(me, otro, 'propia');
    else
      update baile_solicitudes set estado = 'cancelada', visto = true where de = me and estado = 'pendiente';
      insert into baile_solicitudes (de, para) values (me, otro);
      perform baile_cancelar_propuesta(me);
      update baile_personas set estado = 'tiene' where id = me;
    end if;

  elsif accion = 'cancelar_solicitud' then
    update baile_solicitudes set estado = 'cancelada', visto = true where de = me and estado = 'pendiente';

  elsif accion = 'responder_solicitud' then
    select * into s from baile_solicitudes where id = (p->>'id')::bigint and para = me and estado = 'pendiente';
    if not found then raise exception 'Esa solicitud ya no está pendiente'; end if;
    if (p->>'acepta')::boolean then
      if yo.estado = 'pareja' then raise exception 'Ya tienes pareja confirmada'; end if;
      update baile_solicitudes set estado = 'aceptada' where id = s.id;
      perform baile_formar_pareja(me, s.de, 'propia');
    else
      update baile_solicitudes set estado = 'rechazada' where id = s.id;
    end if;

  elsif accion = 'responder_propuesta' then  -- invitar (con regalo) o decir que no
    select * into q from baile_propuestas where estado = 'pendiente' and (a = me or b = me) and id = (p->>'id')::bigint;
    if not found then raise exception 'Esta propuesta ya no está activa'; end if;
    if (case when q.a = me then q.resp_a else q.resp_b end) is not null then raise exception 'Ya respondiste'; end if;
    if (p->>'si')::boolean then
      if not (p->>'regalo' = any (regalos)) then raise exception 'Elige un regalo para tu invitación'; end if;
      v := left(trim(coalesce(p->>'nota', '')), 140);
      fid := baile_foto_regalo(me, p);
      tit := case when fid is not null then left(trim(p->>'titulo'), 40) end;
      if q.a = me then update baile_propuestas set resp_a = true, regalo_a = p->>'regalo', nota_a = v, foto_a = fid, titulo_a = tit where id = q.id;
      else update baile_propuestas set resp_b = true, regalo_b = p->>'regalo', nota_b = v, foto_b = fid, titulo_b = tit where id = q.id; end if;
      select * into q from baile_propuestas where id = q.id;
      if q.resp_a and q.resp_b then         -- ¡los dos dijeron que sí!
        update baile_propuestas set estado = 'pareja', cerrada = now(), visto_a = true, visto_b = true where id = q.id;
        perform baile_formar_pareja(q.a, q.b, 'sombrero');
        insert into baile_lechuzas (de, para, regalo, nota, foto, titulo)
        values (q.a, q.b, q.regalo_a, coalesce(q.nota_a, ''), q.foto_a, q.titulo_a),
               (q.b, q.a, q.regalo_b, coalesce(q.nota_b, ''), q.foto_b, q.titulo_b);
      end if;
    else
      update baile_propuestas set estado = 'no', cerrada = now(),
             resp_a = case when a = me then false else resp_a end,
             resp_b = case when b = me then false else resp_b end,
             visto_a = visto_a or a = me, visto_b = visto_b or b = me
       where id = q.id;
    end if;

  elsif accion = 'visto' then
    if p->>'tipo' = 'solicitud_rechazada' then
      update baile_solicitudes set visto = true where id = (p->>'id')::bigint and de = me;
    elsif p->>'tipo' = 'pareja' then
      update baile_parejas set visto_a = visto_a or a = me, visto_b = visto_b or b = me where a = me or b = me;
    else
      update baile_propuestas set visto_a = visto_a or a = me, visto_b = visto_b or b = me
       where id = (p->>'id')::bigint and (a = me or b = me);
    end if;

  elsif accion = 'lechuza' then             -- regalo a tu pareja confirmada
    select case when a = me then b else a end into otro from baile_parejas where a = me or b = me;
    if otro is null then raise exception 'Primero necesitas pareja confirmada'; end if;
    if not (p->>'regalo' = any (regalos)) then raise exception 'Elige un regalo'; end if;
    if (select count(*) from baile_lechuzas where de = me and creada > now() - interval '1 day') >= 15 then
      raise exception 'Las lechuzas están agotadas por hoy 🦉 Mañana pueden volar más.';
    end if;
    fid := baile_foto_regalo(me, p);
    insert into baile_lechuzas (de, para, regalo, nota, sorpresa, foto, titulo)
    values (me, otro, p->>'regalo', left(trim(coalesce(p->>'nota', '')), 140), coalesce((p->>'sorpresa')::boolean, false),
            fid, case when fid is not null then left(trim(p->>'titulo'), 40) end);

  elsif accion = 'leer_lechuzas' then
    update baile_lechuzas set leida = true
     where para = me and not leida and not (sorpresa and now() < baile_cfg('baile')::timestamptz);

  else
    raise exception 'Acción desconocida';
  end if;

  perform baile_repartir();
  return baile_estado(me);
end $$;

-- Solo la función baile() se puede llamar desde la página.
revoke execute on function baile_cfg(text), baile_norm(text), baile_compat(text, text, text, text), baile_publico(bigint),
  baile_comunes(bigint, bigint), baile_formar_pareja(bigint, bigint, text), baile_cancelar_propuesta(bigint),
  baile_repartir(), baile_estado(bigint), baile_foto_regalo(bigint, jsonb) from public, anon, authenticated;
revoke execute on function baile(jsonb) from public;
grant execute on function baile(jsonb) to anon, authenticated;
