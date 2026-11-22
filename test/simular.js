'use strict';
// Pruebas automáticas con clientes simulados.
// Arranca su propio servidor (puerto 3999, reserva de 2 s en vez de 60 s para no esperar)
// y comprueba: límite de 20, nombres repetidos, plazas disputadas, reconexión,
// vencimiento de la reserva y la barra de pase (incluido rechazar tiempos imposibles).
// Uso: npm test

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PUERTO = 3999;
const RESERVA_MS = 2000;
const CLAVE = 'prueba123';
const URL = `ws://127.0.0.1:${PUERTO}`;
const CASAS = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];

let fallos = 0;
function comprobar(cond, texto) {
  console.log(`${cond ? '  ✔' : '  ✘ FALLO:'} ${texto}`);
  if (!cond) fallos++;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

class Cliente {
  constructor(nombre) {
    this.nombre = nombre;
    this.mensajes = [];
    this.esperas = [];
    this.estado = null;
  }
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
  // Espera el primer mensaje (nuevo o ya recibido desde "desde") que cumpla la condición.
  recibir(f, ms = 3000) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error(`${this.nombre}: tiempo agotado esperando mensaje`)), ms);
      this.esperas.push({ f, ok: (m) => { clearTimeout(t); ok(m); } });
    });
  }
  async entrar(codigo, nombre = this.nombre, casa = CASAS[0]) {
    const r = this.recibir((m) => m.t === 'bienvenida' || m.t === 'error');
    this.mandar({ t: 'entrar', nombre, casa, codigo });
    return r;
  }
  cerrar() { this.ws.terminate(); }
}

