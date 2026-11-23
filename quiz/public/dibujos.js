'use strict';
// Dibujitos del quiz, hechos a mano en SVG (estilo garabato a tinta en el cuaderno).
// - DIBUJOS_CURSOS[n]: dibujo de cada asignatura (1 a 12).
// - DIBUJOS_CASAS[casa]: escudo con el animal de cada casa.
// dibujoSVG(nombre) devuelve el SVG completo como texto (sirve para la página y para la imagen PNG).
(function () {
  const T = '#2b2f5e';   // tinta
  const linea = `fill="none" stroke="${T}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const trazo = `stroke="${T}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;

  // Estrella de 4 puntas (destellos)
  const destello = (x, y, r, color = '#f2c94c') =>
    `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${color}" ${trazo} stroke-width="1.6"/>`;
  const puntos = (lista) => lista.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r || 1.4}" fill="${T}"/>`).join('');

  function espiral(cx, cy, vueltas, paso) {
    let d = '';
    for (let a = 0; a <= vueltas * Math.PI * 2; a += 0.25) {
      const r = 1.5 + paso * a;
      d += (d ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d;
  }
  function heptagrama(cx, cy, r) {
    const p = [...Array(7).keys()].map((i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / 7) * 3;
      return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    });
    return 'M' + p.join('L') + 'Z';
  }
  function melena(cx, cy, r1, r2, n) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? r1 : r2;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }

  const CURSOS = {
    // 1. Cuidado de criaturas mágicas: huevo de dragón agrietado y una huella
    1: `<ellipse cx="27" cy="35" rx="15" ry="20" fill="#cfe3b4" ${trazo}/>
        <path d="M15 31q3 3 6 0q3 3 6 0q3 3 6 0q3 3 6 0" ${linea} stroke-width="1.8"/>
        <path d="M13 41q3 3 6 0q3 3 6 0q3 3 6 0q3 3 6 0q3 3 5 1" ${linea} stroke-width="1.8"/>
        <path d="M21 17l3 5l-3 3l4 4l-2 3" ${linea}/>
        <ellipse cx="51" cy="52" rx="5" ry="4.2" fill="${T}"/>
        ${puntos([[44.5, 45.5, 2], [50, 43.5, 2], [55.5, 45.5, 2], [58, 50, 1.8]])}`,
    // 2. Pociones (años mayores): caldero burbujeante
    2: `<path d="M16 58l-3 4M48 58l3 4" ${linea}/>
        <path d="M11 30h42l-3 17q-2 12-18 12t-18-12z" fill="#3c3c52" ${trazo}/>
        <ellipse cx="32" cy="30" rx="22" ry="5" fill="#86c97a" ${trazo}/>
        <path d="M20 44q2 6 8 7" fill="none" stroke="#8a8aa8" stroke-width="2" stroke-linecap="round"/>
        <circle cx="25" cy="21" r="3.5" fill="#b9e6ac" ${trazo} stroke-width="1.8"/>
        <circle cx="35" cy="14" r="4.5" fill="#b9e6ac" ${trazo} stroke-width="1.8"/>
        <circle cx="42" cy="6" r="2.5" fill="#b9e6ac" ${trazo} stroke-width="1.6"/>
        <path d="M17 20q-4-4 0-8q3-3 0-7" ${linea} stroke-width="1.8"/>`,
    // 3. Pociones (años menores): frasquito con corcho
    3: `<path d="M27 10v11q-13 6-12 21q1 16 17 16t17-16q1-15-12-21V10z" fill="#f6e3f3"/>
        <path d="M16 40q16 6 32 0q0 15-16 15t-16-15z" fill="#c77dd0"/>
        <path d="M27 10v11q-13 6-12 21q1 16 17 16t17-16q1-15-12-21V10z" ${linea}/>
        <rect x="25" y="4" width="14" height="7" rx="2" fill="#c9a26b" ${trazo} stroke-width="2"/>
        <circle cx="27" cy="46" r="2.2" fill="#fff"/><circle cx="36" cy="49" r="1.6" fill="#fff"/><circle cx="31" cy="43" r="1.2" fill="#fff"/>
        ${destello(52, 16, 5)}`,
    // 4. Historia de la magia: pergamino y pluma
    4: `<path d="M14 15h32v33H14z" fill="#f6ead0" ${trazo}/>
        <rect x="9" y="9" width="40" height="9" rx="4.5" fill="#e3c88f" ${trazo}/>
        <rect x="14" y="45" width="40" height="9" rx="4.5" fill="#e3c88f" ${trazo}/>
        <path d="M19 25h20M19 31h16M19 37h20" ${linea} stroke-width="1.8"/>
        <path d="M60 4q-3 16-17 27q1-16 17-27z" fill="#fff" ${trazo} stroke-width="2"/>
        <path d="M43 31l-4 6M60 4l-14 22" ${linea} stroke-width="1.6"/>`,
    // 5. DCLAO: escudo con varita y destello
    5: `<path d="M32 5l21 7v16q0 19-21 30q-21-11-21-30V12z" fill="#dfe3ee" ${trazo}/>
        <path d="M32 11l15 5v12q0 14-15 23z" fill="#b9c3dc"/>
        <path d="M32 5l21 7v16q0 19-21 30q-21-11-21-30V12z" ${linea}/>
        <path d="M18 46L40 24" stroke="#6b4a2b" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M18 46l5-5" stroke="#3d2a18" stroke-width="5.5" stroke-linecap="round"/>
        ${destello(44, 20, 8)}`,
    // 6. Encantamientos: varita con chispas
    6: `<path d="M9 55L38 26" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/>
        <path d="M9 55l8-8" stroke="#3d2a18" stroke-width="6.5" stroke-linecap="round"/>
        <path d="M9 55L38 26" ${linea} stroke-width="1.2"/>
        ${destello(46, 18, 9)}${destello(56, 34, 4.5)}${destello(30, 10, 4.5)}
        ${puntos([[52, 8, 1.6], [58, 22, 1.3], [40, 33, 1.3], [22, 18, 1.2]])}`,
    // 7. Vuelo: escoba en movimiento
    7: `<path d="M10 10L40 40" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M37 39q-3 9 2 15q8 6 19 6q-1-12-7-18q-6-6-14-3z" fill="#e0b25a" ${trazo}/>
        <path d="M43 47l11 10M41 52l8 6M47 44l9 10" ${linea} stroke-width="1.6"/>
        <path d="M36 38l6 6" stroke="#5a3a1a" stroke-width="5" stroke-linecap="round"/>
        <path d="M6 28h10M4 35h12M12 42h7" ${linea} stroke-width="2"/>`,
    // 8. Aparición: remolino que hace "¡crac!"
    8: `<path d="${espiral(32, 33, 2.6, 1.35)}" ${linea}/>
        <path d="M32 4v5M54 12l-4 4M60 33h-5M10 12l4 4M4 33h5M50 54l-3-3M14 54l3-3" ${linea} stroke-width="2"/>
        ${destello(52, 46, 4)}${destello(13, 22, 3.5)}`,
    // 9. Aritmancia: heptagrama con números
    9: `<circle cx="32" cy="32" r="24" fill="#efe7fb" ${trazo}/>
        <path d="${heptagrama(32, 32, 20)}" ${linea} stroke-width="1.8"/>
        <circle cx="32" cy="32" r="8.5" fill="#fffaf0" ${trazo} stroke-width="1.8"/>
        <text x="32" y="38" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="700" fill="${T}">7</text>
        <text x="7" y="12" font-family="Georgia, serif" font-size="11" fill="${T}">3</text>
        <text x="51" y="61" font-family="Georgia, serif" font-size="11" fill="${T}">9</text>`,
    // 10. Astronomía: telescopio, luna y estrellas
    10: `<path d="M48 4a11 11 0 1 0 12 15a9 9 0 1 1-12-15z" fill="#f5e08a" ${trazo}/>
         <g transform="rotate(-32 28 36)">
           <rect x="7" y="31" width="34" height="10" rx="2" fill="#8c6bb1" ${trazo}/>
           <rect x="39" y="28.5" width="9" height="15" rx="2" fill="#6b4f8f" ${trazo}/>
           <rect x="3" y="33" width="5" height="6" rx="1" fill="#6b4f8f" ${trazo} stroke-width="1.8"/>
         </g>
         <path d="M28 40l-10 19M28 40l10 19M28 40v19" ${linea}/>
         ${destello(12, 10, 4)}${destello(30, 6, 3)}
         ${puntos([[56, 34, 1.4], [20, 20, 1.2], [44, 26, 1.2]])}`,
    // 11. Runas antiguas: piedra con runas inventadas
    11: `<path d="M13 13q19-8 38 0l5 40q-24 9-48 0z" fill="#cfcabd" ${trazo}/>
         <path d="M19 22l3 3M44 46l3-2" ${linea} stroke-width="1.4"/>
         <path d="M23 21v15M23 25l6-4M23 30l6-4" ${linea}/>
         <path d="M37 21v15M37 21l6 7l-6 7" ${linea}/>
         <path d="M21 42l5 7l5-7M26 42v11" ${linea}/>
         <path d="M38 41l6 6l-6 6" ${linea}/>`,
    // 12. Adivinación: bola de cristal
    12: `<circle cx="32" cy="27" r="19" fill="#d6ebf8" ${trazo}/>
         <path d="M21 28q6-9 14-3t11-3" fill="none" stroke="#8fb7d8" stroke-width="2.4" stroke-linecap="round"/>
         <path d="M23 34q7 5 15 0" fill="none" stroke="#b6a3dd" stroke-width="2" stroke-linecap="round"/>
         <path d="M22 19q2-6 8-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
         <path d="M19 51h26l-4-8H23z" fill="#9a6a3a" ${trazo}/>
         <rect x="14" y="50" width="36" height="7" rx="2.5" fill="#6b4220" ${trazo}/>
         ${destello(53, 10, 4.5)}${destello(9, 18, 3.5)}`,
  };

  const ESCUDO = 'M32 3l25 8v19c0 17-10 27-25 32C17 57 7 47 7 30V11z';
  function escudo(fondo, borde, dentro) {
    return `<path d="${ESCUDO}" fill="${fondo}" stroke="${borde}" stroke-width="2.6" stroke-linejoin="round"/>
            <path d="M32 8l20 6.5v15.5c0 14-8 22.5-20 27c-12-4.5-20-13-20-27V14.5z" fill="none" stroke="${borde}" stroke-width="1" opacity=".6"/>
            ${dentro}`;
  }
  const CASAS = {
    // León (Gryffindor)
    Gryffindor: escudo('#7f0909', '#3d0303',
      `<path d="${melena(32, 31, 12.5, 17, 13)}" fill="#e8a52a" stroke="#3d0303" stroke-width="1.8" stroke-linejoin="round"/>
       <circle cx="32" cy="32" r="10.5" fill="#ffd34e" stroke="#3d0303" stroke-width="1.8"/>
       <circle cx="23.5" cy="23" r="3" fill="#ffd34e" stroke="#3d0303" stroke-width="1.6"/>
       <circle cx="40.5" cy="23" r="3" fill="#ffd34e" stroke="#3d0303" stroke-width="1.6"/>
       <circle cx="28" cy="29.5" r="1.6" fill="#3d0303"/><circle cx="36" cy="29.5" r="1.6" fill="#3d0303"/>
       <path d="M29.5 34h5l-2.5 3z" fill="#3d0303"/>
       <path d="M32 37v2.5M28.5 40q3.5 2.5 7 0" fill="none" stroke="#3d0303" stroke-width="1.6" stroke-linecap="round"/>`),
    // Tejón (Hufflepuff)
    Hufflepuff: escudo('#eeb939', '#5a4205',
      `<circle cx="21" cy="19" r="3.6" fill="#1a1a1a"/><circle cx="43" cy="19" r="3.6" fill="#1a1a1a"/>
       <path d="M32 14c11 0 15 9 14 17c-1 9-7 16-14 18c-7-2-13-9-14-18c-1-8 3-17 14-17z" fill="#f4f1ea" stroke="#1a1a1a" stroke-width="2"/>
       <path d="M27 15c-3 6-5 14-3 25l5 6c-1-9 0-21 3-31z" fill="#1a1a1a"/>
       <path d="M37 15c3 6 5 14 3 25l-5 6c1-9 0-21-3-31z" fill="#1a1a1a"/>
       <circle cx="27.5" cy="31" r="1.5" fill="#fff"/><circle cx="36.5" cy="31" r="1.5" fill="#fff"/>
       <ellipse cx="32" cy="45" rx="3" ry="2.2" fill="#1a1a1a"/>`),
    // Águila (Ravenclaw)
    Ravenclaw: escudo('#1b2a5c', '#0a1230',
      `<path d="M15 47c1-12 5-22 13-27c6-4 14-4 19 0l6 5l-7 2c-1 3-1 6 1 9l-7-2c-4 4-6 9-6 15z" fill="#d9b47a" stroke="#0a1230" stroke-width="1.8" stroke-linejoin="round"/>
       <path d="M47 20l6 5l-7 2z" fill="#f0c75e" stroke="#0a1230" stroke-width="1.6" stroke-linejoin="round"/>
       <path d="M53 25q1 4-3 6" fill="none" stroke="#0a1230" stroke-width="1.6" stroke-linecap="round"/>
       <circle cx="41" cy="22.5" r="2" fill="#0a1230"/>
       <path d="M22 32q5 2 9 0M20 39q5 2 9 0M19 45q4 1 7 0" fill="none" stroke="#9c7a45" stroke-width="1.5" stroke-linecap="round"/>`),
    // Serpiente (Slytherin)
    Slytherin: escudo('#1a472a', '#0a2414',
      `<path d="M21 50c11 1 18-3 15-10s-15-6-14-14s10-10 17-8" fill="none" stroke="#0a2414" stroke-width="9" stroke-linecap="round"/>
       <path d="M21 50c11 1 18-3 15-10s-15-6-14-14s10-10 17-8" fill="none" stroke="#d6dadf" stroke-width="6" stroke-linecap="round"/>
       <path d="M24 49.5q3 .5 5 0M33 43q1-2 0-4M26 29q1-3 4-4" fill="none" stroke="#8d969f" stroke-width="1.2" stroke-linecap="round"/>
       <ellipse cx="42" cy="18" rx="6" ry="4.2" fill="#d6dadf" stroke="#0a2414" stroke-width="1.8" transform="rotate(-10 42 18)"/>
       <circle cx="43.5" cy="16.5" r="1.3" fill="#0a2414"/>
       <path d="M47.5 18.5l4 0.5l2-2M51.5 19l2 1.5" fill="none" stroke="#c0392b" stroke-width="1.4" stroke-linecap="round"/>`),
  };

  // Si un atributo aparece dos veces en la misma etiqueta, se queda el último
  // (la imagen PNG necesita un SVG estrictamente válido).
  function limpiar(svg) {
    return svg.replace(/<[a-z]+\s[^>]*>/gi, (etiqueta) => {
      const vistos = new Set();
      const partes = etiqueta.match(/\s[\w:-]+="[^"]*"/g) || [];
      const unicos = [];
      for (let i = partes.length - 1; i >= 0; i--) {
        const n = partes[i].trim().split('=')[0];
        if (!vistos.has(n)) { vistos.add(n); unicos.unshift(partes[i]); }
      }
      const nombre = etiqueta.match(/^<[a-z]+/i)[0];
      return nombre + unicos.join('') + (etiqueta.endsWith('/>') ? '/>' : '>');
    });
  }
  const hechos = {};
  function dibujoSVG(nombre) {
    if (hechos[nombre]) return hechos[nombre];
    const dentro = limpiar(CASAS[nombre] || CURSOS[nombre] || '');
    return (hechos[nombre] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${dentro}</svg>`);
  }
  window.dibujoSVG = dibujoSVG;
  window.DIBUJOS_CASAS = Object.keys(CASAS);
})();
