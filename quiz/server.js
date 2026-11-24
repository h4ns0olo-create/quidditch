'use strict';
// Servidor de los quizzes de las clases (proyecto separado del Quidditch).
// - Sirve la página web (public/index.html) y una pequeña API en JSON.
// - Todo vive en memoria: si el servidor se reinicia, los quizzes abiertos se pierden.
// - El cronómetro lo lleva el SERVIDOR: recargar la página no reinicia el tiempo
//   y una respuesta que llega tarde no cuenta.
// - No usa ninguna librería externa: solo Node.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------- Ajustes
function entero(valor, porDefecto, min, max) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : porDefecto;
}
const PORT = Number(process.env.PORT) || 3000;
const MIN_PREGUNTAS = 5;                                             // cada quiz: de 5 a 10 preguntas
const MAX_PREGUNTAS = 10;
const SEGUNDOS_POR_DEFECTO = 20;                                     // segundos por pregunta
const SEGUNDOS_MIN = entero(process.env.SEGUNDOS_MIN, 5, 1, 60);      // (las pruebas automáticas lo bajan)
const SEGUNDOS_MAX = 60;
const GRACIA_MS = 1500;               // margen por la red: después de esto la respuesta ya no cuenta
const MAX_POR_CASA = 20;
const MAX_ALUMNOS = 80;
const MAX_NOMBRE = 30;
const MAX_TEXTO = 300;                // largo máximo de una pregunta o alternativa
const BORRAR_TRAS_PUBLICAR_MS = entero(process.env.BORRAR_TRAS_PUBLICAR_MS, 30 * 60 * 1000, 1000, 864e5);
const BORRAR_SIN_PUBLICAR_MS = entero(process.env.BORRAR_SIN_PUBLICAR_MS, 3 * 60 * 60 * 1000, 1000, 864e5);
const SESION_PROFE_MS = 12 * 60 * 60 * 1000;
// Tablón de tareas (fotos cuadradas que suben los alumnos; se borra todo al acabar el tiempo)
const TABLON_MINUTOS = [10, 15, 20, 30];                                        // duraciones que elige el profesor
const TABLON_ALARGAR_MIN = 5;                                                   // botón "+5 minutos"
const TABLON_MAX_MIN = 60;                                                      // nunca más de 1 hora en total
const MINUTO_TABLON_MS = entero(process.env.MINUTO_TABLON_MS, 60000, 50, 60000); // (las pruebas lo acortan)
const MAX_FOTO_BYTES = 450 * 1024;                                              // cada foto (el celular la deja en ~150 KB)
const MAX_FOTOS_BYTES = entero(process.env.MAX_FOTOS_MB, 200, 1, 2000) * 1024 * 1024; // todas las fotos juntas en memoria

const CASAS = ['Gryffindor', 'Hufflepuff', 'Ravenclaw', 'Slytherin'];
const CURSOS = [
  'Cuidado de criaturas mágicas',
  'Pociones (años mayores)',
  'Pociones (años menores)',
  'Historia de la magia',
  'DCLAO',
  'Encantamientos',
  'Vuelo',
  'Aparición',
  'Aritmancia',
  'Astronomía',
  'Runas antiguas',
  'Adivinación',
];

// Quita mayúsculas, tildes y espacios repetidos: "  Ánna  María" -> "anna maria".
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- Contraseñas de los cursos
// Una sola variable en Render, CLAVES_CURSOS, con este formato:
//   1=fenix; 2=mandragora; 3=bezoar; ...
// (número del curso, signo =, contraseña; separadas por punto y coma).
function leerClaves(texto) {
  const porCurso = new Map();   // número de curso -> contraseña normalizada
  const avisos = [];
  String(texto || '').split(/[;\n]+/).forEach((trozo, i) => {
    const t = trozo.trim();
    if (!t) return;
    const igual = t.indexOf('=');
    if (igual < 0) { avisos.push(`El trozo número ${i + 1} no tiene el signo "=" y se ignora.`); return; }
    const num = Number(t.slice(0, igual).trim());
    const clave = normalizar(t.slice(igual + 1));
    if (!Number.isInteger(num) || num < 1 || num > CURSOS.length) {
      avisos.push(`El trozo número ${i + 1} no empieza con un número de curso del 1 al ${CURSOS.length} y se ignora.`);
      return;
    }
    if (!clave) { avisos.push(`El curso ${num} no tiene contraseña.`); return; }
    if (porCurso.has(num)) avisos.push(`El curso ${num} aparece dos veces: vale la última contraseña.`);
    porCurso.set(num, clave);
  });
  // Dos cursos con la misma contraseña: no se sabría a cuál entrar, así que ninguno funciona.
  const repetidas = new Map();
  for (const [num, clave] of porCurso) {
    if (!repetidas.has(clave)) repetidas.set(clave, []);
    repetidas.get(clave).push(num);
  }
  for (const nums of repetidas.values()) {
    if (nums.length > 1) {
      avisos.push(`Los cursos ${nums.join(', ')} tienen la misma contraseña: no podrán entrar hasta que les pongas contraseñas distintas.`);
      nums.forEach((n) => porCurso.delete(n));
    }
  }
  return { porCurso, avisos };
}

