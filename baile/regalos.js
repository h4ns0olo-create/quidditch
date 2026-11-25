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
  const COLORES_CASA = {
    Gryffindor: ['#a01d1d', '#e8b33a'], Slytherin: ['#1f5f37', '#c4cad1'],
    Ravenclaw: ['#24439a', '#b8925a'], Hufflepuff: ['#e3b12c', '#2b2622'],
  };

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
    cerveza: () => `${sombra(58, 17)}
      <path d="M24 13Q21 9 24 5M32 12Q35 8 32 4M40 13Q37 9 40 5" stroke="#cfe0f7" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".75"/>
      <path d="M44 28H49A7 7 0 0 1 49 42H44" stroke="#8a5a2b" stroke-width="4" fill="none"/>
      <rect x="16" y="24" width="29" height="32" rx="4" fill="#d98c2b"/>
      <rect x="16" y="31" width="29" height="3" fill="#a8641c"/><rect x="16" y="48" width="29" height="3" fill="#a8641c"/>
      <rect x="19.5" y="28" width="4" height="24" rx="2" fill="#fff" opacity=".28"/>
      <rect x="15" y="21" width="31" height="6" rx="3" fill="#fff3d6"/>
      <circle cx="19" cy="23" r="5" fill="#fff3d6"/><circle cx="26" cy="20" r="6" fill="#fff3d6"/>
      <circle cx="34" cy="20" r="6" fill="#fff3d6"/><circle cx="41" cy="23" r="5" fill="#fff3d6"/>
      <path d="M38 25Q40.5 31 38 34Q35.5 31 38 25Z" fill="#fff3d6"/>`,
    bufanda: (casa) => {
      const [c1, c2] = COLORES_CASA[casa] || COLORES_CASA.Gryffindor;
      return `
      <path d="M24 23 33 24 27 50 19 48Z" fill="${c1}" opacity=".8"/>
      <path d="M22.6 30 31.4 31.2 30.2 35.4 21.6 34.2ZM20.6 39 29.2 40.3 28.1 44.4 19.6 43.2Z" fill="${c2}" opacity=".8"/>
      <path d="M13 18C21 11 43 11 51 18L47 27C39 21 25 21 17 27Z" fill="${c1}"/>
      <path d="M21 14.2 24.5 22.6M29 12.8 30.5 21.5M37 12.9 35.6 21.6M45 14.6 41.4 22.8" stroke="${c2}" stroke-width="3"/>
      <path d="M36 22 46 24 42 53 32 51Z" fill="${c1}"/>
      <path d="M34.8 30 44.9 32 44.3 36.2 34.1 34.3ZM33.6 39.4 43.7 41.4 43.1 45.6 32.9 43.6Z" fill="${c2}"/>
      <path d="M33 51.5 32.2 58M36.2 52.1 35.8 58.6M39.4 52.7 39.4 59.2M42.4 53.3 42.8 59.6" stroke="${c2}" stroke-width="1.8" stroke-linecap="round"/>
      ${brillo(53, 36, 3)}`;
    },
    pluma: () => `
      <path d="M17 56 43 13" stroke="#f3dfb0" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M20 51C13 38 22 20 45 9 47 26 39 45 20 51Z" fill="#d9381f"/>
      <path d="M22 47C18 36 26 22 43 13 43 28 37 41 22 47Z" fill="#f2792a"/>
      <path d="M25 42C24 33 30 24 40 18 39 29 34 37 25 42Z" fill="#fbc94a"/>
      <path d="M27 37C27 31 31 26 37 22 36 29 32 34 27 37Z" fill="#fff0a8"/>
      ${brillo(51, 30, 3.5)}${brillo(14, 22, 3)}${brillo(46, 47, 2.4, '#ff9a5a')}`,
    vela: () => `
      ${halo(32, 16, 17)}
      <rect x="25" y="26" width="14" height="26" rx="3" fill="#f6efe0"/>
      <rect x="33" y="26" width="6" height="26" rx="3" fill="#e2d6bd"/>
      <path d="M25 29H39V32Q37 36 35 32Q33 38 31 32Q28 35 25 31Z" fill="#fffaf0"/>
      <path d="M32 26V22" stroke="#3a2a1a" stroke-width="1.5"/>
      <path d="M32 8C37 14 37 19 32 22 27 19 27 14 32 8Z" fill="#ffb347"/>
      <path d="M32 13C34.5 16 34.5 19 32 20.5 29.5 19 29.5 16 32 13Z" fill="#fff1a8"/>
      <ellipse cx="32" cy="59" rx="9" ry="1.8" fill="#cfe0f7" opacity=".3"/>
      ${brillo(46, 44, 2.5, '#cfe0f7')}${brillo(18, 50, 2, '#cfe0f7')}`,
    cancion: () => `
      <path d="M24 45V18L46 12V39" stroke="#e6c77a" stroke-width="3" fill="none" stroke-linejoin="round"/>
      <path d="M24 17 46 11V17.5L24 23.5Z" fill="#e6c77a"/>
      <ellipse cx="19.5" cy="46" rx="6" ry="4.5" fill="#e6c77a" transform="rotate(-20 19.5 46)"/>
      <ellipse cx="41.5" cy="40" rx="6" ry="4.5" fill="#e6c77a" transform="rotate(-20 41.5 40)"/>
      ${corazon(53, 50, 0.7, '#f08aa8')}${corazon(11, 22, 0.55, '#f08aa8')}${brillo(52, 24, 3)}${brillo(30, 56, 2.2)}`,
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
    muerdago: () => `
      <path d="M32 16V30" stroke="#5c8a3a" stroke-width="2"/>
      <path d="M32 30C22 28 14 34 12 44 22 44 30 38 32 30Z" fill="#5fa64a"/>
      <path d="M32 30C42 28 50 34 52 44 42 44 34 38 32 30Z" fill="#4e9640"/>
      <path d="M32 32C27 38 26 46 30 54 35 47 35 39 32 32Z" fill="#6cb855"/>
      <circle cx="28.5" cy="33" r="3.3" fill="#fbf7ee"/><circle cx="35.5" cy="33" r="3.3" fill="#fbf7ee"/><circle cx="32" cy="37.8" r="3.3" fill="#fbf7ee"/>
      <circle cx="27.6" cy="32" r=".9" fill="#fff"/><circle cx="34.6" cy="32" r=".9" fill="#fff"/><circle cx="31.1" cy="36.8" r=".9" fill="#fff"/>
      <path d="M31 15 27 25M33 15 37 25" stroke="#c8243f" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 14C26 8 20 10 22 15 24 18 29 16 32 14ZM32 14C38 8 44 10 42 15 40 18 35 16 32 14Z" fill="#c8243f"/>
      <circle cx="32" cy="14" r="2.3" fill="#a01a33"/>
      ${brillo(52, 16, 3)}${brillo(12, 18, 2.4)}`,
    varita: () => `
      ${halo(45.5, 18.5, 12)}
      <path d="M14 52 44 20" stroke="#6b4423" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M14 52 22 43.5" stroke="#3e2512" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M22.3 42.6l2.2 2M19.6 45.5l2.2 2" stroke="#c9a24a" stroke-width="1.6"/>
      <circle cx="45.5" cy="18.5" r="2.8" fill="#fff6d0"/>
      ${brillo(53, 9, 4.5)}${brillo(56, 25, 3)}${brillo(39, 8, 2.6)}<circle cx="50" cy="31" r="1.2" fill="#ffd56b"/><circle cx="57" cy="15" r="1" fill="#ffd56b"/>`,
    amortentia: () => `${sombra(58, 14)}
      <rect x="26" y="8" width="12" height="7" rx="2" fill="#b07a45"/>
      <rect x="27" y="14" width="10" height="13" rx="2" fill="#e8eef8" opacity=".55"/>
      <circle cx="32" cy="40" r="15" fill="#f6c7da" opacity=".3" stroke="#e8eef8" stroke-width="2"/>
      <path d="M18.5 42A13.5 13.5 0 0 0 45.5 42C40 39 36 44 32 42S24 44 18.5 42Z" fill="#ef6f9e"/>
      ${corazon(32, 47, 0.75, '#ffd3e2')}
      <circle cx="26" cy="35" r="1.6" fill="#ffd3e2"/><circle cx="37" cy="33" r="1.2" fill="#ffd3e2"/><circle cx="33" cy="29.5" r="1" fill="#ffd3e2"/>
      <path d="M22 35Q23.5 29.5 28 28" stroke="#fff" stroke-width="2" fill="none" opacity=".65" stroke-linecap="round"/>
      ${corazon(50, 18, 0.5, '#f08aa8')}${corazon(13, 26, 0.4, '#f08aa8')}`,
    carta: () => `${sombra(56, 22)}
      <rect x="10" y="18" width="44" height="31" rx="3" fill="#f6ecd8"/>
      <path d="M10 47 26 33M54 47 38 33" stroke="#e4d6b8" stroke-width="1.4"/>
      <path d="M10.5 20 32 36 53.5 20" stroke="#d8c7a4" stroke-width="1.6" fill="none"/>
      <circle cx="32" cy="36" r="6.5" fill="#b3203a"/>
      ${corazon(32, 36.3, 0.55, '#e05068')}
      ${corazon(46, 10, 0.55, '#f08aa8')}${corazon(18, 9, 0.4, '#f08aa8')}`,
    bola: () => `
      <path d="M16 51H48L45 59H19Z" fill="#6b4423"/><rect x="18" y="48" width="28" height="4" rx="1.5" fill="#8a5a2b"/>
      <circle cx="32" cy="29" r="19" fill="#bfe0ff" opacity=".28"/>
      <path d="M14 34Q32 30 50 34A19 19 0 0 1 14 34Z" fill="#fff"/>
      <path d="M24 34V25H27V22H29V25H31V19L33 16 35 19V25H37V22H39V25H42V34Z" fill="#2f3d6b"/>
      <rect x="32" y="22" width="2" height="3" fill="#ffd56b"/><rect x="25" y="28" width="1.6" height="2.4" fill="#ffd56b"/><rect x="39.5" y="28" width="1.6" height="2.4" fill="#ffd56b"/>
      <circle cx="21" cy="20" r="1" fill="#fff"/><circle cx="43" cy="16" r="1.1" fill="#fff"/><circle cx="27" cy="13" r=".9" fill="#fff"/><circle cx="38" cy="25" r=".8" fill="#fff"/><circle cx="19" cy="28" r=".8" fill="#fff"/>
      <circle cx="32" cy="29" r="19" fill="none" stroke="#e8f3ff" stroke-width="2"/>
      <path d="M19 20Q22 13 29 11" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>`,
  };

  const LISTA = [
    { id: 'rosa', e: '🌹', n: 'Rosa encantada', d: 'Nunca se marchita' },
    { id: 'rana', e: '🐸', n: 'Rana de chocolate', d: 'Con cromo de mago incluido' },
    { id: 'grajeas', e: '🍬', n: 'Grajeas de todos los sabores', d: 'Ojalá no te toque la de cerumen' },
    { id: 'ramillete', e: '💐', n: 'Ramillete para el baile', d: 'Para la muñeca o la solapa' },
    { id: 'cerveza', e: '🍺', n: 'Cerveza de mantequilla', d: 'Calentita, de Las Tres Escobas' },
    { id: 'bufanda', e: '🧣', n: 'Bufanda de mi casa', d: 'Con los colores de quien la regala' },
    { id: 'pluma', e: '🪶', n: 'Pluma de fénix', d: 'Rarísima y brillante' },
    { id: 'vela', e: '🕯️', n: 'Vela flotante', d: 'Del techo del Gran Comedor' },
    { id: 'cancion', e: '🎶', n: 'Una canción para bailar juntos', d: 'Para la pista del Gran Comedor' },
    { id: 'copo', e: '❄️', n: 'Copo de nieve encantado', d: 'Nunca se derrite' },
    { id: 'pastel', e: '🥧', n: 'Pastel de calabaza', d: 'Recién salido del horno' },
    { id: 'snitch', e: '✨', n: 'Snitch dorada', d: 'Para que no se te escape' },
    { id: 'lechuza', e: '🦉', n: 'Lechuza de peluche', d: 'Para que no te olvides de mí' },
    { id: 'muerdago', e: '🌿', n: 'Muérdago', d: 'Ya sabes lo que significa…' },
    { id: 'varita', e: '🪄', n: 'Varita con chispas', d: 'Para hechizar la pista de baile' },
    { id: 'amortentia', e: '💗', n: 'Amortentia', d: 'Huele a lo que más te gusta' },
    { id: 'carta', e: '💌', n: 'Carta sellada', d: 'Con sello de lacre y corazón' },
    { id: 'bola', e: '🔮', n: 'Bola de nieve de Hogwarts', d: 'Agítala y nieva sobre el castillo' },
  ];

  window.REGALOS = LISTA;
  // dibujoRegalo('rosa') o dibujoRegalo('bufanda', 'Slytherin') → <svg>
  window.dibujoRegalo = (id, casa) => {
    const f = D[id];
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${f ? f(casa) : brillo(32, 32, 14) + brillo(48, 16, 5)}</svg>`;
  };
})();
