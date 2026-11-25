// =====================================================================
//  Fondo de noche: cielo, estrellas, luna, montañas, castillo, lago y niebla.
//  Dibujo original hecho con formas simples.
// =====================================================================
(function () {
  const caja = document.getElementById("escena");
  if (!caja) return;

  // Números "al azar" pero siempre iguales (para que el cielo no cambie al recargar)
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);

  // ---- estrellas ----
  let estrellas = "";
  for (let i = 0; i < 150; i++) {
    const x = (azar() * 1000).toFixed(1);
    const y = (azar() * azar() * 640).toFixed(1);
    const r = (0.5 + azar() * 1.4).toFixed(2);
    const titila = azar() < 0.35;
    const dur = (2.2 + azar() * 3.5).toFixed(1);
    const ret = (azar() * 5).toFixed(1);
    estrellas += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(0.45 + azar() * 0.55).toFixed(2)}"${
      titila ? ` class="titila" style="animation-duration:${dur}s;animation-delay:-${ret}s"` : ""
    }/>`;
  }
  // algunas estrellas en cruz, más brillantes
  for (const [x, y] of [[140, 90], [820, 60], [610, 210], [930, 300], [70, 330]]) {
    estrellas += `<path class="titila" style="animation-duration:4s" d="M${x} ${y - 6} L${x + 1.2} ${y - 1.2} L${x + 6} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 6} L${x - 1.2} ${y + 1.2} L${x - 6} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#fff8dc"/>`;
  }

  // ---- ventanas del castillo ----
  const ventanas = [
    [612, 470], [612, 494], [596, 534], [628, 534], [654, 552], [570, 560], [690, 548], [708, 548],
    [640, 590], [662, 590], [586, 596], [724, 584], [530, 600], [612, 438],
  ]
    .map(([x, y], i) => {
      const dur = (2.5 + ((i * 37) % 30) / 10).toFixed(1);
      return `<path class="ventana" style="animation-duration:${dur}s;animation-delay:-${(i * 0.7).toFixed(1)}s" d="M${x} ${y + 9} V${y + 3} Q${x + 2.2} ${y - 1.5} ${x + 4.4} ${y + 3} V${y + 9} Z"/>`;
    })
    .join("");

  // ---- torre con tejado puntiagudo ----
  const torre = (x, ancho, arriba, abajo, alturaTejado) => {
    const m = x + ancho / 2;
    let almenas = "";
    return `<rect x="${x}" y="${arriba}" width="${ancho}" height="${abajo - arriba}"/>
      <path d="M${x - 3} ${arriba + 1} L${m} ${arriba - alturaTejado} L${x + ancho + 3} ${arriba + 1} Z"/>
      <line x1="${m}" y1="${arriba - alturaTejado}" x2="${m}" y2="${arriba - alturaTejado - 10}" stroke="#0d0a1c" stroke-width="1.4"/>${almenas}`;
  };
  const muralla = (x, ancho, arriba, abajo) => {
    let d = `M${x} ${abajo} V${arriba}`;
    for (let k = x; k < x + ancho; k += 8) d += ` H${k + 4} V${arriba - 5} H${Math.min(k + 8, x + ancho)} V${arriba}`;
    d += ` V${abajo} Z`;
    return `<path d="${d}"/>`;
  };

  const castillo = `
    <g fill="#0d0a1c">
      ${muralla(520, 230, 590, 640)}
      ${muralla(560, 140, 560, 600)}
      ${torre(522, 20, 585, 640, 34)}
      ${torre(718, 24, 572, 640, 40)}
      ${torre(560, 26, 525, 600, 46)}
      ${torre(683, 32, 540, 600, 50)}
      ${torre(645, 26, 545, 600, 40)}
      ${torre(598, 30, 455, 600, 72)}
      ${torre(628, 12, 500, 560, 30)}
      <rect x="590" y="582" width="70" height="20"/>
      <path d="M604 600 Q625 560 646 600 Z"/>
    </g>
    <g fill="#ffcf73">${ventanas}</g>`;

  // ---------- 1) Cielo fijo con estrellas (detrás de toda la página) ----------
  caja.innerHTML = `
<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#060a22"/>
      <stop offset=".45" stop-color="#141647"/>
      <stop offset=".8" stop-color="#2b1b58"/>
      <stop offset="1" stop-color="#3d2366"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#cielo)"/>
  <g>${estrellas}</g>
</svg>`;

  // ---------- 2) Paisaje: luna, montañas, castillo, lago y niebla ----------
  const banda = document.getElementById("paisaje");
  if (!banda) return;
  // En este dibujo el agua empieza en y=330 (de 0 a 420)
  banda.innerHTML = `
