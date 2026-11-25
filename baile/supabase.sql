-- =====================================================================
--  BAILE DE NAVIDAD — base de datos (Supabase)
--  Cómo usarlo: en Supabase → SQL Editor → New query → pega TODO este
--  archivo → (solo la primera vez) cambia la clave de administración → Run.
--  Se puede volver a ejecutar sin perder datos: actualiza las funciones y
--  NO cambia la clave de administración que ya tengas.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- Ajustes
create table if not exists baile_config (clave text primary key, valor text not null);
insert into baile_config (clave, valor) values
  ('sombrero',   'si'),                        -- 'si' = se pueden mandar invitaciones; 'no' = en pausa
  ('cierre',     '2026-12-04 23:59:59-03'),    -- hasta cuándo se puede invitar (hora de Argentina: -03)
  ('baile',      '2026-12-05 00:00:00-03'),    -- cuándo se abren los regalos "sorpresa"
  ('horas',      '12'),                        -- horas para responder a una invitación antes de que caduque
  ('minimo',     '3'),                         -- cosas en común que hacen falta como mínimo para ver a alguien
  ('nota_libre', 'si')                         -- 'si' = se puede escribir una carta propia; 'no' = solo frases hechas
on conflict (clave) do nothing;

-- 🔑 CLAVE DE ADMINISTRACIÓN (solo la primera vez): cambia CAMBIA-ESTA-CLAVE por la tuya antes de pulsar Run.
--    Si ya la pusiste antes, no hace falta tocar nada: esta línea no la cambia.
insert into baile_config (clave, valor)
values ('admin', extensions.crypt('CAMBIA-ESTA-CLAVE', extensions.gen_salt('bf')))
on conflict (clave) do nothing;
-- Para cambiarla más adelante, ejecuta solo esta línea con tu clave nueva:
-- update baile_config set valor = extensions.crypt('MI-CLAVE-NUEVA', extensions.gen_salt('bf')) where clave = 'admin';

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
alter table baile_personas add column if not exists crush bigint references baile_personas(id) on delete set null;
-- cómo le gustaría ir al baile: romantico | amistad | igual (se muestra en su perfil)
alter table baile_personas add column if not exists plan text not null default 'igual';
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
create table if not exists baile_vetos (            -- "prefiero no ir con…"
  persona_id bigint not null references baile_personas(id) on delete cascade,
  vetado_id  bigint not null references baile_personas(id) on delete cascade,
  primary key (persona_id, vetado_id)
);
create table if not exists baile_parejas (
  id      bigint generated always as identity primary key,
  a       bigint not null unique references baile_personas(id) on delete cascade,
  b       bigint not null unique references baile_personas(id) on delete cascade,
  origen  text not null,                        -- propia | invitacion | admin
  visto_a boolean not null default false,
  visto_b boolean not null default false,
  creada  timestamptz not null default now(),
  check (a < b)
);
create table if not exists baile_solicitudes (      -- "ya tengo pareja": la otra persona confirma
  id     bigint generated always as identity primary key,
  de     bigint not null references baile_personas(id) on delete cascade,
  para   bigint not null references baile_personas(id) on delete cascade,
  estado text not null default 'pendiente',       -- pendiente | aceptada | rechazada | cancelada
  visto  boolean not null default false,
  creada timestamptz not null default now()
);
create table if not exists baile_invitaciones (     -- "¿vamos juntos al baile?" con regalo y carta
  id          bigint generated always as identity primary key,
  de          bigint not null references baile_personas(id) on delete cascade,
  para        bigint not null references baile_personas(id) on delete cascade,
  regalo      text not null,
  nota        text not null default '',
  foto        bigint,
  titulo      text,
  revela      boolean not null default false,     -- revela que era su admirador secreto
  regalo_resp text, nota_resp text, foto_resp bigint, titulo_resp text,
  revela_resp boolean not null default false,
  estado      text not null default 'pendiente',  -- pendiente | aceptada | rechazada | caducada | cancelada
  visto_de    boolean not null default false,
  visto_para  boolean not null default false,
  creada      timestamptz not null default now(),
  cerrada     timestamptz
);
create table if not exists baile_lechuzas (         -- regalos entre parejas
  id       bigint generated always as identity primary key,
  de       bigint not null references baile_personas(id) on delete cascade,
  para     bigint not null references baile_personas(id) on delete cascade,
  regalo   text not null,
  nota     text not null default '',
  sorpresa boolean not null default false,
  leida    boolean not null default false,
  creada   timestamptz not null default now()
);
alter table baile_lechuzas add column if not exists foto bigint, add column if not exists titulo text;
create table if not exists baile_regalo_fotos (     -- fotos de los regalos propios
  id     bigint generated always as identity primary key,
  de     bigint not null references baile_personas(id) on delete cascade,
  datos  text not null,
  creada timestamptz not null default now()
);
create table if not exists baile_secretos (         -- 🎁 regalos para quien quieras (con tu nombre o en secreto)
  id     bigint generated always as identity primary key,
  de     bigint not null references baile_personas(id) on delete cascade,
  para   bigint not null references baile_personas(id) on delete cascade,
  regalo text not null,
  nota   text not null default '',
  foto   bigint,
  titulo text,
  leida  boolean not null default false,
  creada timestamptz not null default now()
);
-- los regalos que ya se mandaron se quedan anónimos (default true)
alter table baile_secretos add column if not exists anonimo boolean not null default true;
create table if not exists baile_bloqueos (         -- "no quiero recibir más regalos secretos de esta persona"
  para bigint not null references baile_personas(id) on delete cascade,
  de   bigint not null references baile_personas(id) on delete cascade,
  primary key (para, de)
);
create index if not exists baile_invitaciones_estado on baile_invitaciones (estado);
create index if not exists baile_lechuzas_para on baile_lechuzas (para);