async function main() {
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PUERTO), RESERVA_MS: String(RESERVA_MS), ADMIN_PASSWORD: CLAVE },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok) => servidor.stdout.on('data', (d) => d.toString().includes('listo') && ok()));
  const todos = [];
  const nuevo = async (n) => { const c = new Cliente(n); await c.abrir(); todos.push(c); return c; };

  try {
    console.log('\n1) Crear sala');
    const admin = await nuevo('admin');
    admin.mandar({ t: 'crear_sala', clave: 'mala', codigo: 'FIESTA' });
    comprobar((await admin.recibir((m) => m.t === 'error')).msg.includes('incorrecta'), 'contraseña incorrecta rechazada');
    admin.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'fiesta' });
    comprobar((await admin.recibir((m) => m.t === 'sala_creada')).codigo === 'FIESTA', 'sala FIESTA creada');
    const sinSala = await nuevo('perdido');
    comprobar((await sinSala.entrar('NOEXISTE')).t === 'error', 'código de sala inexistente rechazado');

    console.log('\n2) Entran 20 participantes');
    const jug = [];
    for (let i = 1; i <= 20; i++) {
      const c = await nuevo(`Jugador${i}`);
      const r = await c.entrar('FIESTA', c.nombre, CASAS[i % 4]);
      if (r.t !== 'bienvenida') comprobar(false, `Jugador${i} debía entrar: ${r.msg}`);
      jug.push(c);
    }
    await esperar(200);
    comprobar(jug[0].estado.participantes.length === 20, 'hay 20 participantes en la sala');

    console.log('\n3) Sala llena');
    const extra = await nuevo('Extra');
    const r21 = await extra.entrar('FIESTA');
    comprobar(r21.t === 'error' && r21.codigo === 'sala_llena', `el 21.º es rechazado: "${r21.msg}"`);

    console.log('\n4) Plaza disputada: dos piden la misma a la vez');
    const a = jug[0], b = jug[1];
    const eA = a.recibir((m) => m.t === 'error' || (m.t === 'estado' && m.sala.plazas['A-cazador1']));
    const eB = b.recibir((m) => m.t === 'error' || (m.t === 'estado' && m.sala.plazas['A-cazador1']));
    a.mandar({ t: 'elegir_plaza', plaza: 'A-cazador1' });
    b.mandar({ t: 'elegir_plaza', plaza: 'A-cazador1' });
    await Promise.all([eA, eB]);
    await esperar(200);
    const errores = [a, b].filter((c) => c.mensajes.some((m) => m.codigo === 'plaza_ocupada')).length;
    const duena = a.estado.plazas['A-cazador1'];
    comprobar(errores === 1 && (duena === a.id || duena === b.id), 'solo uno consigue la plaza, el otro recibe "ocupada"');

    console.log('\n5) Llenar los dos equipos (14 plazas)');
    const plazas = ['A', 'B'].flatMap((e) => ['cazador1', 'cazador2', 'cazador3', 'golpeador1', 'golpeador2', 'guardian', 'buscador'].map((p) => `${e}-${p}`));
    const libres = plazas.filter((p) => p !== 'A-cazador1');
    const sinPlaza = jug.filter((c) => c.id !== duena);
    for (let i = 0; i < libres.length; i++) sinPlaza[i].mandar({ t: 'elegir_plaza', plaza: libres[i] });
    for (let i = libres.length; i < sinPlaza.length; i++) sinPlaza[i].mandar({ t: 'ser_invitado', tipo: 'comentarista' });
    await esperar(400);
    const ocupadas = Object.values(jug[0].estado.plazas).filter((v) => typeof v === 'string').length;
    comprobar(ocupadas === 14, `14 plazas ocupadas (hay ${ocupadas})`);

    console.log('\n6) Nombre repetido (tras liberar un hueco)');
    const comentarista = sinPlaza[sinPlaza.length - 1];
    comentarista.mandar({ t: 'salir' });
    await comentarista.recibir((m) => m.t === 'fuera');
    const dup = await nuevo('dup');
    const rDup = await dup.entrar('FIESTA', ' jugador1 ');
    comprobar(rDup.t === 'error' && rDup.codigo === 'nombre_repetido', 'no se permite "jugador1" si ya existe "Jugador1"');
    const rAcento = await dup.entrar('FIESTA', 'Jugadór2');
    comprobar(rAcento.t === 'error', 'tampoco "Jugadór2" (tilde) si existe "Jugador2"');

    console.log('\n7) Reconexión con token');
    const quien = jug.find((c) => c.estado && jug[0].estado.participantes.find((p) => p.id === c.id && p.plaza === 'B-guardian'));
    const token = quien.token;
    quien.cerrar();
    await esperar(300);
    comprobar(jug[0].estado.participantes.find((p) => p.id === quien.id).conectado === false, 'aparece como desconectado');
    const vuelve = await nuevo('vuelve');
    vuelve.mandar({ t: 'reconectar', token });
    const bien = await vuelve.recibir((m) => m.t === 'bienvenida');
    await esperar(200);
    comprobar(bien.yo === quien.id && vuelve.estado.plazas['B-guardian'] === quien.id, 'recupera su plaza de guardián');

    console.log(`\n8) Vencimiento de la reserva (${RESERVA_MS / 1000} s en la prueba, 60 s de verdad)`);
    const seVa = jug.find((c) => jug[0].estado.plazas['B-buscador'] === c.id);
    const tokenViejo = seVa.token;
    seVa.cerrar();
    await esperar(RESERVA_MS + 500);
    comprobar(jug[0].estado.plazas['B-buscador'] === null, 'la plaza de buscador queda libre');
    comprobar(!jug[0].estado.participantes.some((p) => p.id === seVa.id), 'el participante se borra de la sala');
    const tarde = await nuevo('tarde');
    tarde.mandar({ t: 'reconectar', token: tokenViejo });
    comprobar((await tarde.recibir((m) => m.t === 'error')).codigo === 'token_invalido', 'su token ya no sirve');
    const r2 = await tarde.entrar('FIESTA', 'Nuevo');
    comprobar(r2.t === 'bienvenida', 'otra persona puede entrar en su hueco');
    tarde.mandar({ t: 'elegir_plaza', plaza: 'B-buscador' });
    await esperar(200);
    comprobar(jug[0].estado.plazas['B-buscador'] === tarde.id, 'y ocupar la plaza libre');

    console.log('\n9) Barra de pase');
    const plazaDe = (c) => jug[0].estado.participantes.find((p) => p.id === c.id)?.plaza;
    const vivos = [...jug, vuelve].filter((c) => c.ws.readyState === 1);
    const caz = (eq, n) => vivos.find((c) => plazaDe(c) === `${eq}-cazador${n}`);
    const a1 = caz('A', 1), a2 = caz('A', 2), b1 = caz('B', 1);
    const noCaz = vivos.find((c) => plazaDe(c) === 'A-guardian');
    noCaz.mandar({ t: 'tomar_pelota' });
    comprobar((await noCaz.recibir((m) => m.t === 'error')).msg.includes('cazadores'), 'un guardián no puede tomar la pelota');
    a1.mandar({ t: 'tomar_pelota' });
    await esperar(150);
    comprobar(jug[0].estado.pelota?.portador === a1.id, 'el cazador A1 toma la pelota');

    // Pase bueno: tocar justo en el centro de la zona verde.
    let barraP = a1.recibir((m) => m.t === 'barra');
    a1.mandar({ t: 'pasar', a: a2.id });
    let { accion } = await barraP;
    const centro = (accion.zonaIni + accion.zonaFin) / 2;
    let ms = Math.round(centro * accion.periodo / 2); // la marca llega al centro en ida
    await esperar(ms + 50);
    a1.mandar({ t: 'tap', accion: accion.id, ms });
    await esperar(150);
    comprobar(jug[0].estado.pelota.portador === a2.id, `pase bueno (tap a ${ms} ms): ahora la tiene A2`);

    // Tiempo imposible: dice que tocó a los 4 s cuando solo pasaron unos ms.
    barraP = a2.recibir((m) => m.t === 'barra');
    a2.mandar({ t: 'pasar', a: a1.id });
    ({ accion } = await barraP);
    a2.mandar({ t: 'tap', accion: accion.id, ms: 4000 });
    await esperar(150);
    comprobar(jug[0].estado.pelota.equipo === 'B' && jug[0].estado.pelota.portador === b1.id,
      'tiempo imposible = pase fallido y la pelota pasa al Equipo B');
    comprobar(jug[0].estado.log.some((l) => l.texto.includes('tiempo no válido')), 'queda en el registro como "tiempo no válido"');

    // Fuera del verde
    const b2 = caz('B', 2);
    barraP = b1.recibir((m) => m.t === 'barra');
    b1.mandar({ t: 'pasar', a: b2.id });
    ({ accion } = await barraP);
    ms = Math.round((accion.zonaIni - 0.12) * accion.periodo / 2); // claramente antes del verde
    await esperar(ms + 50);
    b1.mandar({ t: 'tap', accion: accion.id, ms });
    await esperar(150);
    comprobar(jug[0].estado.pelota.equipo === 'A', 'tocar fuera del verde = pase fallido');

    // Sin tocar: vence el tiempo (6 s + margen de red)
    const port = vivos.find((c) => c.id === jug[0].estado.pelota.portador);
    const comp = caz('A', port === a1 ? 2 : 1);
    barraP = port.recibir((m) => m.t === 'barra');
    port.mandar({ t: 'pasar', a: comp.id });
    await barraP;
    await esperar(6000 + 1500 + 300);
    comprobar(jug[0].estado.pelota.equipo === 'B', 'si no toca en 6 s, cuenta como fallo');
    comprobar(jug[0].estado.log.some((l) => l.texto.includes('se acabó el tiempo')), 'registro: "se acabó el tiempo"');

    console.log('\n10) Página web');
    const html = await fetch(`http://127.0.0.1:${PUERTO}/`).then((r) => r.text());
    comprobar(html.includes('Quidditch entre amigos'), 'la página se sirve correctamente');
  } catch (e) {
    comprobar(false, e.message);
  } finally {
    for (const c of todos) c.cerrar();
    servidor.kill();
  }
  console.log(fallos ? `\n❌ ${fallos} comprobación(es) fallaron.` : '\n✅ Todas las pruebas pasaron.');
  process.exit(fallos ? 1 : 0);
}

main();
