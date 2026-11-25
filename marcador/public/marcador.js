// =====================================================================
//  Página pública: dibuja los 4 tubos y los actualiza en vivo
// =====================================================================
(function () {
  const { CASAS, tuboSVG, yDeNivel, T } = window.Gemas;
  const tablero = document.getElementById("tablero");
  const cinta = document.querySelector(".cinta");
  const textoUltimo = document.getElementById("ultimo");
  const vivo = document.getElementById("vivo");
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");

  const NIVEL_MAXIMO = 0.9; // si una casa pasa la capacidad, la escala crece y queda al 90 %
  const NIVEL_MINIMO = 0.025; // con 1 punto ya se ve alguna gema

  // ---- Crear las tarjetas ----
  const tarjetas = {};
  for (const c of CASAS) {
    const art = document.createElement("article");
    art.className = `tarjeta piedra casa-${c.id}`;
    art.innerHTML = `
      <span class="insignia">VA GANANDO</span>
      <h2>${c.nombre}</h2>
      <div class="dibujo">${tuboSVG(c.id)}</div>
      <p class="puntos"><span class="num">0</span><span class="etq">puntos</span></p>`;
    tablero.appendChild(art);
    tarjetas[c.id] = {
      art,
      monton: art.querySelector(".monton"),
      placa: art.querySelector(".placa"),
      corriente: art.querySelector(".corriente"),
      num: art.querySelector(".num"),
      insignia: art.querySelector(".insignia"),
      mostrado: 0,
      puntos: null,
    };
    tarjetas[c.id].corriente.classList.add("quieta");
    art.setAttribute("aria-label", `${c.nombre}: 0 puntos`);
  }

  // ---- Contar hasta el número nuevo ----
  function animarNumero(t, destino) {
    const desde = t.mostrado;
    if (sinMovimiento.matches || desde === destino) {
      t.mostrado = destino;
      t.num.textContent = destino;
      return;
    }
    const inicio = performance.now();
    const dur = 1100;
    cancelAnimationFrame(t.anim);
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - inicio) / dur);
      const suave = 1 - Math.pow(1 - k, 3);
      t.mostrado = Math.round(desde + (destino - desde) * suave);
      t.num.textContent = t.mostrado;
      if (k < 1) t.anim = requestAnimationFrame(paso);
    };
    t.anim = requestAnimationFrame(paso);
  }

  function reiniciarAnimacion(el, clase) {
    el.classList.remove(clase);
    void el.offsetWidth; // fuerza a que la animación vuelva a empezar
    el.classList.add(clase);
  }

  // ---- Pintar el estado ----
  let ultimoTexto = null;
  function pintar(estado) {
    const puntos = estado.puntos || {};
    const valores = CASAS.map((c) => Math.max(0, Number(puntos[c.id]) || 0));
    const max = Math.max(...valores);
    // El tubo es una regla fija: "capacidad" puntos = tubo lleno (1000 si no se cambió).
    // Si alguna casa la supera, la escala crece para que nada se desborde.
    const capacidad = Number(estado.capacidad) > 0 ? Number(estado.capacidad) : 1000;
    const escala = Math.max(capacidad, max / NIVEL_MAXIMO);
    const lideres = CASAS.filter((c, i) => max > 0 && valores[i] === max);

    CASAS.forEach((c, i) => {
      const t = tarjetas[c.id];
      const pts = valores[i];
      const nivel = pts > 0 ? Math.max(NIVEL_MINIMO, pts / escala) : 0;
      const y = yDeNivel(nivel);

      t.monton.style.transform = `translateY(${pts > 0 ? y : T.fondo + 20}px)`;
      t.placa.style.transform = `translate(82px, ${y}px)`;
      t.corriente.classList.toggle("quieta", pts === 0);

      if (t.puntos !== null && pts !== t.puntos) {
        if (pts > t.puntos) {
          reiniciarAnimacion(t.art, "sube");
          t.corriente.classList.add("rafaga");
          clearTimeout(t.rafaga);
          t.rafaga = setTimeout(() => t.corriente.classList.remove("rafaga"), 2200);
        } else {
          reiniciarAnimacion(t.art, "baja");
        }
      }
      t.puntos = pts;
      animarNumero(t, pts);

      const gana = lideres.length === 1 && lideres[0].id === c.id;
      const empate = lideres.length > 1 && lideres.some((l) => l.id === c.id);
      t.art.classList.toggle("gana", gana);
      t.art.classList.toggle("empate", empate);
      t.insignia.textContent = empate ? "EMPATADOS" : "VA GANANDO";
      t.art.setAttribute(
        "aria-label",
        `${c.nombre}: ${pts} punto${pts === 1 ? "" : "s"}${gana ? ", va ganando" : empate ? ", empatada en cabeza" : ""}`
      );
    });

    const texto = estado.ultimo && estado.ultimo.texto ? estado.ultimo.texto : "Aún no hay cambios";
    if (texto !== ultimoTexto) {
      textoUltimo.textContent = texto;
      if (ultimoTexto !== null) reiniciarAnimacion(cinta, "nueva");
      ultimoTexto = texto;
    }
  }

  // ---- Indicador de conexión ----
  const TEXTOS = { conectando: "Conectando…", "en-vivo": "En vivo", reconectando: "Reconectando…" };
  function conexion(e) {
    vivo.className = "vivo " + e;
    vivo.querySelector(".txt").textContent = TEXTOS[e] || e;
  }

  window.EnVivo({ alEstado: pintar, alCambiarConexion: conexion });
})();