-- Lo de la versión anterior (propuestas del Sombrero) ya no se usa
drop function if exists baile_repartir();
drop function if exists baile_cancelar_propuesta(bigint);
drop table if exists baile_propuestas cascade;

-- Nadie lee las tablas directamente: todo pasa por la función baile(), que comprueba quién eres.
alter table baile_config       enable row level security;
alter table baile_personas     enable row level security;
alter table baile_fotos        enable row level security;
alter table baile_sesiones     enable row level security;
alter table baile_vetos        enable row level security;
alter table baile_parejas      enable row level security;
alter table baile_solicitudes  enable row level security;
alter table baile_invitaciones enable row level security;
alter table baile_lechuzas     enable row level security;
alter table baile_regalo_fotos enable row level security;
alter table baile_secretos     enable row level security;
alter table baile_bloqueos     enable row level security;
revoke all on baile_config, baile_personas, baile_fotos, baile_sesiones, baile_vetos, baile_parejas, baile_solicitudes,
  baile_invitaciones, baile_lechuzas, baile_regalo_fotos, baile_secretos, baile_bloqueos from anon, authenticated;

-- ---------------------------------------------------------------- Ayudantes
create or replace function baile_cfg(k text) returns text
language sql stable set search_path = public as $$ select valor from baile_config where clave = k $$;

-- 🎁 Regalos permitidos (si quitas uno en regalos.js, quítalo también aquí). 'propio' = foto de tu propio regalo.
create or replace function baile_regalos() returns text[]
language sql immutable as $$
  select array['rosa', 'rana', 'grajeas', 'ramillete', 'copo', 'pastel', 'snitch', 'lechuza', 'amortentia', 'propio']
$$;

create or replace function baile_norm(t text) returns text
language sql immutable as $$
  select translate(lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g')), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou')
$$;

create or replace function baile_compat(s1 text, v1 text, s2 text, v2 text) returns boolean
language sql immutable as $$
  select (v1 = 'cualquiera' or (v1 = 'chicas' and s2 = 'chica') or (v1 = 'chicos' and s2 = 'chico'))
     and (v2 = 'cualquiera' or (v2 = 'chicas' and s1 = 'chica') or (v2 = 'chicos' and s1 = 'chico'))
$$;

-- ¿Pueden verse e invitarse? (los dos buscan pareja, se sienten a gusto y nadie vetó al otro)
create or replace function baile_compatibles(x bigint, y bigint) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from baile_personas p, baile_personas q
    where p.id = x and q.id = y and p.id <> q.id and p.estado = 'busca' and q.estado = 'busca'
      and baile_compat(p.soy, p.voy_con, q.soy, q.voy_con)
      and not exists (select 1 from baile_vetos v
                      where (v.persona_id = x and v.vetado_id = y) or (v.persona_id = y and v.vetado_id = x)))
$$;

create or replace function baile_abiertas() returns boolean
language sql stable set search_path = public as $$
  select baile_cfg('sombrero') = 'si' and now() <= baile_cfg('cierre')::timestamptz
$$;

