'use strict';
// Servidor del juego de Quidditch (paso 3: partido completo).
// - Sirve la página web (public/index.html).
// - Mantiene las salas en memoria (si el servidor se reinicia, se pierden).
// - Toda la validación se hace aquí. Node procesa los mensajes uno a uno,
//   así que dos peticiones simultáneas nunca pueden quedarse con la misma plaza.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ---------------------------------------------------------------- Ajustes
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambiame';
const CAPITAN_PASSWORD = process.env.CAPITAN_PASSWORD || '';            // clave de capitanes: solo para entrenamientos
const RESERVA_MS = Number(process.env.RESERVA_MS) || 60000;              // plaza reservada al desconectarse
const BLUDGER_ESPERA_MS = Number(process.env.BLUDGER_ESPERA_MS) || 20000; // cada equipo, una bludger cada 20 s
const MINUTO_MS = Number(process.env.MINUTO_MS) || 60000;                 // (las pruebas automáticas lo acortan)
const INICIO_MS = Number(process.env.INICIO_MS) || 7000;                  // moneda (4 s) + cuenta atrás (3 s)
const POSESION_MS = 10000;   // tiempo para pasar o lanzar; si no, se pierde la quaffle
const MAX_PARTICIPANTES = 20;
const MAX_LOG = 100;
const PUNTOS_GOL = 10;
const PUNTOS_SNITCH = 150;
const DURACIONES = [10, 15, 20];        // minutos de partido que puede elegir el administrador
const MOMENTOS_SNITCH = [0.5, 0.75];    // la snitch aparece a la mitad y a los 3/4 del partido (20 min: min 10 y 15)
const VENTANA_RED_MS = 1000;            // en duelos (tiro, snitch), cuánto esperamos el toque del otro por si viene con retraso
const MAX_COMENTARIO = 140;

const AJUSTES = {
  tolerancia: 0.015,     // margen extra a cada lado de la zona (por el refresco de pantalla)
  minimoHumanoMs: 80,    // nadie reacciona antes de esto: valor imposible
  margenRelojMs: 300,    // diferencia de reloj admitida entre celular y servidor
  margenRedMs: 1500,     // espera extra por la red antes de dar un reto por fallido
};
// Cada reto es un minijuego de precisión: una marca va y vuelve y hay que tocar dentro de la zona.
// Lo que cambia es el dibujo: barra (cazadores), aguja (guardián) y círculo (golpeadores).
// Tiro y atajada tienen la MISMA velocidad y zona, para que gane el más rápido.
const RETOS = {
  pase:    { visual: 'barra',   ancho: 0.14, periodo: 1600, limite: 6000, boton: '¡PASAR!' },
  tiro:    { visual: 'barra',   ancho: 0.14, periodo: 1500, limite: 6000, boton: '¡LANZAR!' },
  atajar:  { visual: 'aguja',   ancho: 0.14, periodo: 1500, limite: 6000, boton: '¡ATAJAR!' },
  bateo:   { visual: 'circulo', ancho: 0.12, periodo: 1400, limite: 6000, boton: '¡BATEAR!' },
  repeler: { visual: 'circulo', ancho: 0.16, periodo: 1000, limite: 3000, boton: '¡REPELER!' },
};
// Posiciones de la zona: secuencia fija.
const CENTROS = [0.5, 0.3, 0.7, 0.4, 0.62, 0.26, 0.74, 0.45, 0.56, 0.34, 0.68];
const SNITCH = {
  pausas: [2600, 4100, 1900, 3400, 4600, 2200, 3800, 3000], // espera antes de la señal (secuencia fija)
  limiteMs: 3000,        // tras la señal, tiempo para tocar
  minimoMs: 100,         // reacción más rápida que esto = imposible
  entreRondasMs: 2500,
  maxMuerteSubita: 5,    // apariciones en muerte súbita antes de declarar empate
};

const CASAS = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];
const EQUIPOS = ['A', 'B'];
const POSICIONES = [
  { id: 'cazador1', nombre: 'Cazador 1', tipo: 'cazador' },
  { id: 'cazador2', nombre: 'Cazador 2', tipo: 'cazador' },
  { id: 'cazador3', nombre: 'Cazador 3', tipo: 'cazador' },
  { id: 'golpeador1', nombre: 'Golpeador 1', tipo: 'golpeador' },
  { id: 'golpeador2', nombre: 'Golpeador 2', tipo: 'golpeador' },
  { id: 'guardian', nombre: 'Guardián', tipo: 'guardian' },
  { id: 'buscador', nombre: 'Buscador', tipo: 'buscador' },
];
const PAPELES_INVITADO = ['comentaristaA', 'comentaristaB', 'prefecto', 'administracion'];
// Partido oficial: 7 por lado. Entrenamiento: 5 por lado (2 cazadores, 1 golpeador, 1 guardián, 1 buscador).
// Entrenamiento: 3 contra 3, 4 contra 4 (con buscador o con golpeador) o 5 contra 5.
const POSICIONES_DE = {
  oficial: POSICIONES.map((p) => p.id),
  e3: ['cazador1', 'cazador2', 'guardian'],
  e4b: ['cazador1', 'cazador2', 'guardian', 'buscador'],
  e4g: ['cazador1', 'cazador2', 'golpeador1', 'guardian'],
  e5: ['cazador1', 'cazador2', 'golpeador1', 'guardian', 'buscador'],
};
const FORMATOS = ['e3', 'e4b', 'e4g', 'e5'];
POSICIONES_DE.duelo = [];
// Señuelos de la snitch (una polilla dorada): secuencia fija de rondas en las que aparece uno.
const SENUELOS = [1, 0, 1, 1, 0, 1, 0, 1];
const SENUELO_MS = 800;
const RONDAS_DUELO = [3, 5, 7];
const conSnitch = (sala) => POSICIONES_DE[sala.formato].includes('buscador');

// ---------------------------------------------------------------- Estado
const salas = new Map();   // codigo -> sala
const tokens = new Map();  // token  -> { codigo, id }

function nuevaSala(codigo, equipos, tipo, formato) {
  const plazas = {};
  for (const e of EQUIPOS) for (const id of POSICIONES_DE[formato]) plazas[`${e}-${id}`] = null; // null = libre, id, o {bloqueada, nombre}
  // Si en un entrenamiento los dos lados son de la misma casa, se llaman "Slytherin 1" y "Slytherin 2".
  const nombres = equipos.A === equipos.B ? { A: `${equipos.A} 1`, B: `${equipos.B} 2` } : { ...equipos };
  return {
    codigo,
    tipo,          // 'oficial' | 'entrenamiento'
    formato,       // 'oficial' | 'e3' | 'e4b' | 'e4g' | 'e5'
    nombres,
    creada: Date.now(),
    fase: 'lobby', // 'lobby' | 'inicio' (moneda) | 'partido' | 'muerte' (muerte súbita) | 'final'
    equipos,       // { A: 'Slytherin', B: 'Gryffindor' }
    participantes: new Map(),
    plazas,
    log: [],
    comentarios: [],
    pelota: null,  // { equipo, portador, limite }
    accion: null,  // jugada en curso: 'pase' | 'tiro' | 'bludger'
    contadorRetos: 0,
    contadorPausas: 0,
    rotacion: { A: 0, B: 0 },
    pasesBuenos: 0,
    marcador: { A: 0, B: 0 },
    ultimaBludger: { A: 0, B: 0 },
    partido: null, // { duracionMin, moneda, inicio, fin, timers }
    snitch: null,
    muertesSubitas: 0,
    finPendiente: false,
    timerPosesion: null,
    stats: {},
    resultado: null,
  };
}

// ---------------------------------------------------------------- Utilidades
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpiarTexto = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const limpiarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const tipoDePlaza = (plaza) => POSICIONES.find((p) => p.id === plaza.split('-')[1]).tipo;
const nombreDePlaza = (plaza) => POSICIONES.find((p) => p.id === plaza.split('-')[1]).nombre;
const equipoDePlaza = (plaza) => plaza.split('-')[0];
const rival = (e) => (e === 'A' ? 'B' : 'A');
const hex = (n) => crypto.randomBytes(n).toString('hex');
const seg = (ms) => (ms / 1000).toFixed(2).replace('.', ',') + ' s';
const enJuego = (sala) => ['inicio', 'partido', 'muerte'].includes(sala.fase);

function nombrePapel(sala, papel) {
  if (papel === 'comentaristaA') return `Comentarista de ${sala.nombres.A}`;
  if (papel === 'comentaristaB') return `Comentarista de ${sala.nombres.B}`;
  if (papel === 'prefecto') return 'Prefecto';
  return 'Administración';
}

