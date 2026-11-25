// =====================================================================
//  Prueba automática del marcador (se corre contra el servidor local):
//    1) npx wrangler dev        (en otra terminal, con el archivo .dev.vars)
//    2) npm test
//  Revisa: 80 visitantes conectados a la vez, muchos cambios simultáneos
//  sin perder ninguno, doble toque que no cuenta doble, permisos,
//  valores inválidos, deshacer y bloqueo por intentos fallidos.
//  Las contraseñas de prueba son "prueba-<nombre>" (ver .dev.vars).
// =====================================================================
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const WS = BASE.replace(/^http/, "ws") + "/ws";
const CASAS = ["gryffindor", "hufflepuff", "ravenclaw", "slytherin"];
const CURSOS = ["criaturas", "pociones_mayores", "pociones_menores", "historia", "dclao", "encantamientos",
  "vuelo", "aparicion", "aritmancia", "astronomia", "runas", "adivinacion"];

let fallos = 0;
function ok(cond, texto) {
  console.log(`${cond ? "✔" : "✘"} ${texto}`);
  if (!cond) fallos++;
}

async function api(ruta, { token, datos, metodo, ip } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo || (datos ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(ip ? { "CF-Connecting-IP": ip } : {}),
    },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  let cuerpo = {};
  try { cuerpo = await r.json(); } catch { /* vacío */ }
  return { status: r.status, ...cuerpo };
}
const entrar = async (nombre) => (await api("/api/entrar", { datos: { clave: "prueba-" + nombre } })).token;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------
console.log("— Preparación");
const dev = await entrar("desarrollador");
ok(!!dev, "la desarrolladora entra con su contraseña");
await api("/api/maximo", { token: dev, datos: { maximo: 100 } });
const reinicio = await api("/api/reiniciar", { token: dev, datos: { confirmacion: "REINICIAR" } });
ok(reinicio.ok, "reinicio a 0 (con la palabra REINICIAR)");

// ---------------------------------------------------------------
console.log("— 80 visitantes conectados a la vez");
const visitantes = [];
await Promise.all(
  Array.from({ length: 80 }, () => new Promise((resolver, rechazar) => {
    const ws = new WebSocket(WS);
    const v = { ws, ultimo: null, mensajes: 0 };
    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      v.ultimo = JSON.parse(e.data);
      v.mensajes++;
      resolver();
    };
    ws.onerror = rechazar;
    visitantes.push(v);
  }))
);
ok(visitantes.every((v) => v.ultimo && v.ultimo.puntos), "los 80 reciben el marcador al conectarse");
visitantes[0].ws.send("ping");

// ---------------------------------------------------------------
console.log("— 12 cursos + directora suman y restan a la vez");
const tokens = await Promise.all([...CURSOS, "directora"].map(entrar));
ok(tokens.every(Boolean), "las 13 contraseñas (12 cursos + directora) funcionan");

// Primero una base para que las restas no dejen nada en negativo
await Promise.all(CASAS.map((casa) => api("/api/cambio", { token: dev, datos: { casa, modo: "sumar", cantidad: 100, motivo: "base de la prueba" } })));
const esperado = Object.fromEntries(CASAS.map((c) => [c, 100]));

const peticiones = [];
for (let i = 0; i < 260; i++) {
  const casa = CASAS[i % 4];
  const modo = i % 5 === 0 ? "restar" : "sumar";
  const cantidad = [5, 10, 20, 1, 7][i % 5];
  peticiones.push({ casa, modo, cantidad, token: tokens[i % tokens.length], idem: `prueba-${Date.now()}-${i}` });
}
// Cada petición se manda DOS veces con el mismo identificador (como un doble toque)
const respuestas = await Promise.all(
  peticiones.flatMap((p) => [p, p]).map((p) =>
    api("/api/cambio", { token: p.token, datos: { casa: p.casa, modo: p.modo, cantidad: p.cantidad, motivo: "prueba simultánea", idem: p.idem } })
      .then((r) => ({ p, r }))
  )
);
const aceptadas = respuestas.filter(({ r }) => r.ok && !r.repetido);
const repetidas = respuestas.filter(({ r }) => r.ok && r.repetido);
for (const { p } of aceptadas) esperado[p.casa] += p.modo === "sumar" ? p.cantidad : -p.cantidad;
ok(aceptadas.length === 260, `se aceptan las 260 operaciones distintas (aceptadas: ${aceptadas.length})`);
ok(repetidas.length === 260, `los 260 dobles toques no cuentan dos veces (ignorados: ${repetidas.length})`);

const estado = await api("/api/estado");
ok(JSON.stringify(estado.puntos) === JSON.stringify(esperado), `ningún cambio perdido: ${JSON.stringify(estado.puntos)}`);

