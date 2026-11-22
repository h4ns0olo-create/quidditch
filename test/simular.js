'use strict';
// Pruebas automáticas con clientes simulados.
// Arranca su propio servidor (puerto 3999, reserva de 2 s en vez de 60 s y bludger cada 1,5 s para no esperar)
// y comprueba: límite de 20, nombres repetidos, plazas disputadas, reconexión, vencimiento de la reserva,
// pases, tiro y atajada, bludgers, comentarios y que los jugadores no vean el registro.
// Uso: npm test

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PUERTO = 3999;
const RESERVA_MS = 2000;
const BLUDGER_MS = 1500;
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

// Resuelve un reto como lo haría una persona: 'centro', 'desvio' (acierta pero lejos del centro),
// 'fuera' (fuera de la zona), 'imposible' (dice un tiempo que no pudo pasar) o 'nada' (no toca).
async function jugar(cliente, modo, promesaReto) {
  const { reto } = await promesaReto;
  if (modo === 'nada') return reto;
  if (modo === 'imposible') { cliente.mandar({ t: 'tap', reto: reto.id, ms: 4000 }); return reto; }
  const centro = (reto.zonaIni + reto.zonaFin) / 2;
  const pos = modo === 'centro' ? centro : modo === 'desvio' ? centro + 0.05 : reto.zonaIni - 0.12;
  const ms = Math.round(pos * reto.periodo / 2); // la marca va de 0 a 1 en medio periodo
  await esperar(Math.max(0, ms - reto.desde) + 30);
  cliente.mandar({ t: 'tap', reto: reto.id, ms });
  return reto;
}
const esperaReto = (c) => c.recibir((m) => m.t === 'reto', 4000);

