'use strict';
// Servidor del mini juego de Quidditch (prototipo, paso 2).
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
const RESERVA_MS = Number(process.env.RESERVA_MS) || 60000;              // plaza reservada al desconectarse
const BLUDGER_ESPERA_MS = Number(process.env.BLUDGER_ESPERA_MS) || 20000; // cada equipo, una bludger cada 20 s
const MAX_PARTICIPANTES = 20;
const MAX_LOG = 60;
const PUNTOS_GOL = 10;
const MARGEN_TIRO = 0;      // el cazador debe superar al guardián por más de esto (0 a 1). Empate = atajada.
const MAX_COMENTARIO = 140;

const AJUSTES = {
  tolerancia: 0.015,     // margen extra a cada lado de la zona (por el refresco de pantalla)
  minimoHumanoMs: 80,    // nadie reacciona antes de esto: valor imposible
  margenRelojMs: 300,    // diferencia de reloj admitida entre celular y servidor
  margenRedMs: 1500,     // espera extra por la red antes de dar un reto por fallido
};
// Cada reto es un minijuego de precisión: una marca va y vuelve y hay que tocar dentro de la zona.
// Lo que cambia es el dibujo: barra (cazadores), aguja (guardián) y círculo (golpeadores).
const RETOS = {
  pase:    { visual: 'barra',   ancho: 0.14, periodo: 1600, limite: 6000, boton: '¡PASAR!' },
  tiro:    { visual: 'barra',   ancho: 0.14, periodo: 1500, limite: 6000, boton: '¡LANZAR!' },
  atajar:  { visual: 'aguja',   ancho: 0.14, periodo: 1500, limite: 6000, boton: '¡ATAJAR!' },
  bateo:   { visual: 'circulo', ancho: 0.12, periodo: 1400, limite: 6000, boton: '¡BATEAR!' },
  repeler: { visual: 'circulo', ancho: 0.16, periodo: 1000, limite: 3000, boton: '¡REPELER!' },
};
// Posiciones de la zona: secuencia fija (el juego no usa azar).
const CENTROS = [0.5, 0.3, 0.7, 0.4, 0.62, 0.26, 0.74, 0.45, 0.56, 0.34, 0.68];

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
const INVITADOS = { comentarista: 'Comentarista', prefecto: 'Prefecto', administracion: 'Administración' };
const PLAZAS = [];
for (const e of EQUIPOS) for (const p of POSICIONES) PLAZAS.push(`${e}-${p.id}`);

// ---------------------------------------------------------------- Estado
const salas = new Map();   // codigo -> sala
const tokens = new Map();  // token  -> { codigo, id }

function nuevaSala(codigo, equipos) {
  const plazas = {};
  for (const id of PLAZAS) plazas[id] = null; // null = libre, id de participante, o {bloqueada, nombre}
  return {
    codigo,
    creada: Date.now(),
    fase: 'lobby', // 'lobby' | 'partido' (el partido con reloj llega en el siguiente paso)
    equipos,       // { A: 'Slytherin', B: 'Gryffindor' }
    participantes: new Map(),
    plazas,
    log: [],
    comentarios: [],
    pelota: null,  // { equipo, portador }
    accion: null,  // jugada en curso: 'pase' | 'tiro' | 'bludger'
    contadorRetos: 0,
    pasesBuenos: 0,
    marcador: { A: 0, B: 0 },
    ultimaBludger: { A: 0, B: 0 },
  };
}

