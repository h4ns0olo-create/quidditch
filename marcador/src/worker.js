// =====================================================================
//  Marcador de las casas — servidor (Cloudflare Worker + Durable Object)
// ---------------------------------------------------------------------
//  - Las páginas (carpeta public/) las sirve Cloudflare directamente.
//  - Todo lo que empieza por /api/ y la conexión en vivo /ws llegan aquí
//    y se pasan a UN solo "Durable Object" llamado Marcador.
//  - Ese objeto atiende las peticiones de una en una, así que si dos
//    personas suman a la vez no se pierde ningún cambio.
//  - Los puntos y el registro se guardan en SQLite (permanente).
//  - Las contraseñas NO están aquí: se leen de los secretos de Cloudflare.
// =====================================================================

import { DurableObject } from "cloudflare:workers";

// ---------- Casas ----------
const CASAS = {
  gryffindor: "Gryffindor",
  hufflepuff: "Hufflepuff",
  ravenclaw: "Ravenclaw",
  slytherin: "Slytherin",
};
const ORDEN_CASAS = Object.keys(CASAS);

// ---------- Cuentas: 3 contraseñas (cada una es un secreto en Cloudflare) ----------
const CUENTAS = [
  { secreto: "CLAVE_PROFESORES", nombre: "Profesores", rol: "curso" },
  { secreto: "CLAVE_DIRECTORA", nombre: "Dirección", rol: "directora" },
  { secreto: "CLAVE_DESARROLLADOR", nombre: "Desarrollo", rol: "desarrollador" },
];

// Con la clave de profesores, cada uno elige su curso al entrar (queda en el registro).
const CURSOS = [
  "Cuidado de criaturas mágicas",
  "Pociones (años mayores)",
  "Pociones (años menores)",
  "Historia de la magia",
  "DCLAO",
  "Encantamientos",
  "Vuelo",
  "Aparición",
  "Aritmancia",
  "Astronomía",
  "Runas antiguas",
  "Adivinación",
];

// ---------- Reglas ----------
const MAXIMO_POR_DEFECTO = 100;
const MAXIMO_TOPE = 1000; // ni la desarrolladora puede poner un máximo mayor
const PUNTOS_TOPE = 999999; // ninguna casa puede pasar de aquí
const LARGO_MIN_CLAVE = 6; // contraseñas más cortas se ignoran
const SESION_DIAS = 14;
const FALLOS_PERMITIDOS = 5; // intentos fallidos seguidos antes de bloquear
const VENTANA_FALLOS_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;

// =====================================================================
//  Worker: la puerta de entrada
// =====================================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/salud") {
      // Diagnóstico: cuántas contraseñas ve el servidor (nunca muestra cuáles son)
      const id = env.MARCADOR.idFromName("principal");
      const objeto = await (await env.MARCADOR.get(id).fetch(new Request(url.origin + "/api/salud-objeto"))).json();
      return new Response(JSON.stringify({ version: VERSION, puerta: contarClaves(env), ...objeto }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      const id = env.MARCADOR.idFromName("principal");
      return env.MARCADOR.get(id).fetch(request);
    }
    return new Response("No encontrado", { status: 404 });
  },
};

