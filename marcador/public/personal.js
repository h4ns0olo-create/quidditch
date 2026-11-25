// =====================================================================
//  Pantallas del personal: entrar, sumar/restar, registro y herramientas.
//  OJO: la interfaz solo ayuda; TODOS los permisos los revisa el servidor.
// =====================================================================
(function () {
  const { CASAS, POR_ID, gemaIcono } = window.Gemas;
  const $ = (id) => document.getElementById(id);
  const CLAVE_TOKEN = "marcador-token";

  let token = leerToken();
  let sesion = null;
  let puntosActuales = {};
  let envivo = null;

  // ------------------------- Utilidades -------------------------
  function leerToken() {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  }
  function guardarToken(t) {
    try { t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
  }
  function nuevoId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function escapar(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function plural(n, palabra = "punto") {
    return `${n} ${palabra}${n === 1 ? "" : "s"}`;
  }

  let avisoTimer;
  function aviso(texto, malo = false) {
    const el = $("aviso");
    el.textContent = texto;
    el.classList.toggle("malo", malo);
    el.classList.add("visible");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => el.classList.remove("visible"), 3500);
  }

  async function api(ruta, { metodo = "GET", datos } = {}) {
    let r;
    try {
      r = await fetch(ruta, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: datos ? JSON.stringify(datos) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new Error("Sin conexión. Revisa el internet e inténtalo otra vez.");
    }
    let cuerpo = {};
    try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }
    if (r.status === 401 && ruta !== "/api/entrar") {
      cerrarSesion(cuerpo.error || "Tu sesión terminó. Vuelve a entrar.");
      throw new Error(cuerpo.error || "Sesión terminada.");
    }
    if (!r.ok) throw new Error(cuerpo.error || "Algo falló. Intenta de nuevo.");
    return cuerpo;
  }

  // Ventana de confirmación (devuelve true si se acepta)
  function confirmar({ titulo, texto, boton = "Sí", peligro = false, pedir = null }) {
    const d = $("dialogo");
    $("dialogo-titulo").textContent = titulo;
    $("dialogo-texto").textContent = texto;
    const si = $("dialogo-si");
    si.textContent = boton;
    si.className = "boton " + (peligro ? "boton-peligro" : "boton-dorado");
    const campo = $("dialogo-campo");
    const input = $("dialogo-input");
    campo.classList.toggle("oculto", !pedir);
    input.value = "";
    if (pedir) $("dialogo-etiqueta").textContent = pedir.etiqueta;
    return new Promise((resolver) => {
      const alCerrar = () => {
        d.removeEventListener("close", alCerrar);
        const ok = d.returnValue === "si" && (!pedir || input.value.trim().toUpperCase() === pedir.valor);
        if (d.returnValue === "si" && pedir && !ok) aviso(`No escribiste ${pedir.valor}. No se hizo nada.`, true);
        resolver(ok);
      };
      d.addEventListener("close", alCerrar);
      d.returnValue = "";
      d.showModal();
      if (pedir) input.focus();
    });
  }

  // ------------------------- Entrar / salir -------------------------
  function mostrar(vista) {
    $("vista-entrar").classList.toggle("oculto", vista !== "entrar");
    $("vista-curso").classList.toggle("oculto", vista !== "curso");
    $("vista-panel").classList.toggle("oculto", vista !== "panel");
  }

  function cerrarSesion(mensaje) {
    token = null;
    sesion = null;
    guardarToken(null);
    mostrar("entrar");
    $("error-entrar").textContent = mensaje || "";
    $("clave").value = "";
  }

  $("ver-clave").addEventListener("click", () => {
    const c = $("clave");
    const ver = c.type === "password";
    c.type = ver ? "text" : "password";
    $("ver-clave").textContent = ver ? "Ocultar" : "Ver";
    $("ver-clave").setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  $("form-entrar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = $("boton-entrar");
    $("error-entrar").textContent = "";
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      const r = await api("/api/entrar", { metodo: "POST", datos: { clave: $("clave").value } });
      token = r.token;
      guardarToken(token);
      $("clave").value = "";
      abrirPanel(r);
    } catch (err) {
      $("error-entrar").textContent = err.message;
    } finally {
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });

  $("salir").addEventListener("click", async () => {
    try { await api("/api/salir", { metodo: "POST" }); } catch { /* da igual */ }
    cerrarSesion("Saliste correctamente.");
  });

  // ------------------------- Panel -------------------------
  const NOMBRES_ROL = { curso: "Curso", directora: "Directora", desarrollador: "Desarrolladora" };

  // Profesores: elegir de qué curso son
  function pedirCurso(datos) {
    sesion = datos;
    $("error-curso").textContent = "";
    $("lista-cursos").innerHTML = datos.cursos
      .map((c) => `<button type="button" class="opcion" data-curso="${escapar(c)}">${escapar(c)}</button>`)
      .join("");
    $("lista-cursos").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", async () => {
        $("lista-cursos").querySelectorAll("button").forEach((x) => (x.disabled = true));
        try {
          abrirPanel(await api("/api/curso", { metodo: "POST", datos: { curso: b.dataset.curso } }));
        } catch (err) {
          $("error-curso").textContent = err.message;
          $("lista-cursos").querySelectorAll("button").forEach((x) => (x.disabled = false));
        }
      })
    );
    mostrar("curso");
    window.scrollTo(0, 0);
  }
  $("salir-curso").addEventListener("click", () => $("salir").click());
  $("cambiar-curso").addEventListener("click", () => pedirCurso(sesion));

  function abrirPanel(datos) {
    if (datos.rol === "curso" && !datos.curso) return pedirCurso(datos);
    sesion = datos;
    $("cambiar-curso").classList.toggle("oculto", datos.rol !== "curso");
    $("nombre").textContent = datos.nombre;
    $("rol").textContent = NOMBRES_ROL[datos.rol] || "";
    $("pestanas").classList.toggle("oculto", !datos.puedeVerRegistro);
    $("herramientas").classList.toggle("oculto", !datos.herramientas);
    $("ayuda-registro").textContent = datos.herramientas
      ? "Todos los cambios, del más nuevo al más antiguo."
      : "Solo lectura: aquí ves todos los cambios, pero no se pueden modificar.";
    $("maximo").value = datos.maximo;
    $("capacidad").value = datos.capacidad || 1000;
    actualizarMaximo(datos.maximo);
    cambiarVista("puntos");
    mostrar("panel");
    if (!envivo) envivo = window.EnVivo({ alEstado: pintarActuales });
  }

  function cambiarVista(v) {
    $("vista-puntos").classList.toggle("oculto", v !== "puntos");
    $("vista-registro").classList.toggle("oculto", v !== "registro");
    document.querySelectorAll(".pestana").forEach((b) => {
      const activa = b.dataset.vista === v;
      b.classList.toggle("activa", activa);
      b.setAttribute("aria-pressed", activa);
    });
    if (v === "registro") cargarRegistro(true);
  }
  document.querySelectorAll(".pestana").forEach((b) => b.addEventListener("click", () => cambiarVista(b.dataset.vista)));

  function pintarActuales(estado) {
    puntosActuales = estado.puntos || {};
    $("actuales").innerHTML = CASAS.map(
      (c) => `<div class="actual casa-${c.id}"><b>${Number(puntosActuales[c.id]) || 0}</b><span>${c.nombre}</span></div>`
    ).join("");
  }

  // ------------------------- Sumar / restar -------------------------
  const form = { modo: "sumar", casa: null, cantidad: null, idem: nuevoId() };

  $("casas").innerHTML = CASAS.map(
    (c) => `<button type="button" class="opcion casa casa-${c.id}" data-casa="${c.id}" aria-pressed="false">
      ${gemaIcono(c.id, 30)}<span class="nom">${c.nombre}</span></button>`
  ).join("");
  $("fijar-casa").innerHTML = CASAS.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");

  document.querySelectorAll(".modo").forEach((b) =>
    b.addEventListener("click", () => {
      form.modo = b.dataset.modo;
      document.querySelectorAll(".modo").forEach((x) => {
        x.classList.toggle("activo", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
      actualizarResumen();
    })
  );

  document.querySelectorAll(".opcion.casa").forEach((b) =>
    b.addEventListener("click", () => {
      form.casa = b.dataset.casa;
      document.querySelectorAll(".opcion.casa").forEach((x) => {
        x.classList.toggle("activa", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
      actualizarResumen();
    })
  );

  document.querySelectorAll(".opcion.cantidad").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".opcion.cantidad").forEach((x) => x.classList.toggle("activa", x === b));
      const otra = b.dataset.cantidad === "otra";
      $("caja-otra").classList.toggle("oculto", !otra);
      form.cantidad = otra ? "otra" : Number(b.dataset.cantidad);
      if (otra) $("otra").focus();
      actualizarResumen();
    })
  );
  $("otra").addEventListener("input", actualizarResumen);
  $("motivo").addEventListener("input", actualizarResumen);
  // Al tocar cualquier cosa del formulario se borra el error anterior
  $("form-cambio").addEventListener("click", (e) => { if (e.target.closest("button[type=button]")) $("error-cambio").textContent = ""; });
  $("form-cambio").addEventListener("input", () => { $("error-cambio").textContent = ""; });

  function cantidadElegida() {
    if (form.cantidad === "otra") {
      const n = Number($("otra").value);
      return Number.isInteger(n) && n > 0 ? n : null;
    }
    return form.cantidad;
  }

  function actualizarMaximo(m) {
    $("nota-maximo").textContent =
      sesion && sesion.sinLimite
        ? `Como desarrolladora no tienes límite por cambio (los demás: máximo ${m}).`
        : `Máximo ${plural(m)} por cambio.`;
    if (sesion && sesion.sinLimite) $("otra").removeAttribute("max");
    else $("otra").max = m;
  }

  function actualizarResumen() {
    const n = cantidadElegida();
    const max = sesion && sesion.sinLimite ? 999999 : sesion ? sesion.maximo : 100;
    const sumar = form.modo === "sumar";
    const motivoOk = $("motivo").value.trim().length >= 3;
    let texto;
    if (!form.casa && !n) texto = "Elige una casa y una cantidad";
    else if (!form.casa) texto = "Elige una casa";
    else if (!n) texto = form.cantidad === "otra" ? "Escribe cuántos puntos" : "Elige una cantidad";
    else {
      texto = `${POR_ID[form.casa].nombre} ${sumar ? "sumará" : "perderá"} ${plural(n)}`;
      if (n > max) texto += ` (supera el máximo de ${max})`;
      else if (!motivoOk) texto += " · falta el motivo";
    }
    const listo = !!(form.casa && n && n <= max && motivoOk);
    $("resumen").textContent = texto;
    $("confirmar").textContent = sumar ? "Confirmar y sumar" : "Confirmar y restar";
    $("confirmar").disabled = !listo;
  }

  $("form-cambio").addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = cantidadElegida();
    if (!form.casa || !n) return;
    const boton = $("confirmar");
    if (boton.disabled) return;
    boton.disabled = true;
    $("error-cambio").textContent = "";
    const textoBoton = boton.textContent;
    boton.textContent = "Guardando…";
    try {
      const r = await api("/api/cambio", {
        metodo: "POST",
        datos: { casa: form.casa, modo: form.modo, cantidad: n, motivo: $("motivo").value, idem: form.idem },
      });
      if (r.estado) pintarActuales(r.estado);
      const casa = POR_ID[form.casa].nombre;
      aviso(`¡Listo! ${casa} ${form.modo === "sumar" ? "+" : "−"}${n}`);
      // Limpia el formulario para no repetir por accidente
      form.casa = null;
      form.cantidad = null;
      form.idem = nuevoId();
      document.querySelectorAll(".opcion.casa, .opcion.cantidad").forEach((x) => {
        x.classList.remove("activa");
        x.setAttribute("aria-pressed", "false");
      });
      $("caja-otra").classList.add("oculto");
      $("otra").value = "";
      $("motivo").value = "";
    } catch (err) {
      $("error-cambio").textContent = err.message;
      // Si falla por la red, se reintenta con el mismo identificador: no se cuenta dos veces.
    } finally {
      boton.textContent = textoBoton;
      actualizarResumen();
    }
  });

  // ------------------------- Registro -------------------------
  let ultimoId = null;
  const fmtFecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

  function filaRegistro(f) {
    const c = f.casa ? POR_ID[f.casa] : null;
    let cant, titulo;
    if (f.tipo === "cambio") {
      cant = `<div class="cant ${f.cantidad > 0 ? "mas" : "menos"}">${f.cantidad > 0 ? "+" : "−"}${Math.abs(f.cantidad)}</div>`;
      titulo = `<span class="nom">${escapar(c ? c.nombre : "")}</span>`;
    } else if (f.tipo === "fijar") {
      cant = `<div class="cant especial">= ${f.cantidad}</div>`;
      titulo = `<span class="nom">${escapar(c ? c.nombre : "")}</span>: puntaje fijado`;
    } else if (f.tipo === "reiniciar") {
      cant = `<div class="cant especial">0</div>`;
      titulo = "Reinicio de todos los puntos";
    } else if (f.tipo === "deshacer") {
      cant = `<div class="cant especial">↶</div>`;
      titulo = "Deshacer";
    } else if (f.tipo === "capacidad") {
      cant = `<div class="cant especial">Tubo</div>`;
      titulo = "Cambio de los puntos para llenar un tubo";
    } else if (f.tipo === "maximo") {
      cant = `<div class="cant especial">Máx.</div>`;
      titulo = "Cambio del máximo por cambio";
    } else {
      cant = `<div class="cant especial">·</div>`;
      titulo = escapar(f.tipo);
    }
    return `<li class="${c ? "casa-" + c.id : ""}${f.deshecho ? " deshecho" : ""}">
      ${cant}
      <div class="linea1">${titulo} <span class="quien">· ${escapar(f.quien)}</span></div>
      <div class="motivo">${escapar(f.motivo || "")}</div>
      <div class="fecha">${fmtFecha.format(new Date(f.fecha))}</div>
    </li>`;
  }

  async function cargarRegistro(desdeCero) {
    const lista = $("lista-registro");
    if (desdeCero) {
      ultimoId = null;
      lista.innerHTML = `<li class="vacio">Cargando…</li>`;
    }
    try {
      const r = await api("/api/registro" + (ultimoId ? "?antes=" + ultimoId : ""));
      if (desdeCero) lista.innerHTML = "";
      if (desdeCero && r.filas.length === 0) lista.innerHTML = `<li class="vacio">Todavía no hay cambios.</li>`;
      lista.insertAdjacentHTML("beforeend", r.filas.map(filaRegistro).join(""));
      if (r.filas.length) ultimoId = r.filas[r.filas.length - 1].id;
      $("mas-registro").classList.toggle("oculto", !r.hayMas);
    } catch (err) {
      if (desdeCero) lista.innerHTML = `<li class="vacio">${escapar(err.message)}</li>`;
      else aviso(err.message, true);
    }
  }
  $("actualizar-registro").addEventListener("click", () => cargarRegistro(true));
  $("mas-registro").addEventListener("click", () => cargarRegistro(false));

  // ------------------------- Herramientas -------------------------
  async function accion(fn, exito) {
    try {
      const r = await fn();
      if (r && r.estado) pintarActuales(r.estado);
      aviso(exito);
      cargarRegistro(true);
      return r;
    } catch (err) {
      aviso(err.message, true);
    }
  }

  $("deshacer").addEventListener("click", async () => {
    let pendiente;
    try {
      pendiente = (await api("/api/deshacer")).pendiente;
    } catch (err) {
      return aviso(err.message, true);
    }
    if (!pendiente) return aviso("No hay ningún cambio que deshacer.", true);
    const ok = await confirmar({ titulo: "Deshacer el último cambio", texto: `Se deshará: ${pendiente}. ¿Continuar?`, boton: "Deshacer" });
    if (ok) accion(() => api("/api/deshacer", { metodo: "POST", datos: {} }), "Cambio deshecho.");
  });

  $("fijar").addEventListener("click", async () => {
    const casa = $("fijar-casa").value;
    const puntos = Number($("fijar-puntos").value);
    if ($("fijar-puntos").value === "" || !Number.isInteger(puntos) || puntos < 0) {
      return aviso("Escribe un número entero de 0 en adelante.", true);
    }
    const nombre = POR_ID[casa].nombre;
    const ok = await confirmar({
      titulo: "Fijar puntaje exacto",
      texto: `${nombre} pasará de ${Number(puntosActuales[casa]) || 0} a ${plural(puntos)}. ¿Continuar?`,
      boton: "Fijar",
    });
    if (ok) {
      const r = await accion(() => api("/api/fijar", { metodo: "POST", datos: { casa, puntos } }), `${nombre} ahora tiene ${plural(puntos)}.`);
      if (r) $("fijar-puntos").value = "";
    }
  });

  $("guardar-capacidad").addEventListener("click", async () => {
    const capacidad = Number($("capacidad").value);
    if (!Number.isInteger(capacidad) || capacidad < 50 || capacidad > 100000) return aviso("Escribe un número entre 50 y 100000.", true);
    const r = await accion(() => api("/api/capacidad", { metodo: "POST", datos: { capacidad } }), `Ahora un tubo se llena con ${plural(capacidad)}.`);
    if (r) sesion.capacidad = r.capacidad;
  });

  $("guardar-maximo").addEventListener("click", async () => {
    const maximo = Number($("maximo").value);
    if (!Number.isInteger(maximo) || maximo < 1 || maximo > 1000) return aviso("El máximo debe estar entre 1 y 1000.", true);
    const r = await accion(() => api("/api/maximo", { metodo: "POST", datos: { maximo } }), `Máximo por cambio: ${plural(maximo)}.`);
    if (r) {
      sesion.maximo = r.maximo;
      actualizarMaximo(r.maximo);
      actualizarResumen();
    }
  });

  $("reiniciar").addEventListener("click", async () => {
    const paso1 = await confirmar({
      titulo: "Reiniciar todos los puntos",
      texto: "Las cuatro casas quedarán en 0. ¿Seguro que quieres seguir?",
      boton: "Sí, seguir",
      peligro: true,
    });
    if (!paso1) return;
    const paso2 = await confirmar({
      titulo: "Última confirmación",
      texto: "Esto borra el marcador actual (queda anotado en el registro y se puede deshacer).",
      boton: "Reiniciar",
      peligro: true,
      pedir: { etiqueta: "Escribe REINICIAR para confirmar", valor: "REINICIAR" },
    });
    if (paso2) accion(() => api("/api/reiniciar", { metodo: "POST", datos: { confirmacion: "REINICIAR" } }), "Marcador reiniciado.");
  });

  // ------------------------- Arranque -------------------------
  async function iniciar() {
    if (!token) return mostrar("entrar");
    try {
      abrirPanel(await api("/api/sesion"));
    } catch (err) {
      if (token) {
        // Sin internet al abrir: se queda en la pantalla de entrada con el aviso
        mostrar("entrar");
        $("error-entrar").textContent = err.message;
      }
    }
  }
  iniciar();
})();