await esperar(800);
ok(
  visitantes.every((v) => JSON.stringify(v.ultimo.puntos) === JSON.stringify(esperado)),
  "los 80 visitantes ven el resultado final en vivo"
);
const recibidos = visitantes.map((v) => v.mensajes);
console.log(`   (cada visitante recibió entre ${Math.min(...recibidos)} y ${Math.max(...recibidos)} actualizaciones)`);

// ---------------------------------------------------------------
console.log("— Permisos y valores inválidos (el servidor los rechaza)");
const curso = tokens[0];
const dir = tokens[12];
ok((await api("/api/cambio", { datos: { casa: "ravenclaw", modo: "sumar", cantidad: 5, motivo: "sin login" } })).status === 401, "sin contraseña no se puede sumar");
ok((await api("/api/registro", { token: curso })).status === 403, "un curso NO ve el registro");
ok((await api("/api/registro", { token: dir })).status === 200, "la directora SÍ ve el registro");
ok((await api("/api/fijar", { token: dir, datos: { casa: "ravenclaw", puntos: 999 } })).status === 403, "la directora NO puede fijar puntajes");
ok((await api("/api/deshacer", { token: dir, datos: {} })).status === 403, "la directora NO puede deshacer");
ok((await api("/api/reiniciar", { token: curso, datos: { confirmacion: "REINICIAR" } })).status === 403, "un curso NO puede reiniciar");
ok((await api("/api/maximo", { token: dir, datos: { maximo: 500 } })).status === 403, "la directora NO cambia el máximo");
ok((await api("/api/cambio", { token: curso, datos: { casa: "ravenclaw", modo: "sumar", cantidad: 101, motivo: "demasiado" } })).status === 400, "más de 100 por cambio: rechazado");
ok((await api("/api/cambio", { token: curso, datos: { casa: "ravenclaw", modo: "sumar", cantidad: 5.5, motivo: "decimal" } })).status === 400, "cantidades con decimales: rechazadas");
ok((await api("/api/cambio", { token: curso, datos: { casa: "ravenclaw", modo: "sumar", cantidad: -5, motivo: "negativo" } })).status === 400, "cantidades negativas: rechazadas");
ok((await api("/api/cambio", { token: curso, datos: { casa: "durmstrang", modo: "sumar", cantidad: 5, motivo: "casa rara" } })).status === 400, "casa inexistente: rechazada");
ok((await api("/api/cambio", { token: curso, datos: { casa: "ravenclaw", modo: "sumar", cantidad: 5, motivo: "" } })).status === 400, "sin motivo: rechazado");
const actual = (await api("/api/estado")).puntos.hufflepuff;
await api("/api/maximo", { token: dev, datos: { maximo: 1000 } });
const neg = await api("/api/cambio", { token: dev, datos: { casa: "hufflepuff", modo: "restar", cantidad: Math.min(1000, actual + 1), motivo: "quedaría negativo" } });
ok(neg.status === 400 && (await api("/api/estado")).puntos.hufflepuff === actual, "nunca queda en negativo: " + (neg.error || ""));
await api("/api/maximo", { token: dev, datos: { maximo: 100 } });
ok((await api("/api/reiniciar", { token: dev, datos: { confirmacion: "si" } })).status === 400, "reiniciar sin escribir REINICIAR: rechazado");

// ---------------------------------------------------------------
console.log("— Deshacer");
const antes = (await api("/api/estado")).puntos;
await api("/api/cambio", { token: dev, datos: { casa: "slytherin", modo: "sumar", cantidad: 50, motivo: "para deshacer" } });
const vista = await api("/api/deshacer", { token: dev });
ok(/\+50 a Slytherin/.test(vista.pendiente || ""), "muestra qué se va a deshacer: " + vista.pendiente);
await api("/api/deshacer", { token: dev, datos: {} });
ok(JSON.stringify((await api("/api/estado")).puntos) === JSON.stringify(antes), "deshacer devuelve el marcador exacto de antes");

// ---------------------------------------------------------------
console.log("— Intentos fallidos de contraseña");
const ip = "203.0.113." + Math.floor(Math.random() * 200);
let ultimo;
for (let i = 0; i < 6; i++) ultimo = await api("/api/entrar", { datos: { clave: "clave-equivocada" }, ip });
ok(ultimo.status === 429, "tras 5 fallos se bloquea 15 minutos: " + ultimo.error);
const bloqueada = await api("/api/entrar", { datos: { clave: "prueba-desarrollador" }, ip });
ok(bloqueada.status === 429, "ni con la contraseña correcta entra mientras está bloqueado");

for (const v of visitantes) v.ws.close();
console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien ✔");
process.exit(fallos ? 1 : 0);