create or replace function baile_publico(pid bigint) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'casa', p.casa, 'frase', p.frase,
    'intereses', to_jsonb(p.intereses), 'fotos_ver', p.fotos_ver, 'plan', p.plan,
    'fotos_n', (select count(*) from baile_fotos f where f.persona_id = p.id))
  from baile_personas p where p.id = pid
$$;

create or replace function baile_comunes(x bigint, y bigint) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(i order by i), '{}')
  from unnest((select intereses from baile_personas where id = x)) i
  where i = any ((select intereses from baile_personas where id = y)::text[])
$$;

-- Regalo propio: valida y guarda la foto; devuelve su id (o null si es un regalo de la lista).
create or replace function baile_foto_regalo(me bigint, p jsonb) returns bigint
language plpgsql set search_path = public as $$
declare fid bigint;
begin
  if not (p->>'regalo' = any (baile_regalos())) then raise exception 'Elige un regalo'; end if;
  if p->>'regalo' <> 'propio' then return null; end if;
  if length(trim(coalesce(p->>'titulo', ''))) < 2 then raise exception 'Escribe qué es tu regalo'; end if;
  if coalesce(p->>'foto', '') !~ '^data:image/(jpeg|png|webp);base64,' or length(p->>'foto') > 600000 then
    raise exception 'Sube una foto de tu regalo';
  end if;
  insert into baile_regalo_fotos (de, datos) values (me, p->>'foto') returning id into fid;
  return fid;
end $$;

-- Invitaciones sin respuesta a tiempo → caducan
create or replace function baile_caducar() returns void
language sql set search_path = public as $$
  update baile_invitaciones set estado = 'caducada', cerrada = now()
  where estado = 'pendiente' and creada < now() - make_interval(hours => baile_cfg('horas')::int)
$$;

-- Cancela las invitaciones pendientes de una persona (enviadas y recibidas)
create or replace function baile_cancelar_invitaciones(pid bigint) returns void
language sql set search_path = public as $$
  update baile_invitaciones set estado = 'cancelada', cerrada = now(),
         visto_de = visto_de or de = pid, visto_para = visto_para or para = pid
  where estado = 'pendiente' and (de = pid or para = pid)
$$;

-- Cancela las invitaciones de alguien que ya no son posibles (cambió con quién quiere ir, vetó, etc.)
create or replace function baile_limpiar_invitaciones(pid bigint) returns void
language sql set search_path = public as $$
  update baile_invitaciones set estado = 'cancelada', cerrada = now(),
         visto_de = visto_de or de = pid, visto_para = visto_para or para = pid
  where estado = 'pendiente' and (de = pid or para = pid) and not baile_compatibles(de, para)
$$;

-- Forma una pareja y cancela todo lo pendiente de esas dos personas.
create or replace function baile_formar_pareja(x bigint, y bigint, origen text) returns void
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from baile_parejas where a in (x, y) or b in (x, y)) then
    raise exception 'Una de esas personas ya tiene pareja';
  end if;
  perform baile_cancelar_invitaciones(x);
  perform baile_cancelar_invitaciones(y);
  update baile_solicitudes set estado = 'cancelada', visto = true
   where estado = 'pendiente' and (de in (x, y) or para in (x, y));
  insert into baile_parejas (a, b, origen) values (least(x, y), greatest(x, y), origen);
  update baile_personas set estado = 'pareja' where id in (x, y);
end $$;

-- Aceptar una invitación (con regalo y carta de vuelta)
create or replace function baile_aceptar(iid bigint, p jsonb) returns void
language plpgsql set search_path = public as $$
declare
  inv baile_invitaciones;
  fid bigint;
begin
  select * into inv from baile_invitaciones where id = iid and estado = 'pendiente';
  if not found then raise exception 'Esa invitación ya no está activa'; end if;
  fid := baile_foto_regalo(inv.para, p);
  update baile_invitaciones set estado = 'aceptada', cerrada = now(), visto_de = true, visto_para = true,
    regalo_resp = p->>'regalo', nota_resp = left(trim(coalesce(p->>'nota', '')), 500), foto_resp = fid,
    titulo_resp = case when fid is not null then left(trim(p->>'titulo'), 40) end,
    revela_resp = coalesce((p->>'revela')::boolean, false)
                  and exists (select 1 from baile_secretos where de = inv.para and para = inv.de and anonimo)
  where id = iid;
  select * into inv from baile_invitaciones where id = iid;
  perform baile_formar_pareja(inv.de, inv.para, 'invitacion');
  insert into baile_lechuzas (de, para, regalo, nota, foto, titulo)
  values (inv.de, inv.para, inv.regalo, inv.nota, inv.foto, inv.titulo),
         (inv.para, inv.de, inv.regalo_resp, coalesce(inv.nota_resp, ''), inv.foto_resp, inv.titulo_resp);
