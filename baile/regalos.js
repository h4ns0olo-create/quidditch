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
  };

  const LISTA = [
    { id: 'rosa', e: '🌹', n: 'Rosa encantada', d: 'Nunca se marchita' },
    { id: 'rana', e: '🐸', n: 'Rana de chocolate', d: 'Con cromo de mago incluido' },
    { id: 'grajeas', e: '🍬', n: 'Grajeas de todos los sabores', d: 'Ojalá no te toque la de cerumen' },
    { id: 'ramillete', e: '💐', n: 'Ramillete para el baile', d: 'Para la muñeca o la solapa' },
    { id: 'copo', e: '❄️', n: 'Copo de nieve encantado', d: 'Nunca se derrite' },
    { id: 'pastel', e: '🥧', n: 'Pastel de calabaza', d: 'Recién salido del horno' },
    { id: 'snitch', e: '✨', n: 'Snitch dorada', d: 'Para que no se te escape' },
    { id: 'lechuza', e: '🦉', n: 'Lechuza de peluche', d: 'Para que no te olvides de mí' },
    { id: 'amortentia', e: '💗', n: 'Amortentia', d: 'Huele a lo que más te gusta' },
  ];

  window.REGALOS = LISTA;
  // dibujoRegalo('rosa') → <svg>
  window.dibujoRegalo = (id) => {
    const f = D[id];
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${f ? f() : brillo(32, 32, 14) + brillo(48, 16, 5)}</svg>`;
  };
})();
