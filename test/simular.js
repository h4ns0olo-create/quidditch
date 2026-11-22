'use strict';
// Pruebas automáticas con clientes simulados.
// Arranca sus propios servidores con los tiempos acortados (un "minuto" de partido dura 10 s o 0,4 s,
// la reserva 2 s, la bludger 1,5 s) y comprueba las reglas del juego de principio a fin.
// Uso: npm test   (tarda unos 2-3 minutos)

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const RESERVA_MS = 2000;
const BLUDGER_MS = 1500;
const CLAVE = 'prueba123';
let URL = '';

let fallos = 0;
function comprobar(cond, texto) {
  console.log(`${cond ? '  ✔' : '  ✘ FALLO:'} ${texto}`);
  if (!cond) fallos++;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

class Cliente {
  constructor(nombre) { this.nombre = nombre; this.mensajes = []; this.esperas = []; this.estado = null; }
  abrir() {
    return new Promise((ok, mal) => {
      this.ws = new WebSocket(URL);
      this.ws.on('open', ok);
      this.ws.on('error', mal);
      this.ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        if (m.t === 'estado') this.estado = m.sala;
        if (m.t === 'bienvenida') { this.token = m.token; this.id = m.yo; }
        this.mensajes.push(m);
        this.esperas = this.esperas.filter((w) => !(w.f(m) && (w.ok(m), true)));
      });
    });
  }
  mandar(m) { this.ws.send(JSON.stringify(m)); }
  recibir(f, ms = 3000) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error(`${this.nombre}: tiempo agotado esperando mensaje`)), ms);
      this.esperas.push({ f, ok: (m) => { clearTimeout(t); ok(m); } });
    });
  }
  async entrar(codigo, casa, nombre = this.nombre) {
    const r = this.recibir((m) => m.t === 'bienvenida' || m.t === 'error');
    this.mandar({ t: 'entrar', nombre, casa, codigo });
    return r;
  }
  async error(msg) { // manda algo y espera el error que provoca
    const r = this.recibir((m) => m.t === 'error');
    this.mandar(msg);
    return r;
  }
  cerrar() { this.ws.terminate(); }
}

// Resuelve un reto como lo haría una persona.
//  'centro': toca en el centro de la zona en la primera pasada · 'tarde': en el centro, pero una vuelta después
//  'fuera': fuera de la zona · 'imposible': dice un tiempo que no pudo pasar · 'nada': no toca
async function jugar(cliente, modo, promesaReto) {
  const { reto } = await promesaReto;
  if (modo === 'nada') return reto;
  if (modo === 'imposible') { cliente.mandar({ t: 'tap', reto: reto.id, ms: 4000 }); return reto; }
  const centro = (reto.zonaIni + reto.zonaFin) / 2;
  const pos = modo === 'fuera' ? reto.zonaIni - 0.12 : centro;
  const ms = Math.round(pos * reto.periodo / 2) + (modo === 'tarde' ? reto.periodo : 0);
  await esperar(Math.max(0, ms - reto.desde) + 30);
  cliente.mandar({ t: 'tap', reto: reto.id, ms });
  return reto;
}
const esperaReto = (c, ms = 4000) => c.recibir((m) => m.t === 'reto', ms);
// Espera hasta que se cumpla una condición (revisándola cada 50 ms).
async function hasta(fn, ms, texto = 'condición') {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (fn()) return true; await esperar(50); }
  throw new Error(`tiempo agotado esperando: ${texto}`);
}

function arrancarServidor(puerto, minutoMs) {
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(puerto), RESERVA_MS: String(RESERVA_MS), BLUDGER_ESPERA_MS: String(BLUDGER_MS),
      MINUTO_MS: String(minutoMs), INICIO_MS: '300', ADMIN_PASSWORD: CLAVE },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((ok) => servidor.stdout.on('data', (d) => d.toString().includes('listo') && ok(servidor)));
}