end $$;

-- Las personas que puede ver alguien que busca pareja, de más a menos cosas en común
create or replace function baile_perfiles(me bigint) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(s.o order by s.n desc, s.nombre), '[]')
  from (
    select baile_publico(y.id) || jsonb_build_object(
        'comunes', to_jsonb(c.comunes), 'n', cardinality(c.comunes),
        'es_mi_crush', coalesce(x.crush = y.id, false),
        'me_invito', exists (select 1 from baile_invitaciones i where i.de = y.id and i.para = me and i.estado = 'pendiente'),
        'le_invite', exists (select 1 from baile_invitaciones i where i.de = me and i.para = y.id and i.estado = 'pendiente'),
        'me_rechazo', exists (select 1 from baile_invitaciones i where i.de = me and i.para = y.id and i.estado = 'rechazada'),
        'le_mande_secretos', exists (select 1 from baile_secretos z where z.de = me and z.para = y.id and z.anonimo)) as o,
      cardinality(c.comunes) as n, y.nombre
    from baile_personas x
    join baile_personas y on baile_compatibles(x.id, y.id)
    cross join lateral (select baile_comunes(x.id, y.id) as comunes) c
    where x.id = me
      and (cardinality(c.comunes) >= baile_cfg('minimo')::int
           or exists (select 1 from baile_invitaciones i where i.de = y.id and i.para = me and i.estado = 'pendiente'))
  ) s
$$;

-- Todo lo que ve una persona en su pantalla.
create or replace function baile_estado(me bigint) returns jsonb
language plpgsql set search_path = public as $$
declare
  yo baile_personas;
  par baile_parejas;
  otro bigint;
  j jsonb;
  baile_t timestamptz := baile_cfg('baile')::timestamptz;