// ---------------------------------------------------------------- Utilidades
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpiarTexto = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const limpiarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const tipoDePlaza = (plaza) => POSICIONES.find((p) => p.id === plaza.split('-')[1]).tipo;
const equipoDePlaza = (plaza) => plaza.split('-')[0];
const rival = (e) => (e === 'A' ? 'B' : 'A');
const hex = (n) => crypto.randomBytes(n).toString('hex');
const pct = (x) => Math.round(x * 100);

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
  return p ? p.nombre : '?';
}
// Aviso personal para un jugador (aparece solo en su pantalla).
function avisarA(sala, id, texto, bueno) {
  const p = sala.participantes.get(id);
  if (p) enviar(p.ws, { t: 'resultado', texto, bueno });
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

// Lo que ven los clientes. Los jugadores NO ven el registro de jugadas: eso es para invitados
// (comentaristas, prefectos, administración). Nunca se envían tokens ni zonas de los retos.
function estadoPublico(sala, conRegistro) {
  const ahora = Date.now();
  const a = sala.accion;
  return {
    codigo: sala.codigo,
    fase: sala.fase,
    max: MAX_PARTICIPANTES,
    equipos: sala.equipos,
    participantes: [...sala.participantes.values()].map((p) => ({
      id: p.id, nombre: p.nombre, casa: p.casa, conectado: p.conectado, plaza: p.plaza, invitado: p.invitado,
    })),
    plazas: sala.plazas,
    pelota: sala.pelota,
    enJuego: !!a,
    marcador: sala.marcador,
    pasesBuenos: sala.pasesBuenos,
    pasesNecesarios: sala.pelota ? pasesNecesarios(sala, sala.pelota.equipo) : 2,
    bludgerEsperaMs: {
      A: Math.max(0, sala.ultimaBludger.A + BLUDGER_ESPERA_MS - ahora),
      B: Math.max(0, sala.ultimaBludger.B + BLUDGER_ESPERA_MS - ahora),
    },
    accion: conRegistro && a ? { tipo: a.tipo, texto: a.texto } : null,
    log: conRegistro ? sala.log : null,
  };
}
function difundir(sala) {
  const paraInvitados = JSON.stringify({ t: 'estado', sala: estadoPublico(sala, true) });
  const paraJugadores = JSON.stringify({ t: 'estado', sala: estadoPublico(sala, false) });
  for (const p of sala.participantes.values()) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(p.invitado ? paraInvitados : paraJugadores);
  }
}

// ---------------------------------------------------------------- Entrada y reconexión
function crearSala(ws, m) {
  if (m.clave !== ADMIN_PASSWORD) return error(ws, 'Contraseña de administración incorrecta.');
  const codigo = limpiarCodigo(m.codigo);
  if (codigo.length < 3 || codigo.length > 10) return error(ws, 'El código debe tener entre 3 y 10 letras o números.');
  if (salas.has(codigo)) return enviar(ws, { t: 'sala_creada', codigo, equipos: salas.get(codigo).equipos, yaExistia: true });
  if (!CASAS.includes(m.equipoA) || !CASAS.includes(m.equipoB)) return error(ws, 'Elige la casa de cada equipo.');
  if (m.equipoA === m.equipoB) return error(ws, 'Los dos equipos deben ser de casas distintas.');
  const sala = nuevaSala(codigo, { A: m.equipoA, B: m.equipoB });
  salas.set(codigo, sala);
  registrar(sala, `Sala ${codigo} creada: ${m.equipoA} contra ${m.equipoB}.`);
  enviar(ws, { t: 'sala_creada', codigo, equipos: sala.equipos });
}