let textoClaves = process.env.CLAVES_CURSOS || '';
if (!textoClaves.trim() && !process.env.RENDER) {
  textoClaves = '1=prueba';   // solo para probar en una computadora; en Render no hay clave por defecto
  console.log('Aviso: no hay CLAVES_CURSOS; para probar, el curso 1 usa la contraseña "prueba".');
}
const CLAVES = leerClaves(textoClaves);
CLAVES.avisos.forEach((a) => console.log('Aviso en CLAVES_CURSOS: ' + a));
console.log(`Cursos con contraseña: ${CLAVES.porCurso.size} de ${CURSOS.length}` +
  (CLAVES.porCurso.size ? ` (${[...CLAVES.porCurso.keys()].sort((a, b) => a - b).join(', ')})` : ''));

// ---------------------------------------------------------------- Estado en memoria
const quizzes = new Map();        // código -> quiz
const quizDeCurso = new Map();    // número de curso -> código del quiz activo
const sesiones = new Map();       // token de profesor -> { curso, creada }
const alumnos = new Map();        // token de alumno -> { codigo, id, tipo: 'quiz' | 'tablon' }
const tablones = new Map();       // código -> tablón de tareas
const tablonDeCurso = new Map();  // número de curso -> código del tablón activo
let bytesFotos = 0;               // memoria que ocupan ahora todas las fotos
const fallosLogin = new Map();    // ip -> { n, desde }
let ultimoIntento = 0;            // número único de cada intento (en todo el servidor)

const token = () => crypto.randomBytes(18).toString('base64url');
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0 ni I/1 para no confundir

function nuevoCodigo() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETRAS_CODIGO[crypto.randomInt(LETRAS_CODIGO.length)];
    if (!quizzes.has(c) && !tablones.has(c)) return c;
  }
}

