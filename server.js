'use strict';
// Servidor del mini juego de Quidditch (prototipo, paso 1).
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
const RESERVA_MS = Number(process.env.RESERVA_MS) || 60000; // plaza reservada al desconectarse
const MAX_PARTICIPANTES = 20;
const MAX_LOG = 40;

const PASE = {
  limiteMs: 6000,        // tiempo para tocar la barra
  periodoMs: 1600,       // la marca va de un extremo al otro y vuelve en este tiempo
  anchoZona: 0.22,       // ancho de la zona verde (22 % de la barra)
  tolerancia: 0.04,      // margen extra a cada lado para compensar la latencia
  minimoHumanoMs: 80,    // nadie reacciona antes de esto: valor imposible
  margenRelojMs: 300,    // diferencia de reloj admitida entre celular y servidor
  margenRedMs: 1500,     // espera extra por la red antes de dar el pase por fallido
};
// Posiciones de la zona verde: secuencia fija (el juego no usa azar).
const CENTROS_ZONA = [0.5, 0.3, 0.7, 0.4, 0.62, 0.26, 0.74, 0.45];

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

function nuevaSala(codigo) {
  const plazas = {};
  for (const id of PLAZAS) plazas[id] = null; // null = libre, id de participante, o {bloqueada, nombre}
  return {
    codigo,
    creada: Date.now(),
    fase: 'lobby', // 'lobby' | 'partido' (el partido llega en los siguientes pasos)
    participantes: new Map(),
    plazas,
    log: [],
    pelota: null,  // { equipo, portador }
    accion: null,  // acción en curso (por ahora solo 'pase')
    contadorPases: 0,
    pasesBuenos: 0,
  };
}

// ---------------------------------------------------------------- Utilidades
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpiarNombre = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const limpiarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const tipoDePlaza = (plaza) => POSICIONES.find((p) => p.id === plaza.split('-')[1]).tipo;
const equipoDePlaza = (plaza) => plaza.split('-')[0];

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