function entrar(ws, m) {
  if (ws.participante) return error(ws, 'Ya estás dentro de una sala.');
  const codigo = limpiarCodigo(m.codigo);
  const sala = salas.get(codigo);
  if (!sala) return error(ws, 'No existe ninguna sala con ese código. Revisa el código o pide al administrador que la cree.');
  const nombre = limpiarTexto(m.nombre);
  if (nombre.length < 1 || nombre.length > 20) return error(ws, 'Escribe un nombre de 1 a 20 letras.');
  if (!CASAS.includes(m.casa)) return error(ws, 'Elige tu casa.');
  if (sala.participantes.size >= MAX_PARTICIPANTES) {
    return error(ws, `La sala está llena (${MAX_PARTICIPANTES} participantes). No se puede entrar.`, 'sala_llena');
  }
  const n = normalizar(nombre);
  for (const p of sala.participantes.values()) {
    if (normalizar(p.nombre) === n) return error(ws, `Ya hay alguien llamado "${p.nombre}" en la sala. Usa otro nombre (por ejemplo, con tu apellido).`, 'nombre_repetido');
  }
  const p = {
    id: hex(6), token: hex(24),
    nombre, casa: m.casa, plaza: null, invitado: null,
    ws: null, conectado: false, timerReserva: null, ultimoComentario: 0,
  };
  sala.participantes.set(p.id, p);
  tokens.set(p.token, { codigo, id: p.id });
  conectar(sala, p, ws);
  registrar(sala, `${nombre} (${m.casa}) entra en la sala.`);
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
  difundir(sala);
  // Si tenía un reto abierto, se lo devolvemos por donde iba.
  if (sala.accion) for (const r of sala.accion.retos.values()) {
    if (r.pid === p.id && r.precision === undefined) enviarReto(sala, r);
  }
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
  soltarTodo(sala, p);
  if (p.plaza) {
    // Antes del partido la plaza queda libre; durante el partido queda bloqueada hasta el final.
    sala.plazas[p.plaza] = sala.fase === 'partido' ? { bloqueada: true, nombre: p.nombre } : null;
  }
  clearTimeout(p.timerReserva);
  tokens.delete(p.token); // token invalidado: nadie puede volver con él
  sala.participantes.delete(p.id);
  registrar(sala, texto);
}

function salir(ws) {
  const { sala, p } = quien(ws);
  if (!p) return;
  quitarParticipante(sala, p, `${p.nombre} sale de la sala.`);
  ws.participante = null;
  enviar(ws, { t: 'fuera' });
  difundir(sala);
}

// ---------------------------------------------------------------- Plazas
function quien(ws) {
  const ref = ws.participante;
  const sala = ref && salas.get(ref.codigo);
  const p = sala && sala.participantes.get(ref.id);
  return { sala, p };
}

function elegirPlaza(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return error(ws, 'Primero entra en una sala.');
  if (sala.fase !== 'lobby') return error(ws, 'El partido ya empezó: no se pueden cambiar las plazas.');
  const plaza = String(m.plaza || '');
  if (!PLAZAS.includes(plaza)) return error(ws, 'Esa plaza no existe.');
  if (p.plaza === plaza) return;
  if (sala.plazas[plaza] !== null) return error(ws, 'Esa plaza ya está ocupada. Elige otra.', 'plaza_ocupada');
  liberar(sala, p);
  sala.plazas[plaza] = p.id;
  p.plaza = plaza;
  const pos = POSICIONES.find((x) => x.id === plaza.split('-')[1]);
  registrar(sala, `${p.nombre} es ${pos.nombre} de ${sala.equipos[equipoDePlaza(plaza)]}.`);
  difundir(sala);
}

function serInvitado(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return error(ws, 'Primero entra en una sala.');
  if (sala.fase !== 'lobby') return error(ws, 'El partido ya empezó.');
  if (!INVITADOS[m.tipo]) return error(ws, 'Ese papel no existe.');
  liberar(sala, p);
  p.invitado = m.tipo;
  registrar(sala, `${p.nombre} mira el partido como ${INVITADOS[m.tipo]}.`);
  difundir(sala);
}

function dejarPlaza(ws) {
  const { sala, p } = quien(ws);
  if (!p || sala.fase !== 'lobby') return;
  liberar(sala, p);
  difundir(sala);
}

function liberar(sala, p) {
  soltarTodo(sala, p);
  if (p.plaza) sala.plazas[p.plaza] = null;
  p.plaza = null;
  p.invitado = null;
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
  if (sala.pelota && sala.pelota.portador === p.id) {
    sala.pelota = null;
    registrar(sala, 'La quaffle queda suelta.');
  }
}

// ---------------------------------------------------------------- Motor de retos
function nuevaAccion(sala, tipo, datos, texto) {
  const a = { id: hex(4), tipo, datos, texto, retos: new Map(), timer: null };
  sala.accion = a;
  return a;
}

