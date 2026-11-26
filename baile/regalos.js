// Regalos del Baile de Navidad: nombre, descripción y dibujo (SVG hecho a mano, igual en todos los celulares).
// Para quitar un regalo, borra su línea aquí y su id en la lista "regalos" de supabase.sql.
(function () {
  const brillo = (x, y, r, c = '#ffd56b') =>
    `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${c}"/>`;
  const corazon = (x, y, s, c) =>
    `<path d="M${x} ${y + 6 * s}C${x - 9 * s} ${y} ${x - 6 * s} ${y - 7 * s} ${x} ${y - 3 * s}C${x + 6 * s} ${y - 7 * s} ${x + 9 * s} ${y} ${x} ${y + 6 * s}Z" fill="${c}"/>`;
  const flor = (cx, cy, r, c, centro) => {
    let s = '';
    for (let k = 0; k < 5; k++) {
      const a = (k * 72 - 90) * Math.PI / 180;
      s += `<circle cx="${(cx + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${c}"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(1)}" fill="${centro}"/>`;
  };
  let nHalo = 0;
  const halo = (cx, cy, r, c = '#ffe08a') => { const id = 'halo' + (++nHalo) + Math.random().toString(36).slice(2, 6);
    return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`; };
  const sombra = (y = 58, rx = 18) => `<ellipse cx="32" cy="${y}" rx="${rx}" ry="3" fill="#000" opacity=".2"/>`;

  // ----- Piezas para los ramos, pasteles y peluches
  const hojasRamo = () => `<g fill="#3f9150"><ellipse cx="16" cy="28" rx="8" ry="3" transform="rotate(-38 16 28)"/><ellipse cx="48" cy="28" rx="8" ry="3" transform="rotate(38 48 28)"/>
    <ellipse cx="25" cy="13" rx="2.6" ry="7" transform="rotate(-20 25 13)" fill="#4ca35d"/><ellipse cx="40" cy="13" rx="2.6" ry="7" transform="rotate(20 40 13)" fill="#4ca35d"/></g>`;
  const papel = (c1, c2, lazo) => `<path d="M14 33H50L38 61H26Z" fill="${c1}"/><path d="M14 33 32 37 26 61Z" fill="${c2}" opacity=".7"/>
    <path d="M50 33 32 37 38 61Z" fill="#fff" opacity=".25"/><path d="M14 33 32 37 50 33" fill="none" stroke="${c2}" stroke-width=".8"/>
    <path d="M32 47C26 41 21 45 24 49.5 26 52 30 49 32 47ZM32 47C38 41 43 45 40 49.5 38 52 34 49 32 47Z" fill="${lazo}"/>
    <path d="M31 48 27 57.5M33 48 37 57.5" stroke="${lazo}" stroke-width="2.2" stroke-linecap="round"/><circle cx="32" cy="47.6" r="2.2" fill="${lazo}"/>`;
  const rosaF = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c21d3c"/><path d="M${x - r * .7} ${y - r * .1}Q${x} ${y - r} ${x + r * .7} ${y - r * .1}" stroke="#ec4a64" stroke-width="${r * .28}" fill="none" stroke-linecap="round"/>
    <path d="M${x - r * .45} ${y + r * .15}Q${x} ${y + r * .7} ${x + r * .45} ${y + r * .15}" stroke="#9a142f" stroke-width="${r * .22}" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${r * .35}" fill="#e0334f"/>
    <path d="M${x - r * .15} ${y - r * .05}a${r * .18} ${r * .18} 0 1 1 ${r * .3} ${r * .1}" stroke="#8c0f29" stroke-width="${r * .12}" fill="none"/>`;
  const tulipan = (x, y, c, c2) => `<path d="M${x - 5} ${y - 1}C${x - 6} ${y - 8} ${x - 4} ${y - 10} ${x - 2.5} ${y - 9}L${x} ${y - 5}L${x + 2.5} ${y - 9}C${x + 4} ${y - 10} ${x + 6} ${y - 8} ${x + 5} ${y - 1}C${x + 4} ${y + 4} ${x - 4} ${y + 4} ${x - 5} ${y - 1}Z" fill="${c}"/>
    <path d="M${x} ${y - 5}C${x - 1.5} ${y - 1} ${x - 1.5} ${y + 1} ${x} ${y + 3}" stroke="${c2}" stroke-width="1" fill="none"/>`;
  const petalos = (x, y, r, n, c, w) => { let s = ''; for (let k = 0; k < n; k++) s += `<ellipse cx="${x}" cy="${(y - r * .58).toFixed(2)}" rx="${(r * w).toFixed(2)}" ry="${(r * .44).toFixed(2)}" fill="${c}" transform="rotate(${(k * 360 / n).toFixed(1)} ${x} ${y})"/>`; return s; };
  const margarita = (x, y, r) => petalos(x, y, r, 11, '#fff', .2) + `<circle cx="${x}" cy="${y}" r="${r * .3}" fill="#f2c230"/>`;
  const girasol = (x, y, r) => petalos(x, y, r, 13, '#f5b81c', .2) + `<circle cx="${x}" cy="${y}" r="${r * .4}" fill="#6b3e1e"/><circle cx="${x}" cy="${y}" r="${r * .26}" fill="#4a2a12"/>`;
  const lirio = (x, y, r, c, c2) => petalos(x, y, r, 6, c, .28) + petalos(x, y, r * .6, 3, c2, .3) + `<path d="M${x} ${y}l-1.5 -3M${x} ${y}l1.5 -3M${x} ${y}l0 -3.5" stroke="#d48a2a" stroke-width=".7"/><circle cx="${x}" cy="${y}" r="${r * .14}" fill="#e8a33a"/>`;
  const plato = () => `<ellipse cx="32" cy="55" rx="25" ry="5" fill="#dfe8f6" opacity=".35"/>`;
  const fresa = (x, y) => `<path d="M${x - 3.2} ${y - 1.5}C${x - 3.2} ${y + 2} ${x - 1} ${y + 4} ${x} ${y + 4.5}C${x + 1} ${y + 4} ${x + 3.2} ${y + 2} ${x + 3.2} ${y - 1.5}C${x + 1.6} ${y - 2.6} ${x - 1.6} ${y - 2.6} ${x - 3.2} ${y - 1.5}Z" fill="#e8304a"/>
    <path d="M${x - 2.4} ${y - 2}L${x} ${y - 3.6}L${x + 2.4} ${y - 2}L${x} ${y - 1.2}Z" fill="#3f9150"/><circle cx="${x - 1}" cy="${y + .5}" r=".35" fill="#ffe08a"/><circle cx="${x + 1}" cy="${y + 1.6}" r=".35" fill="#ffe08a"/><circle cx="${x + .6}" cy="${y - .2}" r=".35" fill="#ffe08a"/>`;
  const peluche = (dentro) => sombra(58, 16) + dentro;
  const ojos = (x1, y1, x2, y2) => `<ellipse cx="${x1}" cy="${y1}" rx="2.2" ry="2.7" fill="#24192e"/><ellipse cx="${x2}" cy="${y2}" rx="2.2" ry="2.7" fill="#24192e"/>
    <circle cx="${x1 - .7}" cy="${y1 - 1}" r=".9" fill="#fff"/><circle cx="${x2 - .7}" cy="${y2 - 1}" r=".9" fill="#fff"/>`;
  const mejillas = (x1, y1, x2, y2) => `<ellipse cx="${x1}" cy="${y1}" rx="2.4" ry="1.5" fill="#f08aa8" opacity=".55"/><ellipse cx="${x2}" cy="${y2}" rx="2.4" ry="1.5" fill="#f08aa8" opacity=".55"/>`;
  const patitas = (c) => `<ellipse cx="25" cy="56" rx="4.5" ry="2.8" fill="${c}"/><ellipse cx="39" cy="56" rx="4.5" ry="2.8" fill="${c}"/>`;
  const lazo = (x, y, c) => `<path d="M${x} ${y}l-6 -3v6zM${x} ${y}l6 -3v6z" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/>`;

  const D = {
    rosa: () => `
      <path d="M32 33C31 42 33 50 32 58" stroke="#2f7a3e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M32 47C26 47 21 43 20 38C26 38 30 41 32 47Z" fill="#45a35a"/>
      <path d="M32 43C38 43 43 39 44 34C38 34 34 37 32 43Z" fill="#3c9150"/>
      <path d="M19 20C19 11 25 7 32 7S45 11 45 20C45 28 39 34 32 34S19 28 19 20Z" fill="#c21d3c"/>
      <path d="M22 16C24 10 29 9 32 9S40 10 42 16C38 13 35 12.5 32 12.5S26 13 22 16Z" fill="#ec4a64"/>
      <path d="M24 24C26 29 29 31 32 31S38 29 40 24C37 26.5 35 27 32 27S27 26.5 24 24Z" fill="#9a142f"/>
      <path d="M27 19C27 15 30 14 32 14C35 14 37 16 37 19S35 24 32 24 27 22 27 19Z" fill="#e0334f"/>
      <path d="M30 18.5C30 17 31 16.5 32 16.5 33.5 16.5 34.5 17.5 34.5 19S33 21.5 31.8 21.5" stroke="#8c0f29" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      ${brillo(51, 11, 4)}${brillo(12, 31, 3)}${brillo(50, 42, 2.4)}`,
    rana: () => `${sombra(55, 20)}
      <path d="M13 50C9 44 12 38 19 40L22 50Z" fill="#5e3519"/><path d="M51 50C55 44 52 38 45 40L42 50Z" fill="#5e3519"/>
      <ellipse cx="32" cy="42" rx="17" ry="11" fill="#7b4723"/>
      <ellipse cx="32" cy="31" rx="15" ry="10" fill="#8d5429"/>
      <circle cx="23" cy="23" r="6" fill="#8d5429"/><circle cx="41" cy="23" r="6" fill="#8d5429"/>
      <circle cx="23" cy="22.5" r="3.6" fill="#fff4e0"/><circle cx="41" cy="22.5" r="3.6" fill="#fff4e0"/>
      <circle cx="23.6" cy="23" r="1.8" fill="#2a1408"/><circle cx="41.6" cy="23" r="1.8" fill="#2a1408"/>
      <path d="M25 33Q32 38 39 33" stroke="#4a2810" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="20.5" cy="32" r="2" fill="#c47a4a" opacity=".7"/><circle cx="43.5" cy="32" r="2" fill="#c47a4a" opacity=".7"/>
      <ellipse cx="22" cy="51.5" rx="5" ry="2.5" fill="#6a3c1d"/><ellipse cx="42" cy="51.5" rx="5" ry="2.5" fill="#6a3c1d"/>
      <path d="M21 28Q25 25 29 26" stroke="#c98a5a" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
      ${brillo(53, 13, 4)}${brillo(10, 20, 2.5)}`,
    grajeas: () => `${sombra(58, 16)}
      <ellipse cx="25" cy="18" rx="3.6" ry="2.4" fill="#f25c8a" transform="rotate(-25 25 18)"/>
      <ellipse cx="32" cy="15" rx="3.6" ry="2.4" fill="#6ac46a" transform="rotate(15 32 15)"/>
      <ellipse cx="39" cy="18.5" rx="3.6" ry="2.4" fill="#f2c14e" transform="rotate(30 39 18.5)"/>
      <ellipse cx="28.5" cy="21.5" rx="3.6" ry="2.4" fill="#6aa8f2" transform="rotate(10 28.5 21.5)"/>
      <ellipse cx="36" cy="22" rx="3.6" ry="2.4" fill="#a77ad9" transform="rotate(-15 36 22)"/>
      <path d="M18 26L46 26 43 56 21 56Z" fill="#f6ecd8"/>
      <path d="M24.5 26 26.2 56M32 26V56M39.5 26 37.8 56" stroke="#d9473f" stroke-width="3.2"/>
      <rect x="16.5" y="23" width="31" height="5" rx="1.5" fill="#c23a33"/>
      <ellipse cx="32" cy="41" rx="9" ry="6.5" fill="#fff8e8" stroke="#c9a24a" stroke-width="1.5"/>
      <text x="32" y="44.6" font-size="10" text-anchor="middle" font-family="Georgia,serif" font-weight="700" fill="#8a2a22">B</text>
      <ellipse cx="50" cy="55" rx="3.4" ry="2.2" fill="#f28a3c" transform="rotate(20 50 55)"/>
      <ellipse cx="13" cy="56" rx="3.4" ry="2.2" fill="#fff" transform="rotate(-20 13 56)"/>
      <circle cx="12" cy="55.5" r=".7" fill="#c9a24a"/><circle cx="14" cy="56.5" r=".6" fill="#c9a24a"/>`,
    ramillete: () => `
      <path d="M11 46Q32 59 53 46" stroke="#eab0c6" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <path d="M11 46Q32 59 53 46" stroke="#fff" stroke-width="1.6" fill="none" stroke-dasharray="0.1 5" stroke-linecap="round"/>
      <path d="M18 37C13 31 15 24 22 24 24 30 22 34 18 37Z" fill="#4c9a5b"/>
      <path d="M46 37C51 31 49 24 42 24 40 30 42 34 46 37Z" fill="#4c9a5b"/>
      <path d="M32 46 26 54M32 46 38 54" stroke="#e58aa8" stroke-width="2.4" stroke-linecap="round"/>
      ${flor(21, 38, 7.5, '#f7c6d6', '#e58aa8')}${flor(43, 38, 7.5, '#f7c6d6', '#e58aa8')}${flor(32, 30, 11, '#ffffff', '#f2c94c')}
      ${brillo(52, 14, 3.5)}${brillo(12, 16, 2.5)}`,
    copo: () => {
      let s = '<g stroke="#d6eaff" stroke-width="2.6" stroke-linecap="round" fill="none">';
      for (let k = 0; k < 6; k++) s += `<path transform="rotate(${k * 60} 32 32)" d="M32 32V8M32 15 26.5 10.5M32 15 37.5 10.5M32 23 27.5 19M32 23 36.5 19"/>`;
      return s + `</g><circle cx="32" cy="32" r="4" fill="#fff"/>${brillo(52, 12, 3.5, '#fff')}${brillo(12, 50, 2.5, '#fff')}`;
    },
    pastel: () => `
      <ellipse cx="32" cy="54" rx="26" ry="5" fill="#cfe0f7" opacity=".28"/>
      <path d="M10 42 54 46 54 52 10 48Z" fill="#d9761c"/>
      <path d="M10 48 54 52 54 55 10 51Z" fill="#c4874a"/>
      <path d="M10 42 52 26A18 18 0 0 1 54 46Z" fill="#f29a3a"/>
      <path d="M52 26A18 18 0 0 1 54 46" stroke="#d9a066" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M34 36C30 36 29 31.5 32.5 30.5 32.5 26.5 38.5 26.5 38.5 30.5 42 31.5 41 36 37 36Z" fill="#fff8ec"/>
      <path d="M22 20Q19 16 22 12M30 18Q33 14 30 10" stroke="#cfe0f7" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`,
    snitch: () => `
      ${halo(32, 32, 20)}
      <path d="M25 30C15 17 5 19 3 25 9 25 13 29 25 34Z" fill="#f3f0e6"/>
      <path d="M39 30C49 17 59 19 61 25 55 25 51 29 39 34Z" fill="#f3f0e6"/>
      <path d="M7 25C13 25 17 28 24 32M10 21C15 21 19 25 24.5 29.5M57 25C51 25 47 28 40 32M54 21C49 21 45 25 39.5 29.5" stroke="#cfc6ad" stroke-width="1" fill="none"/>
      <circle cx="32" cy="32" r="10" fill="#e8b93a"/>
      <path d="M22.5 32Q32 26 41.5 32M24 37Q32 33 40 37" stroke="#b8862a" stroke-width="1.3" fill="none"/>
      <circle cx="28.5" cy="28.5" r="3.4" fill="#fff2b8" opacity=".85"/>
      ${brillo(48, 46, 3)}${brillo(14, 44, 2.4)}`,
    lechuza: () => `${sombra(58, 15)}
      <path d="M17 25 20 12 27 21Z" fill="#a87a4f"/><path d="M47 25 44 12 37 21Z" fill="#a87a4f"/>
      <ellipse cx="32" cy="38" rx="17" ry="18" fill="#a87a4f"/>
      <path d="M15 38C12 46 16 52 20 54 20 46 19 42 15 38Z" fill="#8a6038"/><path d="M49 38C52 46 48 52 44 54 44 46 45 42 49 38Z" fill="#8a6038"/>
      <ellipse cx="32" cy="44" rx="10" ry="11" fill="#f1dcbc"/>
      <path d="M27 42l2 2 2-2M33 42l2 2 2-2M30 48l2 2 2-2" stroke="#c9a57a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <circle cx="25" cy="30" r="7" fill="#f6e8d0"/><circle cx="39" cy="30" r="7" fill="#f6e8d0"/>
      <circle cx="25" cy="30" r="3.6" fill="#2a1a10"/><circle cx="39" cy="30" r="3.6" fill="#2a1a10"/>
      <circle cx="26.2" cy="28.8" r="1.2" fill="#fff"/><circle cx="40.2" cy="28.8" r="1.2" fill="#fff"/>
      <path d="M30 34H34L32 38Z" fill="#e8a33a"/>
      <ellipse cx="26" cy="56" rx="4" ry="2" fill="#e8a33a"/><ellipse cx="38" cy="56" rx="4" ry="2" fill="#e8a33a"/>
      <path d="M32 21 26 18V24ZM32 21 38 18V24Z" fill="#f08aa8"/><circle cx="32" cy="21" r="1.8" fill="#d8698a"/>`,
    amortentia: () => `${sombra(58, 14)}
      <rect x="26" y="8" width="12" height="7" rx="2" fill="#b07a45"/>
      <rect x="27" y="14" width="10" height="13" rx="2" fill="#e8eef8" opacity=".55"/>
      <circle cx="32" cy="40" r="15" fill="#f6c7da" opacity=".3" stroke="#e8eef8" stroke-width="2"/>
      <path d="M18.5 42A13.5 13.5 0 0 0 45.5 42C40 39 36 44 32 42S24 44 18.5 42Z" fill="#ef6f9e"/>
      ${corazon(32, 47, 0.75, '#ffd3e2')}
      <circle cx="26" cy="35" r="1.6" fill="#ffd3e2"/><circle cx="37" cy="33" r="1.2" fill="#ffd3e2"/><circle cx="33" cy="29.5" r="1" fill="#ffd3e2"/>
      <path d="M22 35Q23.5 29.5 28 28" stroke="#fff" stroke-width="2" fill="none" opacity=".65" stroke-linecap="round"/>
      ${corazon(50, 18, 0.5, '#f08aa8')}${corazon(13, 26, 0.4, '#f08aa8')}`,
    // ---------------- Ramos de flores
    ramo_rosas: () => hojasRamo() + rosaF(22, 24, 6.5) + rosaF(42, 24, 6.5) + rosaF(32, 15, 7) + rosaF(32, 29, 6) + rosaF(17, 33, 5) + rosaF(47, 33, 5) + papel('#f4ecf6', '#d8c6e2', '#c8243f') + brillo(54, 10, 3),
    ramo_tulipanes: () => hojasRamo() + tulipan(22, 28, '#f05a8a', '#c43a68') + tulipan(42, 28, '#f6a23a', '#cf7a1c') + tulipan(32, 20, '#e8304a', '#b0182f')
      + tulipan(27, 34, '#b483e0', '#8a5cc0') + tulipan(37, 34, '#f8d24a', '#d4a91c') + papel('#eef4fb', '#c9d8ec', '#6f8ee8') + brillo(10, 12, 2.6),
    ramo_margaritas: () => hojasRamo() + margarita(22, 25, 7) + margarita(42, 25, 7) + margarita(32, 16, 7.5) + margarita(32, 30, 6.5) + margarita(16, 34, 5.5) + margarita(48, 34, 5.5)
      + papel('#f6efe0', '#e2d3b4', '#f2c230') + brillo(54, 12, 2.8),
    ramo_girasoles: () => hojasRamo() + girasol(21, 26, 8.5) + girasol(43, 26, 8.5) + girasol(32, 16, 9) + girasol(32, 32, 7) + papel('#e9f2e2', '#c8d9bd', '#8a5a2b') + brillo(55, 10, 3),
    ramo_lirios: () => hojasRamo() + lirio(21, 26, 8, '#fbf6fa', '#f7c6d6') + lirio(43, 26, 8, '#fbf6fa', '#f7c6d6') + lirio(32, 16, 8.5, '#f7c6d6', '#e58aa8') + lirio(32, 31, 7, '#fbf6fa', '#f7c6d6')
      + papel('#ede7f6', '#cfc3e6', '#a48be0') + brillo(10, 10, 2.8, '#fff'),
    ramo_mixto: () => hojasRamo() + girasol(21, 27, 7) + rosaF(42, 25, 6.5) + tulipan(32, 20, '#b483e0', '#8a5cc0') + margarita(30, 32, 5.5) + lirio(46, 34, 5.5, '#fbf6fa', '#f7c6d6') + rosaF(17, 34, 4.5)
      + papel('#eef2fb', '#c9d3ea', '#c8243f') + brillo(54, 12, 3) + brillo(10, 16, 2.2),
    // ---------------- Postres
    pastel_chocolate: () => plato() + `
      <path d="M12 30V49Q32 57 52 49V30Z" fill="#5a3420"/>
      <path d="M12 39Q32 47 52 39" stroke="#f3d9b8" stroke-width="2.2" fill="none"/>
      <ellipse cx="32" cy="30" rx="20" ry="7" fill="#3f2314"/>
      <path d="M12 30Q14 36 16 31Q18 39 21 33Q24 36 26 34Q29 41 32 35Q35 38 38 34Q41 40 43 33Q46 36 48 32Q50 37 52 30" fill="#3f2314"/>
      <ellipse cx="27" cy="28" rx="6" ry="1.6" fill="#7a4a2a" opacity=".7"/>
      <path d="M32 21Q35 15 38 13" stroke="#3f7a2e" stroke-width="1.3" fill="none"/><circle cx="32" cy="24" r="4" fill="#c8243f"/><circle cx="30.6" cy="22.6" r="1.2" fill="#fff" opacity=".7"/>
      <path d="M20 29l2-1M40 31l2 1M24 32l1.5 1M44 28l2-.5" stroke="#d9a066" stroke-width="1.2" stroke-linecap="round"/>`,
    tres_leches: () => `<ellipse cx="32" cy="53" rx="26" ry="6" fill="#fff6e6" opacity=".95"/><ellipse cx="32" cy="53" rx="26" ry="6" fill="none" stroke="#dfe8f6" stroke-opacity=".5"/>
      <path d="M13 33H43V52H13Z" fill="#f1d49a"/><path d="M43 33 51 28V47L43 52Z" fill="#dcb876"/>
      <path d="M13 33 21 28H51L43 33Z" fill="#fffaf2"/><path d="M13 30H43V33H13Z" fill="#fff"/><path d="M43 30 51 25V28L43 33Z" fill="#f4ede2"/><path d="M13 30 21 25H51L43 30Z" fill="#fffdf8"/>
      <path d="M13 41H43M43 41 51 36" stroke="#fff3dc" stroke-width="1.6"/>
      <circle cx="22" cy="28" r=".7" fill="#a5733f"/><circle cx="30" cy="27" r=".7" fill="#a5733f"/><circle cx="38" cy="28.5" r=".7" fill="#a5733f"/><circle cx="44" cy="26.5" r=".7" fill="#a5733f"/>
      <path d="M33 21Q36 15 39 14" stroke="#3f7a2e" stroke-width="1.3" fill="none"/><circle cx="33" cy="24" r="3.6" fill="#d1243f"/><circle cx="31.8" cy="22.8" r="1.1" fill="#fff" opacity=".7"/>
      ${brillo(55, 14, 2.6)}`,
    pastel_fresas: () => plato() + `
      <path d="M12 30V49Q32 57 52 49V30Z" fill="#fde9ee"/>
      <path d="M12 39Q32 47 52 39" stroke="#f08aa8" stroke-width="2.4" fill="none"/>
      <ellipse cx="32" cy="30" rx="20" ry="7" fill="#fffafc"/>
      ${[[18, 30], [25, 26], [32, 24], [39, 26], [46, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y + 1}" r="2.6" fill="#fff"/>`).join('')}
      ${fresa(24, 28)}${fresa(32, 26)}${fresa(40, 28)}${fresa(32, 32)}
      ${[[16, 45], [24, 49], [32, 51], [40, 49], [48, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#e8304a"/>`).join('')}
      ${brillo(55, 14, 2.6)}`,
    pie_limon: () => `
      <ellipse cx="32" cy="54" rx="26" ry="5" fill="#cfe0f7" opacity=".28"/>
      <path d="M10 42 54 46 54 52 10 48Z" fill="#f5d33d"/>
      <path d="M10 48 54 52 54 55 10 51Z" fill="#c98a4a"/>
      <path d="M10 42 52 26A18 18 0 0 1 54 46Z" fill="#fff4e0"/>
      <path d="M52 26A18 18 0 0 1 54 46" stroke="#d9a066" stroke-width="6" fill="none" stroke-linecap="round"/>
      ${[[22, 38], [30, 34], [38, 31], [45, 29], [34, 40], [43, 37], [48, 40]].map(([x, y]) => `<path d="M${x - 4} ${y + 2}Q${x - 3} ${y - 3} ${x} ${y - 5}Q${x + 3} ${y - 3} ${x + 4} ${y + 2}Z" fill="#fffaf2"/><path d="M${x - 1} ${y - 3}Q${x} ${y - 5.5} ${x + 1} ${y - 3}" fill="#d9a066"/>`).join('')}
      <circle cx="14" cy="22" r="6" fill="#f8e04a"/><circle cx="14" cy="22" r="4.4" fill="#fff6b0"/><path d="M14 17.6V26.4M9.6 22H18.4M10.9 18.9l6.2 6.2M17.1 18.9l-6.2 6.2" stroke="#f8e04a" stroke-width=".8"/>`,
    // ---------------- Peluches
    gato: () => peluche(`
      <path d="M44 51C55 51 57 40 50 36" stroke="#9aa0b8" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="32" cy="46" rx="14" ry="11.5" fill="#9aa0b8"/><ellipse cx="32" cy="48" rx="8" ry="7" fill="#c9cde0"/>
      <path d="M18.5 22 20 9 29 17ZM45.5 22 44 9 35 17Z" fill="#9aa0b8"/><path d="M21 19 21.6 13 26 17ZM43 19 42.4 13 38 17Z" fill="#f2a7c0"/>
      <ellipse cx="32" cy="27" rx="15" ry="12.5" fill="#9aa0b8"/>
      ${ojos(26, 27, 38, 27)}<path d="M30.6 31.2h2.8L32 32.8Z" fill="#f08aa8"/>
      <path d="M29 34Q30.5 35.6 32 33.6Q33.5 35.6 35 34" stroke="#4a4f68" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M17 30l6 1M17 33l6 0M47 30l-6 1M47 33l-6 0" stroke="#e6e8f2" stroke-width=".7"/>
      ${mejillas(23, 32, 41, 32)}${patitas('#c9cde0')}${lazo(32, 37, '#f08aa8')}`),
    conejo: () => peluche(`
      <ellipse cx="25" cy="13" rx="4.6" ry="11" fill="#f6f1f3" transform="rotate(-12 25 13)"/><ellipse cx="39" cy="13" rx="4.6" ry="11" fill="#f6f1f3" transform="rotate(12 39 13)"/>
      <ellipse cx="25" cy="13" rx="2.2" ry="8" fill="#f7c6d6" transform="rotate(-12 25 13)"/><ellipse cx="39" cy="13" rx="2.2" ry="8" fill="#f7c6d6" transform="rotate(12 39 13)"/>
      <ellipse cx="32" cy="46" rx="13" ry="11.5" fill="#f6f1f3"/><ellipse cx="32" cy="29" rx="13.5" ry="11.5" fill="#f6f1f3"/>
      ${ojos(26.5, 28, 37.5, 28)}<ellipse cx="32" cy="32" rx="1.8" ry="1.3" fill="#f08aa8"/>
      <path d="M32 33.2V35M30.8 35h2.4v1.8h-2.4Z" stroke="#c9b6c0" stroke-width=".6" fill="#fff"/>
      ${mejillas(24, 32.5, 40, 32.5)}${patitas('#efe6ea')}${lazo(32, 39.5, '#6f8ee8')}`),
    crup: () => peluche(`
      <path d="M43 49C52 46 55 39 51 33" stroke="#efe7da" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      <path d="M44 51C54 52 58 45 57 38" stroke="#efe7da" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="32" cy="46" rx="13.5" ry="11.5" fill="#f3ece0"/><ellipse cx="37" cy="42" rx="6" ry="4.5" fill="#b9814f"/>
      <ellipse cx="32" cy="28" rx="13.5" ry="12" fill="#f3ece0"/><circle cx="37.5" cy="26.5" r="5" fill="#c99566"/>
      <ellipse cx="19.5" cy="28" rx="4" ry="8.5" fill="#a8703f" transform="rotate(18 19.5 28)"/><ellipse cx="44.5" cy="28" rx="4" ry="8.5" fill="#a8703f" transform="rotate(-18 44.5 28)"/>
      ${ojos(26.5, 27, 37.5, 27)}<ellipse cx="32" cy="32" rx="2.6" ry="1.9" fill="#2a1a10"/>
      <path d="M32 33.8V35.5" stroke="#2a1a10" stroke-width=".9"/><path d="M30.4 35.8Q32 39.6 33.6 35.8Z" fill="#f08aa8"/>
      ${mejillas(23, 33, 41, 33)}${patitas('#efe7da')}
      <path d="M22 37.5Q32 41.5 42 37.5" stroke="#c8243f" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="32" cy="41" r="2" fill="#f2c94c"/>`),
    kneazle: () => peluche(`
      <path d="M44 51C55 51 57 41 51 36" stroke="#dcbb84" stroke-width="4.6" fill="none" stroke-linecap="round"/>
      <path d="M51 36C48 33 49 29 52 28C51 31 55 30 55 33C57 33 56 37 51 36Z" fill="#9c6a38"/>
      <ellipse cx="32" cy="46" rx="14" ry="11.5" fill="#e0c08a"/>
      <path d="M17 23 17 7 28 16ZM47 23 47 7 36 16Z" fill="#e0c08a"/><path d="M19.5 19.5 19.6 11.5 25 16.5ZM44.5 19.5 44.4 11.5 39 16.5Z" fill="#f2c4a8"/>
      <path d="M15.6 9.5 17 3.6 18.6 9ZM45.4 9 47 3.6 48.4 9.5Z" fill="#9c6a38"/>
      <ellipse cx="32" cy="27" rx="15" ry="12.5" fill="#e0c08a"/>
      ${[[24, 20], [40, 20], [32, 18], [22, 44], [42, 46], [30, 52], [38, 40]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="1.5" fill="#a5733f" opacity=".75"/>`).join('')}
      <ellipse cx="26" cy="27" rx="2.6" ry="3" fill="#5aa86a"/><ellipse cx="38" cy="27" rx="2.6" ry="3" fill="#5aa86a"/>
      <ellipse cx="26" cy="27.4" rx="1" ry="2.2" fill="#1d2a1d"/><ellipse cx="38" cy="27.4" rx="1" ry="2.2" fill="#1d2a1d"/>
      <circle cx="25.2" cy="25.8" r=".8" fill="#fff"/><circle cx="37.2" cy="25.8" r=".8" fill="#fff"/>
      <path d="M30.6 31.4h2.8L32 33Z" fill="#c9806a"/><path d="M29 34Q30.5 35.6 32 33.8Q33.5 35.6 35 34" stroke="#7a5230" stroke-width="1" fill="none" stroke-linecap="round"/>
      ${mejillas(23, 32, 41, 32)}${patitas('#ead3a8')}${lazo(32, 37, '#5470c6')}`),
    escarbato: () => peluche(`
      ${halo(46, 46, 12)}
      <ellipse cx="32" cy="40" rx="15" ry="16" fill="#2f2b36"/>
      ${[[20, 30], [44, 30], [18, 42], [46, 42], [24, 24], [40, 24], [32, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#3b3644"/>`).join('')}
      <ellipse cx="32" cy="45" rx="9" ry="9" fill="#433d4d"/>
      <circle cx="26" cy="31" r="2.6" fill="#fff"/><circle cx="38" cy="31" r="2.6" fill="#fff"/><circle cx="26.5" cy="31.4" r="1.6" fill="#120f16"/><circle cx="38.5" cy="31.4" r="1.6" fill="#120f16"/>
      <ellipse cx="32" cy="36.5" rx="6.5" ry="3.6" fill="#a99aa6"/><ellipse cx="32" cy="35.6" rx="5" ry="2" fill="#c4b8c2"/>
      <circle cx="32" cy="48" r="6" fill="#f2c94c"/><circle cx="32" cy="48" r="4.4" fill="none" stroke="#c99a26" stroke-width="1"/><path d="M30.6 46.4h2.2a1.2 1.2 0 0 1 0 2.4h-2.2z" fill="none" stroke="#c99a26" stroke-width=".8"/>
      <ellipse cx="24.5" cy="47" rx="3" ry="2.4" fill="#f2b8c0"/><ellipse cx="39.5" cy="47" rx="3" ry="2.4" fill="#f2b8c0"/>
      <ellipse cx="25" cy="56" rx="4" ry="2" fill="#f2b8c0"/><ellipse cx="39" cy="56" rx="4" ry="2" fill="#f2b8c0"/>
      <circle cx="48" cy="54" r="3" fill="#f2c94c"/><circle cx="15" cy="53" r="2.4" fill="#f2c94c"/>${brillo(50, 18, 3.4)}${brillo(13, 22, 2.4)}`),
    micropuff: () => {
      let pelo = '';
      for (let k = 0; k < 18; k++) { const a = k * 20 * Math.PI / 180; pelo += `<circle cx="${(32 + Math.cos(a) * 17).toFixed(1)}" cy="${(36 + Math.sin(a) * 16).toFixed(1)}" r="4.2" fill="#f49ac1"/>`; }
      return peluche(`${pelo}<ellipse cx="32" cy="36" rx="17" ry="16" fill="#f7aacc"/>
        <ellipse cx="26" cy="33" rx="3.4" ry="4" fill="#2a1424"/><ellipse cx="38" cy="33" rx="3.4" ry="4" fill="#2a1424"/>
        <circle cx="25" cy="31.4" r="1.3" fill="#fff"/><circle cx="37" cy="31.4" r="1.3" fill="#fff"/><circle cx="27" cy="35" r=".6" fill="#fff"/><circle cx="39" cy="35" r=".6" fill="#fff"/>
        <path d="M29.5 39.5Q32 42 34.5 39.5" stroke="#8a2a52" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M31.2 40.6Q32 44.6 33.8 40.6Z" fill="#e8304a"/>
        ${mejillas(21.5, 39, 42.5, 39)}<ellipse cx="26" cy="53" rx="3" ry="1.8" fill="#e889b2"/><ellipse cx="38" cy="53" rx="3" ry="1.8" fill="#e889b2"/>
        ${brillo(53, 14, 3)}${corazon(12, 18, 0.45, '#f08aa8')}`);
    },
    hipogrifo: () => peluche(`
      <path d="M45 44C53 42 56 36 54 31C52 35 49 37 45 38Z" fill="#a49d95"/>
      <ellipse cx="35" cy="46" rx="14" ry="9.5" fill="#bdb6ad"/>
      <rect x="25" y="51" width="4.4" height="6.5" rx="2" fill="#bdb6ad"/><rect x="31" y="52" width="4.4" height="6" rx="2" fill="#bdb6ad"/><rect x="38" y="52" width="4.4" height="6" rx="2" fill="#bdb6ad"/><rect x="44" y="51" width="4.4" height="6.5" rx="2" fill="#bdb6ad"/>
      <rect x="25" y="56" width="4.4" height="2.4" rx="1" fill="#4a4038"/><rect x="31" y="56.4" width="4.4" height="2.4" rx="1" fill="#4a4038"/><rect x="38" y="56.4" width="4.4" height="2.4" rx="1" fill="#4a4038"/><rect x="44" y="56" width="4.4" height="2.4" rx="1" fill="#4a4038"/>
      <path d="M33 42C38 33 47 32 51 36C47 36 46 39 49 41C45 41 43 43 45 45C40 45 36 45 33 42Z" fill="#e6e1da"/>
      <path d="M38 40 44 37M39 43 46 41" stroke="#bdb6ad" stroke-width=".8"/>
      <path d="M17 18 19 9 23 16 26 8 28 16 32 10 31 18Z" fill="#d9d3cb"/>
      <circle cx="25" cy="27" r="11.5" fill="#efebe5"/>
      <path d="M15 27C11 28 10 31 12 34C13 32 15 31.5 17 32Z" fill="#f0a53a"/><path d="M14.4 27.2C13 28.4 13 30 14 31" stroke="#c97f1c" stroke-width=".8" fill="none"/>
      <circle cx="24" cy="24.5" r="3.4" fill="#e09a2a"/><circle cx="24" cy="24.8" r="2.2" fill="#1d140c"/><circle cx="23" cy="23.6" r="1" fill="#fff"/>
      ${mejillas(29, 30, 99, 99)}${brillo(52, 14, 3)}`),
    fenix: () => peluche(`
      ${halo(32, 36, 24, '#ffb04a')}
      <path d="M20 46C12 46 9 40 10 35C13 39 16 40 20 40ZM44 46C52 46 55 40 54 35C51 39 48 40 44 40Z" fill="#f2792a"/>
      <path d="M27 24C24 17 28 13 29 8C31 13 34 15 33 21C35 17 38 16 39 13C40 18 39 22 36 25Z" fill="#f2792a"/>
      <path d="M29 23C28 19 30 16 30.5 13C32 16 33 18 32 22Z" fill="#fbc94a"/>
      <circle cx="32" cy="38" r="15" fill="#e2402a"/><ellipse cx="32" cy="43" rx="9" ry="9.5" fill="#fbc94a"/><ellipse cx="32" cy="45" rx="5.5" ry="6" fill="#fff0a8"/>
      ${ojos(26.5, 34, 37.5, 34)}<path d="M30.2 38h3.6L32 40.6Z" fill="#f2a12a"/>
      <ellipse cx="17.5" cy="40" rx="3.6" ry="7" fill="#c42f1e" transform="rotate(20 17.5 40)"/><ellipse cx="46.5" cy="40" rx="3.6" ry="7" fill="#c42f1e" transform="rotate(-20 46.5 40)"/>
      <path d="M27 53v4M25 57h4M37 53v4M35 57h4" stroke="#f2a12a" stroke-width="1.6" stroke-linecap="round"/>
      ${mejillas(23, 38.5, 41, 38.5)}${brillo(52, 16, 3.2)}${brillo(12, 22, 2.4)}`),
  };

  // cat: flores | postres | peluches | magia  ·  d: la descripción bonita que acompaña al regalo
  // oculto: ya no se puede elegir, pero se sigue dibujando en los regalos que ya se mandaron
  const LISTA = [
    { id: 'ramo_rosas', cat: 'flores', e: '🌹', n: 'Ramo de rosas', d: 'Una por cada vez que me hiciste sonreír' },
    { id: 'ramo_tulipanes', cat: 'flores', e: '🌷', n: 'Ramo de tulipanes', d: 'Dicen lo que a mí me da vergüenza decir' },
    { id: 'ramo_margaritas', cat: 'flores', e: '🌼', n: 'Ramo de margaritas', d: 'Me quiere, no me quiere… ¡sí me quiere!' },
    { id: 'ramo_girasoles', cat: 'flores', e: '🌻', n: 'Ramo de girasoles', d: 'Porque contigo todo es más soleado, hasta en diciembre' },
    { id: 'ramo_lirios', cat: 'flores', e: '🤍', n: 'Ramo de lirios', d: 'Elegantes, como vas a estar en el baile' },
    { id: 'ramo_mixto', oculto: true, cat: 'flores', e: '💐', n: 'Ramo de flores mágicas', d: 'Recogidas a escondidas en los invernaderos de la profesora Sprout' },
    { id: 'rosa', cat: 'flores', e: '🌹', n: 'Rosa encantada', d: 'Nunca se marchita, como este recuerdo' },
    { id: 'ramillete', oculto: true, cat: 'flores', e: '💐', n: 'Ramillete para el baile', d: 'Para la muñeca o la solapa: así todos sabrán con quién vas' },
    { id: 'pastel', cat: 'postres', e: '🥧', n: 'Pastel de calabaza', d: 'Recién salido de las cocinas de Hogwarts (gracias, elfos)' },
    { id: 'pastel_chocolate', cat: 'postres', e: '🍫', n: 'Pastel de chocolate', d: 'Mejor que cualquier chocolate contra dementores' },
    { id: 'tres_leches', cat: 'postres', e: '🍰', n: 'Pastel de tres leches', d: 'Tres leches, dos cucharas y un baile juntos' },
    { id: 'pastel_fresas', cat: 'postres', e: '🍓', n: 'Pastel de fresa con crema', d: 'Dulce, como cada rato contigo' },
    { id: 'pie_limon', cat: 'postres', e: '🍋', n: 'Pie de limón', d: 'Un poquito ácido, un poquito dulce… como nuestras charlas' },
    { id: 'rana', cat: 'postres', e: '🐸', n: 'Rana de chocolate', d: 'Con cromo de mago incluido… ojalá te salga Dumbledore' },
    { id: 'grajeas', cat: 'postres', e: '🍬', n: 'Grajeas de todos los sabores', d: 'Como la vida a tu lado: siempre una sorpresa (ojalá no la de cerumen)' },
    { id: 'lechuza', cat: 'peluches', e: '🦉', n: 'Lechuza de peluche', d: 'Te llevará mis cartas, aunque estés lejos' },
    { id: 'gato', cat: 'peluches', e: '🐱', n: 'Gato de peluche', d: 'Ronronea cada vez que piensas en mí' },
    { id: 'conejo', cat: 'peluches', e: '🐰', n: 'Conejito de peluche', d: 'Para abrazarlo cuando me extrañes' },
    { id: 'crup', cat: 'peluches', e: '🐶', n: 'Crup de peluche', d: 'Un cachorrito con dos colas: una para cada uno' },
    { id: 'kneazle', oculto: true, cat: 'peluches', e: '🐈', n: 'Kneazle de peluche', d: 'Siempre sabe en quién se puede confiar… y te eligió a ti' },
    { id: 'escarbato', oculto: true, cat: 'peluches', e: '🪙', n: 'Escarbato de peluche', d: 'Se queda con todo lo que brilla… por eso no se separa de ti' },
    { id: 'micropuff', cat: 'peluches', e: '🩷', n: 'Micropuff de peluche', d: 'Cabe en el bolsillo… y en el corazón' },
    { id: 'hipogrifo', cat: 'peluches', e: '🪶', n: 'Hipogrifo bebé de peluche', d: 'Hazle una reverencia y te será fiel para siempre' },
    { id: 'fenix', cat: 'peluches', e: '🔥', n: 'Fénix bebé de peluche', d: 'Si algún día se apaga, renacerá de sus cenizas, como lo nuestro' },
    { id: 'snitch', cat: 'magia', e: '✨', n: 'Snitch dorada', d: 'Para que no se te escape… ni tú a mí' },
    { id: 'copo', cat: 'magia', e: '❄️', n: 'Copo de nieve encantado', d: 'Del techo encantado del Gran Comedor: nunca se derrite' },
    { id: 'amortentia', cat: 'magia', e: '💗', n: 'Amortentia', d: 'Huele a lo que más te gusta… ¿a qué huele para ti?' },
  ];
  window.CATEGORIAS_REGALO = [['flores', '💐 Flores'], ['postres', '🍰 Postres'], ['peluches', '🧸 Peluches'], ['magia', '✨ Cosas mágicas']];

  window.REGALOS = LISTA;
  // dibujoRegalo('rosa') → <svg>
  window.dibujoRegalo = (id) => {
    const f = D[id];
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${f ? f() : brillo(32, 32, 14) + brillo(48, 16, 5)}</svg>`;
  };
})();
