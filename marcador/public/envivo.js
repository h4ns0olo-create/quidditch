// =====================================================================
//  Conexión en vivo con el servidor (WebSocket) con reconexión automática.
//  - Recibe el estado de los puntos cada vez que algo cambia.
//  - Manda "ping" cada 25 s; si no hay respuesta, reconecta.
//  - Si se corta, reintenta solo (1 s, 2 s, 4 s… hasta 15 s).
//  - Al volver a la pestaña o recuperar internet, reconecta enseguida.
//  - Si el WebSocket no funciona en esa red, pide el estado cada 15 s.
// =====================================================================
(function () {
  function EnVivo({ alEstado, alCambiarConexion }) {
    let ws = null;
    let intentos = 0;
    let temporizador = null;
    let pingTimer = null;
    let vigia = null;
    let sondeo = null;
    let ultimoMensaje = 0;

    function estadoConexion(e) {
      alCambiarConexion && alCambiarConexion(e);
    }

    async function pedirEstado() {
      try {
        const r = await fetch("/api/estado", { cache: "no-store" });
        if (r.ok) alEstado(await r.json());
        return r.ok;
      } catch {
        return false;
      }
    }

    function limpiar() {
      clearInterval(pingTimer);
      clearTimeout(vigia);
      pingTimer = vigia = null;
    }

    function conectar() {
      clearTimeout(temporizador);
      temporizador = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      estadoConexion(intentos === 0 ? "conectando" : "reconectando");
      let socket;
      try {
        socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
      } catch {
        programarReconexion();
        return;
      }
      ws = socket;

      socket.onopen = () => {
        intentos = 0;
        ultimoMensaje = Date.now();
        estadoConexion("en-vivo");
        detenerSondeo();
        limpiar();
        pingTimer = setInterval(() => latido(), 25000);
      };
      socket.onmessage = (ev) => {
        ultimoMensaje = Date.now();
        clearTimeout(vigia);
        vigia = null;
        if (ev.data === "pong") return;
        try {
          const datos = JSON.parse(ev.data);
          if (datos && datos.tipo === "estado") alEstado(datos);
        } catch {
          /* mensaje raro: se ignora */
        }
      };
      socket.onclose = () => {
        if (ws !== socket) return;
        ws = null;
        limpiar();
        programarReconexion();
      };
      socket.onerror = () => {
        try { socket.close(); } catch { /* nada */ }
      };
    }

    // Comprueba que la conexión sigue viva
    function latido() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return conectar();
      try { ws.send("ping"); } catch { /* se detecta abajo */ }
      clearTimeout(vigia);
      vigia = setTimeout(() => {
        // Sin respuesta en 8 s: la conexión está muerta aunque no lo diga
        if (Date.now() - ultimoMensaje > 8000 && ws) {
          const viejo = ws;
          ws = null;
          try { viejo.close(); } catch { /* nada */ }
          limpiar();
          programarReconexion(true);
        }
      }, 8000);
    }

    function programarReconexion(rapido) {
      estadoConexion("reconectando");
      intentos++;
      if (intentos >= 3) iniciarSondeo();
      const espera = rapido ? 300 : Math.min(15000, 1000 * 2 ** Math.min(intentos - 1, 4)) + Math.random() * 1000;
      clearTimeout(temporizador);
      temporizador = setTimeout(conectar, espera);
    }

    function iniciarSondeo() {
      if (sondeo) return;
      pedirEstado();
      sondeo = setInterval(pedirEstado, 15000);
    }
    function detenerSondeo() {
      clearInterval(sondeo);
      sondeo = null;
    }

    function despertar() {
      if (document.visibilityState !== "visible") return;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        intentos = 0;
        conectar();
      } else if (ws.readyState === WebSocket.OPEN) {
        latido();
      }
    }

    document.addEventListener("visibilitychange", despertar);
    window.addEventListener("online", despertar);
    window.addEventListener("pageshow", despertar);

    pedirEstado();
    conectar();

    return { pedirEstado };
  }

  window.EnVivo = EnVivo;
})();