<svg viewBox="0 160 1000 260" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" r=".5">
      <stop offset="0" stop-color="#fff2c8" stop-opacity=".5"/>
      <stop offset=".4" stop-color="#d9c7ff" stop-opacity=".13"/>
      <stop offset="1" stop-color="#d9c7ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="luna" cx=".4" cy=".38" r=".7">
      <stop offset="0" stop-color="#fffaf0"/>
      <stop offset=".7" stop-color="#f3e5bf"/>
      <stop offset="1" stop-color="#d9c79c"/>
    </radialGradient>
    <linearGradient id="lago" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#33246a"/>
      <stop offset=".5" stop-color="#1a1240"/>
      <stop offset="1" stop-color="#120d33"/>
    </linearGradient>
    <linearGradient id="resplandor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a4fa8" stop-opacity="0"/>
      <stop offset="1" stop-color="#7a4fa8" stop-opacity=".35"/>
    </linearGradient>
    <radialGradient id="bruma" r=".5">
      <stop offset="0" stop-color="#d8cff5" stop-opacity=".3"/>
      <stop offset="1" stop-color="#d8cff5" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="-3000" y="200" width="7000" height="132" fill="url(#resplandor)"/>
  <circle cx="215" cy="232" r="110" fill="url(#halo)"/>
  <circle cx="215" cy="232" r="28" fill="url(#luna)"/>
  <g fill="#c9b78c" opacity=".35">
    <circle cx="206" cy="225" r="4.5"/><circle cx="225" cy="241" r="5.5"/><circle cx="222" cy="220" r="2.5"/><circle cx="207" cy="245" r="2.3"/>
  </g>

  <!-- montañas lejanas y cercanas (se repiten en espejo a los lados para pantallas anchas) -->
  <g id="montes">
    <path d="M0 300 L60 262 L120 278 L190 228 L250 262 L310 246 L380 284 L430 258 L470 286 L520 272 L580 244 L640 272
             L700 252 L770 280 L840 232 L900 266 L960 250 L1000 266 V332 H0 Z" fill="#271b50"/>
    <path d="M0 312 L80 284 L150 302 L230 270 L300 300 L360 292 L420 314 L480 306 L500 332 H0 Z" fill="#1b1339"/>
    <path d="M840 332 L880 300 L940 288 L1000 296 V332 Z" fill="#1b1339"/>
  </g>
  <use href="#montes" transform="scale(-1 1)"/>
  <use href="#montes" transform="translate(2000 0) scale(-1 1)"/>
  <use href="#montes" transform="translate(-2000 0)"/>
  <use href="#montes" transform="translate(2000 0)"/>

  <!-- castillo lejano sobre el peñasco -->
  <g transform="translate(482 34) scale(.4)">${castillo}</g>
  <path d="M630 332 L655 305 L673 292 L695 286 L735 283 L773 287 L797 296 L817 314 L835 332 Z" fill="#120d27"/>
  <path d="M685 300 L707 309 L729 302 M750 298 L773 312 L793 307" stroke="#2c2252" stroke-width="1.5" fill="none"/>

  <!-- lago con reflejos -->
  <rect x="-3000" y="330" width="7000" height="90" fill="url(#lago)"/>
  <g transform="translate(0 660) scale(1 -1)" opacity=".2">
    <g transform="translate(482 34) scale(.4)">${castillo.replace(/fill="#ffcf73"/, 'fill="#ffcf73" opacity=".7"')}</g>
  </g>
  <g fill="#fff3cf" class="reflejo">
    <rect x="190" y="338" width="50" height="2.4" rx="1.2" opacity=".55"/>
    <rect x="198" y="350" width="34" height="2" rx="1" opacity=".45"/>
    <rect x="185" y="364" width="60" height="2" rx="1" opacity=".3"/>
    <rect x="204" y="380" width="22" height="1.6" rx=".8" opacity=".3"/>
  </g>
  <rect x="-3000" y="329" width="7000" height="2" fill="#7a66b8" opacity=".4"/>

  <!-- niebla -->
  <g class="niebla">
    <ellipse cx="180" cy="322" rx="320" ry="40" fill="url(#bruma)"/>
    <ellipse cx="720" cy="310" rx="360" ry="44" fill="url(#bruma)"/>
  </g>
  <g class="niebla n2">
    <ellipse cx="480" cy="345" rx="420" ry="34" fill="url(#bruma)"/>
    <ellipse cx="960" cy="338" rx="260" ry="30" fill="url(#bruma)"/>
  </g>
</svg>`;
})();