begin
  select * into yo from baile_personas where id = me;
  j := jsonb_build_object(
    'yo', baile_publico(me) || jsonb_build_object('soy', yo.soy, 'voy_con', yo.voy_con, 'estado', yo.estado),
    'limite_regalos', 5,
    'cfg', jsonb_build_object('abiertas', baile_abiertas(), 'sombrero', baile_cfg('sombrero'), 'cierre', baile_cfg('cierre')::timestamptz,
      'baile', baile_t, 'horas', baile_cfg('horas')::int, 'minimo', baile_cfg('minimo')::int,
      'nota_libre', baile_cfg('nota_libre') = 'si', 'ahora', now()),
    'resumen', jsonb_build_object('parejas', (select count(*) from baile_parejas),
      'buscando', (select count(*) from baile_personas where estado = 'busca')),
    'vetos', coalesce((select jsonb_agg(vetado_id) from baile_vetos where persona_id = me), '[]'));

  -- Pareja confirmada (y si era su admirador secreto y lo reveló)
  select * into par from baile_parejas where a = me or b = me;
  if found then
    otro := case when par.a = me then par.b else par.a end;
    j := j || jsonb_build_object('pareja', jsonb_build_object('id', par.id, 'origen', par.origen,
      'persona', baile_publico(otro), 'comunes', to_jsonb(baile_comunes(me, otro)),
      'nueva', not (case when par.a = me then par.visto_a else par.visto_b end),
      'era_admirador', exists (select 1 from baile_invitaciones i where i.estado = 'aceptada'
        and ((i.de = otro and i.para = me and i.revela) or (i.para = otro and i.de = me and i.revela_resp)))));
  end if;

  -- Invitaciones
  j := j || jsonb_build_object(
    'recibidas', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'persona', baile_publico(i.de),
        'comunes', to_jsonb(baile_comunes(me, i.de)), 'regalo', i.regalo, 'nota', i.nota, 'titulo', i.titulo, 'foto', i.foto,
        'revela', i.revela, 'le_mande_secretos', exists (select 1 from baile_secretos z where z.de = me and z.para = i.de and z.anonimo),
        'vence', i.creada + make_interval(hours => baile_cfg('horas')::int)) order by i.id)
      from baile_invitaciones i where i.para = me and i.estado = 'pendiente'), '[]'),
    'enviada', (select jsonb_build_object('id', i.id, 'persona', baile_publico(i.para), 'regalo', i.regalo, 'nota', i.nota,
        'titulo', i.titulo, 'foto', i.foto, 'revela', i.revela, 'vence', i.creada + make_interval(hours => baile_cfg('horas')::int))
      from baile_invitaciones i where i.de = me and i.estado = 'pendiente' order by i.id desc limit 1));

  -- Avisos que aún no ha visto
  j := j || jsonb_build_object('avisos',
    coalesce((select jsonb_agg(jsonb_build_object('tipo', 'inv_' || i.estado, 'rol', case when i.de = me then 'de' else 'para' end,
        'id', i.id, 'nombre', (select nombre from baile_personas where id = case when i.de = me then i.para else i.de end)) order by i.id)
      from baile_invitaciones i
      where (i.de = me and not i.visto_de and i.estado in ('rechazada', 'caducada', 'cancelada'))
         or (i.para = me and not i.visto_para and i.estado in ('caducada', 'cancelada'))), '[]')
    || coalesce((select jsonb_agg(jsonb_build_object('tipo', 'solicitud_rechazada', 'id', s.id,
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
        'cerrada', l.sorpresa and now() < baile_t,
        'regalo', case when l.sorpresa and now() < baile_t then null else l.regalo end,
        'nota',   case when l.sorpresa and now() < baile_t then null else l.nota end,
        'titulo', case when l.sorpresa and now() < baile_t then null else l.titulo end,
        'foto',   case when l.sorpresa and now() < baile_t then null else l.foto end,
        'sorpresa', l.sorpresa, 'leida', l.leida, 'creada', l.creada) order by l.id desc)
      from baile_lechuzas l where l.para = me), '[]'),
    'enviadas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'para', (select nombre from baile_personas where id = l.para),
        'regalo', l.regalo, 'nota', l.nota, 'titulo', l.titulo, 'foto', l.foto, 'sorpresa', l.sorpresa, 'creada', l.creada) order by l.id desc)
      from baile_lechuzas l where l.de = me), '[]'));

  -- Admirador secreto: lo que recibo (sin decir de quién) y mi crush
  j := j || jsonb_build_object(
    'secretos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'regalo', x.regalo, 'nota', x.nota,
        'titulo', x.titulo, 'foto', x.foto, 'leida', x.leida, 'creada', x.creada, 'anonimo', x.anonimo,
        'de', case when x.anonimo then null else (select nombre from baile_personas where id = x.de) end) order by x.id desc)
      from baile_secretos x where x.para = me
        and not exists (select 1 from baile_bloqueos k where k.para = me and k.de = x.de)), '[]'),
    'secretos_hoy', (select count(*) from baile_secretos where de = me and creada > now() - interval '1 day'),
    'regalos_enviados', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'regalo', x.regalo, 'nota', x.nota,
        'titulo', x.titulo, 'foto', x.foto, 'leida', x.leida, 'creada', x.creada, 'anonimo', x.anonimo,
        'para', (select nombre from baile_personas where id = x.para),
        'bloqueado', exists (select 1 from baile_bloqueos k where k.para = x.para and k.de = me)) order by x.id desc)
      from baile_secretos x where x.de = me), '[]'));
  if yo.crush is not null then
    j := j || jsonb_build_object('crush', (select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'casa', c.casa,
        'tiene_pareja', c.estado = 'pareja',
        'bloqueado', exists (select 1 from baile_bloqueos k where k.para = c.id and k.de = me),
        'enviados', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'regalo', x.regalo, 'nota', x.nota,
            'titulo', x.titulo, 'foto', x.foto, 'leida', x.leida, 'creada', x.creada) order by x.id desc)
          from baile_secretos x where x.de = me and x.para = c.id), '[]'))
      from baile_personas c where c.id = yo.crush));
  end if;
  return j;
end $$;

