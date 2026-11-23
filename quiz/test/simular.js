'use strict';
// Pruebas automáticas del quiz con ~80 alumnos simulados.
// Arranca su propio servidor con los tiempos acortados (3 s por pregunta, borrado a los pocos segundos)
// y comprueba: contraseñas, límite de 80 y de 20 por casa, nombres repetidos (mayúsculas y tildes),
// cronómetro del servidor, recarga de página, respuestas tardías, mezcla por alumno, borrar intento,
// publicar resultados, varios quizzes a la vez, reemplazo del quiz y borrado automático.
// Uso: npm test   (tarda menos de 1 minuto)

const { spawn } = require('child_process');
const path = require('path');

const PUERTO = 3917;
const URL = `http://127.0.0.1:${PUERTO}`;
const SEG = 3;                // segundos por pregunta en la prueba
const GRACIA = 1500;
const CASAS = ['Gryffindor', 'Hufflepuff', 'Ravenclaw', 'Slytherin'];

let fallos = 0;
function comprobar(cond, texto) {
  console.log(`${cond ? '  ✔' : '  ✘ FALLO:'} ${texto}`);
  if (!cond) fallos++;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(ruta, datos, sesion) {
  const headers = { 'Content-Type': 'application/json' };
  if (sesion) headers['X-Sesion'] = sesion;
  const r = await fetch(URL + ruta, { method: 'POST', headers, body: JSON.stringify(datos || {}) });
  const j = await r.json();
  j.status = r.status;
  return j;
}

const PREGUNTAS = [
  { texto: '¿Qué ingrediente calma una poción burbujeante?', opciones: ['Pluma de grifo', 'Raíz de valeriana', 'Polvo de luna'], correcta: 1 },
  { texto: '¿Qué hechizo enciende una varita?', opciones: ['Lumos', 'Nox', 'Accio'], correcta: 0 },
  { texto: '¿Cuántas patas tiene un escreguto de prueba?', opciones: ['Cuatro', 'Seis', 'Diez'], correcta: 2 },
  { texto: '¿Qué planeta se observa en la clase de prueba?', opciones: ['Marte', 'Júpiter', 'Saturno'], correcta: 1 },
  { texto: '¿Qué número es mágico en aritmancia?', opciones: ['Siete', 'Cuatro', 'Doce'], correcta: 0 },
];
const correctaDe = (texto) => {
  for (const p of PREGUNTAS) if (p.texto === texto) return p.opciones[p.correcta];
  return null;
};

async function main() {
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env, PORT: String(PUERTO), RENDER: '',
      CLAVES_CURSOS: '1 = Fénix ; 4=mandragora;7=escoba;8=escoba; 13=nada; sinigual',
      SEGUNDOS_MIN: '2', BORRAR_TRAS_PUBLICAR_MS: '3000', BORRAR_SIN_PUBLICAR_MS: '600000',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let salida = '';
  servidor.stdout.on('data', (d) => { salida += d; });
  for (let i = 0; i < 50 && !salida.includes('listo'); i++) await esperar(100);

  try {
    console.log('\n1. Contraseñas de los cursos');
    comprobar(salida.includes('Cursos con contraseña: 2 de 12 (1, 4)'), 'se leen los cursos 1 y 4; 7 y 8 (repetidos) y 13 (no existe) se descartan');
    comprobar(salida.includes('misma contraseña'), 'avisa de las contraseñas repetidas');
    comprobar(!salida.toLowerCase().includes('escoba') && !salida.toLowerCase().includes('fénix'), 'los avisos no muestran las contraseñas');
    comprobar((await post('/api/profe/entrar', { clave: 'otra' })).error === 'Contraseña incorrecta.', 'contraseña incorrecta rechazada');
    comprobar(!!(await post('/api/profe/entrar', { clave: 'escoba' })).error, 'una contraseña repetida en dos cursos no deja entrar');
    const s1 = (await post('/api/profe/entrar', { clave: ' fenix ' })).sesion;   // sin tilde y con espacios
    const s4 = (await post('/api/profe/entrar', { clave: 'MANDRAGORA' })).sesion;
    comprobar(!!s1 && !!s4, 'entra con la contraseña aunque cambien mayúsculas, tildes o espacios');
    comprobar((await post('/api/profe/estado', {}, 'inventada')).status === 401, 'sin sesión válida no se ve nada');
    const e1 = await post('/api/profe/estado', {}, s1);
    const e4 = await post('/api/profe/estado', {}, s4);
    comprobar(e1.curso === 'Cuidado de criaturas mágicas' && e4.curso === 'Historia de la magia', 'cada profesor ve solo su curso');

    console.log('\n2. Abrir quizzes (varios a la vez)');
    comprobar(/entre 5 y 10/.test((await post('/api/profe/abrir', { preguntas: PREGUNTAS.slice(0, 4), segundos: SEG }, s1)).error || ''), 'rechaza un quiz de 4 preguntas');
    const once = Array.from({ length: 11 }, (_, i) => ({ ...PREGUNTAS[i % 5], texto: 'Pregunta ' + i }));
    comprobar(/entre 5 y 10/.test((await post('/api/profe/abrir', { preguntas: once, segundos: SEG }, s1)).error || ''), 'rechaza un quiz de 11 preguntas');
    const diez = once.slice(0, 10);
    const a10 = await post('/api/profe/abrir', { preguntas: diez, segundos: SEG }, s1);
    comprobar(!!a10.codigo && (await post('/api/profe/estado', {}, s1)).quiz.preguntas.length === 10, 'acepta un quiz de 10 preguntas');
    comprobar((await post('/api/profe/estado', {}, s1)).quiz.modo === 'promedio', 'el modo por defecto es el promedio por alumno');
    const mala = JSON.parse(JSON.stringify(PREGUNTAS)); mala[1].correcta = null;
    comprobar(/correcta/.test((await post('/api/profe/abrir', { preguntas: mala, segundos: SEG }, s1)).error), 'rechaza una pregunta sin respuesta correcta');
    const a1 = await post('/api/profe/abrir', { preguntas: PREGUNTAS, segundos: SEG }, s1);
    const a4 = await post('/api/profe/abrir', { preguntas: PREGUNTAS, segundos: SEG }, s4);
    comprobar(/^[A-Z0-9]{4}$/.test(a1.codigo) && /^[A-Z0-9]{4}$/.test(a4.codigo) && a1.codigo !== a4.codigo, `dos quizzes abiertos a la vez (${a1.codigo} y ${a4.codigo})`);
    comprobar((await post('/api/profe/estado', {}, s1)).quiz.codigo === a1.codigo, 'el profesor 1 ve su quiz y no el del curso 4');
    const COD = a1.codigo;

    console.log('\n3. Entrada de 80 alumnos');
    const alumnos = [];
    const entradas = [];
    for (let i = 0; i < 80; i++) {
      const casa = CASAS[i % 4];
      entradas.push(post('/api/alumno/entrar', { codigo: COD.toLowerCase(), nombre: `Alumno ${i}`, casa }).then((r) => {
        if (r.token) alumnos.push({ nombre: `Alumno ${i}`, casa, token: r.token });
      }));
    }
    await Promise.all(entradas);
    comprobar(alumnos.length === 80, `entran 80 a la vez (${alumnos.length})`);
    const r81 = await post('/api/alumno/entrar', { codigo: COD, nombre: 'Alumno 81', casa: 'Gryffindor' });
    comprobar(/lleno|máximo/.test(r81.error || ''), 'el número 81 no puede entrar');

    // límite por casa y nombres repetidos en el quiz del curso 4
    const otros = [];
    for (let i = 0; i < 20; i++) otros.push(await post('/api/alumno/entrar', { codigo: a4.codigo, nombre: `Leona ${i}`, casa: 'Gryffindor' }));
    comprobar(otros.every((r) => r.token), '20 de Gryffindor entran');
    comprobar(/20/.test((await post('/api/alumno/entrar', { codigo: a4.codigo, nombre: 'Leona 21', casa: 'Gryffindor' })).error || ''), 'el 21.º de Gryffindor no puede entrar');
    comprobar(!!(await post('/api/alumno/entrar', { codigo: a4.codigo, nombre: 'José Ñandú', casa: 'Ravenclaw' })).token, 'entra "José Ñandú"');
    comprobar(/ya respondió/.test((await post('/api/alumno/entrar', { codigo: a4.codigo, nombre: '  jose   ÑANDU ', casa: 'Slytherin' })).error || ''), '"  jose   ÑANDU " se considera el mismo nombre');
    comprobar(!!(await post('/api/alumno/entrar', { codigo: 'ZZZZ', nombre: 'X', casa: 'Ravenclaw' })).error, 'un código inexistente da error');
    comprobar(!!(await post('/api/alumno/entrar', { codigo: a4.codigo, nombre: 'Sin casa', casa: 'Durmstrang' })).error, 'una casa inventada da error');

    console.log('\n4. Mezcla por alumno y recarga de página');
    const primeras = await Promise.all(alumnos.map((a) => post('/api/alumno/estado', { token: a.token })));
    comprobar(primeras.every((e) => e.fase === 'pregunta' && e.pregunta.numero === 1), 'todos reciben su primera pregunta');
    comprobar(primeras.every((e) => !('correcta' in e.pregunta)), 'la respuesta correcta nunca se envía al celular');
    const ordenes = new Set(primeras.map((e) => e.pregunta.texto + '|' + e.pregunta.opciones.join('|')));
    comprobar(ordenes.size > 5, `preguntas y alternativas mezcladas distinto (${ordenes.size} combinaciones distintas)`);
    await esperar(1200);
    const recarga = await post('/api/alumno/estado', { token: alumnos[0].token });
    comprobar(recarga.pregunta.texto === primeras[0].pregunta.texto &&
      recarga.pregunta.opciones.join() === primeras[0].pregunta.opciones.join(), 'al recargar ve la misma pregunta y en el mismo orden');
    comprobar(recarga.pregunta.restanteMs < primeras[0].pregunta.restanteMs - 1000, `el tiempo NO se reinicia al recargar (${primeras[0].pregunta.restanteMs} → ${recarga.pregunta.restanteMs} ms)`);

    console.log('\n5. Responder (cada uno a su ritmo)');
    // Los alumnos 0..59 responden todo; los pares bien y los impares la 1.ª mal.
    // El 60 deja pasar el tiempo; el 61 contesta tarde; el resto (62..79) no termina antes de publicar.
    const esperado = new Map();
    async function responderTodo(a, i) {
      let aciertos = 0;
      for (;;) {
        const e = await post('/api/alumno/estado', { token: a.token });
        if (e.fase !== 'pregunta') break;
        const buena = correctaDe(e.pregunta.texto);
        let op = e.pregunta.opciones.indexOf(buena);
        if (i % 2 === 1 && e.pregunta.numero === 1) op = (op + 1) % 3; else aciertos++;
        const r = await post('/api/alumno/responder', { token: a.token, numero: e.pregunta.numero, opcion: op });
        if (!r.ok) throw new Error('respuesta rechazada');
      }
      esperado.set(a.nombre, aciertos);
    }
    await Promise.all(alumnos.slice(0, 60).map(responderTodo));
    const fin = await Promise.all(alumnos.slice(0, 60).map((a) => post('/api/alumno/estado', { token: a.token })));
    comprobar(fin.every((e) => e.fase === 'esperando'), 'al terminar solo ven "esperando resultados"');
    comprobar(fin.every((e) => !('aciertos' in e) && !e.resultados), 'antes de publicar no se ve el puntaje');
    comprobar(!(await post('/api/alumno/responder', { token: alumnos[0].token, numero: 1, opcion: 0 })).ok, 'no se puede volver atrás ni responder dos veces');

    console.log('\n6. Cronómetro del servidor');
    const a61 = alumnos[61];
    const p61 = await post('/api/alumno/estado', { token: a61.token });
    await esperar(SEG * 1000 + GRACIA + 300);
    const tarde = await post('/api/alumno/responder', { token: a61.token, numero: p61.pregunta.numero, opcion: 0 });
    comprobar(tarde.ok === false && tarde.tarde === true, 'una respuesta que llega después del tiempo no cuenta');
    const sig = await post('/api/alumno/estado', { token: a61.token });
    comprobar(sig.fase === 'pregunta' && sig.pregunta.numero === p61.pregunta.numero + 1, `pasa solo a la pregunta siguiente (${sig.pregunta.numero})`);
    comprobar(sig.pregunta.restanteMs > SEG * 1000 - 300, 'el tiempo de la pregunta siguiente empieza cuando la ve');
    // respuesta justo al límite (dentro del margen de red) sí cuenta
    await esperar(SEG * 1000 + 300);
    const justo = await post('/api/alumno/responder', { token: a61.token, numero: sig.pregunta.numero, opcion: 0 });
    comprobar(justo.ok === true, 'una respuesta que llega dentro del margen de red (1,5 s) sí cuenta');
    // El 60 abre la primera pregunta y desaparece: al volver, retoma donde iba.
    const a60 = alumnos[60];
    const antes60 = await post('/api/alumno/estado', { token: a60.token });
    await esperar(SEG * 1000 + GRACIA + 300);
    const vuelve = await post('/api/alumno/estado', { token: a60.token });
    comprobar(vuelve.fase === 'pregunta' && vuelve.pregunta.numero === antes60.pregunta.numero + 1, 'si vuelve a entrar retoma donde iba (la pregunta vencida cuenta como fallo)');

    console.log('\n7. Borrar un intento por error');
    const victima = alumnos[2];
    const lista = (await post('/api/profe/estado', {}, s1)).quiz.participantes;
    comprobar(lista.length === 80, 'el profesor ve a los 80 participantes');
    const idV = lista.find((p) => p.nombre === victima.nombre).id;
    comprobar(!!(await post('/api/profe/borrar-intento', { id: idV }, s4)).error, 'el profesor de otro curso no puede borrarlo');
    comprobar((await post('/api/profe/borrar-intento', { id: idV }, s1)).ok, 'el profesor borra el intento');
    comprobar((await post('/api/alumno/estado', { token: victima.token })).fase === 'no-existe', 'el celular del alumno se entera de que su intento ya no existe');
    const otraVez = await post('/api/alumno/entrar', { codigo: COD, nombre: victima.nombre.toUpperCase(), casa: victima.casa });
    comprobar(!!otraVez.token, 'puede volver a entrar con el mismo nombre');
    victima.token = otraVez.token;
    await responderTodo(victima, 2);

    console.log('\n8. Publicar resultados');
    comprobar((await post('/api/profe/ajustes', { modo: 'promedio' }, s1)).ok, 'elige el modo promedio');
    comprobar((await post('/api/profe/publicar', {}, s1)).ok, 'cierra y publica');
    const res = await post('/api/alumno/estado', { token: alumnos[0].token });
    comprobar(res.fase === 'resultados', 'los alumnos ven los resultados');
    comprobar(res.resultados.lista === null && res.mostrarLista === false && res.imagenPermitida === false, 'sin permiso no ven la lista ni la imagen');
    comprobar(res.resultados.modo === 'promedio', 'se muestra el modo elegido');
    comprobar(res.propio.aciertos === esperado.get(alumnos[0].nombre) && res.propio.total === 5, `cada uno ve sus aciertos (${res.propio.aciertos}/5)`);
    const sinTerminar = await post('/api/alumno/estado', { token: alumnos[70].token });
    comprobar(sinTerminar.fase === 'resultados' && sinTerminar.propio.aciertos === 0, 'quien no terminó: lo que faltaba cuenta como fallo');
    comprobar(!!(await post('/api/alumno/entrar', { codigo: COD, nombre: 'Tardón', casa: 'Ravenclaw' })).error, 'después de publicar ya no se puede entrar');
    await post('/api/profe/ajustes', { mostrarLista: true, modo: 'suma' }, s1);
    const res2 = await post('/api/alumno/estado', { token: alumnos[5].token });
    comprobar(Array.isArray(res2.resultados.lista) && res2.resultados.lista.length === 80, 'al activar la lista la ven (80 filas)');
    const pr = (await post('/api/profe/estado', {}, s1)).quiz.resultados;
    const sumaG = [...esperado].filter(([n]) => alumnos.find((a) => a.nombre === n).casa === 'Gryffindor').reduce((t, [, v]) => t + v, 0);
    const g = pr.casas.find((c) => c.casa === 'Gryffindor');
    comprobar(g.suma === sumaG, `la suma de Gryffindor cuadra (${g.suma})`);
    comprobar(g.alumnos === 20 && g.promedio === Math.round((g.suma / 20) * 100) / 100, `promedio de Gryffindor: ${g.promedio}`);
    comprobar((await post('/api/profe/estado', {}, s4)).quiz.estado === 'abierto', 'el quiz del curso 4 sigue abierto');

    console.log('\n9. Reemplazo y borrado automático');
    const viejo = (await post('/api/profe/estado', {}, s4)).quiz.codigo;
    const nuevo = await post('/api/profe/abrir', { preguntas: PREGUNTAS, segundos: SEG }, s4);
    comprobar(nuevo.codigo !== viejo && !!(await post('/api/alumno/entrar', { codigo: viejo, nombre: 'Z', casa: 'Ravenclaw' })).error,
      'abrir un quiz nuevo borra el anterior del curso');
    comprobar((await post('/api/alumno/estado', { token: otros[0].token })).fase === 'no-existe', 'los intentos del quiz reemplazado desaparecen');
    await esperar(4500);   // en la prueba se borra 3 s después de publicar
    comprobar((await post('/api/profe/estado', {}, s1)).quiz === null, 'el quiz publicado se borra solo pasado el tiempo');
    comprobar((await post('/api/alumno/estado', { token: alumnos[0].token })).fase === 'no-existe', 'y los alumnos ya no ven nada');
    comprobar((await post('/api/profe/estado', {}, s4)).quiz.codigo === nuevo.codigo, 'el quiz sin publicar del curso 4 sigue ahí');
  } catch (e) {
    console.error(e);
    fallos++;
  } finally {
    servidor.kill();
  }
  console.log(fallos ? `\n✘ ${fallos} fallo(s)` : '\n✔ Todas las pruebas pasaron');
  process.exit(fallos ? 1 : 0);
}

main();