function mezclar(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function borrarQuiz(codigo) {
  const q = quizzes.get(codigo);
  if (!q) return;
  for (const it of q.intentos.values()) alumnos.delete(it.token);
  quizzes.delete(codigo);
  if (quizDeCurso.get(q.curso) === codigo) quizDeCurso.delete(q.curso);
}

// Cada 30 s se borran los quizzes viejos y las sesiones vencidas.
setInterval(() => {
  const ahora = Date.now();
  for (const q of [...quizzes.values()]) {
    if (q.publicado && ahora - q.publicado > BORRAR_TRAS_PUBLICAR_MS) borrarQuiz(q.codigo);
    else if (!q.publicado && ahora - q.creado > BORRAR_SIN_PUBLICAR_MS) borrarQuiz(q.codigo);
  }
  for (const [t, s] of sesiones) if (ahora - s.creada > SESION_PROFE_MS) sesiones.delete(t);
  for (const [ip, f] of fallosLogin) if (ahora - f.desde > 10 * 60 * 1000) fallosLogin.delete(ip);
}, Math.max(500, Math.min(30000, BORRAR_TRAS_PUBLICAR_MS / 2, BORRAR_SIN_PUBLICAR_MS / 2))).unref();

// ---------------------------------------------------------------- Lógica del quiz
const limiteMs = (q) => q.segundos * 1000;

// Si se acabó el tiempo de la pregunta actual (más el margen), cuenta como fallo y pasa a la siguiente.
// La siguiente pregunta NO empieza sola: su tiempo arranca cuando el alumno la ve.
function avanzar(q, it, ahora) {
  if (it.terminado) return;
  if (q.estado !== 'abierto') { it.terminado = true; return; }
  if (it.inicio !== null && ahora > it.inicio + limiteMs(q) + GRACIA_MS) {
    it.respuestas[it.orden[it.pos]] = { elegida: null, ok: false };
    siguiente(q, it);
  }
}
function siguiente(q, it) {
  it.pos++;
  it.inicio = null;
  if (it.pos >= q.preguntas.length) it.terminado = true;
}

function preguntaActual(q, it, ahora) {
  avanzar(q, it, ahora);
  if (it.terminado) return null;
  if (it.inicio === null) it.inicio = ahora;      // empieza a correr el tiempo de esta pregunta
  const p = q.preguntas[it.orden[it.pos]];
  const perm = it.permutaciones[it.orden[it.pos]];
  return {
    numero: it.pos + 1,
    total: q.preguntas.length,
    texto: p.texto,
    opciones: perm.map((i) => p.opciones[i]),
    restanteMs: Math.max(0, it.inicio + limiteMs(q) - ahora),
    segundos: q.segundos,
  };
}

function resultados(q) {
  const total = q.preguntas.length;
  const casas = CASAS.map((casa) => ({ casa, alumnos: 0, suma: 0, promedio: 0 }));
  const lista = [];
  for (const it of q.intentos.values()) {
    const c = casas[CASAS.indexOf(it.casa)];
    c.alumnos++;
    c.suma += it.aciertos;
    lista.push({ nombre: it.nombre, casa: it.casa, aciertos: it.aciertos, total });
  }
  casas.forEach((c) => { c.promedio = c.alumnos ? Math.round((c.suma / c.alumnos) * 100) / 100 : 0; /* 2 decimales: evita empates falsos */ });
  lista.sort((a, b) => CASAS.indexOf(a.casa) - CASAS.indexOf(b.casa) ||
    b.aciertos - a.aciertos || a.nombre.localeCompare(b.nombre, 'es'));
  return { curso: CURSOS[q.curso - 1], numCurso: q.curso, total, casas, lista, modo: q.modo, publicado: q.publicado };
}

// Comprueba las preguntas que manda el profesor.
function validarPreguntas(lista) {
  if (!Array.isArray(lista) || lista.length < MIN_PREGUNTAS || lista.length > MAX_PREGUNTAS) {
    return { error: `El quiz debe tener entre ${MIN_PREGUNTAS} y ${MAX_PREGUNTAS} preguntas.` };
  }
  const preguntas = [];
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i] || {};
    const texto = String(p.texto || '').trim();
    const opciones = Array.isArray(p.opciones) ? p.opciones.map((o) => String(o || '').trim()) : [];
    const n = i + 1;
    if (!texto) return { error: `Falta el texto de la pregunta ${n}.` };
    if (opciones.length !== 3 || opciones.some((o) => !o)) return { error: `La pregunta ${n} necesita 3 alternativas.` };
    if (texto.length > MAX_TEXTO || opciones.some((o) => o.length > MAX_TEXTO)) return { error: `La pregunta ${n} es demasiado larga.` };
    if (new Set(opciones.map(normalizar)).size !== 3) return { error: `La pregunta ${n} tiene alternativas repetidas.` };
    if (![0, 1, 2].includes(p.correcta)) return { error: `Marca la respuesta correcta de la pregunta ${n}.` };
    preguntas.push({ texto, opciones, correcta: p.correcta });
  }
  return { preguntas };
}

// ---------------------------------------------------------------- API de alumnos
// Nombre y casa: lo mismo para quizzes y tablones.
function validarAlumno(d) {
  const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim();
  if (!nombre) return { error: 'Escribe tu nombre y apellido.' };
  if (nombre.length > MAX_NOMBRE) return { error: `El nombre es demasiado largo (máximo ${MAX_NOMBRE} letras).` };
  if (!CASAS.includes(d.casa)) return { error: 'Elige tu casa.' };
  return { nombre, norm: normalizar(nombre), casa: d.casa };
}
function lleno(lista, casa) {
  if (lista.length >= MAX_ALUMNOS) return `Ya hay ${MAX_ALUMNOS} participantes, el máximo.`;
  if (lista.filter((x) => x.casa === casa).length >= MAX_POR_CASA) return `${casa} ya tiene ${MAX_POR_CASA} participantes, el máximo por casa.`;
  return '';
}

