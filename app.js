(() => {
  const config = window.DAY_CLOCK_CONFIG;
  const svg = document.getElementById("clock");
  const list = document.getElementById("events");
  const STORAGE_KEY = "day-clock:off";

  for (const [key, value] of Object.entries(config.theme)) {
    document.documentElement.style.setProperty("--" + key, value);
  }
  const theme = config.theme;

  // Свой маскот из mascot.local.png, иначе картинка из конфига.
  let mascotSrc = "";
  const probe = new Image();
  probe.onload = () => { mascotSrc = probe.src; render(); };
  probe.onerror = () => {
    probe.onerror = null;
    probe.src = config.mascot;
  };
  probe.src = "mascot.local.png";

  const events = config.events.map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    return { ...e, minutes: h * 60 + m };
  });

  // Выключенные события хранятся в localStorage, чтобы пережить перезапуск.
  const off = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  const toggle = (id) => {
    off.has(id) ? off.delete(id) : off.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...off]));
    render();
  };

  const point = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
  };
  const arc = (r, from, to) => {
    const [x0, y0] = point(r, from);
    const [x1, y1] = point(r, to);
    return `M${x0} ${y0}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  // Угол на 12-часовом циферблате для минут от полуночи.
  const angle = (minutes) => (minutes % 720) / 2;
  const duration = (min) => {
    min = Math.abs(Math.round(min));
    return Math.floor(min / 60) + ":" + String(min % 60).padStart(2, "0");
  };

  function drawFace() {
    let s = `<circle cx="100" cy="100" r="94" fill="${theme.face}" stroke="${theme.rim}" stroke-width="3"/>`;
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const [x0, y0] = point(88, i * 6);
      const [x1, y1] = point(major ? 80 : 85, i * 6);
      s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${major ? theme.rim : theme.tick}" stroke-width="${major ? 2 : 1}" stroke-linecap="round"/>`;
    }
    return s;
  }

  function render() {
    const d = new Date();
    const now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const visible = events.filter((e) => !off.has(e.id));
    const byTime = [...visible].sort((a, b) => a.minutes - b.minutes);

    let s = drawFace();

    // У каждого события своя дорожка: раньше по времени — ближе к краю.
    // Будущее событие: дуга от «сейчас» до него.
    // Прошедшее: дуга от события до «сейчас» под полупрозрачной красной маской — это просрочка.
    const OUTER = 77, INNER = 59;
    const step = byTime.length > 1 ? Math.min(6, (OUTER - INNER) / (byTime.length - 1)) : 0;
    const width = Math.max(2, Math.min(4, step * 0.6 || 4));
    byTime.forEach((e, i) => {
      const r = OUTER - i * step;
      const left = e.minutes - now;
      if (left > 0) {
        const from = angle(now);
        s += `<path d="${arc(r, from, from + Math.min(left / 2, 359.9))}" fill="none" stroke="${e.color}" stroke-width="${width}" stroke-linecap="round" opacity="0.7"/>`;
      } else {
        // Ровные концы, чтобы дуга начиналась точно у точки события, а не чуть раньше.
        const from = angle(e.minutes);
        const d = arc(r, from, from + Math.max(Math.min(-left / 2, 359.9), 0.5));
        s += `<path d="${d}" fill="none" stroke="${e.color}" stroke-width="${width}" opacity="0.7"/>`;
        s += `<path d="${d}" fill="none" stroke="${theme.overdueMask}" stroke-width="${width}" opacity="${theme.overdueMaskOpacity}"/>`;
      }
    });

    s += `<circle cx="100" cy="100" r="55" fill="${theme.face}"/>`;
    if (mascotSrc) {
      s += `<image href="${mascotSrc}" x="58" y="58" width="84" height="84" preserveAspectRatio="xMidYMid meet"/>`;
    }

    for (const e of visible) {
      const [x, y] = point(94, angle(e.minutes));
      const past = e.minutes <= now;
      s += `<circle cx="${x}" cy="${y}" r="7" fill="${e.color}" stroke="${theme.face}" stroke-width="2"${past ? ' opacity="0.35"' : ""}><title>${e.name} ${e.time}</title></circle>`;
    }

    const [x0, y0] = point(56, angle(now));
    const [x1, y1] = point(80, angle(now));
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${theme.text}" stroke-width="4" stroke-linecap="round"/>`;

    svg.innerHTML = s;

    list.innerHTML = "";
    for (const e of events) {
      const isOff = off.has(e.id);
      const left = e.minutes - now;
      const btn = document.createElement("button");
      btn.className = "event" + (isOff ? " off" : "");
      btn.title = e.time;
      btn.innerHTML =
        `<span class="name"><span class="dot" style="background:${isOff ? theme.tick : e.color}"></span>${e.name}</span>` +
        `<span class="left${!isOff && left < 0 ? " overdue" : ""}">${isOff ? "выкл" : (left < 0 ? "+" : "") + duration(left)}</span>`;
      btn.onclick = () => toggle(e.id);
      list.appendChild(btn);
    }
  }

  render();
  // Обновляем в начале каждой минуты.
  setTimeout(function tick() {
    render();
    setTimeout(tick, 60000 - (Date.now() % 60000));
  }, 60000 - (Date.now() % 60000));
})();