-- ---------------------------------------------------------------- La única puerta de entrada
create or replace function baile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  accion text := p->>'accion';
  me bigint;
  yo baile_personas;
  inv baile_invitaciones;
  s baile_solicitudes;
  otro bigint;
  tok text;
  v text;
  i int;
  fid bigint;
  casas text[] := array['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];
begin
  perform pg_advisory_xact_lock(20261205);   -- una petición a la vez: nadie se queda con la misma pareja dos veces
  perform baile_caducar();

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
    if coalesce(p->>'plan', 'igual') not in ('romantico', 'amistad', 'igual') then raise exception 'Opción no válida'; end if;
    if p->>'estado' = 'busca' and jsonb_array_length(coalesce(p->'fotos', '[]')) = 0 then
      raise exception 'Sube al menos una foto para que puedan conocerte';
    end if;
    insert into baile_personas (nombre, nombre_norm, pin_hash, casa, soy, voy_con, plan, frase, intereses, estado)
    values (v, baile_norm(v), extensions.crypt(p->>'pin', extensions.gen_salt('bf')), p->>'casa', p->>'soy', p->>'voy_con',
            coalesce(nullif(p->>'plan', ''), 'igual'),
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
    return jsonb_build_object(
      'sombrero', baile_cfg('sombrero'), 'cierre', baile_cfg('cierre')::timestamptz, 'horas', baile_cfg('horas')::int,
      'minimo', baile_cfg('minimo')::int,
      'personas', coalesce((select jsonb_agg(jsonb_build_object(
          'id', x.id, 'nombre', x.nombre, 'casa', x.casa, 'soy', x.soy, 'voy_con', x.voy_con, 'estado', x.estado,
          'intereses', cardinality(x.intereses), 'fotos', (select count(*) from baile_fotos f where f.persona_id = x.id),
          'creado', x.creado,
          'invito_a', (select y.nombre from baile_invitaciones i2 join baile_personas y on y.id = i2.para
                       where i2.de = x.id and i2.estado = 'pendiente' limit 1),
          'invitaciones', (select count(*) from baile_invitaciones i3 where i3.para = x.id and i3.estado = 'pendiente'),
          'rechazos', (select count(*) from baile_invitaciones i4 where i4.de = x.id and i4.estado = 'rechazada')
        ) order by x.nombre) from baile_personas x), '[]'),
      'parejas', coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'origen', pa.origen, 'creada', pa.creada,
          'a', (select nombre from baile_personas where id = pa.a), 'b', (select nombre from baile_personas where id = pa.b)
        ) order by pa.id) from baile_parejas pa), '[]'),
      'lechuzas', (select count(*) from baile_lechuzas),
      'secretos', coalesce((select jsonb_agg(jsonb_build_object('de', d.nombre, 'para', t.nombre, 'n', g.n, 'anonimos', g.anon,
          'bloqueado', exists (select 1 from baile_bloqueos k where k.para = g.para and k.de = g.de)) order by g.n desc)
        from (select de, para, count(*) n, count(*) filter (where anonimo) anon from baile_secretos group by de, para) g
        join baile_personas d on d.id = g.de join baile_personas t on t.id = g.para), '[]'));
  end if;

  -- ======== Con cuenta: a partir de aquí hace falta el token
  select persona_id into me from baile_sesiones where token = p->>'token';
  if me is null then return jsonb_build_object('error', 'sesion'); end if;
  select * into yo from baile_personas where id = me;

  if accion = 'estado' then
    return baile_estado(me);

  elsif accion = 'perfiles' then             -- quienes se pueden ver mutuamente, de más a menos cosas en común
    if yo.estado <> 'busca' then return '[]'::jsonb; end if;
    return baile_perfiles(me);

  elsif accion = 'salir' then
    delete from baile_sesiones where token = p->>'token';
    return jsonb_build_object('ok', true);

  elsif accion = 'fotos' then
    otro := (p->>'persona')::bigint;
    if otro <> me
       and not baile_compatibles(me, otro)
       and not exists (select 1 from baile_parejas where (a = me and b = otro) or (a = otro and b = me))
       and not exists (select 1 from baile_invitaciones where (de = me and para = otro) or (de = otro and para = me))
       and not exists (select 1 from baile_solicitudes where (de = me and para = otro) or (de = otro and para = me)) then
      raise exception 'No puedes ver esas fotos';
    end if;
    return coalesce((select jsonb_agg(datos order by orden) from baile_fotos where persona_id = otro), '[]');

  elsif accion = 'foto_regalo' then
    fid := (p->>'id')::bigint;
    if not exists (select 1 from baile_lechuzas where foto = fid and (de = me or (para = me and not (sorpresa and now() < baile_cfg('baile')::timestamptz))))
       and not exists (select 1 from baile_invitaciones where (foto = fid or foto_resp = fid) and (de = me or para = me))
       and not exists (select 1 from baile_secretos where foto = fid and (de = me or para = me)) then
      raise exception 'No puedes ver esa foto';
    end if;
    return to_jsonb((select datos from baile_regalo_fotos where id = fid));

  elsif accion = 'perfil' then
    if p ? 'casa' and not (p->>'casa' = any (casas)) then raise exception 'Elige tu casa'; end if;
    if p ? 'soy' and p->>'soy' not in ('chica', 'chico', 'otro') then raise exception 'Opción no válida'; end if;
    if p ? 'voy_con' and p->>'voy_con' not in ('chicas', 'chicos', 'cualquiera') then raise exception 'Opción no válida'; end if;
    if p ? 'plan' and p->>'plan' not in ('romantico', 'amistad', 'igual') then raise exception 'Opción no válida'; end if;
    update baile_personas set
      plan = coalesce(p->>'plan', plan),
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
    perform baile_limpiar_invitaciones(me);

  elsif accion = 'vetos' then
    delete from baile_vetos where persona_id = me;
    insert into baile_vetos (persona_id, vetado_id)
    select me, x::bigint from jsonb_array_elements_text(coalesce(p->'ids', '[]')) x
    where x::bigint <> me and exists (select 1 from baile_personas where id = x::bigint)
    limit 3
    on conflict do nothing;
    perform baile_limpiar_invitaciones(me);

  elsif accion = 'nombres' then
    return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'casa', casa, 'estado', estado) order by nombre)
                     from baile_personas where id <> me), '[]');

  elsif accion = 'modo' then                 -- 'busca' (busco pareja) o 'tiene' (ya tengo con quién ir)
    if yo.estado = 'pareja' then raise exception 'Ya tienes pareja confirmada'; end if;
    if p->>'estado' = 'busca' then
      if not exists (select 1 from baile_fotos where persona_id = me) then
        raise exception 'Sube al menos una foto en tu perfil para que puedan conocerte';
      end if;
      update baile_solicitudes set estado = 'cancelada', visto = true where de = me and estado = 'pendiente';
      update baile_personas set estado = 'busca' where id = me;
    elsif p->>'estado' = 'tiene' then
      perform baile_cancelar_invitaciones(me);
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
      perform baile_cancelar_invitaciones(me);
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

  elsif accion = 'invitar' then              -- "¿vamos juntos al baile?" con regalo y carta
    otro := (p->>'para')::bigint;
    if not baile_abiertas() then
      if now() > baile_cfg('cierre')::timestamptz then raise exception 'El plazo para invitar ya terminó'; end if;
      raise exception 'Las invitaciones todavía no están abiertas. ¡Muy pronto!';
    end if;
    if yo.estado <> 'busca' then raise exception 'Solo puedes invitar mientras buscas pareja'; end if;
    if not baile_compatibles(me, otro) then raise exception 'No puedes invitar a esa persona'; end if;
    select * into inv from baile_invitaciones where de = otro and para = me and estado = 'pendiente';
    if found then                            -- ¡ya te había invitado! invitar = aceptar
      perform baile_aceptar(inv.id, p);
      return baile_estado(me);
    end if;
    if cardinality(baile_comunes(me, otro)) < baile_cfg('minimo')::int then
      raise exception 'Necesitan al menos % cosas en común', baile_cfg('minimo');
    end if;
    if exists (select 1 from baile_invitaciones where de = me and estado = 'pendiente') then
      raise exception 'Ya tienes una invitación esperando respuesta. Espera o cancélala para invitar a otra persona.';
    end if;
    if exists (select 1 from baile_invitaciones where de = me and para = otro and estado = 'rechazada') then
      raise exception 'Esa persona ya respondió a tu invitación';
    end if;
    fid := baile_foto_regalo(me, p);
    insert into baile_invitaciones (de, para, regalo, nota, foto, titulo, revela)
    values (me, otro, p->>'regalo', left(trim(coalesce(p->>'nota', '')), 500), fid,
            case when fid is not null then left(trim(p->>'titulo'), 40) end,
            coalesce((p->>'revela')::boolean, false) and exists (select 1 from baile_secretos where de = me and para = otro and anonimo));

  elsif accion = 'responder_invitacion' then
    select * into inv from baile_invitaciones where id = (p->>'id')::bigint and para = me and estado = 'pendiente';
    if not found then raise exception 'Esa invitación ya no está activa'; end if;
    if (p->>'acepta')::boolean then
      if yo.estado = 'pareja' then raise exception 'Ya tienes pareja confirmada'; end if;
      perform baile_aceptar(inv.id, p);
    else
      update baile_invitaciones set estado = 'rechazada', cerrada = now(), visto_para = true where id = inv.id;
    end if;

  elsif accion = 'cancelar_invitacion' then
    update baile_invitaciones set estado = 'cancelada', cerrada = now(), visto_de = true where de = me and estado = 'pendiente';

  elsif accion = 'visto' then
    if p->>'tipo' = 'solicitud_rechazada' then
      update baile_solicitudes set visto = true where id = (p->>'id')::bigint and de = me;
    elsif p->>'tipo' = 'pareja' then
      update baile_parejas set visto_a = visto_a or a = me, visto_b = visto_b or b = me where a = me or b = me;
    else
      update baile_invitaciones set visto_de = visto_de or de = me, visto_para = visto_para or para = me
       where id = (p->>'id')::bigint and (de = me or para = me);
    end if;

  elsif accion = 'lechuza' then             -- regalo a tu pareja confirmada
    select case when a = me then b else a end into otro from baile_parejas where a = me or b = me;
    if otro is null then raise exception 'Primero necesitas pareja confirmada'; end if;
    if (select count(*) from baile_lechuzas where de = me and creada > now() - interval '1 day') >= 15 then
      raise exception 'Las lechuzas están agotadas por hoy 🦉 Mañana pueden volar más.';
    end if;
    fid := baile_foto_regalo(me, p);
    insert into baile_lechuzas (de, para, regalo, nota, sorpresa, foto, titulo)
    values (me, otro, p->>'regalo', left(trim(coalesce(p->>'nota', '')), 500), coalesce((p->>'sorpresa')::boolean, false),
            fid, case when fid is not null then left(trim(p->>'titulo'), 40) end);

  elsif accion = 'leer_lechuzas' then
    update baile_lechuzas set leida = true
     where para = me and not leida and not (sorpresa and now() < baile_cfg('baile')::timestamptz);

  elsif accion = 'crush' then                -- elegir (o quitar) a quién mandarle regalos secretos
    if p->>'para' is null or p->>'para' = '' then
      update baile_personas set crush = null where id = me;
    else
      otro := (p->>'para')::bigint;
      if yo.estado = 'pareja' then raise exception 'Ya tienes pareja: los regalos secretos son para quien todavía busca'; end if;
      if otro = me or not exists (select 1 from baile_personas where id = otro) then raise exception 'Elige a otra persona'; end if;
      if (select estado from baile_personas where id = otro) = 'pareja' then raise exception 'Esa persona ya tiene pareja para el baile'; end if;
      if exists (select 1 from baile_bloqueos where para = otro and de = me) then raise exception 'Esa persona prefiere no recibir regalos secretos'; end if;
      update baile_personas set crush = otro where id = me;
    end if;

  elsif accion = 'secreto' then              -- 🎁 regalo para quien quieras, con tu nombre o en secreto
    otro := coalesce(nullif(p->>'para', '')::bigint, yo.crush);
    if otro is null or otro = me or not exists (select 1 from baile_personas where id = otro) then raise exception 'Elige a quién se lo mandas'; end if;
    if exists (select 1 from baile_bloqueos where para = otro and de = me) then raise exception 'Esa persona prefiere no recibir regalos tuyos'; end if;
    if (select count(*) from baile_secretos where de = me and creada > now() - interval '1 day') >= 5 then
      raise exception 'Ya mandaste 5 regalos hoy 🎁 Mañana puedes mandar más.';
    end if;
    fid := baile_foto_regalo(me, p);
    insert into baile_secretos (de, para, regalo, nota, foto, titulo, anonimo)
    values (me, otro, p->>'regalo', left(trim(coalesce(p->>'nota', '')), 500), fid,
            case when fid is not null then left(trim(p->>'titulo'), 40) end, coalesce((p->>'anonimo')::boolean, true));

  elsif accion = 'bloquear_secreto' then     -- no quiero recibir más regalos de esa persona (aunque no sepa quién es)
    insert into baile_bloqueos (para, de)
    select me, de from baile_secretos where id = (p->>'id')::bigint and para = me
    on conflict do nothing;

  elsif accion = 'leer_secretos' then
    update baile_secretos set leida = true where para = me and not leida;

  else
    raise exception 'Acción desconocida';
  end if;

  return baile_estado(me);
end $$;

-- Solo la función baile() se puede llamar desde la página.
revoke execute on function baile_cfg(text), baile_regalos(), baile_norm(text), baile_compat(text, text, text, text),
  baile_compatibles(bigint, bigint), baile_abiertas(), baile_publico(bigint), baile_comunes(bigint, bigint),
  baile_foto_regalo(bigint, jsonb), baile_caducar(), baile_cancelar_invitaciones(bigint), baile_limpiar_invitaciones(bigint),
  baile_formar_pareja(bigint, bigint, text), baile_aceptar(bigint, jsonb), baile_perfiles(bigint), baile_estado(bigint)
  from public, anon, authenticated;
revoke execute on function baile(jsonb) from public;
grant execute on function baile(jsonb) to anon, authenticated;
