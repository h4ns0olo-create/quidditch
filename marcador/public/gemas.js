// =====================================================================
//  Dibujos compartidos: gemas, tubos de gemas y animales de cada casa.
//  Todo está dibujado desde cero en SVG (sin imágenes ni escudos).
// =====================================================================
(function () {
  const SVGNS = "http://www.w3.org/2000/svg";

  const CASAS = [
    { id: "gryffindor", nombre: "Gryffindor", gema: "rubíes", animal: "león",
      base: "#c8102e", claro: "#ff5c70", brillo: "#ffd0d6", oscuro: "#6e0618", tinta: "#f6e7c1" },
    { id: "hufflepuff", nombre: "Hufflepuff", gema: "topacios", animal: "tejón",
      base: "#f2b705", claro: "#ffe066", brillo: "#fff6c8", oscuro: "#946500", tinta: "#3b2a1a" },
    { id: "ravenclaw", nombre: "Ravenclaw", gema: "zafiros", animal: "águila",
      base: "#2f5fc4", claro: "#6f9bff", brillo: "#dbe6ff", oscuro: "#132a6b", tinta: "#f6e7c1" },
    { id: "slytherin", nombre: "Slytherin", gema: "esmeraldas", animal: "serpiente",
      base: "#1e8a5a", claro: "#4fd08e", brillo: "#cff7e1", oscuro: "#09472b", tinta: "#f6e7c1" },
  ];
  const POR_ID = Object.fromEntries(CASAS.map((c) => [c.id, c]));

  // ---- Medidas del tubo (unidades del dibujo) ----
  const T = {
    ancho: 142, alto: 800,
    cx: 40,               // centro del tubo
    fondo: 765,           // donde se apoyan las gemas de abajo (tubo largo)
    techo: 118,           // parte más alta del tubo largo
  };
  T.altura = T.fondo - T.techo;

  // ---------------------------------------------------------------
  //  Una gema tallada vista desde arriba (octógono con facetas)
  // ---------------------------------------------------------------
  function puntoPolar(r, ang) {
    return [r * Math.cos(ang), r * Math.sin(ang)];
  }
  function f(n) {
    return Math.round(n * 100) / 100;
  }

  function gemaMarcado(c, id, grad) {
    const R = 6.2, r = 3.1;
    const ext = [], int = [];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4;
      ext.push(puntoPolar(R, a));
      int.push(puntoPolar(r, a));
    }
    const luz = (-3 * Math.PI) / 4; // la luz viene de arriba a la izquierda
    let facetas = "";
    for (let k = 0; k < 8; k++) {
      const a = ext[k], b = ext[(k + 1) % 8], cc = int[(k + 1) % 8], d = int[k];
      const medio = Math.PI / 8 + ((k + 0.5) * Math.PI) / 4;
      const brillo = Math.cos(medio - luz);
      const color = brillo > 0.5 ? c.brillo : brillo > 0.1 ? c.claro : brillo < -0.4 ? c.oscuro : c.base;
      facetas += `<polygon points="${[a, b, cc, d].map((p) => f(p[0]) + "," + f(p[1])).join(" ")}" fill="${color}" stroke="${c.oscuro}" stroke-width=".35" stroke-opacity=".6"/>`;
    }
    const contorno = ext.map((p) => f(p[0]) + "," + f(p[1])).join(" ");
    const mesa = int.map((p) => f(p[0]) + "," + f(p[1])).join(" ");
    return `
      <g id="${id}">
        <polygon points="${contorno}" fill="${c.base}" stroke="${c.oscuro}" stroke-width=".7"/>
        ${facetas}
        <polygon points="${mesa}" fill="url(#${grad})"/>
        <path d="M-2.2 -2.6 L-.6 -2.9 L-2.6 -.8 Z" fill="#fff" opacity=".85"/>
      </g>`;
  }

  // Pequeño destello de 4 puntas
  const DESTELLO = "M0 -4 L.9 -.9 L4 0 L.9 .9 L0 4 L-.9 .9 L-4 0 L-.9 -.9 Z";

  // ---------------------------------------------------------------
  //  Definiciones (gradientes, gema, montón de gemas) de una casa
  // ---------------------------------------------------------------
  function defsCasa(c, p) {
    // p = prefijo único para este dibujo
    return `
      <radialGradient id="mesa-${p}" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="${c.brillo}"/>
        <stop offset=".55" stop-color="${c.claro}"/>
        <stop offset="1" stop-color="${c.base}"/>
      </radialGradient>
      ${gemaMarcado(c, "gema-" + p, "mesa-" + p)}
      <g id="gemita-${p}"><use href="#gema-${p}" transform="scale(.9)"/></g>
      <pattern id="monton-${p}" width="24" height="19" patternUnits="userSpaceOnUse" patternTransform="translate(1 0) scale(1.05)">
        <rect width="24" height="19" fill="${c.oscuro}"/>
        <use href="#gema-${p}" transform="translate(6 5) rotate(8)"/>
        <use href="#gema-${p}" transform="translate(18 4.5) rotate(-14)"/>
        <use href="#gema-${p}" transform="translate(0 14.5) rotate(20)"/>
        <use href="#gema-${p}" transform="translate(24 14.5) rotate(20)"/>
        <use href="#gema-${p}" transform="translate(12 14) rotate(-4)"/>
        <use href="#gema-${p}" transform="translate(6 24) rotate(8)"/>
        <use href="#gema-${p}" transform="translate(18 23.5) rotate(-14)"/>
        <use href="#gema-${p}" transform="translate(6 -14) rotate(8)"/>
        <use href="#gema-${p}" transform="translate(12 -5) rotate(-4)"/>
        <use href="#gema-${p}" transform="translate(0 -4.5) rotate(20)"/>
        <use href="#gema-${p}" transform="translate(24 -4.5) rotate(20)"/>
      </pattern>`;
  }

  // Defs comunes (latón y vidrio) — se repiten por dibujo con su prefijo
  function defsComunes(p) {
    return `
      <linearGradient id="laton-${p}" x1="0" x2="1">
        <stop offset="0" stop-color="#6b4c17"/>
        <stop offset=".35" stop-color="#f4dc8f"/>
        <stop offset=".6" stop-color="#c39a43"/>
        <stop offset="1" stop-color="#5a3f12"/>
      </linearGradient>
      <linearGradient id="latonv-${p}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6e09a"/>
        <stop offset=".5" stop-color="#b8903a"/>
        <stop offset="1" stop-color="#5a3f12"/>
      </linearGradient>
      <radialGradient id="esfera-${p}" cx=".35" cy=".3" r=".75">
        <stop offset="0" stop-color="#fff3c4"/>
        <stop offset=".35" stop-color="#e2c46f"/>
        <stop offset="1" stop-color="#5e4314"/>
      </radialGradient>
      <linearGradient id="vidrio-${p}" x1="0" x2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
        <stop offset=".18" stop-color="#fff" stop-opacity=".06"/>
        <stop offset=".65" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".88" stop-color="#fff" stop-opacity=".14"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".04"/>
      </linearGradient>
      <linearGradient id="sombra-${p}" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".55"/>
        <stop offset=".3" stop-color="#000" stop-opacity="0"/>
        <stop offset=".7" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".6"/>
      </linearGradient>`;
  }

  // ---------------------------------------------------------------
  //  Animales (dibujos simples originales), centrados en (0,0)
  // ---------------------------------------------------------------
  function animal(casa, tinta, fondo) {
    if (casa === "gryffindor") {
      // León: melena de puntas, cara redonda
      let melena = "";
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12 - Math.PI / 2;
        const r = k % 2 === 0 ? 11 : 8.4;
        melena += (k ? "L" : "M") + f(r * Math.cos(a)) + " " + f(r * Math.sin(a));
      }
      return `
        <path d="${melena}Z" fill="${tinta}"/>
        <circle cx="-5.4" cy="-5.6" r="2" fill="${tinta}"/><circle cx="5.4" cy="-5.6" r="2" fill="${tinta}"/>
        <circle r="6.6" fill="${fondo}"/>
        <circle cx="-2.4" cy="-1.6" r="1" fill="${tinta}"/><circle cx="2.4" cy="-1.6" r="1" fill="${tinta}"/>
        <path d="M-1.6 1.2 H1.6 L0 2.9 Z" fill="${tinta}"/>
        <path d="M0 2.9 V4 M0 4 Q-1.6 5.2 -2.6 4.2 M0 4 Q1.6 5.2 2.6 4.2" stroke="${tinta}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
    }
    if (casa === "hufflepuff") {
      // Tejón: cabeza triangular con franja clara en el centro
      return `
        <circle cx="-7" cy="-6.5" r="2.6" fill="${tinta}"/><circle cx="7" cy="-6.5" r="2.6" fill="${tinta}"/>
        <path d="M-9.5 -4 Q-9.5 -9 0 -9 Q9.5 -9 9.5 -4 Q9 2 0 10 Q-9 2 -9.5 -4 Z" fill="${tinta}"/>
        <path d="M-2.6 -8.9 Q0 -9.4 2.6 -8.9 L1.6 6.5 Q0 7.6 -1.6 6.5 Z" fill="#fff6dc"/>
        <path d="M-9.3 -3.2 Q-7.5 -4.2 -5.6 -2.8 L-4.4 3 Q-7.5 0.5 -9.3 -3.2 Z" fill="#fff6dc"/>
        <path d="M9.3 -3.2 Q7.5 -4.2 5.6 -2.8 L4.4 3 Q7.5 0.5 9.3 -3.2 Z" fill="#fff6dc"/>
        <circle cx="-4.4" cy="-2" r="1.1" fill="#fff6dc"/><circle cx="4.4" cy="-2" r="1.1" fill="#fff6dc"/>
        <ellipse cx="0" cy="8.4" rx="1.9" ry="1.3" fill="${tinta}"/>`;
    }
    if (casa === "ravenclaw") {
      // Águila: cabeza de perfil con pico curvo
      return `
        <path d="M-9 10 Q-10 0 -6 -5 Q-1 -10 5 -8 Q9 -6.5 10.5 -3.5 Q11.5 -1 10 1.8 Q9.2 0 7.4 0 Q6 0 5 1.4
                 Q3 4 3.6 10 Z" fill="${tinta}"/>
        <path d="M5.4 -0.3 Q8 -1.2 10 1.8 Q9.6 3.6 8.2 4.2 Q8.6 2.6 7.4 1.6 Q6.2 1 5.4 -0.3 Z" fill="${fondo}" opacity=".55"/>
        <circle cx="3.2" cy="-3.8" r="1.4" fill="${fondo}"/><circle cx="3.5" cy="-4" r=".5" fill="${tinta}"/>
        <path d="M-7 3 L-4 1.5 L-5 5 L-2 3.2 L-2.6 7 L0.2 5" stroke="${fondo}" stroke-width=".9" fill="none" stroke-linejoin="round"/>`;
    }
    // Serpiente: cuerpo en S con cabeza y lengua
    return `
      <path d="M-8 9 Q-11 9 -11 6 Q-11 3 -7 3 H5 Q9 3 9 -0.5 Q9 -4 5 -4 H-1" stroke="${tinta}" stroke-width="3.4"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-1 -4 Q-3 -4 -4.5 -5.6" stroke="${tinta}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="-5.6" cy="-7.4" rx="3.4" ry="2.6" transform="rotate(-25 -5.6 -7.4)" fill="${tinta}"/>
      <circle cx="-5" cy="-8.3" r=".75" fill="${fondo}"/>
      <path d="M-8.6 -6.4 L-11 -5.6 M-11 -5.6 L-12 -6.6 M-11 -5.6 L-11.6 -4.4" stroke="${tinta}" stroke-width=".7" stroke-linecap="round"/>
      <path d="M-4 3 V-0 M1 3 V0 M5 3 V0" stroke="${fondo}" stroke-width=".5" opacity=".5"/>`;
  }

  // ---------------------------------------------------------------
  //  El tubo completo de una casa
  // ---------------------------------------------------------------
  let contador = 0;
  function tuboSVG(casaId) {
    const c = POR_ID[casaId];
    const p = casaId.slice(0, 3) + ++contador;
    const { cx, fondo, techo } = T;

    // Marquitas de escala junto al tubo
    let marcas = `<line x1="78" y1="${techo}" x2="78" y2="${fondo}" stroke="#e2c46f" stroke-opacity=".35" stroke-width=".8"/>`;
    for (let t = 0; t <= 20; t++) {
      const y = f(fondo - (t / 20) * T.altura);
      const largo = t % 10 === 0;
      const medio = !largo && t % 2 === 0;
      marcas += `<line x1="${largo ? 73.5 : medio ? 74.5 : 76}" y1="${y}" x2="${largo ? 82.5 : medio ? 81.5 : 80}" y2="${y}" stroke="#e2c46f" stroke-width="${largo ? 1.3 : medio ? 1 : 0.7}" stroke-linecap="round"/>`;
    }

    // Gemas de la superficie del montón (forma de lomita)
    const superficie = [
      [23, 3, 10], [31, 0.6, -20], [40, -1.4, 30], [49, 0.6, -25], [57, 3, 15],
      [27, 8, -10], [35.5, 6, 25], [44.5, 6, -15], [53, 8, 5],
    ]
      .map(([x, y, r]) => `<use href="#gema-${p}" transform="translate(${x} ${y}) rotate(${r}) scale(1.3)"/>`)
      .join("");

    const superficieDeposito = [
      [24, 25, 15], [32, 23, -10], [40, 22.5, 25], [48, 23, -5], [56, 25, 20],
    ]
      .map(([x, y, r]) => `<use href="#gema-${p}" transform="translate(${x} ${y}) rotate(${r}) scale(1.3)"/>`)
      .join("");

    // Corriente de gemas que cae
    let corriente = "";
    const N = 10;
    for (let i = 0; i < N; i++) {
      const dx = [0, -1.6, 1.4, -0.6, 1.8, -1.2, 0.8, -1.8, 1.1, -0.3][i];
      corriente += `<use href="#gemita-${p}" x="${cx + dx}" y="96" class="cae" style="animation-delay:${f((-i * 2.6) / N)}s"/>`;
    }
    // Versión quieta (para quien pide "reducir movimiento")
    for (let i = 0; i < 20; i++) {
      corriente += `<use href="#gemita-${p}" x="${cx + (i % 2 ? 1 : -1)}" y="${104 + i * 34}" class="estatica"/>`;
    }

    const interiorTubo = `M20 ${techo - 2} V${fondo - 5} Q20 ${fondo + 3} 31 ${fondo + 3} H49 Q60 ${fondo + 3} 60 ${fondo - 5} V${techo - 2} Z`;
    const exteriorTubo = `M18 ${techo - 2} V${fondo - 5} Q18 ${fondo + 5} 31 ${fondo + 5} H49 Q62 ${fondo + 5} 62 ${fondo - 5} V${techo - 2} Z`;
    const bulbo = "M22 17 H58 Q64 17 64 27 V58 Q64 80 46 91 V102 H34 V91 Q16 80 16 58 V27 Q16 17 22 17 Z";
    const bulboInt = "M23 19 H57 Q62 19 62 28 V58 Q62 78 44.5 89.5 V102 H35.5 V89.5 Q18 78 18 58 V28 Q18 19 23 19 Z";

    return `
<svg class="tubo-svg" viewBox="0 0 ${T.ancho} ${T.alto}" xmlns="${SVGNS}" role="img" aria-hidden="true">
  <defs>
    ${defsComunes(p)}
    ${defsCasa(c, p)}
    <clipPath id="int-${p}"><path d="${interiorTubo}"/></clipPath>
    <clipPath id="bulbo-${p}"><path d="${bulboInt}"/></clipPath>
    <clipPath id="caida-${p}"><path d="${interiorTubo}"/><rect x="35.5" y="88" width="9" height="32"/></clipPath>
  </defs>

  <!-- varillas de latón -->
  <rect x="7.5" y="12" width="5" height="${fondo + 1}" rx="2.5" fill="url(#laton-${p})"/>
  <rect x="67.5" y="12" width="5" height="${fondo + 1}" rx="2.5" fill="url(#laton-${p})"/>

  <!-- depósito de arriba: siempre lleno -->
  <path d="${bulbo}" fill="rgba(8,10,28,.6)"/>
  <g clip-path="url(#bulbo-${p})">
    <rect x="14" y="26" width="52" height="80" fill="url(#monton-${p})"/>
    ${superficieDeposito}
    <rect x="14" y="17" width="52" height="90" fill="url(#sombra-${p})"/>
  </g>
  <path d="${bulbo}" fill="url(#vidrio-${p})" stroke="rgba(255,255,255,.5)" stroke-width="1.1"/>
  <path d="M21 30 Q21 22 27 21" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- tubo largo -->
  <path d="${exteriorTubo}" fill="rgba(8,10,28,.62)"/>
  <g clip-path="url(#caida-${p})" class="corriente">${corriente}</g>
  <g clip-path="url(#int-${p})">
    <g class="monton" style="transform:translateY(${fondo + 20}px)">
      <rect x="16" y="3" width="48" height="${T.altura + 40}" fill="url(#monton-${p})"/>
      ${superficie}
      <path class="destello" d="${DESTELLO}" transform="translate(30 4)" fill="#fff"/>
      <path class="destello d2" d="${DESTELLO}" transform="translate(50 9) scale(.8)" fill="#fff"/>
      <path class="destello d3" d="${DESTELLO}" transform="translate(39 22) scale(.7)" fill="#fff"/>
    </g>
    <rect x="16" y="${techo - 4}" width="48" height="${T.altura + 12}" fill="url(#sombra-${p})"/>
  </g>
  <path d="${exteriorTubo}" fill="url(#vidrio-${p})" stroke="rgba(255,255,255,.5)" stroke-width="1.1"/>
  <rect x="23" y="${techo + 6}" width="2.6" height="${T.altura - 18}" rx="1.3" fill="#fff" opacity=".28"/>
  <rect x="55" y="${techo + 30}" width="1.4" height="${T.altura - 80}" rx=".7" fill="#fff" opacity=".14"/>

  <!-- estructura de latón con esferas -->
  <rect x="3" y="7" width="74" height="9" rx="3" fill="url(#latonv-${p})"/>
  <circle cx="40" cy="5" r="4.2" fill="url(#esfera-${p})"/>
  <circle cx="10" cy="10.5" r="5.5" fill="url(#esfera-${p})"/>
  <circle cx="70" cy="10.5" r="5.5" fill="url(#esfera-${p})"/>
  <rect x="3" y="104" width="74" height="9" rx="3" fill="url(#latonv-${p})"/>
  <circle cx="10" cy="108.5" r="4.6" fill="url(#esfera-${p})"/>
  <circle cx="70" cy="108.5" r="4.6" fill="url(#esfera-${p})"/>
  <rect x="3" y="${fondo + 6}" width="74" height="10" rx="3" fill="url(#latonv-${p})"/>
  <rect x="11" y="${fondo + 16}" width="58" height="7" rx="2" fill="url(#laton-${p})"/>
  <circle cx="10" cy="${fondo + 11}" r="5.5" fill="url(#esfera-${p})"/>
  <circle cx="70" cy="${fondo + 11}" r="5.5" fill="url(#esfera-${p})"/>
  <circle cx="16" cy="${fondo + 26}" r="3.4" fill="url(#esfera-${p})"/>
  <circle cx="64" cy="${fondo + 26}" r="3.4" fill="url(#esfera-${p})"/>

  <!-- escala y placa del animal -->
  ${marcas}
  <g class="placa" style="transform:translate(82px, ${fondo}px)">
   <g transform="scale(1.24)">
    <path d="M0 0 L7 -7 V-13 Q7 -16 10 -16 H43 Q46 -16 46 -13 V13 Q46 16 43 16 H10 Q7 16 7 13 V7 Z"
          fill="${c.base}" stroke="#e2c46f" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M10.5 -13 H42.5 V13 H10.5 Z" fill="none" stroke="${c.tinta}" stroke-opacity=".35" stroke-width=".6"/>
    <g transform="translate(26.5 0.4) scale(.98)">${animal(c.id, c.tinta, c.base)}</g>
   </g>
  </g>
</svg>`;
  }

  // Altura (en unidades del dibujo) que corresponde a un nivel de 0 a 1
  function yDeNivel(nivel) {
    return T.fondo - nivel * T.altura;
  }

  // Gema suelta (para botones y registro)
  function gemaIcono(casaId, tam = 28) {
    const c = POR_ID[casaId];
    const p = "ico" + casaId.slice(0, 3) + ++contador;
    return `<svg width="${tam}" height="${tam}" viewBox="-7.5 -7.5 15 15" aria-hidden="true">
      <defs><radialGradient id="mesa-${p}" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="${c.brillo}"/><stop offset=".55" stop-color="${c.claro}"/><stop offset="1" stop-color="${c.base}"/>
      </radialGradient>${gemaMarcado(c, "gema-" + p, "mesa-" + p)}</defs>
      <use href="#gema-${p}"/>
    </svg>`;
  }

  window.Gemas = { CASAS, POR_ID, T, tuboSVG, yDeNivel, gemaIcono, animal };
})();