function alumnoEntrar(d) {
  const codigo = String(d.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const t = tablonVivo(codigo);
  if (t) return tablonEntrar(t, d);
  const q = quizzes.get(codigo);
  if (!q) return { error: 'No existe ningún quiz ni tablón con ese código. Revisa que esté bien escrito.' };
  if (q.estado !== 'abierto') return { error: 'Este quiz ya está cerrado.' };
  const v = validarAlumno(d);
  if (v.error) return v;
  const { nombre, norm } = v;
  if (q.nombres.has(norm)) return { error: 'Ese nombre ya respondió este quiz. Si es un error, pídele al profesor que borre ese intento.' };
  if (q.intentos.size >= MAX_ALUMNOS) return { error: `El quiz está lleno (máximo ${MAX_ALUMNOS} participantes).` };
  let enCasa = 0;
  for (const it of q.intentos.values()) if (it.casa === d.casa) enCasa++;
  if (enCasa >= MAX_POR_CASA) return { error: `${d.casa} ya tiene ${MAX_POR_CASA} participantes, el máximo por casa.` };

  const n = q.preguntas.length;
  const it = {
    id: ++ultimoIntento,
    token: token(),
    nombre, norm, casa: d.casa,
    orden: mezclar(n),                                 // orden de las preguntas, distinto para cada alumno
    permutaciones: q.preguntas.map(() => mezclar(3)),  // orden de las alternativas, distinto para cada alumno
    pos: 0, inicio: null, terminado: false,
    respuestas: Array(n).fill(null),
    aciertos: 0,
  };
  q.intentos.set(it.id, it);
  q.nombres.set(norm, it.id);
  alumnos.set(it.token, { codigo, id: it.id, tipo: 'quiz' });
  return { token: it.token, codigo, tipo: 'quiz' };
}

function buscarAlumno(t) {
  const ref = alumnos.get(String(t || ''));
  if (!ref || ref.tipo !== 'quiz') return {};
  const q = quizzes.get(ref.codigo);
  const it = q && q.intentos.get(ref.id);
  return it ? { q, it } : {};
}

function alumnoEstado(d) {
  const ref = alumnos.get(String(d.token || ''));
  if (ref && ref.tipo === 'tablon') return tablonEstadoAlumno(d.token);
  const { q, it } = buscarAlumno(d.token);
  if (!q) return { fase: 'no-existe' };
  const base = { curso: CURSOS[q.curso - 1], numCurso: q.curso, codigo: q.codigo, nombre: it.nombre, casa: it.casa };
  if (q.publicado) {
    const r = resultados(q);
    const verLista = q.mostrarLista || q.imagenAlumnos;
    return {
      ...base, fase: 'resultados',
      resultados: { ...r, lista: verLista ? r.lista : null },
      mostrarLista: q.mostrarLista, imagenPermitida: q.imagenAlumnos,
      propio: { aciertos: it.aciertos, total: q.preguntas.length },
    };
  }
  const p = preguntaActual(q, it, Date.now());
  if (!p) return { ...base, fase: 'esperando' };
  return { ...base, fase: 'pregunta', pregunta: p };
}

function alumnoResponder(d) {
  const { q, it } = buscarAlumno(d.token);
  if (!q) return { error: 'Tu intento ya no existe.' };
  const ahora = Date.now();
  avanzar(q, it, ahora);
  // Si ya pasó a otra pregunta (se acabó el tiempo), la respuesta llegó tarde y no cuenta.
  if (it.terminado || Number(d.numero) !== it.pos + 1 || it.inicio === null) return { ok: false, tarde: true };
  const opcion = Number(d.opcion);
  if (![0, 1, 2].includes(opcion)) return { error: 'Respuesta no válida.' };
  const idx = it.orden[it.pos];
  const elegida = it.permutaciones[idx][opcion];
  const ok = elegida === q.preguntas[idx].correcta;
  it.respuestas[idx] = { elegida, ok };
  if (ok) it.aciertos++;
  siguiente(q, it);
  return { ok: true };
}

// ---------------------------------------------------------------- API de profesores
function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function profeEntrar(d, req) {
  const ip = ipDe(req);
  const f = fallosLogin.get(ip);
  if (f && f.n >= 10) return { error: 'Demasiados intentos fallidos. Espera 10 minutos.' };
  if (!CLAVES.porCurso.size) return { error: 'Todavía no hay contraseñas configuradas (falta CLAVES_CURSOS en Render).' };
  const clave = normalizar(d.clave || '');
  let curso = 0;
  for (const [num, c] of CLAVES.porCurso) if (clave && c === clave) curso = num;
  if (!curso) {
    if (f) f.n++; else fallosLogin.set(ip, { n: 1, desde: Date.now() });
    return { error: 'Contraseña incorrecta.' };
  }
  const t = token();
  sesiones.set(t, { curso, creada: Date.now() });
  return { sesion: t };
}

function profeEstado(curso) {
  const q = quizzes.get(quizDeCurso.get(curso));
  const r = { curso: CURSOS[curso - 1], numCurso: curso, minPreguntas: MIN_PREGUNTAS, maxPreguntas: MAX_PREGUNTAS, segundosMin: SEGUNDOS_MIN,
    segundosMax: SEGUNDOS_MAX, segundosPorDefecto: SEGUNDOS_POR_DEFECTO, quiz: null,
    tablonMinutos: TABLON_MINUTOS, tablonAlargar: TABLON_ALARGAR_MIN, tablon: tablonParaProfe(curso) };
  if (!q) return r;
  const ahora = Date.now();
  const participantes = [...q.intentos.values()].map((it) => {
    avanzar(q, it, ahora);
    return {
      id: it.id, nombre: it.nombre, casa: it.casa, aciertos: it.aciertos,
      respondidas: it.terminado ? q.preguntas.length : it.pos, terminado: it.terminado,
    };
  });
  const borraEn = q.publicado ? q.publicado + BORRAR_TRAS_PUBLICAR_MS : q.creado + BORRAR_SIN_PUBLICAR_MS;
  r.quiz = {
    codigo: q.codigo, estado: q.estado, segundos: q.segundos, preguntas: q.preguntas,
    participantes, maxAlumnos: MAX_ALUMNOS, maxPorCasa: MAX_POR_CASA,
    modo: q.modo, mostrarLista: q.mostrarLista, imagenAlumnos: q.imagenAlumnos,
    borraEnMs: Math.max(0, borraEn - ahora),
    resultados: q.publicado ? resultados(q) : null,
  };
  return r;
}

function profeAbrir(curso, d) {
  const v = validarPreguntas(d.preguntas);
  if (v.error) return v;
  const segundos = entero(d.segundos, SEGUNDOS_POR_DEFECTO, SEGUNDOS_MIN, SEGUNDOS_MAX);
  const anterior = quizDeCurso.get(curso);
  if (anterior) borrarQuiz(anterior);                 // un solo quiz activo por curso: el nuevo reemplaza al viejo
  const q = {
    codigo: nuevoCodigo(), curso, preguntas: v.preguntas, segundos,
    estado: 'abierto', creado: Date.now(), publicado: null,
    modo: 'promedio', mostrarLista: false, imagenAlumnos: false,   // promedio por defecto: es lo más justo
    intentos: new Map(), nombres: new Map(),
  };
  quizzes.set(q.codigo, q);
  quizDeCurso.set(curso, q.codigo);
  return { ok: true, codigo: q.codigo };
}

function quizDelProfe(curso) {
  return quizzes.get(quizDeCurso.get(curso));
}

function profePublicar(curso) {
  const q = quizDelProfe(curso);
  if (!q) return { error: 'No hay ningún quiz abierto.' };
  if (q.publicado) return { ok: true };
  q.estado = 'publicado';
  q.publicado = Date.now();
  for (const it of q.intentos.values()) it.terminado = true;   // lo que quedó sin responder cuenta como fallo
  return { ok: true };
}

function profeAjustes(curso, d) {
  const q = quizDelProfe(curso);
  if (!q) return { error: 'No hay ningún quiz abierto.' };
  if (d.modo === 'suma' || d.modo === 'promedio') q.modo = d.modo;
  if (typeof d.mostrarLista === 'boolean') q.mostrarLista = d.mostrarLista;
  if (typeof d.imagenAlumnos === 'boolean') q.imagenAlumnos = d.imagenAlumnos;
  return { ok: true };
}

function profeBorrarIntento(curso, d) {
  const q = quizDelProfe(curso);
  if (!q) return { error: 'No hay ningún quiz abierto.' };
  const it = q.intentos.get(Number(d.id));
  if (!it) return { error: 'Ese intento ya no existe.' };
  q.intentos.delete(it.id);
  q.nombres.delete(it.norm);
  alumnos.delete(it.token);
  return { ok: true };
}

function profeBorrarQuiz(curso) {
  const q = quizDelProfe(curso);
  if (q) borrarQuiz(q.codigo);
  return { ok: true };
}

// ---------------------------------------------------------------- Tablón de tareas
// Cada curso puede tener un tablón activo (aparte de su quiz). Los alumnos suben UNA foto cuadrada de su tarea;
// todos ven el tablón; el profesor puede quitar fotos. Al acabar el tiempo se borra todo (fotos incluidas).
function borrarTablon(codigo) {
  const t = tablones.get(codigo);
  if (!t) return;
  for (const p of t.participantes.values()) {
    if (p.foto) bytesFotos -= p.foto.length;
    alumnos.delete(p.token);
  }
  tablones.delete(codigo);
  if (tablonDeCurso.get(t.curso) === codigo) tablonDeCurso.delete(t.curso);
}
function tablonVivo(codigo) {
  const t = tablones.get(codigo);
  if (!t) return null;
  if (Date.now() >= t.expira) { borrarTablon(codigo); return null; }
  return t;
}
setInterval(() => { for (const c of [...tablones.keys()]) tablonVivo(c); },
  Math.max(200, Math.min(15000, MINUTO_TABLON_MS / 2))).unref();

function tablonEntrar(t, d) {
  const v = validarAlumno(d);
  if (v.error) return v;
  if (t.nombres.has(v.norm)) return { error: 'Ese nombre ya está en el tablón. Si es un error, pídele al profesor que lo quite.' };
  const motivo = lleno([...t.participantes.values()], v.casa);
  if (motivo) return { error: motivo };
  const p = { id: ++ultimoIntento, token: token(), nombre: v.nombre, norm: v.norm, casa: v.casa, foto: null, fotoId: null, subida: null };
  t.participantes.set(p.id, p);
  t.nombres.set(p.norm, p.id);
  alumnos.set(p.token, { codigo: t.codigo, id: p.id, tipo: 'tablon' });
  return { token: p.token, codigo: t.codigo, tipo: 'tablon' };
}

function buscarEnTablon(tk) {
  const ref = alumnos.get(String(tk || ''));
  if (!ref || ref.tipo !== 'tablon') return {};
  const t = tablonVivo(ref.codigo);
  const p = t && t.participantes.get(ref.id);
  return p ? { t, p } : {};
}

const urlFoto = (t, p) => `/foto/${t.codigo}/${p.fotoId}`;
// Las fotos, en el orden en que se subieron por primera vez (como se van clavando en el corcho).
function fotosDe(t, conId) {
  return [...t.participantes.values()].filter((p) => p.foto).sort((a, b) => a.subida - b.subida)
    .map((p) => ({ id: p.id, nombre: p.nombre, casa: p.casa, url: urlFoto(t, p), ...(conId === p.id ? { propia: true } : {}) }));
}

function tablonEstadoAlumno(tk) {
  const { t, p } = buscarEnTablon(tk);
  if (!t) return { fase: 'no-existe' };
  return {
    fase: 'tablon', tipo: 'tablon', curso: CURSOS[t.curso - 1], numCurso: t.curso, codigo: t.codigo,
    nombre: p.nombre, casa: p.casa, restanteMs: Math.max(0, t.expira - Date.now()),
    propia: p.foto ? urlFoto(t, p) : null,
    fotos: fotosDe(t, p.id), participantes: t.participantes.size,
  };
}

// Recibe la foto ya hecha cuadrada y comprimida por el celular (JPEG en base64).
function tablonSubir(d) {
  if (d.demasiado) return { error: 'La foto es demasiado grande.' };
  const { t, p } = buscarEnTablon(d.token);
  if (!t) return { error: 'El tablón ya se cerró.' };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(d.imagen || ''));
  if (!m) return { error: 'No se pudo leer la foto. Prueba con otra.' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return { error: 'Eso no parece una foto. Prueba con otra.' };
  if (buf.length > MAX_FOTO_BYTES) return { error: 'La foto es demasiado grande.' };
  const antes = p.foto ? p.foto.length : 0;
  if (bytesFotos - antes + buf.length > MAX_FOTOS_BYTES) return { error: 'Ahora mismo hay demasiadas fotos en los tablones. Prueba en unos minutos.' };
  bytesFotos += buf.length - antes;
  p.foto = buf;
  p.fotoId = token();                 // dirección nueva en cada cambio: así nadie ve la foto vieja guardada
  if (!p.subida) p.subida = Date.now();
  return { ok: true, url: urlFoto(t, p) };
}

function tablonQuitar(d) {
  const { t, p } = buscarEnTablon(d.token);
  if (!t) return { error: 'El tablón ya se cerró.' };
  if (p.foto) bytesFotos -= p.foto.length;
  p.foto = null; p.fotoId = null; p.subida = null;
  return { ok: true };
}

function verFoto(codigo, fotoId) {
  const t = tablonVivo(codigo);
  if (!t || !fotoId) return null;
  for (const p of t.participantes.values()) if (p.fotoId === fotoId && p.foto) return p.foto;
  return null;
}

function tablonDelProfe(curso) {
  const c = tablonDeCurso.get(curso);
  return c ? tablonVivo(c) : null;
}

function tablonParaProfe(curso) {
  const t = tablonDelProfe(curso);
  if (!t) return null;
  const lista = [...t.participantes.values()];
  return {
    codigo: t.codigo, minutos: t.minutos, restanteMs: Math.max(0, t.expira - Date.now()),
    puedeAlargar: t.expira + TABLON_ALARGAR_MIN * MINUTO_TABLON_MS <= t.creado + TABLON_MAX_MIN * MINUTO_TABLON_MS,
    fotos: fotosDe(t),
    sinFoto: lista.filter((p) => !p.foto).map((p) => ({ id: p.id, nombre: p.nombre, casa: p.casa })),
    participantes: lista.length, maxAlumnos: MAX_ALUMNOS,
  };
}

function profeTablonAbrir(curso, d) {
  const minutos = TABLON_MINUTOS.includes(Number(d.minutos)) ? Number(d.minutos) : TABLON_MINUTOS[0];
  const anterior = tablonDeCurso.get(curso);
  if (anterior) borrarTablon(anterior);               // un solo tablón por curso: el nuevo reemplaza al viejo
  const ahora = Date.now();
  const t = { codigo: nuevoCodigo(), curso, minutos, creado: ahora, expira: ahora + minutos * MINUTO_TABLON_MS,
    participantes: new Map(), nombres: new Map() };
  tablones.set(t.codigo, t);
  tablonDeCurso.set(curso, t.codigo);
  return { ok: true, codigo: t.codigo };
}

function profeTablonAlargar(curso) {
  const t = tablonDelProfe(curso);
  if (!t) return { error: 'No hay ningún tablón abierto.' };
  const nueva = t.expira + TABLON_ALARGAR_MIN * MINUTO_TABLON_MS;
  if (nueva > t.creado + TABLON_MAX_MIN * MINUTO_TABLON_MS) return { error: `El tablón no puede durar más de ${TABLON_MAX_MIN} minutos.` };
  t.expira = nueva;
  return { ok: true };
}

function profeTablonQuitar(curso, d) {
  const t = tablonDelProfe(curso);
  if (!t) return { error: 'No hay ningún tablón abierto.' };
  const p = t.participantes.get(Number(d.id));
  if (!p) return { error: 'Ya no está en el tablón.' };
  if (p.foto) bytesFotos -= p.foto.length;
  t.participantes.delete(p.id);
  t.nombres.delete(p.norm);
  alumnos.delete(p.token);
  return { ok: true };
}

function profeTablonCerrar(curso) {
  const c = tablonDeCurso.get(curso);
  if (c) borrarTablon(c);
  return { ok: true };
}

// ---------------------------------------------------------------- Servidor HTTP
const PAGINA = path.join(__dirname, 'public', 'index.html');
// Archivos fijos que usa la página: los dibujitos y las tipografías (guardadas aquí, sin depender de nadie).
const ARCHIVOS = { '/dibujos.js': ['dibujos.js', 'text/javascript; charset=utf-8'] };
for (const f of fs.readdirSync(path.join(__dirname, 'public', 'fuentes'))) {
  if (f.endsWith('.woff2')) ARCHIVOS['/fuentes/' + f] = ['fuentes/' + f, 'font/woff2'];
}

function responder(res, codigo, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(cuerpo);
}

// Lee el JSON que manda la página. Si es más grande que el límite, no lo guarda y avisa con { demasiado: true }.
function leerCuerpo(req, limite) {
  return new Promise((ok) => {
    let datos = '';
    let demasiado = false;
    req.on('data', (c) => {
      if (demasiado) return;
      datos += c;
      if (datos.length > limite) { demasiado = true; datos = ''; }
    });
    req.on('end', () => {
      if (demasiado) return ok({ demasiado: true });
      try { ok(JSON.parse(datos || '{}')); } catch { ok({}); }
    });
    req.on('error', () => ok({}));
  });
}

const RUTAS_ALUMNO = {
  '/api/alumno/entrar': alumnoEntrar,
  '/api/alumno/estado': alumnoEstado,
  '/api/alumno/responder': alumnoResponder,
  '/api/tablon/subir': tablonSubir,
  '/api/tablon/quitar': tablonQuitar,
};
const RUTAS_PROFE = {
  '/api/profe/estado': (curso) => profeEstado(curso),
  '/api/profe/abrir': profeAbrir,
  '/api/profe/publicar': profePublicar,
  '/api/profe/ajustes': profeAjustes,
  '/api/profe/borrar-intento': profeBorrarIntento,
  '/api/profe/borrar-quiz': profeBorrarQuiz,
  '/api/profe/tablon-abrir': profeTablonAbrir,
  '/api/profe/tablon-alargar': profeTablonAlargar,
  '/api/profe/tablon-quitar': profeTablonQuitar,
  '/api/profe/tablon-cerrar': profeTablonCerrar,
};

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      fs.createReadStream(PAGINA).pipe(res);
      return;
    }
    if (req.method === 'GET' && ARCHIVOS[url]) {
      const [archivo, tipo] = ARCHIVOS[url];
      res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': archivo.endsWith('.woff2') ? 'public, max-age=604800' : 'no-cache' });
      fs.createReadStream(path.join(__dirname, 'public', archivo)).pipe(res);
      return;
    }
    if (req.method === 'GET' && url.startsWith('/foto/')) {
      const [, , codigo, fotoId] = url.split('/');
      const foto = verFoto(codigo, fotoId);
      if (!foto) return responder(res, 404, { error: 'Esta foto ya no existe' });
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': foto.length, 'Cache-Control': 'private, max-age=3600' });
      return res.end(foto);
    }
    if (url === '/salud') {
      return responder(res, 200, { ok: true, cursosConfigurados: CLAVES.porCurso.size, quizzesAbiertos: quizzes.size,
        tablonesAbiertos: tablones.size, fotosKB: Math.round(bytesFotos / 1024) });
    }
    if (req.method !== 'POST') return responder(res, 404, { error: 'No encontrado' });
    const d = await leerCuerpo(req, url === '/api/tablon/subir' ? Math.ceil(MAX_FOTO_BYTES * 1.4) + 2000 : 200000);
    if (url === '/api/profe/entrar') return responder(res, 200, profeEntrar(d, req));
    if (RUTAS_ALUMNO[url]) return responder(res, 200, RUTAS_ALUMNO[url](d));
    if (RUTAS_PROFE[url]) {
      const s = sesiones.get(String(req.headers['x-sesion'] || ''));
      if (!s) return responder(res, 401, { error: 'Tu sesión terminó. Vuelve a escribir la contraseña.' });
      return responder(res, 200, RUTAS_PROFE[url](s.curso, d));
    }
    responder(res, 404, { error: 'No encontrado' });
  } catch (e) {
    console.error(e);
    responder(res, 500, { error: 'Error en el servidor. Prueba otra vez.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Quiz de clases listo en el puerto ${PORT} (de ${MIN_PREGUNTAS} a ${MAX_PREGUNTAS} preguntas por quiz).`);
});