function lanzarReto(sala, a, pid, clase, titulo) {
  const cfg = RETOS[clase];
  const centro = CENTROS[sala.contadorRetos++ % CENTROS.length];
  const r = {
    id: hex(4), pid, clase, titulo, ...cfg,
    zonaIni: centro - cfg.ancho / 2, zonaFin: centro + cfg.ancho / 2,
    inicio: Date.now(), precision: undefined, motivo: '',
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

function terminarAccion(sala) {
  if (sala.accion) clearTimeout(sala.accion.timer);
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
}

// Entrega la quaffle al primer cazador conectado de un equipo (o queda suelta).
function darPelotaA(sala, equipo) {
  sala.pasesBuenos = 0;
  const nuevo = jugadoresDe(sala, equipo, 'cazador')[0];
  if (nuevo) {
    sala.pelota = { equipo, portador: nuevo };
    registrar(sala, `La quaffle es de ${sala.equipos[equipo]}: la tiene ${nombreDe(sala, nuevo)}.`);
    avisarA(sala, nuevo, '🏐 ¡Tienes la quaffle!', true);
  } else {
    sala.pelota = null;
    registrar(sala, 'La quaffle queda suelta.');
  }
}

function puedeActuar(ws) {
  const { sala, p } = quien(ws);
  if (!p) return {};
  if (sala.accion) { error(ws, 'Espera a que termine la jugada en curso.'); return {}; }
  return { sala, p };
}

// ---------------------------------------------------------------- Quaffle: tomar (prueba), pasar y tirar
function tomarPelota(ws) {
  const { sala, p } = quien(ws);
  if (!p) return;
  if (!p.plaza || tipoDePlaza(p.plaza) !== 'cazador') return error(ws, 'Solo los cazadores pueden tomar la quaffle.');
  if (sala.pelota) return error(ws, 'La quaffle ya la tiene alguien.');
  sala.pelota = { equipo: equipoDePlaza(p.plaza), portador: p.id };
  sala.pasesBuenos = 0;
  registrar(sala, `${p.nombre} toma la quaffle para ${sala.equipos[sala.pelota.equipo]}.`);
  difundir(sala);
}

function pasar(ws, m) {
  const { sala, p } = puedeActuar(ws);
  if (!p) return;
  if (!sala.pelota || sala.pelota.portador !== p.id) return error(ws, 'No tienes la quaffle.');
  const destino = sala.participantes.get(String(m.a || ''));
  if (!destino || destino.id === p.id || !jugadoresDe(sala, sala.pelota.equipo, 'cazador', false).includes(destino.id)) {
    return error(ws, 'Solo puedes pasar a un cazador de tu equipo.');
  }
  if (!destino.conectado) return error(ws, `${destino.nombre} está desconectado ahora mismo.`);
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
    sala.pelota.portador = receptor;
    sala.pasesBuenos++;
    registrar(sala, `${nDe} pasa a ${nA}… ¡bien recibido! (puntería ${pct(r.precision)})`);
    avisarA(sala, de, `✅ ¡Pase completado a ${nA}!`, true);
    const faltan = pasesNecesarios(sala, equipo) - sala.pasesBuenos;
    avisarA(sala, receptor, faltan <= 0 ? `🏐 ${nDe} te pasó la quaffle. ¡Ya puedes lanzar a la meta!` : `🏐 ${nDe} te pasó la quaffle.`, true);
    if (faltan <= 0) registrar(sala, `¡${sala.equipos[equipo]} ya puede lanzar a la meta!`);
  } else {
    const motivo = !receptorSigue ? 'el receptor ya no está' : r.motivo;
    registrar(sala, `${nDe} pasa a ${nA}… ¡pase fallido! (${motivo})`);
    avisarA(sala, de, `❌ Pase fallido (${motivo}). Pierdes la quaffle.`, false);
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
  const guardian = jugadoresDe(sala, rival(equipo), 'guardian')[0] || null;
  const nG = guardian ? nombreDe(sala, guardian) : null;
  const a = nuevaAccion(sala, 'tiro', { de: p.id, guardian, equipo, nDe: p.nombre, nG },
    guardian ? `${p.nombre} lanza a la meta… ${nG} intenta atajar.` : `${p.nombre} lanza a la meta… ¡no hay guardián!`);
  lanzarReto(sala, a, p.id, 'tiro', '¡Lanza a la meta!');
  if (guardian) lanzarReto(sala, a, guardian, 'atajar', `¡${p.nombre} lanza! Ataja el tiro`);
  programarFin(sala, a, RETOS.tiro.limite);
  registrar(sala, a.texto);
  difundir(sala);
}

function avanzarTiro(sala, a, final) {
  const retos = [...a.retos.values()];
  if (!final && retos.some((r) => r.precision === undefined)) return; // esperamos a los dos
  terminarAccion(sala);
  const { de, guardian, equipo, nDe, nG } = a.datos;
  const rT = retos.find((r) => r.clase === 'tiro');
  const rG = retos.find((r) => r.clase === 'atajar');
  const pc = rT.precision;
  const pg = rG ? rG.precision : 0;
  const detalle = rG ? `(puntería ${pct(pc)} contra ${pct(pg)})` : `(puntería ${pct(pc)})`;
  if (pc > 0 && pc > pg + MARGEN_TIRO) {
    sala.marcador[equipo] += PUNTOS_GOL;
    registrar(sala, `¡GOOOL de ${nDe}! +${PUNTOS_GOL} para ${sala.equipos[equipo]} ${detalle}`);
    avisarA(sala, de, `🎉 ¡GOOOL! +${PUNTOS_GOL} para ${sala.equipos[equipo]}`, true);
    if (guardian) avisarA(sala, guardian, `😣 ${nDe} te marcó gol.`, false);
  } else if (pc === 0) {
    registrar(sala, `${nDe} falla el tiro (${rT.motivo}).`);
    avisarA(sala, de, `❌ Tiro fallido (${rT.motivo}).`, false);
    if (guardian) avisarA(sala, guardian, `🧤 ${nDe} falló el tiro.`, true);
  } else {
    registrar(sala, `¡${nG} ataja el tiro de ${nDe}! ${detalle}`);
    avisarA(sala, de, `🧤 ${nG} atajó tu tiro.`, false);
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
    a.texto = `¡Bludger hacia ${d.nO}! Los golpeadores de ${sala.equipos[rival(d.equipo)]} intentan repelerla…`;
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
    registrar(sala, `¡${nR} repele la bludger! ${d.nO} conserva la quaffle.`);
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
  registrar(sala, `¡La bludger golpea a ${d.nO} (${motivo})! Suelta la quaffle.`);
  avisarA(sala, d.objetivo, '💥 ¡Te golpeó una bludger! Pierdes la quaffle.', false);
  avisarA(sala, d.de, `💥 ¡Tu bludger golpeó a ${d.nO}!`, true);
  darPelotaA(sala, d.equipo);
  difundir(sala);
}

// ---------------------------------------------------------------- Comentaristas
function comentar(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return;
  if (p.invitado !== 'comentarista') return error(ws, 'Solo los comentaristas pueden comentar.');
  const texto = limpiarTexto(m.texto);
  if (!texto) return;
  if (texto.length > MAX_COMENTARIO) return error(ws, `Máximo ${MAX_COMENTARIO} letras por comentario.`);
  if (Date.now() - p.ultimoComentario < 1500) return error(ws, 'Espera un segundo antes del siguiente comentario.');
  p.ultimoComentario = Date.now();
  const c = { h: Date.now(), nombre: p.nombre, casa: p.casa, texto };
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
  dejar_plaza: dejarPlaza,
  tomar_pelota: tomarPelota,
  pasar,
  tirar,
  bludger: lanzarBludger,
  tap,
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

server.listen(PORT, () => {
  console.log(`Quidditch listo en el puerto ${PORT}`);
  if (ADMIN_PASSWORD === 'cambiame') console.log('AVISO: define ADMIN_PASSWORD (la contraseña por defecto es "cambiame").');
});