// Lo que ven todos los clientes de la sala (sin secretos: ni tokens ni zona verde).
function estadoPublico(sala) {
  return {
    codigo: sala.codigo,
    fase: sala.fase,
    max: MAX_PARTICIPANTES,
    participantes: [...sala.participantes.values()].map((p) => ({
      id: p.id, nombre: p.nombre, casa: p.casa, conectado: p.conectado,
      plaza: p.plaza, invitado: p.invitado,
    })),
    plazas: sala.plazas,
    pelota: sala.pelota,
    accion: sala.accion && { id: sala.accion.id, tipo: sala.accion.tipo, de: sala.accion.de, a: sala.accion.a },
    pasesBuenos: sala.pasesBuenos,
    log: sala.log,
  };
}
function difundir(sala) {
  const msg = JSON.stringify({ t: 'estado', sala: estadoPublico(sala) });
  for (const p of sala.participantes.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
}

// ---------------------------------------------------------------- Entrada y reconexión
function crearSala(ws, m) {
  if (m.clave !== ADMIN_PASSWORD) return error(ws, 'Contraseña de administración incorrecta.');
  const codigo = limpiarCodigo(m.codigo);
  if (codigo.length < 3 || codigo.length > 10) return error(ws, 'El código debe tener entre 3 y 10 letras o números.');
  if (salas.has(codigo)) return enviar(ws, { t: 'sala_creada', codigo, yaExistia: true });
  salas.set(codigo, nuevaSala(codigo));
  registrar(salas.get(codigo), `Sala ${codigo} creada.`);
  enviar(ws, { t: 'sala_creada', codigo });
}

function entrar(ws, m) {
  if (ws.participante) return error(ws, 'Ya estás dentro de una sala.');
  const codigo = limpiarCodigo(m.codigo);
  const sala = salas.get(codigo);
  if (!sala) return error(ws, 'No existe ninguna sala con ese código. Revisa el código o pide a la administradora que la cree.');
  const nombre = limpiarNombre(m.nombre);
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
    id: crypto.randomBytes(6).toString('hex'),
    token: crypto.randomBytes(24).toString('hex'),
    nombre, casa: m.casa, plaza: null, invitado: null,
    ws: null, conectado: false, timerReserva: null,
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
  // Si tenía una barra abierta, se la devolvemos por donde iba.
  if (sala.accion && sala.accion.de === p.id) enviarBarra(sala, p);
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
  const ref = ws.participante;
  const sala = ref && salas.get(ref.codigo);
  const p = sala && sala.participantes.get(ref.id);
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
  soltarPelotaSiLaTiene(sala, p);
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
  registrar(sala, `${p.nombre} es ${pos.nombre} del Equipo ${equipoDePlaza(plaza)}.`);
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
  soltarPelotaSiLaTiene(sala, p);
  if (p.plaza) sala.plazas[p.plaza] = null;
  p.plaza = null;
  p.invitado = null;
}

// ---------------------------------------------------------------- Pelota y barra de pase
function cazadoresDe(sala, equipo) {
  return POSICIONES.filter((x) => x.tipo === 'cazador')
    .map((x) => sala.plazas[`${equipo}-${x.id}`])
    .filter((id) => typeof id === 'string');
}

function soltarPelotaSiLaTiene(sala, p) {
  if (sala.accion && (sala.accion.de === p.id || sala.accion.a === p.id)) {
    resolverPase(sala, false, 'un jugador salió de su plaza');
  }
  if (sala.pelota && sala.pelota.portador === p.id) {
    sala.pelota = null;
    registrar(sala, 'La pelota queda suelta.');
  }
}

// Prototipo: un cazador puede tomar la pelota si está suelta, para probar los pases.
function tomarPelota(ws) {
  const { sala, p } = quien(ws);
  if (!p) return;
  if (!p.plaza || tipoDePlaza(p.plaza) !== 'cazador') return error(ws, 'Solo los cazadores pueden tomar la pelota.');
  if (sala.pelota) return error(ws, `La pelota la tiene ${nombreDe(sala, sala.pelota.portador)}.`);
  sala.pelota = { equipo: equipoDePlaza(p.plaza), portador: p.id };
  sala.pasesBuenos = 0;
  registrar(sala, `${p.nombre} toma la pelota.`);
  difundir(sala);
}

function pasar(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return;
  if (!sala.pelota || sala.pelota.portador !== p.id) return error(ws, 'No tienes la pelota.');
  if (sala.accion) return error(ws, 'Espera a que termine la jugada en curso.');
  const destino = sala.participantes.get(String(m.a || ''));
  if (!destino || destino.id === p.id || !cazadoresDe(sala, sala.pelota.equipo).includes(destino.id)) {
    return error(ws, 'Solo puedes pasar a un cazador de tu equipo.');
  }
  if (!destino.conectado) return error(ws, `${destino.nombre} está desconectado ahora mismo.`);

  const centro = CENTROS_ZONA[sala.contadorPases++ % CENTROS_ZONA.length];
  const a = {
    id: crypto.randomBytes(4).toString('hex'),
    tipo: 'pase', de: p.id, a: destino.id,
    zonaIni: centro - PASE.anchoZona / 2,
    zonaFin: centro + PASE.anchoZona / 2,
    periodo: PASE.periodoMs, limite: PASE.limiteMs,
    inicio: Date.now(),
  };
  a.timer = setTimeout(() => resolverPase(sala, false, 'se acabó el tiempo'), PASE.limiteMs + PASE.margenRedMs);
  sala.accion = a;
  registrar(sala, `${p.nombre} intenta pasar a ${destino.nombre}…`);
  difundir(sala);
  enviarBarra(sala, p);
}

function enviarBarra(sala, p) {
  const a = sala.accion;
  enviar(p.ws, {
    t: 'barra',
    accion: {
      id: a.id, tipo: a.tipo, a: nombreDe(sala, a.a),
      zonaIni: a.zonaIni, zonaFin: a.zonaFin, periodo: a.periodo, limite: a.limite,
      desde: Date.now() - a.inicio, // ms que ya pasaron (útil al reconectar)
    },
  });
}

// Posición de la marca (0 a 1) a los "ms" milisegundos: va y vuelve sin parar.
function posicionMarca(ms, periodo) {
  const fase = (ms % periodo) / periodo;
  return fase < 0.5 ? fase * 2 : 2 - fase * 2;
}

function tap(ws, m) {
  const { sala, p } = quien(ws);
  if (!p) return;
  const a = sala.accion;
  if (!a || a.id !== m.accion || a.de !== p.id) return; // llegó tarde o no le toca: se ignora
  const ms = Number(m.ms);
  const transcurrido = Date.now() - a.inicio;
  // Rechazar valores imposibles: negativos, más rápidos que un humano,
  // o más tiempo del que realmente pasó en el servidor.
  if (!Number.isFinite(ms) || ms < PASE.minimoHumanoMs || ms > transcurrido + PASE.margenRelojMs) {
    return resolverPase(sala, false, 'tiempo no válido');
  }
  if (ms > a.limite) return resolverPase(sala, false, 'llegó tarde');
  const pos = posicionMarca(ms, a.periodo);
  const ok = pos >= a.zonaIni - PASE.tolerancia && pos <= a.zonaFin + PASE.tolerancia;
  resolverPase(sala, ok, ok ? '' : 'no tocó en el verde');
}

function resolverPase(sala, ok, motivo) {
  const a = sala.accion;
  if (!a) return;
  clearTimeout(a.timer);
  sala.accion = null;
  const de = nombreDe(sala, a.de);
  const receptorSigue = sala.participantes.has(a.a) && cazadoresDe(sala, sala.pelota.equipo).includes(a.a);
  if (ok && receptorSigue) {
    sala.pelota.portador = a.a;
    sala.pasesBuenos++;
    registrar(sala, `${de} pasa a ${nombreDe(sala, a.a)}… ¡bien recibido!`);
    if (sala.pasesBuenos >= 2) {
      registrar(sala, '¡Dos pases buenos! Ya podría tirar a puerta (el tiro llega en el siguiente paso).');
      sala.pasesBuenos = 0;
    }
  } else {
    registrar(sala, `${de} pasa a ${nombreDe(sala, a.a)}… ¡pase fallido! (${motivo || 'el receptor ya no está'})`);
    sala.pasesBuenos = 0;
    const rival = sala.pelota.equipo === 'A' ? 'B' : 'A';
    const nuevo = cazadoresDe(sala, rival).find((id) => sala.participantes.get(id).conectado);
    if (nuevo) {
      sala.pelota = { equipo: rival, portador: nuevo };
      registrar(sala, `La pelota pasa al Equipo ${rival}: la tiene ${nombreDe(sala, nuevo)}.`);
    } else {
      sala.pelota = null;
      registrar(sala, 'La pelota queda suelta.');
    }
  }
  difundir(sala);
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
  tap,
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
