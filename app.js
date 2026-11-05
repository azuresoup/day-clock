(() => {
  const config = window.DAY_CLOCK_CONFIG;
  const svg = document.getElementById("clock");
  const list = document.getElementById("events");
  const clock = document.getElementById("now");
  const STORAGE_KEY = "day-clock:off";

  for (const [key, value] of Object.entries(config.theme)) {
    document.documentElement.style.setProperty("--" + key, value);
  }
  const theme = config.theme;
  if (config.title) document.title = config.title;
  // Цвет заголовка окна в режиме приложения (start.cmd) — под цвет фона.
  document.querySelector('meta[name="theme-color"]').content = theme.background;

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

  // Дорожки по порядку из конфига: первая — у края. Без lane у события своя дорожка.
  const laneOf = (e) => e.lane ?? e.id;
  const lanes = [...new Set(events.map(laneOf))];

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
      if (i % 5 === 0) continue;
      const [x0, y0] = point(91, i * 6);
      const [x1, y1] = point(88, i * 6);
      s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${theme.tick}" stroke-width="1" stroke-linecap="round"/>`;
    }
    for (let h = 1; h <= 12; h++) {
      const [x, y] = point(83, h * 30);
      s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="600" fill="${theme.rim}">${h}</text>`;
    }
    return s;
  }

  function render() {
    const d = new Date();
    const now = debugNow ?? d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const visible = events.filter((e) => !off.has(e.id));

    clock.textContent = String(Math.floor(now / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(now % 60)).padStart(2, "0");

    let s = drawFace();

    // Дорожки берутся из конфига (поле lane) и не зависят от выключенных событий,
    // поэтому ничего не прыгает. События на одной дорожке идут друг за другом:
    // дуга следующего начинается там, где кончается предыдущее.
    // Будущее событие: дуга от «сейчас» (или от предыдущего события) до него.
    // Прошедшее: дуга от события до «сейчас» (но не дальше следующего) под красной маской.
    // Циферблат вмещает 12 часов, поэтому всё обрезается на 12 часах вперёд от стрелки —
    // иначе дуги дальних событий налезают на ближние.
    const HORIZON = now + 720;
    const OUTER = 73, STEP = 8, WIDTH = 5;
    lanes.forEach((lane, i) => {
      const r = OUTER - i * STEP;
      const onLane = visible.filter((e) => laneOf(e) === lane).sort((a, b) => a.minutes - b.minutes);
      // Докуда на этой дорожке дотягиваются будущие дуги; просрочка не должна заходить на них сзади.
      const reach = Math.min(HORIZON, Math.max(now, ...onLane.map((e) => e.minutes)));
      const segment = (start, end) => arc(r, angle(start), angle(start) + Math.max((end - start) / 2, 0.5));
      onLane.forEach((e, k) => {
        const prev = onLane[k - 1], next = onLane[k + 1];
        if (e.minutes > now) {
          const start = Math.max(now, prev ? prev.minutes : -Infinity);
          const end = Math.min(e.minutes, HORIZON);
          if (end <= start) return;
          s += `<path d="${segment(start, end)}" fill="none" stroke="${e.color}" stroke-width="${WIDTH}" opacity="0.7"/>`;
        } else {
          const start = Math.max(e.minutes, reach - 720);
          const end = Math.min(now, next ? next.minutes : Infinity);
          if (end < start) return;
          const d = segment(start, end);
          s += `<path d="${d}" fill="none" stroke="${e.color}" stroke-width="${WIDTH}" opacity="0.7"/>`;
          s += `<path d="${d}" fill="none" stroke="${theme.overdueMask}" stroke-width="${WIDTH}" opacity="${theme.overdueMaskOpacity}"/>`;
        }
      });
    });

    s += `<circle cx="100" cy="100" r="55" fill="${theme.face}"/>`;
    if (mascotSrc) {
      s += `<image href="${mascotSrc}" x="66" y="66" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`;
    }

    for (const e of visible) {
      const [x, y] = point(94, angle(e.minutes));
      const past = e.minutes <= now;
      s += `<circle cx="${x}" cy="${y}" r="7" fill="${e.color}" stroke="${past ? theme.overdue : theme.face}" stroke-width="${past ? 2.5 : 2}"><title>${e.name} ${e.time}</title></circle>`;
    }

    const [x0, y0] = point(56, angle(now));
    const [x1, y1] = point(77, angle(now));
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${theme.text}" stroke-width="4" stroke-linecap="round"/>`;

    svg.innerHTML = s;

    list.innerHTML = "";
    for (const e of events) {
      const isOff = off.has(e.id);
      const left = e.minutes - now;
      const btn = document.createElement("button");
      btn.className = "event" + (isOff ? " off" : left < 0 ? " overdue" : "");
      btn.title = e.time;
      btn.innerHTML =
        `<span class="name"><span class="dot" style="background:${isOff ? theme.tick : e.color}"></span>${e.name}</span>` +
        `<span class="left${!isOff && left < 0 ? " overdue" : ""}">${isOff ? "off" : (left < 0 ? "+" : "") + duration(left)}</span>`;
      btn.onclick = () => toggle(e.id);
      list.appendChild(btn);
    }
  }

  // Режим отладки: index.html?debug — под кнопками ползунок, который подменяет текущее время.
  let debugNow = null;
  if (new URLSearchParams(location.search).has("debug")) {
    const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    const d = new Date();
    debugNow = d.getHours() * 60 + d.getMinutes();
    const row = document.createElement("div");
    row.className = "debug";
    row.innerHTML = `<input type="range" min="0" max="1439" step="5" value="${debugNow}"><span>${hhmm(debugNow)}</span>`;
    const [slider, label] = row.children;
    slider.oninput = () => {
      debugNow = +slider.value;
      label.textContent = hhmm(debugNow);
      render();
    };
    document.querySelector(".widget").appendChild(row);
  }

  render();
  // Обновляем в начале каждой минуты.
  setTimeout(function tick() {
    render();
    setTimeout(tick, 60000 - (Date.now() % 60000));
  }, 60000 - (Date.now() % 60000));
})();