async function main() {
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PUERTO), RESERVA_MS: String(RESERVA_MS), BLUDGER_ESPERA_MS: String(BLUDGER_MS), ADMIN_PASSWORD: CLAVE },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok) => servidor.stdout.on('data', (d) => d.toString().includes('listo') && ok()));
  const todos = [];
  const nuevo = async (n) => { const c = new Cliente(n); await c.abrir(); todos.push(c); return c; };

  try {
    console.log('\n1) Crear sala');
    const admin = await nuevo('admin');
    admin.mandar({ t: 'crear_sala', clave: 'mala', codigo: 'FIESTA', equipoA: 'Slytherin', equipoB: 'Gryffindor' });
    comprobar((await admin.recibir((m) => m.t === 'error')).msg.includes('incorrecta'), 'contraseña incorrecta rechazada');
    admin.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'FIESTA', equipoA: 'Slytherin', equipoB: 'Slytherin' });
    comprobar((await admin.recibir((m) => m.t === 'error')).msg.includes('distintas'), 'no se permiten dos equipos de la misma casa');
    admin.mandar({ t: 'crear_sala', clave: CLAVE, codigo: 'fiesta', equipoA: 'Slytherin', equipoB: 'Gryffindor' });
    const creada = await admin.recibir((m) => m.t === 'sala_creada');
    comprobar(creada.codigo === 'FIESTA' && creada.equipos.A === 'Slytherin' && creada.equipos.B === 'Gryffindor', 'sala FIESTA creada: Slytherin contra Gryffindor');
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

    console.log('\n5) Llenar los dos equipos (14 plazas) y 6 comentaristas');
    const plazas = ['A', 'B'].flatMap((e) => ['cazador1', 'cazador2', 'cazador3', 'golpeador1', 'golpeador2', 'guardian', 'buscador'].map((p) => `${e}-${p}`));
    const libres = plazas.filter((p) => p !== 'A-cazador1');
    const sinPlaza = jug.filter((c) => c.id !== duena);
    for (let i = 0; i < libres.length; i++) sinPlaza[i].mandar({ t: 'elegir_plaza', plaza: libres[i] });
    for (let i = libres.length; i < sinPlaza.length; i++) sinPlaza[i].mandar({ t: 'ser_invitado', tipo: 'comentarista' });
    await esperar(400);
    const ocupadas = Object.values(jug[0].estado.plazas).filter((v) => typeof v === 'string').length;
    comprobar(ocupadas === 14, `14 plazas ocupadas (hay ${ocupadas})`);
    const obs = sinPlaza[libres.length]; // un comentarista que observa el registro
    comprobar(Array.isArray(obs.estado.log) && obs.estado.log.length > 0, 'los invitados ven el registro de jugadas');
    comprobar(jug[0].estado.log === null, 'los jugadores NO reciben el registro de jugadas');

    console.log('\n6) Nombre repetido (tras liberar un hueco)');
    const seSale = sinPlaza[sinPlaza.length - 1];
    seSale.mandar({ t: 'salir' });
    await seSale.recibir((m) => m.t === 'fuera');
    const dup = await nuevo('dup');
    const rDup = await dup.entrar('FIESTA', ' jugador1 ');
    comprobar(rDup.t === 'error' && rDup.codigo === 'nombre_repetido', 'no se permite "jugador1" si ya existe "Jugador1"');
    const rAcento = await dup.entrar('FIESTA', 'Jugadór2');
    comprobar(rAcento.t === 'error', 'tampoco "Jugadór2" (tilde) si existe "Jugador2"');

    console.log('\n7) Reconexión con token');
    const plazaDe = (c) => obs.estado.participantes.find((p) => p.id === c.id)?.plaza;
    const quien = jug.find((c) => plazaDe(c) === 'B-guardian');
    const token = quien.token;
    quien.cerrar();
    await esperar(300);
    comprobar(obs.estado.participantes.find((p) => p.id === quien.id).conectado === false, 'aparece como desconectado');
    const guardB = await nuevo('vuelve');
    guardB.mandar({ t: 'reconectar', token });
    const bien = await guardB.recibir((m) => m.t === 'bienvenida');
    await esperar(200);
    comprobar(bien.yo === quien.id && guardB.estado.plazas['B-guardian'] === quien.id, 'recupera su plaza de guardián');

    console.log(`\n8) Vencimiento de la reserva (${RESERVA_MS / 1000} s en la prueba, 60 s de verdad)`);
    const seVa = jug.find((c) => plazaDe(c) === 'B-buscador');
    const tokenViejo = seVa.token;
    seVa.cerrar();
    await esperar(RESERVA_MS + 500);
    comprobar(obs.estado.plazas['B-buscador'] === null, 'la plaza de buscador queda libre');
    comprobar(!obs.estado.participantes.some((p) => p.id === seVa.id), 'el participante se borra de la sala');
    const tarde = await nuevo('tarde');
    tarde.mandar({ t: 'reconectar', token: tokenViejo });
    comprobar((await tarde.recibir((m) => m.t === 'error')).codigo === 'token_invalido', 'su token ya no sirve');
    const r2 = await tarde.entrar('FIESTA', 'Nuevo');
    comprobar(r2.t === 'bienvenida', 'otra persona puede entrar en su hueco');
    tarde.mandar({ t: 'elegir_plaza', plaza: 'B-buscador' });
    await esperar(200);
    comprobar(obs.estado.plazas['B-buscador'] === tarde.id, 'y ocupar la plaza libre');

    // Jugadores por plaza (los que siguen conectados)
    const vivos = [...jug, guardB, tarde].filter((c) => c.ws.readyState === 1);
    const en = (plaza) => vivos.find((c) => plazaDe(c) === plaza);
    const pel = () => obs.estado.pelota;
    const log = (txt) => obs.estado.log.some((l) => l.texto.includes(txt));
    const a1 = en('A-cazador1'), a2 = en('A-cazador2'), b1 = en('B-cazador1'), b2 = en('B-cazador2');
    const guardA = en('A-guardian');

    console.log('\n9) Pases');
    guardA.mandar({ t: 'tomar_pelota' });
    comprobar((await guardA.recibir((m) => m.t === 'error')).msg.includes('cazadores'), 'un guardián no puede tomar la quaffle');
    a1.mandar({ t: 'tomar_pelota' });
    await esperar(150);
    comprobar(pel()?.portador === a1.id, 'el cazador A1 toma la quaffle');
    let pr = esperaReto(a1);
    a1.mandar({ t: 'pasar', a: a2.id });
    let r = await jugar(a1, 'centro', pr);
    comprobar(r.visual === 'barra', 'el pase usa la barra');
    await esperar(150);
    comprobar(pel().portador === a2.id && obs.estado.pasesBuenos === 1, 'pase bueno: ahora la tiene A2 (1 pase bueno)');
    a2.mandar({ t: 'tirar' });
    comprobar((await a2.recibir((m) => m.t === 'error')).msg.includes('Todavía no'), 'con 1 pase todavía no puede lanzar');
    pr = esperaReto(a2);
    a2.mandar({ t: 'pasar', a: a1.id });
    await jugar(a2, 'centro', pr);
    await esperar(150);
    comprobar(pel().portador === a1.id && obs.estado.pasesBuenos === 2, 'segundo pase bueno (de vuelta a A1): ya puede lanzar');

    console.log('\n10) Tiro y atajada');
    let pT = esperaReto(a1), pG = esperaReto(guardB);
    a1.mandar({ t: 'tirar' });
    let [rt, rg] = await Promise.all([jugar(a1, 'centro', pT), jugar(guardB, 'fuera', pG)]);
    comprobar(rt.visual === 'barra' && rg.visual === 'aguja', 'cazador con barra y guardián con aguja');
    await esperar(150);
    comprobar(obs.estado.marcador.A === 10 && log('GOOOL'), '¡gol! Slytherin suma 10');
    comprobar(pel().equipo === 'B', 'tras el gol, la quaffle es de Gryffindor');
    const portB = vivos.find((c) => c.id === pel().portador);
    const otroB = portB === b1 ? b2 : b1;
    pr = esperaReto(portB); portB.mandar({ t: 'pasar', a: otroB.id }); await jugar(portB, 'centro', pr); await esperar(100);
    pr = esperaReto(otroB); otroB.mandar({ t: 'pasar', a: portB.id }); await jugar(otroB, 'centro', pr); await esperar(100);
    pT = esperaReto(portB); pG = esperaReto(guardA);
    portB.mandar({ t: 'tirar' });
    await Promise.all([jugar(portB, 'desvio', pT), jugar(guardA, 'centro', pG)]);
    await esperar(150);
    comprobar(obs.estado.marcador.B === 0 && log('ataja'), 'el guardián ataja un tiro peor que su atajada');
    comprobar(pel().equipo === 'A', 'tras la atajada, la quaffle es de Slytherin');

    console.log('\n11) Pases fallidos');
    let port = vivos.find((c) => c.id === pel().portador);
    let comp = port === a1 ? a2 : a1;
    pr = esperaReto(port); port.mandar({ t: 'pasar', a: comp.id }); await jugar(port, 'imposible', pr); await esperar(150);
    comprobar(pel().equipo === 'B' && log('tiempo no válido'), 'tiempo imposible = pase fallido, la quaffle cambia de equipo');
    port = vivos.find((c) => c.id === pel().portador);
    comp = port === b1 ? b2 : b1;
    pr = esperaReto(port); port.mandar({ t: 'pasar', a: comp.id }); await jugar(port, 'fuera', pr); await esperar(150);
    comprobar(pel().equipo === 'A' && log('fuera de la zona'), 'tocar fuera de la zona = pase fallido');

    console.log('\n12) Bludgers (Slytherin tiene la quaffle)');
    const golpA = en('A-golpeador1'), golpB1 = en('B-golpeador1'), golpB2 = en('B-golpeador2');
    golpA.mandar({ t: 'bludger' });
    comprobar((await golpA.recibir((m) => m.t === 'error')).msg.includes('rival'), 'no puedes lanzarla si tu equipo tiene la quaffle');
    // Gryffindor batea; los golpeadores de Slytherin no reaccionan: impacto.
    let pB = esperaReto(golpB1);
    let pR1 = esperaReto(golpA), pR2 = esperaReto(en('A-golpeador2'));
    golpB1.mandar({ t: 'bludger' });
    r = await jugar(golpB1, 'centro', pB);
    comprobar(r.visual === 'circulo', 'el golpeador batea con el círculo');
    await Promise.all([jugar(golpA, 'nada', pR1), jugar(en('A-golpeador2'), 'nada', pR2)]);
    golpB2.mandar({ t: 'bludger' });
    comprobar((await golpB2.recibir((m) => m.t === 'error')).msg.includes('jugada en curso'), 'no se puede lanzar otra mientras hay una en el aire');
    await esperar(3000 + 1500 + 300);
    comprobar(log('golpea') && pel().equipo === 'B', 'nadie la repele: el cazador pierde la quaffle (pasa a Gryffindor)');
    // Ahora Slytherin batea y Gryffindor la repele.
    pB = esperaReto(golpA);
    pR1 = esperaReto(golpB1); pR2 = esperaReto(golpB2);
    golpA.mandar({ t: 'bludger' });
    await jugar(golpA, 'centro', pB);
    await Promise.all([jugar(golpB1, 'centro', pR1), jugar(golpB2, 'nada', pR2)]);
    await esperar(150);
    comprobar(log('repele') && pel().equipo === 'B', 'un golpeador la repele: Gryffindor conserva la quaffle');
    en('A-golpeador2').mandar({ t: 'bludger' });
    comprobar((await en('A-golpeador2').recibir((m) => m.t === 'error')).msg.includes('podrá lanzar otra'), 'hay que esperar entre bludgers del mismo equipo');
    await esperar(BLUDGER_MS + 100);
    pB = esperaReto(golpA);
    golpA.mandar({ t: 'bludger' });
    await jugar(golpA, 'fuera', pB);
    await esperar(150);
    comprobar(log('se desvía') && pel().equipo === 'B', 'mal bateo: la bludger se desvía');

    console.log('\n13) Sin tocar: vence el tiempo');
    port = vivos.find((c) => c.id === pel().portador);
    comp = port === b1 ? b2 : b1;
    pr = esperaReto(port); port.mandar({ t: 'pasar', a: comp.id }); await pr;
    await esperar(6000 + 1500 + 300);
    comprobar(pel().equipo === 'A' && log('se acabó el tiempo'), 'si no toca en 6 s, cuenta como fallo');

    console.log('\n14) Equipo con menos cazadores');
    const a3 = en('A-cazador3');
    a3.mandar({ t: 'dejar_plaza' });
    await esperar(150);
    comprobar(pel().equipo === 'A', `(Slytherin tiene la quaffle)`);
    a1.mandar({ t: 'dejar_plaza' }); a1.mandar({ t: 'elegir_plaza', plaza: 'A-cazador1' });
    await esperar(150);
    a1.mandar({ t: 'tomar_pelota' });
    await esperar(150);
    comprobar(obs.estado.pasesNecesarios === 2, 'con 2 cazadores siguen haciendo falta 2 pases (ida y vuelta)');
    a2.mandar({ t: 'dejar_plaza' });
    await esperar(150);
    comprobar(obs.estado.pasesNecesarios === 0, 'con 1 solo cazador puede lanzar directo');
    pT = esperaReto(a1); pG = esperaReto(guardB);
    a1.mandar({ t: 'tirar' });
    await Promise.all([jugar(a1, 'centro', pT), jugar(guardB, 'fuera', pG)]);
    await esperar(150);
    comprobar(obs.estado.marcador.A === 20, 'y meter gol él solo');

    console.log('\n15) Comentaristas');
    const llega = jug[0].recibir((m) => m.t === 'comentario');
    obs.mandar({ t: 'comentar', texto: '¡Qué atajada increíble!' });
    const c = await llega;
    comprobar(c.texto === '¡Qué atajada increíble!' && c.nombre === obs.nombre, 'el comentario llega a la pantalla de los jugadores');
    obs.mandar({ t: 'comentar', texto: 'otro' });
    comprobar((await obs.recibir((m) => m.t === 'error')).msg.includes('Espera'), 'no se puede inundar con comentarios');
    a1.mandar({ t: 'comentar', texto: 'hola' });
    comprobar((await a1.recibir((m) => m.t === 'error')).msg.includes('comentaristas'), 'un jugador no puede comentar');

    console.log('\n16) Página web');
    const html = await fetch(`http://127.0.0.1:${PUERTO}/`).then((x) => x.text());
    comprobar(html.includes('Soy el administrador'), 'la página se sirve correctamente');
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