async function main() {
  const servidor = await arrancarServidor(3999, 10000); // 1 minuto de partido = 10 s
  URL = 'ws://127.0.0.1:3999';
  const todos = [];
  const nuevo = async (n) => { const c = new Cliente(n); await c.abrir(); todos.push(c); return c; };
  let servidor2 = null;

  try {
    console.log('\n1) Crear sala');
    const creador = await nuevo('creador');
    comprobar((await creador.error({ t: 'crear_sala', clave: 'mala', codigo: 'FIESTA', equipoA: 'Slytherin', equipoB: 'Gryffindor' })).msg.includes('incorrecta'), 'contraseña incorrecta rechazada');
    comprobar((await creador.error({ t: 'crear_sala', clave: CLAVE, codigo: 'FIESTA', equipoA: 'Slytherin', equipoB: 'Slytherin' })).msg.includes('distintas'), 'no se permiten dos equipos de la misma casa');
    creador.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'fiesta', equipoA: 'Slytherin', equipoB: 'Gryffindor' });
    const creada = await creador.recibir((m) => m.t === 'sala_creada');
    comprobar(creada.codigo === 'FIESTA' && creada.equipos.A === 'Slytherin', 'sala FIESTA creada: Slytherin contra Gryffindor');

    console.log('\n2) Entrada: casa o Invitado');
    const raven = await nuevo('Raven');
    const rR = await raven.entrar('FIESTA', 'Ravenclaw');
    comprobar(rR.t === 'error' && rR.codigo === 'casa_no_juega', `una casa que no juega es rechazada: "${rR.msg}"`);
    const S = [], G = [], I = [];
    for (let i = 1; i <= 7; i++) { const c = await nuevo(`Serpiente${i}`); await c.entrar('FIESTA', 'Slytherin'); S.push(c); }
    for (let i = 1; i <= 7; i++) { const c = await nuevo(`Leon${i}`); await c.entrar('FIESTA', 'Gryffindor'); G.push(c); }
    for (let i = 1; i <= 6; i++) { const c = await nuevo(`Invitado${i}`); await c.entrar('FIESTA', 'Invitado'); I.push(c); }
    await esperar(200);
    comprobar(S[0].estado.participantes.length === 20, 'entran 20 participantes (7 + 7 + 6 invitados)');
    comprobar(S[0].estado.participantes.find((p) => p.id === S[0].id).equipo === 'A', 'quien entra con Slytherin queda en su equipo');
    const extra = await nuevo('Extra');
    const r21 = await extra.entrar('FIESTA', 'Invitado');
    comprobar(r21.t === 'error' && r21.codigo === 'sala_llena', 'el 21.º es rechazado (sala llena)');

    console.log('\n3) Posiciones: solo de tu equipo y sin cambiar');
    comprobar((await S[0].error({ t: 'elegir_plaza', plaza: 'B-cazador1' })).codigo === 'otro_equipo', 'un Slytherin no puede elegir una posición de Gryffindor');
    comprobar((await I[0].error({ t: 'elegir_plaza', plaza: 'A-cazador1' })).msg.includes('Invitado'), 'un invitado no puede elegir posición de jugador');
    comprobar((await S[0].error({ t: 'ser_invitado', tipo: 'prefecto' })).msg.includes('Slytherin'), 'un jugador no puede hacerse invitado');
    const eA = S[0].recibir((m) => m.t === 'error' || (m.t === 'estado' && m.sala.plazas['A-cazador1']));
    const eB = S[1].recibir((m) => m.t === 'error' || (m.t === 'estado' && m.sala.plazas['A-cazador1']));
    S[0].mandar({ t: 'elegir_plaza', plaza: 'A-cazador1' });
    S[1].mandar({ t: 'elegir_plaza', plaza: 'A-cazador1' });
    await Promise.all([eA, eB]);
    await esperar(200);
    const perdedor = [S[0], S[1]].find((c) => c.mensajes.some((m) => m.codigo === 'plaza_ocupada'));
    comprobar(!!perdedor && [S[0].id, S[1].id].includes(S[0].estado.plazas['A-cazador1']), 'dos piden la misma plaza a la vez: solo uno la consigue');
    const ganadorPlaza = perdedor === S[0] ? S[1] : S[0];
    comprobar((await ganadorPlaza.error({ t: 'elegir_plaza', plaza: 'A-cazador3' })).codigo === 'ya_elegiste', 'quien ya eligió no puede cambiar de posición');
    const ids = ['cazador1', 'cazador2', 'cazador3', 'golpeador1', 'golpeador2', 'guardian', 'buscador'];
    const restoS = S.filter((c) => c !== ganadorPlaza);
    ids.slice(1).forEach((id, i) => restoS[i].mandar({ t: 'elegir_plaza', plaza: `A-${id}` }));
    ids.forEach((id, i) => G[i].mandar({ t: 'elegir_plaza', plaza: `B-${id}` }));
    await esperar(400);
    comprobar(Object.values(S[0].estado.plazas).filter((v) => typeof v === 'string').length === 14, 'las 14 plazas quedan ocupadas');

    console.log('\n4) Invitados: 2 comentaristas (uno por equipo) y administración con contraseña');
    I[0].mandar({ t: 'ser_invitado', tipo: 'comentaristaA' });
    await esperar(100);
    comprobar((await I[1].error({ t: 'ser_invitado', tipo: 'comentaristaA' })).codigo === 'papel_ocupado', 'no puede haber dos comentaristas del mismo equipo');
    I[1].mandar({ t: 'ser_invitado', tipo: 'comentaristaB' });
    await esperar(100);
    comprobar((await I[2].error({ t: 'ser_invitado', tipo: 'administracion', clave: 'mala' })).codigo === 'clave_mala', 'Administración pide la contraseña');
    I[2].mandar({ t: 'ser_invitado', tipo: 'administracion', clave: CLAVE });
    I[3].mandar({ t: 'ser_invitado', tipo: 'prefecto' });
    await esperar(150);
    comprobar((await I[3].error({ t: 'ser_invitado', tipo: 'administracion', clave: CLAVE })).codigo === 'ya_elegiste', 'un invitado tampoco puede cambiar de papel');
    const admin = I[2], obs = I[0];
    comprobar(Array.isArray(obs.estado.log) && S[0].estado.log === null, 'los invitados ven el registro; los jugadores no');

    console.log('\n5) Salir libera al instante; nombre repetido');
    I[5].mandar({ t: 'salir' });
    await I[5].recibir((m) => m.t === 'fuera');
    const dup = await nuevo('dup');
    comprobar((await dup.entrar('FIESTA', 'Invitado', ' serpiente1 ')).codigo === 'nombre_repetido', 'no se permite "serpiente1" si ya existe "Serpiente1"');
    comprobar((await dup.entrar('FIESTA', 'Invitado', 'León2')).codigo === 'nombre_repetido', 'tampoco "León2" (tilde) si existe "Leon2"');

    console.log('\n6) Reconexión y reserva de 1 minuto (2 s en la prueba)');
    const plazaDe = (c) => obs.estado.participantes.find((p) => p.id === c.id)?.plaza;
    let guardB = G[5];
    const token = guardB.token;
    guardB.cerrar();
    await esperar(300);
    comprobar(obs.estado.participantes.find((p) => p.id === guardB.id).conectado === false, 'aparece como desconectado');
    const vuelve = await nuevo('vuelve');
    vuelve.mandar({ t: 'reconectar', token });
    comprobar((await vuelve.recibir((m) => m.t === 'bienvenida')).yo === guardB.id, 'al volver recupera su sesión');
    await esperar(150);
    comprobar(vuelve.estado.plazas['B-guardian'] === guardB.id, 'y su plaza de guardián');
    vuelve.id = guardB.id; G[5] = vuelve; guardB = vuelve;
    const seVa = G[4]; // golpeador 2 de Gryffindor
    const tokenViejo = seVa.token;
    seVa.cerrar();
    await esperar(RESERVA_MS + 500);
    comprobar(obs.estado.plazas['B-golpeador2'] === null && !obs.estado.participantes.some((p) => p.id === seVa.id), 'pasado el tiempo, su plaza queda libre y sale de la sala');
    const tarde = await nuevo('tarde');
    tarde.mandar({ t: 'reconectar', token: tokenViejo });
    comprobar((await tarde.recibir((m) => m.t === 'error')).codigo === 'token_invalido', 'su sesión ya no sirve');
    await tarde.entrar('FIESTA', 'Gryffindor', 'Nuevo');
    tarde.mandar({ t: 'elegir_plaza', plaza: 'B-golpeador2' });
    await esperar(200);
    comprobar(obs.estado.plazas['B-golpeador2'] === tarde.id, 'otra persona ocupa la plaza libre');
    G[4] = tarde;

    console.log('\n7) Empezar: solo administración; moneda al azar');
    comprobar((await S[0].error({ t: 'empezar', duracion: 10 })).msg.includes('administración'), 'un jugador no puede empezar el partido');
    comprobar((await S[0].error({ t: 'pasar', a: S[1].id })).msg.includes('todavía no empieza'), 'antes del partido no se puede jugar');
    admin.mandar({ t: 'empezar', duracion: 10 });
    await obs.recibir((m) => m.t === 'estado' && m.sala.fase === 'inicio');
    comprobar(true, 'fase de moneda');
    await obs.recibir((m) => m.t === 'estado' && m.sala.fase === 'partido', 3000);
    const moneda = obs.estado.partido.moneda;
    comprobar(obs.estado.pelota && obs.estado.pelota.equipo === moneda, `empieza con la quaffle el equipo de la moneda (${obs.estado.equipos[moneda]})`);
    comprobar(obs.estado.partido.duracionMs === 100000 && obs.estado.partido.snitchMs[0] === 50000, 'reloj de 10 "minutos" con snitch a la mitad');
    comprobar((await raven.entrar('FIESTA', 'Slytherin', 'Tardón')).codigo === 'partido_empezado', 'con el partido empezado, solo se entra como invitado');

    // Ayudas para jugar
    const vivos = () => [...S, ...G, guardB].filter((c) => c.ws.readyState === 1);
    const en = (plaza) => vivos().find((c) => plazaDe(c) === plaza);
    const pel = () => obs.estado.pelota;
    const log = (txt) => obs.estado.log.some((l) => l.texto.includes(txt));
    const portador = () => vivos().find((c) => c.id === pel().portador);
    const companero = (c) => { const eq = plazaDe(c)[0]; return ['cazador1', 'cazador2', 'cazador3'].map((x) => en(`${eq}-${x}`)).find((x) => x && x !== c); };
    const guardianRival = (c) => en(`${plazaDe(c)[0] === 'A' ? 'B' : 'A'}-guardian`);
    async function pase(modo) {
      const p = portador(), comp = companero(p);
      const pr = esperaReto(p);
      p.mandar({ t: 'pasar', a: comp.id });
      const r = await jugar(p, modo, pr);
      await esperar(150);
      return { p, comp, r };
    }
    async function tiro(modoTirador, modoGuardian) {
      const p = portador(), g = guardianRival(p);
      const pT = esperaReto(p), pG = esperaReto(g);
      const t0 = Date.now();
      p.mandar({ t: 'tirar' });
      const [rt, rg] = await Promise.all([jugar(p, modoTirador, pT), jugar(g, modoGuardian, pG)]);
      await hasta(() => !obs.estado.enJuego, 9000, 'fin del tiro');
      return { rt, rg, dur: Date.now() - t0, equipo: plazaDe(p)[0] };
    }

    console.log('\n8) Pases y tiro: gana quien acierta primero');
    let { r } = await pase('centro');
    comprobar(r.visual === 'barra' && obs.estado.pasesBuenos === 1, 'pase bueno con la barra (1 de 2)');
    comprobar((await portador().error({ t: 'tirar' })).msg.includes('Todavía no'), 'con 1 pase todavía no se puede lanzar');
    await pase('centro');
    comprobar(obs.estado.pasesBuenos === 2, 'segundo pase bueno: ya se puede lanzar');
    let t = await tiro('centro', 'tarde');
    comprobar(t.rt.visual === 'barra' && t.rg.visual === 'aguja', 'cazador con barra y guardián con aguja');
    comprobar(t.rt.zonaIni === t.rg.zonaIni && t.rt.periodo === t.rg.periodo, 'los dos tienen la misma zona y velocidad (justo)');
    comprobar(obs.estado.marcador[t.equipo] === 10 && log('GOOOL'), 'el cazador acierta ANTES que el guardián: ¡gol!');
    comprobar(pel().equipo !== t.equipo, 'tras el gol, la quaffle pasa al otro equipo');
    await pase('centro'); await pase('centro');
    t = await tiro('tarde', 'centro');
    comprobar(obs.estado.marcador[t.equipo] === 0 && log('ataja'), 'el guardián ataja ANTES de que el cazador lance: atajada (aunque el tiro fuera bueno)');
    comprobar(pel().equipo !== t.equipo, 'tras la atajada, la quaffle pasa al otro equipo');
    await pase('centro'); await pase('centro');
    const antes = { ...obs.estado.marcador };
    t = await tiro('centro', 'nada');
    comprobar(obs.estado.marcador[t.equipo] === antes[t.equipo] + 10 && t.dur < 3500, `si el guardián no reacciona, es gol sin esperar los 6 s (${(t.dur / 1000).toFixed(1)} s)`);

    console.log('\n9) Pérdidas de la quaffle');
    let eq0 = pel().equipo;
    await pase('imposible');
    comprobar(pel().equipo !== eq0 && log('tiempo no válido'), 'tiempo imposible = pase fallido, la quaffle cambia de equipo');
    eq0 = pel().equipo;
    await pase('fuera');
    comprobar(pel().equipo !== eq0 && log('fuera de la zona'), 'tocar fuera de la zona = pase fallido');
    eq0 = pel().equipo;
    await obs.recibir((m) => m.t === 'estado' && m.sala.pelota && m.sala.pelota.equipo !== eq0, 12000);
    comprobar(log('tardó demasiado'), 'si quien tiene la quaffle no pasa ni lanza en 10 s, la pierde');

    console.log('\n10) Bludgers');
    const atacado = pel().equipo, atacante = atacado === 'A' ? 'B' : 'A';
    const g1 = en(`${atacante}-golpeador1`), g2 = en(`${atacante}-golpeador2`);
    const d1 = en(`${atacado}-golpeador1`), d2 = en(`${atacado}-golpeador2`);
    comprobar((await d1.error({ t: 'bludger' })).msg.includes('rival'), 'no puedes lanzarla si tu equipo tiene la quaffle');
    let pB = esperaReto(g1), pR1 = esperaReto(d1), pR2 = esperaReto(d2);
    g1.mandar({ t: 'bludger' });
    r = await jugar(g1, 'centro', pB);
    comprobar(r.visual === 'circulo', 'el golpeador batea con el círculo');
    await Promise.all([jugar(d1, 'centro', pR1), jugar(d2, 'nada', pR2)]);
    await esperar(150);
    comprobar(log('repele') && pel().equipo === atacado, 'un golpeador la repele: conservan la quaffle');
    comprobar((await g2.error({ t: 'bludger' })).msg.includes('podrá lanzar otra'), 'hay que esperar entre bludgers del mismo equipo');
    await esperar(BLUDGER_MS + 100);
    pB = esperaReto(g2); pR1 = esperaReto(d1); pR2 = esperaReto(d2);
    g2.mandar({ t: 'bludger' });
    await jugar(g2, 'centro', pB);
    await Promise.all([jugar(d1, 'nada', pR1), jugar(d2, 'nada', pR2)]);
    await hasta(() => !obs.estado.enJuego, 6000, 'fin de la bludger');
    comprobar(log('golpea') && pel().equipo === atacante, 'nadie la repele: el cazador pierde la quaffle');

    console.log('\n11) Comentaristas');
    const llega = S[0].recibir((m) => m.t === 'comentario');
    obs.mandar({ t: 'comentar', texto: '¡Qué atajada increíble!' });
    const c = await llega;
    comprobar(c.texto === '¡Qué atajada increíble!' && c.casa === 'Slytherin', 'el comentario llega a los jugadores (con el color de su equipo)');
    comprobar((await obs.error({ t: 'comentar', texto: 'otro' })).msg.includes('Espera'), 'no se puede inundar con comentarios');
    comprobar((await S[0].error({ t: 'comentar', texto: 'hola' })).msg.includes('comentaristas'), 'un jugador no puede comentar');
    comprobar((await I[3].error({ t: 'comentar', texto: 'hola' })).msg.includes('comentaristas'), 'un prefecto tampoco');

    console.log('\n12) Snitch (aparece a la mitad: 50 s en la prueba)');
    const bA = en('A-buscador'), bB = en('B-buscador');
    await hasta(() => bA.mensajes.some((m) => m.t === 'snitch' && m.fase === 'espera'), 60000, 'aparición de la snitch');
    await esperar(100);
    comprobar(S.filter((x) => x !== bA).every((x) => !x.mensajes.some((m) => m.t === 'snitch')), 'solo los buscadores reciben la snitch');
    comprobar(S[0].estado.snitch === null && obs.estado.snitch && obs.estado.snitch.ronda === 1, 'los jugadores no ven la snitch; los invitados sí');
    // Ronda 1: el buscador A toca antes de la señal y la pierde.
    const ronda = bA.mensajes.filter((m) => m.t === 'snitch' && m.fase === 'espera').pop();
    let finRonda = bB.recibir((m) => m.t === 'snitch' && m.fase === 'ronda', 8000);
    bA.mandar({ t: 'snitch_tap', rondaId: ronda.rondaId, antes: true });
    let fr = await finRonda;
    comprobar(fr.ganador === 'B' && fr.victorias.B === 1, 'ronda 1: A toca antes de tiempo y gana B');
    // Ronda 2: los dos tocan tras la señal; A es más rápido.
    let senalA = bA.recibir((m) => m.t === 'snitch' && m.fase === 'senal', 10000);
    let senalB = bB.recibir((m) => m.t === 'snitch' && m.fase === 'senal', 10000);
    const [sA, sB] = await Promise.all([senalA, senalB]);
    finRonda = bA.recibir((m) => m.t === 'snitch' && m.fase === 'ronda', 5000);
    await esperar(450);
    bB.mandar({ t: 'snitch_tap', rondaId: sB.rondaId, ms: 420 });
    bA.mandar({ t: 'snitch_tap', rondaId: sA.rondaId, ms: 260 });
    fr = await finRonda;
    comprobar(fr.ganador === 'A', 'ronda 2: gana el que reaccionó antes (A, aunque su toque llegó después)');
    // Ronda 3: A toca, B no toca nada.
    senalA = bA.recibir((m) => m.t === 'snitch' && m.fase === 'senal', 10000);
    const s3 = await senalA;
    const finP = obs.recibir((m) => m.t === 'estado' && m.sala.fase === 'final', 6000);
    await esperar(350);
    const ganaAntes = obs.estado.marcador.A;
    bA.mandar({ t: 'snitch_tap', rondaId: s3.rondaId, ms: 300 });
    await finP;
    comprobar(obs.estado.marcador.A === ganaAntes + 150, 'ronda 3: A gana 2-1, atrapa la snitch y suma 150');
    comprobar(obs.estado.fase === 'final' && obs.estado.resultado.motivo === 'snitch', 'atrapar la snitch termina el partido');
    const res = obs.estado.resultado;
    comprobar(res.ganador === (res.marcador.A > res.marcador.B ? 'A' : 'B'), `gana quien tiene más puntos (${res.marcador.A} - ${res.marcador.B})`);
    const st = S[0].estado.stats;
    comprobar(Array.isArray(st) && st.length >= 14 && st.some((x) => x.goles > 0) && st.some((x) => x.snitch === 1), 'informe final con estadísticas de cada jugador');

    console.log('\n13) Nueva partida');
    comprobar((await S[0].error({ t: 'nueva_partida' })).msg.includes('administración'), 'solo la administración puede volver al lobby');
    admin.mandar({ t: 'nueva_partida' });
    await obs.recibir((m) => m.t === 'estado' && m.sala.fase === 'lobby');
    comprobar(obs.estado.marcador.A === 0 && Object.values(obs.estado.plazas).filter((v) => typeof v === 'string').length === 14, 'vuelve al lobby con el marcador a cero y las posiciones intactas');

    console.log('\n14) Fin por tiempo, empate y muerte súbita (otro servidor: 1 minuto = 0,4 s)');
    servidor2 = await arrancarServidor(3998, 400);
    URL = 'ws://127.0.0.1:3998';
    const ad2 = await nuevo('ad2');
    ad2.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'MUERTE', equipoA: 'Ravenclaw', equipoB: 'Hufflepuff' });
    await ad2.recibir((m) => m.t === 'sala_creada');
    ad2.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'VACIA', equipoA: 'Ravenclaw', equipoB: 'Hufflepuff' });
    await ad2.recibir((m) => m.t === 'sala_creada');
    const unir = async (n, sala, casa, plaza) => { const x = await nuevo(n); await x.entrar(sala, casa); x.mandar(plaza ? { t: 'elegir_plaza', plaza } : { t: 'ser_invitado', tipo: 'administracion', clave: CLAVE }); return x; };
    // Sala VACIA: sin buscadores. Empate a 0 -> muerte súbita sin buscadores -> empate.
    const ad3 = await unir('ad3', 'VACIA', 'Invitado');
    await unir('r1', 'VACIA', 'Ravenclaw', 'A-cazador1');
    await unir('h1', 'VACIA', 'Hufflepuff', 'B-cazador1');
    // Sala MUERTE: solo hay buscador en Ravenclaw.
    const ad4 = await unir('ad4', 'MUERTE', 'Invitado');
    await unir('r2', 'MUERTE', 'Ravenclaw', 'A-cazador1');
    const busc = await unir('rb', 'MUERTE', 'Ravenclaw', 'A-buscador');
    await unir('h2', 'MUERTE', 'Hufflepuff', 'B-cazador1');
    await esperar(200);
    ad3.mandar({ t: 'empezar', duracion: 10 });
    ad4.mandar({ t: 'empezar', duracion: 10 });
    await ad3.recibir((m) => m.t === 'estado' && m.sala.fase === 'final', 9000);
    comprobar(ad3.estado.resultado.ganador === null && ad3.estado.resultado.motivo === 'empate', 'empate sin buscadores: el partido termina en empate');
    // En la sala MUERTE el buscador toca antes de tiempo en las apariciones normales (nadie gana)...
    const tocarAntes = (m) => { if (m.t === 'snitch' && m.fase === 'espera' && !m.muerte) busc.mandar({ t: 'snitch_tap', rondaId: m.rondaId, antes: true }); };
    busc.ws.on('message', (d) => tocarAntes(JSON.parse(d.toString())));
    await ad4.recibir((m) => m.t === 'estado' && m.sala.fase === 'muerte', 40000);
    comprobar(ad4.estado.log.some((l) => l.texto.includes('Muerte súbita')), 'se acaba el tiempo con empate: muerte súbita');
    // ...y en la muerte súbita la atrapa.
    busc.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 'snitch' && m.fase === 'senal' && m.muerte) setTimeout(() => busc.mandar({ t: 'snitch_tap', rondaId: m.rondaId, ms: 280 }), 300);
    });
    await ad4.recibir((m) => m.t === 'estado' && m.sala.fase === 'final', 40000);
    comprobar(ad4.estado.resultado.ganador === 'A' && ad4.estado.marcador.A === 150, 'en la muerte súbita, quien atrapa la snitch gana');

    console.log('\n15) Página web');
    const html = await fetch('http://127.0.0.1:3999/').then((x) => x.text());
    comprobar(html.includes('Soy el administrador') && html.includes('<title>Quidditch</title>'), 'la página se sirve con el título "Quidditch"');
  } catch (e) {
    comprobar(false, e.message);
  } finally {
    for (const c of todos) c.cerrar();
    servidor.kill();
    if (servidor2) servidor2.kill();
  }
  console.log(fallos ? `\n❌ ${fallos} comprobación(es) fallaron.` : '\n✅ Todas las pruebas pasaron.');
  process.exit(fallos ? 1 : 0);
}

main();