function enviar(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function error(ws, msg, codigo) {
  enviar(ws, { t: 'error', msg, codigo });
}
function registrar(sala, texto) {
  sala.log.push({ h: Date.now(), texto });
  if (sala.log.length > MAX_LOG) sala.log.shift();
}
function nombreDe(sala, id) {
  const p = sala.participantes.get(id);
  return p ? p.nombre : (sala.stats[id] && sala.stats[id].nombre) || '?';
}
// Aviso personal para un jugador (aparece solo en su pantalla).
function avisarA(sala, id, texto, bueno) {
  const p = sala.participantes.get(id);
  if (p) enviar(p.ws, { t: 'resultado', texto, bueno });
}
function stat(sala, id, campo, n = 1) {
  if (sala.stats[id]) sala.stats[id][campo] += n;
}
function programar(sala, fn, ms) {
  const t = setTimeout(fn, ms);
  if (sala.partido) sala.partido.timers.push(t);
  return t;
}

// Animaciones en el campo: se mandan a todos (jugadores incluidos). No llevan texto, solo lo que se dibuja.
function animar(sala, ev) {
  const msg = JSON.stringify({ t: 'anim', ...ev });
  for (const p of sala.participantes.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
}
// Jugadores que están resolviendo un reto ahora mismo (se dibujan con un brillo en el campo).
function actuando(sala) {
  const ids = [];
  if (sala.accion) for (const r of sala.accion.retos.values()) if (r.precision === undefined) ids.push(r.pid);
  if (sala.snitch) for (const e of EQUIPOS) if (sala.snitch.busc[e]) ids.push(sala.snitch.busc[e]);
  return ids;
}

// Ids de los jugadores de un tipo en un equipo (conectados o todos).
function jugadoresDe(sala, equipo, tipo, soloConectados = true) {
  return POSICIONES.filter((x) => x.tipo === tipo)
    .map((x) => sala.plazas[`${equipo}-${x.id}`])
    .filter((id) => typeof id === 'string' && (!soloConectados || sala.participantes.get(id).conectado));
}
// Con 3 o 2 cazadores hacen falta 2 pases buenos (pueden ir y volver); con 1 solo, puede tirar directo.
function pasesNecesarios(sala, equipo) {
  return jugadoresDe(sala, equipo, 'cazador').length >= 2 ? 2 : 0;
}

// Lo que ven los clientes. Los jugadores NO ven lo que pasa en el campo (registro, snitch, jugada en curso):
// eso es para los invitados. Nunca se envían tokens ni zonas de los retos.
function estadoPublico(sala, esInvitado) {
  const ahora = Date.now();
  const a = sala.accion;
  const pt = sala.partido;
  const s = sala.snitch;
  return {
    codigo: sala.codigo,
    tipo: sala.tipo,
    fase: sala.fase,
    max: MAX_PARTICIPANTES,
    equipos: sala.equipos,
    nombres: sala.nombres,
    posiciones: POSICIONES_DE[sala.formato],
    formato: sala.formato,
    snitchActiva: !!sala.snitch,
    duelo: dueloPublico(sala),
    actuando: actuando(sala),
    participantes: [...sala.participantes.values()].map((p) => ({
      id: p.id, nombre: p.nombre, casa: p.casa, equipo: p.equipo, lados: p.lados, conectado: p.conectado, plaza: p.plaza, invitado: p.invitado, admin: p.admin,
    })),
    plazas: sala.plazas,
    pelota: sala.pelota && { equipo: sala.pelota.equipo, portador: sala.pelota.portador, restaMs: Math.max(0, sala.pelota.limite - ahora) },
    enJuego: !!a,
    marcador: sala.marcador,
    pasesBuenos: sala.pasesBuenos,
    pasesNecesarios: sala.pelota ? pasesNecesarios(sala, sala.pelota.equipo) : 2,
    bludgerEsperaMs: {
      A: Math.max(0, sala.ultimaBludger.A + BLUDGER_ESPERA_MS - ahora),
      B: Math.max(0, sala.ultimaBludger.B + BLUDGER_ESPERA_MS - ahora),
    },
    partido: pt && {
      duracionMs: pt.duracionMin * MINUTO_MS,
      transcurridoMs: Math.min(ahora, sala.resultado ? sala.resultado.fin : ahora) - pt.inicio, // negativo durante la moneda
      moneda: pt.moneda,
      snitchMs: conSnitch(sala) ? MOMENTOS_SNITCH.map((f) => f * pt.duracionMin * MINUTO_MS) : [],
      minutoMs: MINUTO_MS,
    },
    duraciones: DURACIONES,
    accion: esInvitado && a ? { tipo: a.tipo, texto: a.texto } : null,
    snitch: esInvitado && s ? { ronda: s.ronda, victorias: s.victorias, muerte: s.muerte } : null,
    log: esInvitado ? sala.log : null,
    resultado: sala.resultado,
    stats: sala.fase === 'final' ? Object.values(sala.stats) : null,
  };
}
function difundir(sala) {
  const paraInvitados = JSON.stringify({ t: 'estado', sala: estadoPublico(sala, true) });
  const paraJugadores = JSON.stringify({ t: 'estado', sala: estadoPublico(sala, false) });
  for (const p of sala.participantes.values()) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(p.invitado || sala.tipo !== 'oficial' ? paraInvitados : paraJugadores);
  }
}

// ---------------------------------------------------------------- Entrada y reconexión
// La contraseña de administración sirve para todo; la de capitanes, solo en entrenamientos.
function esClaveAdmin(tipo, clave) {
  return clave === ADMIN_PASSWORD || (tipo !== 'oficial' && !!CAPITAN_PASSWORD && clave === CAPITAN_PASSWORD);
}

function crearSala(ws, m) {
  const tipo = ['entrenamiento', 'duelo'].includes(m.tipo) ? m.tipo : 'oficial';
  if (!esClaveAdmin(tipo, m.clave)) {
    return error(ws, tipo === 'oficial' && CAPITAN_PASSWORD && m.clave === CAPITAN_PASSWORD
      ? 'La clave de capitanes solo sirve para crear entrenamientos.' : 'Contraseña incorrecta.');
  }
  const codigo = limpiarCodigo(m.codigo);
  if (codigo.length < 3 || codigo.length > 10) return error(ws, 'El código debe tener entre 3 y 10 letras o números.');
  if (salas.has(codigo)) return enviar(ws, { t: 'sala_creada', codigo, equipos: salas.get(codigo).equipos, nombres: salas.get(codigo).nombres, tipo: salas.get(codigo).tipo, yaExistia: true });
  if (tipo === 'duelo') { m.equipoA = m.equipoA || 'Gryffindor'; m.equipoB = m.equipoB || 'Slytherin'; }
  if (!CASAS.includes(m.equipoA) || !CASAS.includes(m.equipoB)) return error(ws, 'Elige la casa de cada equipo.');
  if (m.equipoA === m.equipoB && tipo === 'oficial') return error(ws, 'En un partido oficial los dos equipos deben ser de casas distintas.');
  const formato = tipo === 'oficial' ? 'oficial' : tipo === 'duelo' ? 'duelo' : FORMATOS.includes(m.formato) ? m.formato : 'e5';
  const sala = nuevaSala(codigo, { A: m.equipoA, B: m.equipoB }, tipo, formato);
  salas.set(codigo, sala);
  registrar(sala, tipo === 'duelo' ? `Sala de duelos ${codigo} creada.` : `${tipo === 'entrenamiento' ? 'Entrenamiento' : 'Partido'} ${codigo} creado: ${sala.nombres.A} contra ${sala.nombres.B}.`);
  enviar(ws, { t: 'sala_creada', codigo, equipos: sala.equipos, nombres: sala.nombres, tipo, formato });
}

// Se entra con una casa (solo si esa casa juega: luego solo puede elegir posiciones de su equipo)
// o como Invitado (solo puede elegir comentarista, prefecto o administración).
function entrar(ws, m) {
  if (ws.participante) return error(ws, 'Ya estás dentro de una sala.');
  const codigo = limpiarCodigo(m.codigo);
  const sala = salas.get(codigo);
  if (!sala) return error(ws, 'No existe ninguna sala con ese código. Revisa el código o pide al administrador que la cree.');
  const nombre = limpiarTexto(m.nombre);
  if (nombre.length < 1 || nombre.length > 20) return error(ws, 'Escribe un nombre de 1 a 20 letras.');
  const esInvitado = m.casa === 'Invitado';
  if (!esInvitado && !CASAS.includes(m.casa)) return error(ws, 'Elige tu casa o "Invitado".');
  let lados = [];
  if (!esInvitado && sala.tipo !== 'duelo') {
    lados = EQUIPOS.filter((e) => sala.equipos[e] === m.casa); // en un entrenamiento de una sola casa, puede ir a los dos lados
    if (!lados.length) {
      return error(ws, `${m.casa} no juega en este partido (${sala.nombres.A} contra ${sala.nombres.B}). Puedes entrar como Invitado.`, 'casa_no_juega');
    }
    if (enJuego(sala)) return error(ws, 'El partido ya empezó: solo se puede entrar como Invitado.', 'partido_empezado');
  }
  if (sala.participantes.size >= MAX_PARTICIPANTES) {
    return error(ws, `La sala está llena (${MAX_PARTICIPANTES} participantes). No se puede entrar.`, 'sala_llena');
  }
  const n = normalizar(nombre);
  for (const p of sala.participantes.values()) {
    if (normalizar(p.nombre) === n) return error(ws, `Ya hay alguien llamado "${p.nombre}" en la sala. Usa otro nombre (por ejemplo, con tu apellido).`, 'nombre_repetido');
  }
  const p = {
    id: hex(6), token: hex(24),
    nombre, casa: esInvitado ? null : m.casa, lados, equipo: lados.length === 1 ? lados[0] : null, plaza: null, invitado: null, admin: false,
    ws: null, conectado: false, timerReserva: null, ultimoComentario: 0,
  };
  sala.participantes.set(p.id, p);
  tokens.set(p.token, { codigo, id: p.id });
  conectar(sala, p, ws);
  registrar(sala, `${nombre} (${esInvitado ? 'invitado' : m.casa}) entra en la sala.`);
  difundir(sala);
}

function reconectar(ws, m) {
  const ref = tokens.get(String(m.token || ''));
  const sala = ref && salas.get(ref.codigo);
  const p = sala && sala.participantes.get(ref.id);
  if (!p) return error(ws, 'Tu sesión anterior ya no existe. Vuelve a entrar.', 'token_invalido');
  if (p.ws && p.ws !== ws) {
    enviar(p.ws, { t: 'error', msg: 'Abriste el juego en otra pestaña o aparato.', codigo: 'otra_pestana' });
    p.ws.participante = null;
    p.ws.close();
  }
  const volvia = !p.conectado;
  conectar(sala, p, ws);
  if (volvia) registrar(sala, `${p.nombre} se reconecta.`);
  repartirSiSuelta(sala);
  difundir(sala);
  // Si tenía un reto o la snitch abiertos, se los devolvemos por donde iban.
  if (sala.accion) for (const r of sala.accion.retos.values()) {
    if (r.pid === p.id && r.precision === undefined) enviarReto(sala, r);
  }
  if (sala.snitch) enviarSnitch(sala, p.id);
  if (sala.duelo && sala.duelo.estado !== 'fin') enviarDuelo(sala, p.id);
}

function conectar(sala, p, ws) {
  clearTimeout(p.timerReserva);
  p.timerReserva = null;
  p.ws = ws;
  p.conectado = true;
  ws.participante = { codigo: sala.codigo, id: p.id };
  enviar(ws, { t: 'bienvenida', token: p.token, yo: p.id, codigo: sala.codigo });
}

function alDesconectar(ws) {
  const { sala, p } = quien(ws);
  if (!p || p.ws !== ws) return;
  p.ws = null;
  p.conectado = false;
  registrar(sala, `${p.nombre} se desconectó (plaza reservada ${Math.round(RESERVA_MS / 1000)} s).`);
  p.timerReserva = setTimeout(() => vencerReserva(sala, p.id), RESERVA_MS);
  difundir(sala);
}

// Pasó el minuto sin volver: se borra como si hubiera abandonado.
function vencerReserva(sala, id) {
  const p = sala.participantes.get(id);
  if (!p || p.conectado) return;
  quitarParticipante(sala, p, `${p.nombre} no volvió a tiempo y queda fuera de la sala.`);
  difundir(sala);
}

function quitarParticipante(sala, p, texto) {
  p.conectado = false; // para que no se le pueda volver a entregar la quaffle mientras sale
  soltarTodo(sala, p);
  if (p.plaza) {
    // Antes del partido la plaza queda libre; durante el partido queda bloqueada hasta el final.
    sala.plazas[p.plaza] = enJuego(sala) ? { bloqueada: true, nombre: p.nombre } : null;
  }
  clearTimeout(p.timerReserva);
  tokens.delete(p.token); // token invalidado: nadie puede volver con él
  sala.participantes.delete(p.id);
  registrar(sala, texto);
}

// Salir a propósito libera todo al instante (así quien se equivocó puede volver a entrar y elegir bien).
function salir(ws) {
  const { sala, p } = quien(ws);
  if (!p) return;
  quitarParticipante(sala, p, `${p.nombre} sale de la sala.`);
  ws.participante = null;
  enviar(ws, { t: 'fuera' });
  difundir(sala);
}

// ---------------------------------------------------------------- Plazas y papeles (no se pueden cambiar)
function quien(ws) {
  const ref = ws.participante;
  const sala = ref && salas.get(ref.codigo);
  const p = sala && sala.participantes.get(ref.id);
  return { sala, p };
}

const YA_ELEGISTE = 'Ya elegiste tu función y no se puede cambiar. Si te equivocaste, sal de la sala y vuelve a entrar.';

function elegirPlaza(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return error(ws, 'Primero entra en una sala.');
  if (!p.lados.length) return error(ws, 'Entraste como Invitado: elige un papel de invitado.');
  if (p.plaza) return error(ws, YA_ELEGISTE, 'ya_elegiste');
  if (sala.fase !== 'lobby') return error(ws, 'Las posiciones solo se eligen antes del partido.');
  const plaza = String(m.plaza || '');
  if (!(plaza in sala.plazas)) return error(ws, 'Esa plaza no existe.');
  if (!p.lados.includes(equipoDePlaza(plaza))) return error(ws, `Solo puedes elegir posiciones de ${p.lados.map((e) => sala.nombres[e]).join(' o ')}.`, 'otro_equipo');
  if (sala.plazas[plaza] !== null) return error(ws, 'Esa plaza ya está ocupada. Elige otra.', 'plaza_ocupada');
  sala.plazas[plaza] = p.id;
  p.plaza = plaza;
  p.equipo = equipoDePlaza(plaza);
  registrar(sala, `${p.nombre} es ${nombreDePlaza(plaza)} de ${sala.nombres[p.equipo]}.`);
  difundir(sala);
}

function serInvitado(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return error(ws, 'Primero entra en una sala.');
  if (p.lados.length) return error(ws, `Entraste con la casa ${p.casa}: elige una posición de tu equipo. Para ser invitado, sal y entra como Invitado.`);
  if (p.invitado) return error(ws, YA_ELEGISTE, 'ya_elegiste');
  const papel = String(m.tipo || '');
  if (!PAPELES_INVITADO.includes(papel)) return error(ws, 'Ese papel no existe.');
  if (papel.startsWith('comentarista')) {
    if (sala.tipo === 'entrenamiento') return error(ws, 'En los entrenamientos no hay comentaristas.');
    for (const x of sala.participantes.values()) {
      if (x.invitado === papel) return error(ws, `Ya hay ${nombrePapel(sala, papel)}: ${x.nombre}.`, 'papel_ocupado');
    }
  }
  if (papel === 'administracion') {
    if (!p.admin && !esClaveAdmin(sala.tipo, m.clave)) return error(ws, 'Contraseña incorrecta.', 'clave_mala');
    p.admin = true;
  }
  p.invitado = papel;
  registrar(sala, `${p.nombre} mira el partido como ${nombrePapel(sala, papel)}.`);
  difundir(sala);
}

// Administrar sin dejar de jugar: cualquiera que sepa la contraseña puede activar la administración.
function adminLogin(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return error(ws, 'Primero entra en una sala.');
  if (p.admin) return;
  if (!esClaveAdmin(sala.tipo, m.clave)) {
    return error(ws, sala.tipo === 'oficial' && CAPITAN_PASSWORD && m.clave === CAPITAN_PASSWORD
      ? 'La clave de capitanes solo sirve en los entrenamientos.' : 'Contraseña incorrecta.', 'clave_mala');
  }
  p.admin = true;
  registrar(sala, `🔑 ${p.nombre} ahora también administra la sala.`);
  difundir(sala);
}

// Si alguien deja su plaza a mitad de jugada: sus retos cuentan como fallo y suelta la pelota.
function soltarTodo(sala, p) {
  const a = sala.accion;
  if (a) {
    let afectado = false;
    for (const r of a.retos.values()) {
      if (r.pid === p.id && r.precision === undefined) { r.precision = 0; r.motivo = 'dejó su plaza'; afectado = true; }
    }
    if (afectado || a.datos.receptor === p.id || a.datos.objetivo === p.id) avanzar(sala, a, false);
  }
  const s = sala.snitch;
  if (s) for (const eq of EQUIPOS) {
    if (s.busc[eq] === p.id) {
      s.busc[eq] = null;
      if (s.estado !== 'pausa') evaluarRonda(sala, false);
    }
  }
  if (sala.pelota && sala.pelota.portador === p.id && !sala.accion) {
    registrar(sala, `${p.nombre} sale con la quaffle.`);
    darPelotaA(sala, rival(sala.pelota.equipo));
  }
}

// ---------------------------------------------------------------- Administración: empezar, terminar, nueva partida
function soloAdmin(ws) {
  const { sala, p } = quien(ws);
  if (!p || !p.admin) { error(ws, 'Solo la administración puede hacer esto.'); return {}; }
  return { sala, p };
}

function empezar(ws, m) {
  const { sala } = soloAdmin(ws);
  if (!sala) return;
  if (sala.fase !== 'lobby') return error(ws, 'El partido ya empezó.');
  const duracionMin = Number(m.duracion);
  if (!DURACIONES.includes(duracionMin)) return error(ws, 'Elige la duración del partido.');
  for (const e of EQUIPOS) {
    if (!jugadoresDe(sala, e, 'cazador').length) return error(ws, `${sala.nombres[e]} necesita al menos un cazador conectado.`);
  }
  const ahora = Date.now();
  sala.fase = 'inicio';
  sala.marcador = { A: 0, B: 0 };
  sala.pelota = null;
  sala.pasesBuenos = 0;
  sala.ultimaBludger = { A: 0, B: 0 };
  sala.resultado = null;
  sala.muertesSubitas = 0;
  sala.finPendiente = false;
  sala.stats = {};
  for (const p of sala.participantes.values()) {
    if (p.plaza) {
      sala.stats[p.id] = {
        nombre: p.nombre, equipo: p.equipo, plaza: p.plaza,
        pases: 0, pasesBuenos: 0, tiros: 0, goles: 0, atajadas: 0, bludgers: 0, impactos: 0, repelidas: 0, rondasSnitch: 0, snitch: 0,
      };
    }
  }
  // La moneda: azar de verdad (lo pidió la organización).
  const moneda = crypto.randomInt(2) === 0 ? 'A' : 'B';
  sala.partido = { duracionMin, moneda, inicio: ahora + INICIO_MS, fin: ahora + INICIO_MS + duracionMin * MINUTO_MS, timers: [] };
  registrar(sala, `🪙 ¡Moneda al aire! ${sala.tipo === 'entrenamiento' ? 'Entrenamiento' : 'Partido'} de ${duracionMin} minutos: ${sala.nombres.A} contra ${sala.nombres.B}.`);
  programar(sala, () => arrancarPartido(sala), INICIO_MS);
  difundir(sala);
}

function arrancarPartido(sala) {
  if (sala.fase !== 'inicio') return;
  const pt = sala.partido;
  sala.fase = 'partido';
  const animal = sala.equipos.A === sala.equipos.B ? `el ${pt.moneda === 'A' ? '1' : '2'}`
    : { Gryffindor: 'el león', Slytherin: 'la serpiente', Ravenclaw: 'el águila', Hufflepuff: 'el tejón' }[sala.equipos[pt.moneda]];
  registrar(sala, `🪙 Salió ${animal}: ¡empieza ${sala.nombres[pt.moneda]} con la quaffle! ⏱ Comienza el partido.`);
  animar(sala, { tipo: 'silbato' });
  darPelotaA(sala, pt.moneda);
  const dur = pt.duracionMin * MINUTO_MS;
  if (conSnitch(sala)) for (const f of MOMENTOS_SNITCH) programar(sala, () => aparecerSnitch(sala, false), f * dur);
  programar(sala, () => finTiempo(sala), dur);
  difundir(sala);
}

function terminarAhora(ws) {
  const { sala } = soloAdmin(ws);
  if (!sala) return;
  if (!enJuego(sala)) return error(ws, 'No hay ningún partido en curso.');
  registrar(sala, 'La administración termina el partido.');
  finalizar(sala, 'admin');
}

function nuevaPartida(ws) {
  const { sala } = soloAdmin(ws);
  if (!sala) return;
  if (sala.fase !== 'final') return error(ws, 'Solo se puede volver al lobby cuando el partido terminó.');
  sala.fase = 'lobby';
  sala.pelota = null;
  sala.marcador = { A: 0, B: 0 };
  sala.partido = null;
  sala.resultado = null;
  sala.stats = {};
  for (const id of Object.keys(sala.plazas)) if (sala.plazas[id] && typeof sala.plazas[id] === 'object') sala.plazas[id] = null;
  registrar(sala, '🔄 Nueva partida: de vuelta al lobby.');
  difundir(sala);
}

function limpiarTimers(sala) {
  if (sala.partido) for (const t of sala.partido.timers) clearTimeout(t);
  clearTimeout(sala.timerPosesion);
  if (sala.accion) { clearTimeout(sala.accion.timer); clearTimeout(sala.accion.timerRevisar); }
  sala.accion = null;
  if (sala.snitch) { for (const t of ['timer', 'revisar', 'timerSenuelo', 'timerSenuelo2']) clearTimeout(sala.snitch[t]); }
  sala.snitch = null;
}

function finTiempo(sala) {
  if (sala.fase !== 'partido') return;
  if (sala.snitch) { sala.finPendiente = true; return; } // se espera a que termine el duelo de la snitch
  limpiarTimers(sala);
  sala.pelota = null;
  const { A, B } = sala.marcador;
  if (A !== B) return finalizar(sala, 'tiempo');
  sala.fase = 'muerte';
  registrar(sala, '⏰ ¡Se acabó el tiempo con empate! ⚡ Muerte súbita: gana el primer buscador que atrape la snitch.');
  if (!jugadoresDe(sala, 'A', 'buscador', false).length && !jugadoresDe(sala, 'B', 'buscador', false).length) {
    return finalizar(sala, 'empate');
  }
  aparecerSnitch(sala, true);
  difundir(sala);
}

function finalizar(sala, motivo, equipoSnitch) {
  limpiarTimers(sala);
  sala.pelota = null;
  sala.fase = 'final';
  const { A, B } = sala.marcador;
  const ganador = A > B ? 'A' : B > A ? 'B' : null;
  sala.resultado = {
    ganador, motivo, marcador: { ...sala.marcador }, fin: Date.now(),
    snitch: equipoSnitch ? { equipo: equipoSnitch, nombre: nombreDe(sala, sala.ultimoBuscador) } : null,
  };
  registrar(sala, ganador
    ? `🏁 ¡Fin del partido! Gana ${sala.nombres[ganador]} ${sala.marcador[ganador]} a ${sala.marcador[rival(ganador)]}.`
    : `🏁 ¡Fin del partido! Empate ${A} a ${B}.`);
  animar(sala, { tipo: 'final', ganador });
  difundir(sala);
}

// ---------------------------------------------------------------- Motor de retos
function nuevaAccion(sala, tipo, datos, texto) {
  const a = { id: hex(4), tipo, datos, texto, retos: new Map(), timer: null, timerRevisar: null };
  sala.accion = a;
  return a;
}

// Dificultad del partido: de 0 (al empezar) a 1 (al final). Igual para los dos equipos.
function dificultad(sala) {
  if (sala.fase === 'muerte') return 1;
  if (sala.fase !== 'partido' || !sala.partido) return 0;
  const dur = sala.partido.duracionMin * MINUTO_MS;
  return Math.max(0, Math.min(1, (Date.now() - sala.partido.inicio) / dur));
}
// La zona se achica (hasta ~55 %) y la marca acelera (hasta +25 %) a medida que avanza el partido.
function ajustar(cfg, f) {
  return { ...cfg, ancho: cfg.ancho * (1 - 0.45 * f), periodo: Math.round(cfg.periodo / (1 + 0.25 * f)) };
}

function lanzarReto(sala, a, pid, clase, titulo, centroFijo) {
  const cfg = ajustar(RETOS[clase], dificultad(sala));
  const centro = centroFijo !== undefined ? centroFijo : CENTROS[sala.contadorRetos++ % CENTROS.length];
  const r = {
    id: hex(4), pid, clase, titulo, ...cfg,
    zonaIni: centro - cfg.ancho / 2, zonaFin: centro + cfg.ancho / 2,
    inicio: Date.now(), precision: undefined, ms: null, motivo: '',
  };
  a.retos.set(r.id, r);
  enviarReto(sala, r);
  return r;
}

function enviarReto(sala, r) {
  const p = sala.participantes.get(r.pid);
  enviar(p && p.ws, {
    t: 'reto',
    reto: {
      id: r.id, clase: r.clase, visual: r.visual, titulo: r.titulo, boton: r.boton,
      zonaIni: r.zonaIni, zonaFin: r.zonaFin, periodo: r.periodo, limite: r.limite,
      desde: Date.now() - r.inicio, // ms que ya pasaron (útil al reconectar)
    },
  });
}

function programarFin(sala, a, ms) {
  clearTimeout(a.timer);
  a.timer = setTimeout(() => {
    if (sala.accion !== a) return;
    for (const r of a.retos.values()) if (r.precision === undefined) { r.precision = 0; r.motivo = 'se acabó el tiempo'; }
    avanzar(sala, a, true);
  }, ms + AJUSTES.margenRedMs);
}
function revisarEn(sala, a, ms) {
  clearTimeout(a.timerRevisar);
  a.timerRevisar = setTimeout(() => avanzar(sala, a, false), Math.max(10, ms));
}

function terminarAccion(sala) {
  if (sala.accion) { clearTimeout(sala.accion.timer); clearTimeout(sala.accion.timerRevisar); }
  sala.accion = null;
}

// Posición de la marca (0 a 1) a los "ms" milisegundos: va y vuelve sin parar.
function posicionMarca(ms, periodo) {
  const fase = (ms % periodo) / periodo;
  return fase < 0.5 ? fase * 2 : 2 - fase * 2;
}

// Devuelve la precisión: 0 = fallo; de 0.01 a 1 = acierto (1 = justo en el centro).
function medir(r, ms) {
  const transcurrido = Date.now() - r.inicio;
  // Rechazar valores imposibles: negativos, más rápidos que un humano,
  // o más tiempo del que realmente pasó en el servidor.
  if (!Number.isFinite(ms) || ms < AJUSTES.minimoHumanoMs || ms > transcurrido + AJUSTES.margenRelojMs) {
    r.motivo = 'tiempo no válido';
    return 0;
  }
  if (ms > r.limite) { r.motivo = 'llegó tarde'; return 0; }
  const pos = posicionMarca(ms, r.periodo);
  const centro = (r.zonaIni + r.zonaFin) / 2;
  const medio = (r.zonaFin - r.zonaIni) / 2 + AJUSTES.tolerancia;
  const d = Math.abs(pos - centro);
  if (d > medio) { r.motivo = 'fuera de la zona'; return 0; }
  r.ms = ms;
  return Math.max(0.01, 1 - d / medio);
}

function tap(ws, m) {
  const { sala, p } = quien(ws);
  if (!p || !sala.accion) return;
  const a = sala.accion;
  const r = a.retos.get(String(m.reto || ''));
  if (!r || r.pid !== p.id || r.precision !== undefined) return; // llegó tarde o no le toca: se ignora
  r.precision = medir(r, Number(m.ms));
  avanzar(sala, a, false);
}

function avanzar(sala, a, final) {
  if (sala.accion !== a) return;
  if (a.tipo === 'pase') avanzarPase(sala, a, final);
  else if (a.tipo === 'tiro') avanzarTiro(sala, a, final);
  else if (a.tipo === 'bludger') avanzarBludger(sala, a, final);
  // Al terminar una jugada, quien tenga la quaffle vuelve a tener su tiempo para pasar o lanzar.
  if (!sala.accion) armarPosesion(sala);
}

// Quien tiene la quaffle tiene unos segundos para pasar o lanzar; si no, la pierde.
function armarPosesion(sala) {
  clearTimeout(sala.timerPosesion);
  if (!sala.pelota || sala.fase !== 'partido') return;
  sala.pelota.limite = Date.now() + POSESION_MS;
  sala.timerPosesion = setTimeout(() => {
    if (sala.fase !== 'partido' || !sala.pelota || sala.accion) return;
    const id = sala.pelota.portador;
    registrar(sala, `${nombreDe(sala, id)} tardó demasiado con la quaffle y la pierde.`);
    avisarA(sala, id, '⏰ Tardaste demasiado: pierdes la quaffle.', false);
    animar(sala, { tipo: 'perdida', de: id });
    darPelotaA(sala, rival(sala.pelota.equipo));
    difundir(sala);
  }, POSESION_MS);
}

// Entrega la quaffle a un cazador conectado del equipo (se van turnando).
// Si ese equipo no tiene cazadores conectados, se la queda el otro; si nadie puede, queda suelta.
function darPelotaA(sala, equipo) {
  sala.pasesBuenos = 0;
  for (const e of [equipo, rival(equipo)]) {
    const caz = jugadoresDe(sala, e, 'cazador');
    if (!caz.length) continue;
    const nuevo = caz[sala.rotacion[e]++ % caz.length];
    sala.pelota = { equipo: e, portador: nuevo, limite: 0 };
    registrar(sala, `La quaffle es de ${sala.nombres[e]}: la tiene ${nombreDe(sala, nuevo)}.`);
    avisarA(sala, nuevo, '🏐 ¡Tienes la quaffle!', true);
    armarPosesion(sala);
    return;
  }
  sala.pelota = null;
  registrar(sala, 'La quaffle queda suelta: no hay cazadores conectados.');
}
function repartirSiSuelta(sala) {
  if (sala.fase === 'partido' && !sala.pelota && !sala.accion) darPelotaA(sala, sala.partido.moneda);
}

function puedeActuar(ws) {
  const { sala, p } = quien(ws);
  if (!p) return {};
  if (sala.fase !== 'partido') { error(ws, sala.fase === 'lobby' ? 'El partido todavía no empieza.' : 'Ahora no se puede jugar la quaffle.'); return {}; }
  if (sala.accion) { error(ws, 'Espera a que termine la jugada en curso.'); return {}; }
  return { sala, p };
}

// ---------------------------------------------------------------- Quaffle: pasar y tirar
function pasar(ws, m) {
  const { sala, p } = puedeActuar(ws);
  if (!p) return;
  if (!sala.pelota || sala.pelota.portador !== p.id) return error(ws, 'No tienes la quaffle.');
  const destino = sala.participantes.get(String(m.a || ''));
  if (!destino || destino.id === p.id || !jugadoresDe(sala, sala.pelota.equipo, 'cazador', false).includes(destino.id)) {
    return error(ws, 'Solo puedes pasar a un cazador de tu equipo.');
  }
  if (!destino.conectado) return error(ws, `${destino.nombre} está desconectado ahora mismo.`);
  stat(sala, p.id, 'pases');
  const a = nuevaAccion(sala, 'pase', { de: p.id, receptor: destino.id, nDe: p.nombre, nA: destino.nombre },
    `${p.nombre} intenta pasar a ${destino.nombre}…`);
  lanzarReto(sala, a, p.id, 'pase', `Pasa a ${destino.nombre}`);
  programarFin(sala, a, RETOS.pase.limite);
  registrar(sala, a.texto);
  difundir(sala);
}

function avanzarPase(sala, a, final) {
  const r = [...a.retos.values()][0];
  if (r.precision === undefined && !final) return;
  terminarAccion(sala);
  const { de, receptor, nDe, nA } = a.datos;
  const equipo = sala.pelota.equipo;
  const receptorSigue = jugadoresDe(sala, equipo, 'cazador').includes(receptor);
  if (r.precision > 0 && receptorSigue) {
    animar(sala, { tipo: 'pase', de, a: receptor, ok: true });
    sala.pelota.portador = receptor;
    sala.pasesBuenos++;
    stat(sala, de, 'pasesBuenos');
    registrar(sala, `${nDe} pasa a ${nA}… ¡bien recibido!`);
    avisarA(sala, de, `✅ ¡Pase completado a ${nA}!`, true);
    const faltan = pasesNecesarios(sala, equipo) - sala.pasesBuenos;
    avisarA(sala, receptor, faltan <= 0 ? `🏐 ${nDe} te pasó la quaffle. ¡Ya puedes lanzar a la meta!` : `🏐 ${nDe} te pasó la quaffle.`, true);
    if (faltan <= 0) registrar(sala, `¡${sala.nombres[equipo]} ya puede lanzar a la meta!`);
  } else {
    const motivo = !receptorSigue ? 'el receptor ya no está' : r.motivo;
    registrar(sala, `${nDe} pasa a ${nA}… ¡pase fallido! (${motivo})`);
    avisarA(sala, de, `❌ Pase fallido (${motivo}). Pierdes la quaffle.`, false);
    animar(sala, { tipo: 'pase', de, a: receptor, ok: false });
    darPelotaA(sala, rival(equipo));
  }
  difundir(sala);
}

function tirar(ws) {
  const { sala, p } = puedeActuar(ws);
  if (!p) return;
  if (!sala.pelota || sala.pelota.portador !== p.id) return error(ws, 'No tienes la quaffle.');
  const equipo = sala.pelota.equipo;
  const faltan = pasesNecesarios(sala, equipo) - sala.pasesBuenos;
  if (faltan > 0) return error(ws, `Todavía no: les falta${faltan > 1 ? 'n' : ''} ${faltan} pase${faltan > 1 ? 's' : ''} bueno${faltan > 1 ? 's' : ''}.`);
  const guardian = jugadoresDe(sala, rival(equipo), 'guardian', false)[0] || null;
  const nG = guardian ? nombreDe(sala, guardian) : null;
  stat(sala, p.id, 'tiros');
  const a = nuevaAccion(sala, 'tiro', { de: p.id, guardian, equipo, nDe: p.nombre, nG },
    guardian ? `${p.nombre} lanza a la meta… ${nG} intenta atajar.` : `${p.nombre} lanza a la meta… ¡no hay guardián!`);
  // Misma zona y velocidad para los dos: gana quien acierte primero.
  const centro = CENTROS[sala.contadorRetos++ % CENTROS.length];
  lanzarReto(sala, a, p.id, 'tiro', '¡Lanza a la meta!', centro);
  if (guardian) lanzarReto(sala, a, guardian, 'atajar', `¡${p.nombre} lanza! Ataja el tiro`, centro);
  programarFin(sala, a, RETOS.tiro.limite);
  registrar(sala, a.texto);
  difundir(sala);
}

// Gana quien acierta PRIMERO (según el tiempo que midió cada celular):
// si el guardián ataja antes de que el cazador lance, es atajada; si el cazador lanza antes, es gol.
// Si el cazador falla, no hay gol. Si el guardián falla, no ataja.
function avanzarTiro(sala, a, final) {
  const retos = [...a.retos.values()];
  const rT = retos.find((r) => r.clase === 'tiro');
  const rG = retos.find((r) => r.clase === 'atajar');
  if (rT.precision === 0) return resolverTiro(sala, a, 'falla', rT, rG);
  const tT = rT.precision === undefined ? null : rT.ms;                                   // null = aún no tocó
  const tG = !rG ? Infinity : rG.precision === undefined ? null : rG.precision > 0 ? rG.ms : Infinity; // Infinity = no ataja
  if (tT !== null && tG !== null) return resolverTiro(sala, a, tT < tG ? 'gol' : 'atajada', rT, rG);
  // Uno ya acertó y el otro todavía no tocó: esperamos un poco por si su toque viene en camino.
  const transcurrido = Date.now() - rT.inicio;
  const conocido = tT !== null ? tT : tG;
  if (conocido === null || conocido === Infinity) return; // seguimos esperando al cazador
  if (transcurrido > conocido + VENTANA_RED_MS) return resolverTiro(sala, a, tT !== null ? 'gol' : 'atajada', rT, rG);
  revisarEn(sala, a, conocido + VENTANA_RED_MS - transcurrido + 20);
}

function resolverTiro(sala, a, res, rT, rG) {
  terminarAccion(sala);
  const { de, guardian, equipo, nDe, nG } = a.datos;
  const tiempos = [rT.ms ? `lanzó a los ${seg(rT.ms)}` : null, rG && rG.ms ? `atajó a los ${seg(rG.ms)}` : null].filter(Boolean).join(', ');
  const det = tiempos ? ` (${tiempos})` : '';
  animar(sala, { tipo: 'tiro', de, guardian, equipo, res });
  if (res === 'gol') {
    sala.marcador[equipo] += PUNTOS_GOL;
    stat(sala, de, 'goles');
    registrar(sala, `¡GOOOL de ${nDe}! +${PUNTOS_GOL} para ${sala.nombres[equipo]}${det}`);
    avisarA(sala, de, `🎉 ¡GOOOL! +${PUNTOS_GOL} para ${sala.nombres[equipo]}`, true);
    if (guardian) avisarA(sala, guardian, rG && rG.precision > 0 ? `😣 ¡Gol! ${nDe} lanzó antes de que atajaras.` : `😣 ${nDe} te marcó gol.`, false);
  } else if (res === 'falla') {
    registrar(sala, `${nDe} falla el tiro (${rT.motivo}).`);
    avisarA(sala, de, `❌ Tiro fallido (${rT.motivo}).`, false);
    if (guardian) avisarA(sala, guardian, `🧤 ${nDe} falló el tiro.`, true);
  } else {
    stat(sala, guardian, 'atajadas');
    registrar(sala, `¡${nG} ataja el tiro de ${nDe}!${det}`);
    avisarA(sala, de, `🧤 ${nG} atajó antes de que lanzaras.`, false);
    avisarA(sala, guardian, '🧤 ¡Atajada!', true);
  }
  darPelotaA(sala, rival(equipo));
  difundir(sala);
}

// ---------------------------------------------------------------- Bludgers
function lanzarBludger(ws) {
  const { sala, p } = puedeActuar(ws);
  if (!p) return;
  if (!p.plaza || tipoDePlaza(p.plaza) !== 'golpeador') return error(ws, 'Solo los golpeadores lanzan bludgers.');
  const equipo = equipoDePlaza(p.plaza);
  if (!sala.pelota || sala.pelota.equipo === equipo) return error(ws, 'Solo puedes lanzarla cuando el rival tiene la quaffle.');
  const espera = sala.ultimaBludger[equipo] + BLUDGER_ESPERA_MS - Date.now();
  if (espera > 0) return error(ws, `Tu equipo podrá lanzar otra bludger en ${Math.ceil(espera / 1000)} s.`);
  sala.ultimaBludger[equipo] = Date.now();
  stat(sala, p.id, 'bludgers');
  const objetivo = sala.pelota.portador;
  const nO = nombreDe(sala, objetivo);
  const a = nuevaAccion(sala, 'bludger', { de: p.id, equipo, objetivo, nDe: p.nombre, nO, fase: 'apuntar' },
    `${p.nombre} batea una bludger hacia ${nO}…`);
  lanzarReto(sala, a, p.id, 'bateo', `Batea la bludger hacia ${nO}`);
  programarFin(sala, a, RETOS.bateo.limite);
  registrar(sala, a.texto);
  difundir(sala);
}

function avanzarBludger(sala, a, final) {
  const d = a.datos;
  if (d.fase === 'apuntar') {
    const r = [...a.retos.values()][0];
    if (r.precision === undefined && !final) return;
    if (r.precision === 0) {
      terminarAccion(sala);
      registrar(sala, `La bludger de ${d.nDe} se desvía (${r.motivo}).`);
      animar(sala, { tipo: 'bludger', de: d.de, objetivo: d.objetivo, res: 'desvio' });
      avisarA(sala, d.de, `❌ La bludger se desvió (${r.motivo}).`, false);
      return difundir(sala);
    }
    if (!sala.pelota || sala.pelota.portador !== d.objetivo) {
      terminarAccion(sala);
      registrar(sala, `La bludger de ${d.nDe} pasa de largo: ${d.nO} ya no tiene la quaffle.`);
      return difundir(sala);
    }
    // Buen bateo: los golpeadores del equipo atacado tienen unos segundos para repelerla.
    const defensores = jugadoresDe(sala, rival(d.equipo), 'golpeador');
    if (!defensores.length) return impactoBludger(sala, d, 'no hay golpeadores para repelerla');
    d.fase = 'repeler';
    a.texto = `¡Bludger hacia ${d.nO}! Los golpeadores de ${sala.nombres[rival(d.equipo)]} intentan repelerla…`;
    for (const id of defensores) lanzarReto(sala, a, id, 'repeler', `¡Bludger hacia ${d.nO}! Repélela`);
    programarFin(sala, a, RETOS.repeler.limite);
    registrar(sala, a.texto);
    return difundir(sala);
  }
  // Fase repeler: basta con que uno de los golpeadores acierte.
  const intentos = [...a.retos.values()].filter((r) => r.clase === 'repeler');
  const bueno = intentos.find((r) => r.precision > 0);
  if (bueno) {
    terminarAccion(sala);
    const nR = nombreDe(sala, bueno.pid);
    stat(sala, bueno.pid, 'repelidas');
    registrar(sala, `¡${nR} repele la bludger! ${d.nO} conserva la quaffle.`);
    animar(sala, { tipo: 'bludger', de: d.de, objetivo: d.objetivo, res: 'repelida', por: bueno.pid });
    avisarA(sala, bueno.pid, '💪 ¡Bludger repelida!', true);
    for (const r of intentos) if (r !== bueno) avisarA(sala, r.pid, `💪 ${nR} repelió la bludger.`, true);
    avisarA(sala, d.de, `🛡️ ${nR} repelió tu bludger.`, false);
    return difundir(sala);
  }
  if (final || intentos.every((r) => r.precision !== undefined)) impactoBludger(sala, d, 'nadie la repelió');
}

function impactoBludger(sala, d, motivo) {
  terminarAccion(sala);
  if (!sala.pelota || sala.pelota.portador !== d.objetivo) {
    registrar(sala, `La bludger pasa de largo: ${d.nO} ya no tiene la quaffle.`);
    return difundir(sala);
  }
  stat(sala, d.de, 'impactos');
  registrar(sala, `¡La bludger golpea a ${d.nO} (${motivo})! Suelta la quaffle.`);
  animar(sala, { tipo: 'bludger', de: d.de, objetivo: d.objetivo, res: 'golpe' });
  avisarA(sala, d.objetivo, '💥 ¡Te golpeó una bludger! Pierdes la quaffle.', false);
  avisarA(sala, d.de, `💥 ¡Tu bludger golpeó a ${d.nO}!`, true);
  darPelotaA(sala, d.equipo);
  difundir(sala);
}

// ---------------------------------------------------------------- Snitch (buscadores)
// Aparece en momentos fijos. Cada aparición es al mejor de 3 rondas: los dos ven "espera…", tras una pausa
// aparece la señal y gana la ronda quien toque primero. Tocar antes de la señal pierde la ronda.
// Quien gane 2 rondas la atrapa: +150 y se acaba el partido.
function aparecerSnitch(sala, muerte) {
  if (sala.snitch || !(sala.fase === 'partido' || sala.fase === 'muerte')) return;
  const busc = { A: jugadoresDe(sala, 'A', 'buscador', false)[0] || null, B: jugadoresDe(sala, 'B', 'buscador', false)[0] || null };
  if (!busc.A && !busc.B) {
    registrar(sala, '✨ La snitch aparece… pero no hay buscadores. Se escapa.');
    return difundir(sala);
  }
  sala.aparicionesSnitch = (sala.aparicionesSnitch || 0) + 1;
  sala.snitch = { muerte, senuelos: muerte || sala.aparicionesSnitch >= 2, ronda: 0, victorias: { A: 0, B: 0 }, busc, estado: 'pausa', rondaId: null, taps: { A: null, B: null }, senalEn: 0, timer: null, revisar: null };
  animar(sala, { tipo: 'snitch', fase: 'aparece' });
  registrar(sala, muerte ? '⚡ ¡La snitch aparece en la muerte súbita! (al mejor de 3)' : '✨ ¡Apareció la snitch dorada! Los buscadores se lanzan a por ella (al mejor de 3).');
  nuevaRonda(sala);
  difundir(sala);
}

function nuevaRonda(sala) {
  const s = sala.snitch;
  if (!s) return;
  s.ronda++;
  s.rondaId = hex(4);
  s.estado = 'espera';
  s.taps = { A: null, B: null };
  const pausa = SNITCH.pausas[sala.contadorPausas++ % SNITCH.pausas.length];
  enviarSnitch(sala);
  const extra = s.senuelos ? programarSenuelo(sala, s, pausa, (fase) => enviarSnitch(sala, null, { fase })) : 0;
  s.timer = setTimeout(() => {
    if (sala.snitch !== s || s.estado !== 'espera') return;
    s.estado = 'senal';
    s.senalEn = Date.now();
    enviarSnitch(sala);
    s.timer = setTimeout(() => evaluarRonda(sala, true), SNITCH.limiteMs + AJUSTES.margenRedMs);
  }, pausa + extra);
}

// Señuelo: a mitad de la espera aparece una polilla dorada durante un momento. Tocarla cuenta como tocar antes.
// Devuelve cuánto se alarga la espera.
function programarSenuelo(sala, estado, pausa, mandar) {
  const i = sala.contadorSenuelos || 0;
  sala.contadorSenuelos = i + 1;
  if (!SENUELOS[i % SENUELOS.length]) return 0;
  const t = Math.round(pausa * 0.5);
  estado.timerSenuelo = setTimeout(() => { if (estado.estado === 'espera') mandar('senuelo'); }, t);
  estado.timerSenuelo2 = setTimeout(() => { if (estado.estado === 'espera') mandar('espera'); }, t + SENUELO_MS);
  return SENUELO_MS + 600;
}

function enviarSnitch(sala, soloId, extra) {
  const s = sala.snitch;
  if (!s) return;
  for (const eq of EQUIPOS) {
    const id = s.busc[eq];
    if (!id || (soloId && soloId !== id)) continue;
    const p = sala.participantes.get(id);
    enviar(p && p.ws, {
      t: 'snitch', fase: s.estado, rondaId: s.rondaId, ronda: s.ronda, yo: eq, victorias: s.victorias, muerte: s.muerte,
      rival: s.busc[rival(eq)] ? nombreDe(sala, s.busc[rival(eq)]) : null,
      desdeSenal: s.estado === 'senal' ? Date.now() - s.senalEn : 0,
      ...extra,
    });
  }
}

function snitchTap(ws, m) {
  const { sala, p } = quien(ws);
  const s = sala && sala.snitch;
  if (!p || !s || m.rondaId !== s.rondaId || s.estado === 'pausa') return;
  const eq = EQUIPOS.find((e) => s.busc[e] === p.id);
  if (!eq || s.taps[eq]) return;
  if (s.estado === 'espera' || m.antes) s.taps[eq] = { antes: true };
  else {
    const ms = Number(m.ms);
    const trans = Date.now() - s.senalEn;
    s.taps[eq] = (!Number.isFinite(ms) || ms < SNITCH.minimoMs || ms > trans + AJUSTES.margenRelojMs) ? { antes: true, invalido: true } : { ms };
  }
  evaluarRonda(sala, false);
}

function evaluarRonda(sala, final) {
  const s = sala.snitch;
  if (!s || s.estado === 'pausa') return;
  const t = s.taps;
  const nom = (eq) => nombreDe(sala, s.busc[eq]);
  for (const eq of EQUIPOS) {
    if (t[eq] && t[eq].antes) {
      const otro = rival(eq);
      const gana = s.busc[otro] && !(t[otro] && t[otro].antes) ? otro : null;
      return terminarRonda(sala, gana, t[eq].invalido ? `${nom(eq)} dio un tiempo imposible` : `${nom(eq)} tocó antes de tiempo`);
    }
  }
  if (final) for (const eq of EQUIPOS) if (!t[eq]) t[eq] = { nada: true };
  const tiempo = (eq) => (!s.busc[eq] ? Infinity : !t[eq] ? null : t[eq].ms !== undefined ? t[eq].ms : Infinity);
  const a = tiempo('A'), b = tiempo('B');
  if (a !== null && b !== null) {
    if (a === Infinity && b === Infinity) return terminarRonda(sala, null, 'nadie tocó a tiempo');
    if (a === b) return terminarRonda(sala, null, 'empate exacto');
    const g = a < b ? 'A' : 'B';
    return terminarRonda(sala, g, `reaccionó en ${seg(Math.min(a, b))}`);
  }
  if (s.estado !== 'senal') return;
  const conocido = a !== null ? a : b;
  if (conocido === Infinity) return; // esperamos al otro
  const trans = Date.now() - s.senalEn;
  if (trans > conocido + VENTANA_RED_MS) return terminarRonda(sala, a !== null ? 'A' : 'B', `reaccionó en ${seg(conocido)}`);
  clearTimeout(s.revisar);
  s.revisar = setTimeout(() => evaluarRonda(sala, false), conocido + VENTANA_RED_MS - trans + 20);
}

function terminarRonda(sala, ganador, motivo) {
  const s = sala.snitch;
  for (const t of ['timer', 'revisar', 'timerSenuelo', 'timerSenuelo2']) clearTimeout(s[t]);
  s.estado = 'pausa';
  if (ganador) { s.victorias[ganador]++; stat(sala, s.busc[ganador], 'rondasSnitch'); }
  const marcadorRondas = `${sala.nombres.A} ${s.victorias.A} - ${s.victorias.B} ${sala.nombres.B}`;
  registrar(sala, `✨ Ronda ${s.ronda}: ${ganador ? `gana ${nombreDe(sala, s.busc[ganador])}` : 'nadie gana'} (${motivo}). Snitch: ${marcadorRondas}.`);
  enviarSnitch(sala, null, { fase: 'ronda', ganador, motivo });
  if (ganador && s.victorias[ganador] >= 2) return atraparSnitch(sala, ganador);
  if (s.ronda >= 3) return escaparSnitch(sala);
  s.timer = setTimeout(() => nuevaRonda(sala), SNITCH.entreRondasMs);
  difundir(sala);
}

function escaparSnitch(sala) {
  const s = sala.snitch;
  registrar(sala, '✨ La snitch se escapa… volverá a aparecer.');
  animar(sala, { tipo: 'snitch', fase: 'escapa' });
  enviarSnitch(sala, null, { fase: 'fin', atrapada: false });
  sala.snitch = null;
  if (s.muerte) {
    if (++sala.muertesSubitas >= SNITCH.maxMuerteSubita) return finalizar(sala, 'empate');
    programar(sala, () => aparecerSnitch(sala, true), 3000);
  } else if (sala.finPendiente) {
    sala.finPendiente = false;
    return finTiempo(sala);
  }
  difundir(sala);
}

function atraparSnitch(sala, eq) {
  const s = sala.snitch;
  const id = s.busc[eq];
  sala.ultimoBuscador = id;
  sala.marcador[eq] += PUNTOS_SNITCH;
  stat(sala, id, 'snitch');
  registrar(sala, `🏆✨ ¡${nombreDe(sala, id)} atrapa la snitch dorada! +${PUNTOS_SNITCH} para ${sala.nombres[eq]}.`);
  animar(sala, { tipo: 'snitch', fase: 'atrapada', equipo: eq, por: id });
  enviarSnitch(sala, null, { fase: 'fin', atrapada: true, ganador: eq });
  sala.snitch = null;
  finalizar(sala, 'snitch', eq);
}

// ---------------------------------------------------------------- Duelos (buscador o guardián)
// El capitán elige a dos aspirantes. En cada ronda los dos reciben el mismo reto a la vez y cada ronda es más difícil.
//  - Buscador: "espera…", aparece la snitch y gana quien toca primero (desde la ronda 3 hay señuelos).
//  - Guardián: la aguja se mueve; tras el aviso "¡TIRO!" gana quien ataja primero con la aguja en lo verde.
//  Tocar antes de la señal pierde la ronda.
const NOMBRE_DUELO = { buscador: 'buscadores', guardian: 'guardianes' };

function dueloPublico(sala) {
  const d = sala.duelo;
  if (!d) return null;
  return {
    pos: d.pos, ids: d.ids, nombres: d.nombres, casas: d.casas, victorias: d.victorias, necesarias: d.necesarias,
    rondas: d.rondas, ronda: d.ronda, estado: d.estado, resultado: d.resultado,
  };
}

function empezarDuelo(ws, m) {
  const { sala } = soloAdmin(ws);
  if (!sala) return;
  if (sala.tipo !== 'duelo') return error(ws, 'Los duelos se hacen en una sala de duelos.');
  if (sala.duelo && sala.duelo.estado !== 'fin') return error(ws, 'Ya hay un duelo en marcha.');
  const pos = m.pos === 'guardian' ? 'guardian' : m.pos === 'buscador' ? 'buscador' : null;
  if (!pos) return error(ws, 'Elige si es un duelo de buscadores o de guardianes.');
  const rondas = RONDAS_DUELO.includes(Number(m.rondas)) ? Number(m.rondas) : 5;
  const ids = [String(m.a || ''), String(m.b || '')];
  if (ids[0] === ids[1]) return error(ws, 'Elige a dos personas distintas.');
  const ps = ids.map((id) => sala.participantes.get(id));
  if (ps.some((x) => !x || !x.conectado)) return error(ws, 'Los dos aspirantes tienen que estar conectados en la sala.');
  sala.duelo = {
    pos, ids, nombres: ps.map((x) => x.nombre), casas: ps.map((x) => x.casa), victorias: [0, 0], necesarias: (rondas + 1) / 2,
    rondas, maxRondas: rondas + 4, ronda: 0, estado: 'cuenta', rondaId: null, taps: [null, null],
    tiempos: [[], []], resultado: null,
  };
  registrar(sala, `⚔️ ¡Duelo de ${NOMBRE_DUELO[pos]}! ${ps[0].nombre} contra ${ps[1].nombre}, al mejor de ${rondas}.`);
  sala.duelo.timer = setTimeout(() => nuevaRondaDuelo(sala), 3000);
  enviarDuelo(sala, null, { fase: 'cuenta' });
  difundir(sala);
}

function detenerDuelo(ws) {
  const { sala } = soloAdmin(ws);
  if (!sala || !sala.duelo || sala.duelo.estado === 'fin') return;
  registrar(sala, 'La administración detiene el duelo.');
  finDuelo(sala, 'detenido');
}

function limpiarDuelo(d) {
  for (const t of ['timer', 'revisar', 'timerSenuelo', 'timerSenuelo2']) clearTimeout(d[t]);
}

function enviarDuelo(sala, soloId, extra) {
  const d = sala.duelo;
  if (!d) return;
  d.ids.forEach((id, i) => {
    if (soloId && soloId !== id) return;
    const p = sala.participantes.get(id);
    enviar(p && p.ws, {
      t: 'duelo', pos: d.pos, fase: d.estado, rondaId: d.rondaId, ronda: d.ronda, rondas: d.rondas, necesarias: d.necesarias,
      yo: i === 0 ? 'A' : 'B', victorias: { A: d.victorias[0], B: d.victorias[1] }, rival: d.nombres[1 - i],
      desdeSenal: d.estado === 'senal' ? Date.now() - d.senalEn : 0,
      aguja: d.pos === 'guardian' && d.aguja ? { zonaIni: d.aguja.zonaIni, zonaFin: d.aguja.zonaFin, periodo: d.aguja.periodo, desde: Date.now() - d.aguja.inicio } : null,
      ...extra,
    });
  });
}

function nuevaRondaDuelo(sala) {
  const d = sala.duelo;
  if (!d || d.estado === 'fin') return;
  d.ronda++;
  d.rondaId = hex(4);
  d.taps = [null, null];
  d.estado = 'espera';
  const f = Math.min(1, (d.ronda - 1) / Math.max(1, d.rondas - 1)); // cada ronda, más difícil
  const pausa = SNITCH.pausas[sala.contadorPausas++ % SNITCH.pausas.length];
  let extra = 0;
  if (d.pos === 'guardian') {
    const centro = CENTROS[sala.contadorRetos++ % CENTROS.length];
    const ancho = 0.18 * (1 - 0.45 * f);
    d.aguja = { zonaIni: centro - ancho / 2, zonaFin: centro + ancho / 2, periodo: Math.round(1500 / (1 + 0.35 * f)), inicio: Date.now() };
    enviarDuelo(sala);
  } else {
    enviarDuelo(sala);
    if (d.ronda >= 3) extra = programarSenuelo(sala, d, pausa, (fase) => enviarDuelo(sala, null, { fase }));
  }
  d.timer = setTimeout(() => {
    if (sala.duelo !== d || d.estado !== 'espera') return;
    d.estado = 'senal';
    d.senalEn = Date.now();
    if (d.aguja) d.senalMs = d.senalEn - d.aguja.inicio;
    enviarDuelo(sala);
    d.timer = setTimeout(() => evaluarDuelo(sala, true), SNITCH.limiteMs + AJUSTES.margenRedMs);
  }, pausa + extra);
  difundir(sala);
}

function dueloTap(ws, m) {
  const { sala, p } = quien(ws);
  const d = sala && sala.duelo;
  if (!p || !d || m.rondaId !== d.rondaId || !['espera', 'senal'].includes(d.estado)) return;
  const i = d.ids.indexOf(p.id);
  if (i < 0 || d.taps[i]) return;
  if (d.estado === 'espera' || m.antes) d.taps[i] = { antes: true };
  else {
    const ms = Number(m.ms);
    const trans = Date.now() - d.senalEn;
    if (!Number.isFinite(ms) || ms < SNITCH.minimoMs || ms > trans + AJUSTES.margenRelojMs) d.taps[i] = { antes: true, invalido: true };
    else if (d.pos === 'guardian') {
      const msA = Number(m.msAguja);
      const transA = Date.now() - d.aguja.inicio;
      if (!Number.isFinite(msA) || msA > transA + AJUSTES.margenRelojMs || msA < d.senalMs - AJUSTES.margenRelojMs) d.taps[i] = { antes: true, invalido: true };
      else {
        const pos = posicionMarca(msA, d.aguja.periodo);
        const dentro = pos >= d.aguja.zonaIni - AJUSTES.tolerancia && pos <= d.aguja.zonaFin + AJUSTES.tolerancia;
        d.taps[i] = dentro ? { ms } : { fuera: true };
      }
    } else d.taps[i] = { ms };
  }
  evaluarDuelo(sala, false);
}

function evaluarDuelo(sala, final) {
  const d = sala.duelo;
  if (!d || !['espera', 'senal'].includes(d.estado)) return;
  const t = d.taps;
  for (const i of [0, 1]) {
    if (t[i] && t[i].antes) {
      const gana = !(t[1 - i] && t[1 - i].antes) ? 1 - i : null;
      return terminarRondaDuelo(sala, gana, t[i].invalido ? `${d.nombres[i]} dio un tiempo imposible` : `${d.nombres[i]} tocó antes de tiempo`);
    }
  }
  if (final) for (const i of [0, 1]) if (!t[i]) t[i] = { nada: true };
  const tiempo = (i) => (!t[i] ? null : t[i].ms !== undefined ? t[i].ms : Infinity);
  const a = tiempo(0), b = tiempo(1);
  if (a !== null && b !== null) {
    if (a === Infinity && b === Infinity) return terminarRondaDuelo(sala, null, d.pos === 'guardian' ? 'ninguno atajó en lo verde' : 'nadie tocó a tiempo');
    if (a === b) return terminarRondaDuelo(sala, null, 'empate exacto');
    return terminarRondaDuelo(sala, a < b ? 0 : 1, `reaccionó en ${seg(Math.min(a, b))}`);
  }
  if (d.estado !== 'senal') return;
  const conocido = a !== null ? a : b;
  if (conocido === Infinity) return;
  const trans = Date.now() - d.senalEn;
  if (trans > conocido + VENTANA_RED_MS) return terminarRondaDuelo(sala, a !== null ? 0 : 1, `reaccionó en ${seg(conocido)}`);
  clearTimeout(d.revisar);
  d.revisar = setTimeout(() => evaluarDuelo(sala, false), conocido + VENTANA_RED_MS - trans + 20);
}

function terminarRondaDuelo(sala, ganador, motivo) {
  const d = sala.duelo;
  limpiarDuelo(d);
  d.estado = 'pausa';
  d.taps.forEach((x, i) => { if (x && x.ms !== undefined) d.tiempos[i].push(x.ms); });
  if (ganador !== null) d.victorias[ganador]++;
  registrar(sala, `⚔️ Ronda ${d.ronda}: ${ganador !== null ? `gana ${d.nombres[ganador]}` : 'nadie gana'} (${motivo}). Duelo: ${d.nombres[0]} ${d.victorias[0]} - ${d.victorias[1]} ${d.nombres[1]}.`);
  enviarDuelo(sala, null, { fase: 'ronda', ganador: ganador === null ? null : ganador === 0 ? 'A' : 'B', motivo });
  if (ganador !== null && d.victorias[ganador] >= d.necesarias) return finDuelo(sala, 'ganado');
  if (d.ronda >= d.maxRondas) return finDuelo(sala, 'rondas');
  d.timer = setTimeout(() => nuevaRondaDuelo(sala), SNITCH.entreRondasMs);
  difundir(sala);
}

function finDuelo(sala, motivo) {
  const d = sala.duelo;
  limpiarDuelo(d);
  d.estado = 'fin';
  const [va, vb] = d.victorias;
  const ganador = va > vb ? 0 : vb > va ? 1 : null;
  const resumen = (i) => {
    const ts = d.tiempos[i];
    return {
      nombre: d.nombres[i], victorias: d.victorias[i], aciertos: ts.length, rondas: d.ronda,
      promedio: ts.length ? Math.round(ts.reduce((x, y) => x + y, 0) / ts.length) : null,
      mejor: ts.length ? Math.min(...ts) : null,
    };
  };
  d.resultado = { ganador, motivo, stats: [resumen(0), resumen(1)] };
  registrar(sala, ganador !== null
    ? `🏆 ¡${d.nombres[ganador]} gana el duelo de ${NOMBRE_DUELO[d.pos]} ${d.victorias[ganador]} a ${d.victorias[1 - ganador]}!`
    : `🤝 El duelo termina empatado ${va} a ${vb}.`);
  enviarDuelo(sala, null, { fase: 'fin', ganador: ganador === null ? null : ganador === 0 ? 'A' : 'B' });
  difundir(sala);
}

// ---------------------------------------------------------------- Comentaristas
function comentar(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return;
  if (!p.invitado || !p.invitado.startsWith('comentarista')) return error(ws, 'Solo los comentaristas pueden comentar.');
  const texto = limpiarTexto(m.texto);
  if (!texto) return;
  if (texto.length > MAX_COMENTARIO) return error(ws, `Máximo ${MAX_COMENTARIO} letras por comentario.`);
  if (Date.now() - p.ultimoComentario < 1500) return error(ws, 'Espera un segundo antes del siguiente comentario.');
  p.ultimoComentario = Date.now();
  const equipo = p.invitado === 'comentaristaA' ? 'A' : 'B';
  const c = { h: Date.now(), nombre: p.nombre, casa: sala.equipos[equipo], texto };
  sala.comentarios.push(c);
  if (sala.comentarios.length > 200) sala.comentarios.shift();
  const msg = JSON.stringify({ t: 'comentario', ...c });
  for (const x of sala.participantes.values()) if (x.ws && x.ws.readyState === 1) x.ws.send(msg);
}

// ---------------------------------------------------------------- Mensajes
const ACCIONES = {
  crear_sala: crearSala,
  entrar,
  reconectar,
  salir,
  elegir_plaza: elegirPlaza,
  ser_invitado: serInvitado,
  admin_login: adminLogin,
  empezar,
  terminar: terminarAhora,
  nueva_partida: nuevaPartida,
  pasar,
  tirar,
  bludger: lanzarBludger,
  tap,
  snitch_tap: snitchTap,
  empezar_duelo: empezarDuelo,
  detener_duelo: detenerDuelo,
  duelo_tap: dueloTap,
  comentar,
};

function alMensaje(ws, datos) {
  let m;
  try { m = JSON.parse(datos); } catch { return; }
  if (!m || typeof m !== 'object') return;
  const fn = ACCIONES[m.t];
  if (!fn) return;
  try { fn(ws, m); } catch (e) {
    console.error('Error procesando', m.t, e);
    error(ws, 'Algo falló en el servidor. Inténtalo de nuevo.');
  }
}

// ---------------------------------------------------------------- Servidor HTTP + WebSocket
const PAGINA = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/salud') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (url === '/' || url === '/index.html') {
    return fs.readFile(PAGINA, (err, html) => {
      if (err) { res.writeHead(500); return res.end('Error'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
    });
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', (ws) => {
  ws.vivo = true;
  ws.on('pong', () => { ws.vivo = true; });
  ws.on('message', (datos) => alMensaje(ws, datos.toString()));
  ws.on('close', () => alDesconectar(ws));
  ws.on('error', () => {});
});

// Latido cada 20 s: detecta celulares que perdieron la conexión sin avisar.
const latido = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.vivo) { ws.terminate(); continue; }
    ws.vivo = false;
    ws.ping();
  }
}, 20000);
wss.on('close', () => clearInterval(latido));

console.log(`Arrancando el servidor (Node ${process.version}, puerto ${PORT})…`);
server.on('error', (e) => { console.error('No se pudo abrir el puerto:', e.message); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Quidditch listo en el puerto ${PORT}`);
  if (ADMIN_PASSWORD === 'cambiame') console.log('AVISO: define ADMIN_PASSWORD (la contraseña por defecto es "cambiame").');
});