// =====================================================================
//  Durable Object: guarda los puntos y avisa a todos
// =====================================================================
export class Marcador extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.cacheEstado = null;
    this.huellas = null; // huella de cada contraseña configurada (se calcula una vez)

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS puntos (
        casa TEXT PRIMARY KEY,
        puntos INTEGER NOT NULL CHECK (puntos BETWEEN 0 AND ${PUNTOS_TOPE})
      );
      CREATE TABLE IF NOT EXISTS registro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha INTEGER NOT NULL,
        tipo TEXT NOT NULL,          -- cambio | fijar | reiniciar | deshacer | maximo
        quien TEXT NOT NULL,
        rol TEXT NOT NULL,
        casa TEXT,
        cantidad INTEGER,            -- con signo: +10 o -5 (en fijar: el valor puesto)
        motivo TEXT,
        antes TEXT,                  -- puntos de las 4 casas justo antes (para deshacer)
        deshecho INTEGER NOT NULL DEFAULT 0,
        ref INTEGER,                 -- en "deshacer": qué fila se deshizo
        idem TEXT UNIQUE             -- evita que un doble toque cuente dos veces
      );
      CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sesiones (
        token TEXT PRIMARY KEY, secreto TEXT NOT NULL, huella TEXT NOT NULL, expira INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS intentos (
        ip TEXT PRIMARY KEY, fallos INTEGER NOT NULL, desde INTEGER NOT NULL, hasta INTEGER NOT NULL DEFAULT 0
      );
    `);
    for (const c of ORDEN_CASAS) {
      this.sql.exec("INSERT OR IGNORE INTO puntos (casa, puntos) VALUES (?, 0)", c);
    }
    // Columna para el curso elegido (se agrega una sola vez si no existía)
    const columnas = this.sql.exec("PRAGMA table_info(sesiones)").toArray().map((c) => c.name);
    if (!columnas.includes("curso")) this.sql.exec("ALTER TABLE sesiones ADD COLUMN curso TEXT");
    // Los celulares mandan "ping" cada tanto; se responde "pong" sin despertar al objeto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ------------------------- Rutas -------------------------
  async fetch(request) {
    const url = new URL(request.url);
    const ruta = url.pathname;
    const metodo = request.method;
    try {
      if (ruta === "/ws") return this.conectarEnVivo(request);
      if (ruta === "/api/estado" && metodo === "GET") return json(this.estado());
      if (ruta === "/api/salud-objeto") {
        return json({ guardian: contarClaves(this.env), enMemoria: this.huellas ? this.huellas.size : null });
      }

      if (ruta === "/api/entrar" && metodo === "POST") return await this.entrar(request);

      // Desde aquí, todo pide una sesión válida.
      const cuenta = await this.cuentaDeSesion(request);
      if (!cuenta) return error(401, "Tu sesión terminó. Vuelve a escribir la contraseña.");

      if (ruta === "/api/sesion" && metodo === "GET") return json(this.datosSesion(cuenta));
      if (ruta === "/api/salir" && metodo === "POST") {
        this.sql.exec("DELETE FROM sesiones WHERE token = ?", tokenDe(request));
        return json({ ok: true });
      }
      if (ruta === "/api/curso" && metodo === "POST") return this.elegirCurso(request, cuenta, await leerJSON(request));
      if (ruta === "/api/cambio" && metodo === "POST") {
        if (cuenta.rol === "curso" && !cuenta.curso) return error(400, "Primero elige tu curso.");
        return this.cambio(cuenta, await leerJSON(request));
      }

      // Registro: directora y desarrollador (solo lectura).
      if (ruta === "/api/registro" && metodo === "GET") {
        if (cuenta.rol === "curso") return error(403, "Tu clave no permite ver el registro.");
        return json(this.registro(url.searchParams.get("antes")));
      }

      // Herramientas: solo desarrollador.
      const herramientas = ["/api/deshacer", "/api/fijar", "/api/reiniciar", "/api/maximo"];
      if (herramientas.includes(ruta)) {
        if (cuenta.rol !== "desarrollador") return error(403, "Solo la desarrolladora puede usar esto.");
        if (ruta === "/api/deshacer" && metodo === "GET") return json({ pendiente: this.describirDeshacer() });
        if (metodo !== "POST") return error(405, "Método no permitido.");
        const datos = await leerJSON(request);
        if (ruta === "/api/deshacer") return this.deshacer(cuenta);
        if (ruta === "/api/fijar") return this.fijar(cuenta, datos);
        if (ruta === "/api/reiniciar") return this.reiniciar(cuenta, datos);
        if (ruta === "/api/maximo") return this.cambiarMaximo(cuenta, datos);
      }
      return error(404, "No encontrado.");
    } catch (e) {
      if (e instanceof ErrorUsuario) return error(e.estado, e.message);
      console.error(e);
      return error(500, "Algo falló en el servidor. Intenta de nuevo.");
    }
  }

  // ------------------------- Estado público -------------------------
  estado() {
    if (!this.cacheEstado) {
      const puntos = {};
      for (const fila of this.sql.exec("SELECT casa, puntos FROM puntos")) puntos[fila.casa] = fila.puntos;
      const ultimo = this.leerAjuste("ultimo");
      this.cacheEstado = {
        tipo: "estado",
        puntos,
        ultimo: ultimo ? JSON.parse(ultimo) : null,
      };
    }
    return this.cacheEstado;
  }

  maximo() {
    const v = parseInt(this.leerAjuste("maximo") ?? "", 10);
    return Number.isInteger(v) ? v : MAXIMO_POR_DEFECTO;
  }

  leerAjuste(clave) {
    const fila = this.sql.exec("SELECT valor FROM ajustes WHERE clave = ?", clave).toArray()[0];
    return fila ? fila.valor : null;
  }

  guardarAjuste(clave, valor) {
    this.sql.exec(
      "INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      clave,
      valor
    );
  }

  // Avisa a todos los celulares conectados.
  difundir() {
    this.cacheEstado = null;
    const mensaje = JSON.stringify(this.estado());
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(mensaje);
      } catch {
        /* ese celular ya se fue */
      }
    }
  }

  // ------------------------- En vivo (WebSocket) -------------------------
  conectarEnVivo(request) {
    if (request.headers.get("Upgrade") !== "websocket") return error(426, "Se esperaba WebSocket.");
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    // "Hibernación": el objeto puede dormir entre cambios sin cortar las conexiones.
    this.ctx.acceptWebSocket(servidor);
    servidor.send(JSON.stringify(this.estado()));
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws, mensaje) {
    // El público solo escucha. Si alguien pide el estado, se le manda.
    if (mensaje === "estado") ws.send(JSON.stringify(this.estado()));
  }

  async webSocketClose(ws, codigo) {
    try {
      ws.close(codigo === 1005 ? 1000 : codigo, "adiós");
    } catch {
      /* ya estaba cerrado */
    }
  }

  async webSocketError(ws) {
    try {
      ws.close(1011, "error");
    } catch {
      /* nada */
    }
  }

  // ------------------------- Contraseñas y sesiones -------------------------
  async calcularHuellas() {
    // Se recuerda en memoria solo si ya hay contraseñas (si no, se vuelve a mirar cada vez)
    if (this.huellas && this.huellas.size > 0) return this.huellas;
    const huellas = new Map(); // secreto -> huella
    for (const c of CUENTAS) {
      const valor = this.env[c.secreto];
      if (typeof valor === "string" && valor.trim().length >= LARGO_MIN_CLAVE) {
        huellas.set(c.secreto, await huella(valor.trim()));
      }
    }
    this.huellas = huellas;
    return huellas;
  }

  async entrar(request) {
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const ahora = Date.now();
    this.sql.exec("DELETE FROM intentos WHERE hasta < ? AND desde < ?", ahora, ahora - VENTANA_FALLOS_MS);
    const intento = this.sql.exec("SELECT * FROM intentos WHERE ip = ?", ip).toArray()[0];
    if (intento && intento.hasta > ahora) {
      const min = Math.ceil((intento.hasta - ahora) / 60000);
      return error(429, `Demasiados intentos fallidos. Espera ${min} minuto${min === 1 ? "" : "s"} y vuelve a probar.`);
    }

    const datos = await leerJSON(request);
    const clave = typeof datos.clave === "string" ? datos.clave.trim() : "";
    const huellas = await this.calcularHuellas();
    if (huellas.size === 0) return error(503, "Todavía no hay contraseñas configuradas en Cloudflare.");

    const h = clave.length >= LARGO_MIN_CLAVE && clave.length <= 200 ? await huella(clave) : "";
    const coincidencias = CUENTAS.filter((c) => h && huellas.get(c.secreto) === h);

    if (coincidencias.length === 0) {
      // Fallo: se cuenta. Al 5.º fallo seguido, bloqueo de 15 minutos.
      const nuevo = !intento || intento.desde < ahora - VENTANA_FALLOS_MS;
      const fallos = nuevo ? 1 : intento.fallos + 1;
      const desde = nuevo ? ahora : intento.desde;
      const hasta = fallos >= FALLOS_PERMITIDOS ? ahora + BLOQUEO_MS : 0;
      this.sql.exec(
        "INSERT INTO intentos (ip, fallos, desde, hasta) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(ip) DO UPDATE SET fallos = excluded.fallos, desde = excluded.desde, hasta = excluded.hasta",
        ip,
        fallos,
        desde,
        hasta
      );
      const quedan = FALLOS_PERMITIDOS - fallos;
      return error(
        401,
        quedan > 0
          ? `Contraseña incorrecta. Te quedan ${quedan} intento${quedan === 1 ? "" : "s"}.`
          : "Contraseña incorrecta. Por seguridad, espera 15 minutos."
      );
    }
    if (coincidencias.length > 1) {
      return error(409, "Esa contraseña está repetida en dos cuentas. La desarrolladora debe cambiar una.");
    }

    const cuenta = coincidencias[0];
    this.sql.exec("DELETE FROM intentos WHERE ip = ?", ip);
    this.sql.exec("DELETE FROM sesiones WHERE expira < ?", ahora);
    const token = tokenAleatorio();
    this.sql.exec(
      "INSERT INTO sesiones (token, secreto, huella, expira) VALUES (?, ?, ?, ?)",
      token,
      cuenta.secreto,
      h,
      ahora + SESION_DIAS * 86400000
    );
    return json({ token, ...this.datosSesion(cuenta) });
  }

  async cuentaDeSesion(request) {
    const token = tokenDe(request);
    if (!token) return null;
    const fila = this.sql.exec("SELECT * FROM sesiones WHERE token = ?", token).toArray()[0];
    if (!fila || fila.expira < Date.now()) return null;
    // Si la contraseña se cambió en Cloudflare, las sesiones viejas dejan de valer.
    const huellas = await this.calcularHuellas();
    if (huellas.get(fila.secreto) !== fila.huella) return null;
    const base = CUENTAS.find((c) => c.secreto === fila.secreto);
    if (!base) return null;
    if (base.rol !== "curso") return base;
    // Profesores: el nombre que queda en el registro es el del curso elegido
    const curso = CURSOS.includes(fila.curso) ? fila.curso : null;
    return { ...base, curso, nombre: curso || base.nombre };
  }

  elegirCurso(request, cuenta, datos) {
    if (cuenta.rol !== "curso") return error(403, "Solo para la clave de profesores.");
    if (!CURSOS.includes(datos.curso)) return error(400, "Elige un curso de la lista.");
    this.sql.exec("UPDATE sesiones SET curso = ? WHERE token = ?", datos.curso, tokenDe(request));
    return json(this.datosSesion({ ...cuenta, curso: datos.curso, nombre: datos.curso }));
  }

  datosSesion(cuenta) {
    return {
      nombre: cuenta.nombre,
      ...(cuenta.rol === "curso" ? { curso: cuenta.curso || null, cursos: CURSOS } : {}),
      rol: cuenta.rol,
      maximo: this.maximo(),
      puedeVerRegistro: cuenta.rol !== "curso",
      herramientas: cuenta.rol === "desarrollador",
    };
  }

  // ------------------------- Escrituras -------------------------
  // Toda escritura se hace dentro de una transacción: o se guarda todo o nada.
  fotoPuntos() {
    return { ...this.estado().puntos };
  }

  cambio(cuenta, datos) {
    const casa = validarCasa(datos.casa);
    const modo = datos.modo === "restar" ? "restar" : datos.modo === "sumar" ? "sumar" : null;
    if (!modo) throw new ErrorUsuario("Elige sumar o restar.");
    const maximo = this.maximo();
    const cantidad = Number(datos.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new ErrorUsuario("La cantidad debe ser un número entero mayor que 0.");
    if (cantidad > maximo) throw new ErrorUsuario(`Máximo ${maximo} puntos por cambio.`);
    const motivo = limpiarTexto(datos.motivo, 200);
    if (motivo.length < 3) throw new ErrorUsuario("Escribe el motivo (al menos 3 letras).");
    const idem = validarIdem(datos.idem);

    if (idem) {
      const repetido = this.sql.exec("SELECT id FROM registro WHERE idem = ?", idem).toArray()[0];
      if (repetido) return json({ ok: true, repetido: true, estado: this.estado() });
    }

    const antes = this.fotoPuntos();
    const delta = modo === "sumar" ? cantidad : -cantidad;
    const nuevo = antes[casa] + delta;
    if (nuevo < 0) {
      throw new ErrorUsuario(`${CASAS[casa]} solo tiene ${antes[casa]} puntos: no puede quedar en negativo.`);
    }
    if (nuevo > PUNTOS_TOPE) throw new ErrorUsuario("Ese cambio supera el máximo del marcador.");

    const n = Math.abs(delta);
    const texto =
      delta > 0
        ? `¡${CASAS[casa]} suma ${n} punto${n === 1 ? "" : "s"}!`
        : `${CASAS[casa]} pierde ${n} punto${n === 1 ? "" : "s"}`;

    this.ctx.storage.transactionSync(() => {
      this.sql.exec("UPDATE puntos SET puntos = ? WHERE casa = ?", nuevo, casa);
      this.anotar({ tipo: "cambio", cuenta, casa, cantidad: delta, motivo, antes, idem });
      this.guardarAjuste("ultimo", JSON.stringify({ texto, casa, cantidad: delta, fecha: Date.now() }));
    });
    this.difundir();
    return json({ ok: true, estado: this.estado() });
  }

  anotar({ tipo, cuenta, casa = null, cantidad = null, motivo = null, antes = null, ref = null, idem = null }) {
    this.sql.exec(
      "INSERT INTO registro (fecha, tipo, quien, rol, casa, cantidad, motivo, antes, ref, idem) VALUES (?,?,?,?,?,?,?,?,?,?)",
      Date.now(),
      tipo,
      cuenta.nombre,
      cuenta.rol,
      casa,
      cantidad,
      motivo,
      antes ? JSON.stringify(antes) : null,
      ref,
      idem
    );
  }

  ultimoDeshacible() {
    return this.sql
      .exec(
        "SELECT * FROM registro WHERE deshecho = 0 AND tipo IN ('cambio','fijar','reiniciar') ORDER BY id DESC LIMIT 1"
      )
      .toArray()[0];
  }

  describirDeshacer() {
    const fila = this.ultimoDeshacible();
    return fila ? describirFila(fila) : null;
  }

  deshacer(cuenta) {
    const fila = this.ultimoDeshacible();
    if (!fila) throw new ErrorUsuario("No hay ningún cambio que deshacer.");
    // Como se deshace siempre el más reciente, volver a la "foto" de antes es exacto.
    const antes = JSON.parse(fila.antes);
    const ahora = this.fotoPuntos();
    this.ctx.storage.transactionSync(() => {
      for (const c of ORDEN_CASAS) {
        this.sql.exec("UPDATE puntos SET puntos = ? WHERE casa = ?", antes[c] ?? 0, c);
      }
      this.sql.exec("UPDATE registro SET deshecho = 1 WHERE id = ?", fila.id);
      this.anotar({ tipo: "deshacer", cuenta, casa: fila.casa, motivo: "Deshace: " + describirFila(fila), antes: ahora, ref: fila.id });
      this.guardarAjuste("ultimo", JSON.stringify({ texto: "Se corrigió el último cambio", casa: null, fecha: Date.now() }));
    });
    this.difundir();
    return json({ ok: true, estado: this.estado() });
  }

  fijar(cuenta, datos) {
    const casa = validarCasa(datos.casa);
    const valor = Number(datos.puntos);
    if (!Number.isInteger(valor) || valor < 0 || valor > PUNTOS_TOPE) {
      throw new ErrorUsuario(`El puntaje debe ser un número entero entre 0 y ${PUNTOS_TOPE}.`);
    }
    const motivo = limpiarTexto(datos.motivo, 200) || "Ajuste manual";
    const antes = this.fotoPuntos();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("UPDATE puntos SET puntos = ? WHERE casa = ?", valor, casa);
      this.anotar({ tipo: "fijar", cuenta, casa, cantidad: valor, motivo, antes });
      this.guardarAjuste(
        "ultimo",
        JSON.stringify({ texto: `Marcador ajustado: ${CASAS[casa]} tiene ${valor} puntos`, casa, fecha: Date.now() })
      );
    });
    this.difundir();
    return json({ ok: true, estado: this.estado() });
  }

  reiniciar(cuenta, datos) {
    if (datos.confirmacion !== "REINICIAR") throw new ErrorUsuario("Escribe REINICIAR para confirmar.");
    const antes = this.fotoPuntos();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("UPDATE puntos SET puntos = 0");
      this.anotar({ tipo: "reiniciar", cuenta, motivo: "Reinicio de todos los puntos", antes });
      this.guardarAjuste(
        "ultimo",
        JSON.stringify({ texto: "¡Nuevo comienzo! Todas las casas vuelven a 0", casa: null, fecha: Date.now() })
      );
    });
    this.difundir();
    return json({ ok: true, estado: this.estado() });
  }

  cambiarMaximo(cuenta, datos) {
    const valor = Number(datos.maximo);
    if (!Number.isInteger(valor) || valor < 1 || valor > MAXIMO_TOPE) {
      throw new ErrorUsuario(`El máximo debe estar entre 1 y ${MAXIMO_TOPE}.`);
    }
    this.ctx.storage.transactionSync(() => {
      this.guardarAjuste("maximo", String(valor));
      this.anotar({ tipo: "maximo", cuenta, cantidad: valor, motivo: `Máximo por cambio: ${valor} puntos` });
    });
    return json({ ok: true, maximo: valor });
  }

  // ------------------------- Registro -------------------------
  registro(antesDe) {
    const POR_PAGINA = 100;
    const corte = parseInt(antesDe ?? "", 10);
    const filas = Number.isInteger(corte)
      ? this.sql.exec("SELECT * FROM registro WHERE id < ? ORDER BY id DESC LIMIT ?", corte, POR_PAGINA + 1).toArray()
      : this.sql.exec("SELECT * FROM registro ORDER BY id DESC LIMIT ?", POR_PAGINA + 1).toArray();
    const hayMas = filas.length > POR_PAGINA;
    return {
      filas: filas.slice(0, POR_PAGINA).map((f) => ({
        id: f.id,
        fecha: f.fecha,
        tipo: f.tipo,
        quien: f.quien,
        rol: f.rol,
        casa: f.casa,
        cantidad: f.cantidad,
        motivo: f.motivo,
        deshecho: !!f.deshecho,
      })),
      hayMas,
    };
  }
}

// =====================================================================
//  Ayudantes
// =====================================================================
const VERSION = "2026-11-25b";

function contarClaves(env) {
  return CUENTAS.filter((c) => typeof env[c.secreto] === "string" && env[c.secreto].trim().length >= LARGO_MIN_CLAVE).length;
}

class ErrorUsuario extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

function json(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function error(estado, mensaje) {
  return json({ ok: false, error: mensaje }, estado);
}

async function leerJSON(request) {
  const texto = await request.text();
  if (texto.length > 4000) throw new ErrorUsuario("Datos demasiado largos.", 413);
  if (!texto) return {};
  try {
    const datos = JSON.parse(texto);
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    throw new ErrorUsuario("Datos inválidos.");
  }
}

function tokenDe(request) {
  const cabecera = request.headers.get("Authorization") || "";
  const m = cabecera.match(/^Bearer ([a-f0-9]{64})$/);
  return m ? m[1] : null;
}

function tokenAleatorio() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function huella(texto) {
  const datos = new TextEncoder().encode("marcador-casas:" + texto);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validarCasa(casa) {
  if (typeof casa !== "string" || !Object.hasOwn(CASAS, casa)) throw new ErrorUsuario("Elige una casa.");
  return casa;
}

function validarIdem(idem) {
  return typeof idem === "string" && /^[A-Za-z0-9-]{8,64}$/.test(idem) ? idem : null;
}

function limpiarTexto(texto, largo) {
  if (typeof texto !== "string") return "";
  return texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, largo);
}

function describirFila(f) {
  const casa = f.casa ? CASAS[f.casa] : "";
  if (f.tipo === "cambio") return `${f.cantidad > 0 ? "+" : ""}${f.cantidad} a ${casa} (${f.quien})`;
  if (f.tipo === "fijar") return `${casa} fijado en ${f.cantidad} (${f.quien})`;
  if (f.tipo === "reiniciar") return `Reinicio de todos los puntos (${f.quien})`;
  return f.tipo;
}
