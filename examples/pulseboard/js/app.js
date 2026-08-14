// ===== Pulseboard — demo mock data (read-only; no live endpoints) =====
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var AVATAR_COLORS = ['#58a6ff', '#f0883e', '#3fb950', '#a371f7', '#e5534b', '#39c5cf', '#db61a2'];
  function avatarColor(name) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initials(name) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }

  // ---------- mock data ----------
  var KPIS = [
    { label: 'Active incidents', value: '7', trend: 'up', trendText: '+3 vs yesterday', spark: [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 7], color: 'var(--err)' },
    { label: 'MTTR', value: '42m', trend: 'down', trendText: '-18% this week', spark: [70, 66, 58, 60, 52, 55, 48, 50, 44, 46, 42, 42], color: 'var(--ok)' },
    { label: 'Services healthy', value: '52 / 56', trend: 'flat', trendText: 'no change', spark: [52, 52, 53, 52, 52, 51, 52, 52, 52, 52, 52, 52], color: 'var(--accent)' },
    { label: 'On-call load', value: '3 pages', trend: 'up', trendText: '1 in last hour', spark: [1, 1, 2, 1, 1, 2, 2, 3, 2, 2, 3, 3], color: 'var(--warn)' }
  ];

  var HEALTH_SERIES = [
    118, 122, 119, 124, 121, 126, 123, 120, 125, 128, 124, 130,
    126, 129, 132, 128, 134, 131, 127, 130, 126, 118, 96, 108
  ];
  var HEALTH_SPIKE_INDEX = 22; // 14:00 — the incident spike

  var INCIDENTS = [
    { id: 'INC-1042', title: 'Checkout API elevated 5xx rate', sev: 'critical', status: 'investigating', service: 'Checkout API', owner: 'Priya Nair', startedAt: Date.now() - 22 * 60000, updates: [
      { at: '4m ago', who: 'Priya Nair', text: 'Paged on-call. Error rate 8.4% on checkout-complete since 13:52.' },
      { at: '9m ago', who: 'Priya Nair', text: 'Correlating with deploy #4821 (billing engine config change).' },
      { at: '12m ago', who: 'Alerting', text: 'SLO burn alert fired for checkout-complete availability.' }
    ], responders: ['Priya Nair', 'Diego Fuentes', 'Samira Malik'] },
    { id: 'INC-1041', title: 'Database primary failover in us-east-1', sev: 'high', status: 'identified', service: 'Database — primary', owner: 'Diego Fuentes', startedAt: Date.now() - 74 * 60000, updates: [
      { at: '18m ago', who: 'Diego Fuentes', text: 'Replica promoted; app connections drained and rebalanced.' },
      { at: '41m ago', who: 'Diego Fuentes', text: 'Failover triggered by disk latency threshold breach on db-1a.' },
      { at: '1h ago', who: 'Alerting', text: 'Node db-1a marked unhealthy by healthcheck.' }
    ], responders: ['Diego Fuentes', 'Priya Nair'] },
    { id: 'INC-1039', title: 'Auth Service elevated latency', sev: 'medium', status: 'monitoring', service: 'Auth Service', owner: 'Jon Bell', startedAt: Date.now() - 3 * 3600000, updates: [
      { at: '52m ago', who: 'Jon Bell', text: 'Token cache hit ratio recovered to 98% after cache re-warm.' },
      { at: '2h ago', who: 'Jon Bell', text: 'Identified cache eviction storm after Redis node restart.' }
    ], responders: ['Jon Bell'] },
    { id: 'INC-1036', title: 'Web Frontend slow TTFB for EU users', sev: 'medium', status: 'investigating', service: 'Web Frontend', owner: 'Maya Chen', startedAt: Date.now() - 5 * 3600000, updates: [
      { at: '1h ago', who: 'Maya Chen', text: 'Edge cache misses concentrated on fra1 POP; investigating origin routing.' }
    ], responders: ['Maya Chen', 'Jon Bell'] },
    { id: 'INC-1028', title: 'Billing Engine duplicate webhook deliveries', sev: 'high', status: 'identified', service: 'Billing Engine', owner: 'Priya Nair', startedAt: Date.now() - 8 * 3600000, updates: [
      { at: '2h ago', who: 'Priya Nair', text: 'Idempotency keys missing on retry path — fix staged for review.' }
    ], responders: ['Priya Nair'] },
    { id: 'INC-1015', title: 'API Gateway TLS handshake failures', sev: 'low', status: 'monitoring', service: 'API Gateway', owner: 'Diego Fuentes', startedAt: Date.now() - 26 * 3600000, updates: [
      { at: '5h ago', who: 'Diego Fuentes', text: 'Handshake failures back to baseline after cert chain refresh.' }
    ], responders: ['Diego Fuentes'] },
    { id: 'INC-0993', title: 'Search index lag on metadata updates', sev: 'low', status: 'resolved', service: 'Search Service', owner: 'Maya Chen', startedAt: Date.now() - 47 * 3600000, updates: [
      { at: '1d ago', who: 'Maya Chen', text: 'Resolved — indexer pool scaled up; lag back under 30s.' }
    ], responders: ['Maya Chen'] }
  ];

  var SERVICES = [
    { name: 'API Gateway', state: 'ok', stateText: 'Healthy', latency: '24ms', errRate: '0.02%', bars: [3, 4, 3, 5, 4, 6, 5, 4, 5, 6, 5, 4] },
    { name: 'Checkout API', state: 'err', stateText: 'Degraded', latency: '412ms', errRate: '8.4%', bars: [2, 3, 2, 3, 4, 6, 9, 8, 9, 8, 9, 8] },
    { name: 'Auth Service', state: 'ok', stateText: 'Healthy', latency: '31ms', errRate: '0.01%', bars: [4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4] },
    { name: 'Database — primary', state: 'warn', stateText: 'Failover', latency: '18ms', errRate: '0.00%', bars: [3, 3, 4, 3, 8, 9, 8, 4, 3, 3, 4, 3] },
    { name: 'Billing Engine', state: 'warn', stateText: 'Degraded', latency: '88ms', errRate: '1.9%', bars: [3, 4, 3, 5, 6, 7, 6, 5, 6, 5, 4, 5] },
    { name: 'Web Frontend', state: 'ok', stateText: 'Healthy', latency: '110ms', errRate: '0.05%', bars: [4, 5, 4, 4, 5, 5, 4, 5, 5, 4, 5, 5] }
  ];

  var TIMELINE = [
    { kind: 'err', text: 'SLO burn alert fired for checkout-complete', meta: 'Checkout API · 14:02', who: 'Alerting' },
    { kind: 'warn', text: 'Priya paged: 5xx rate 8.4% and climbing', meta: 'On-call · 14:03', who: 'PagerDuty' },
    { kind: 'info', text: 'Deploy #4821 rolled back on billing-engine', meta: 'CI/CD · 14:11', who: 'Release bot' },
    { kind: 'warn', text: 'db-1a failed over to replica; traffic rebalanced', meta: 'Database · 13:48', who: 'Orchestrator' },
    { kind: 'ok', text: 'Auth cache re-warm complete, hit ratio 98%', meta: 'Auth Service · 13:02', who: 'Jon Bell' },
    { kind: 'info', text: 'On-call handoff: Samira takes lead at 18:00', meta: 'Schedule · 12:30', who: 'OpsBot' },
    { kind: 'ok', text: 'Nightly SLO report generated — no breaches', meta: 'Analytics · 06:00', who: 'Report bot' }
  ];

  var now = Date.now();
  var state = { sevFilter: 'all', statusFilter: 'all', search: '', loading: false, error: false, activityAll: true };

  // ---------- svg helpers ----------
  function sparkline(values, color, w, h) {
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      return [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)];
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' +
      pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') +
      '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function miniBars(values, accent) {
    var max = Math.max.apply(null, values);
    var w = 120, h = 26, bw = 6, gap = (w - bw * values.length) / (values.length - 1);
    var bars = values.map(function (v, i) {
      var bh = Math.max(2, (v / max) * (h - 2));
      var x = i * (bw + gap), y = h - bh;
      var hot = i >= values.length - 5;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + bh.toFixed(1) +
        '" rx="2" fill="' + (hot ? 'var(--err)' : accent) + '" opacity="' + (hot ? 0.95 : 0.55) + '"/>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + bars.join('') + '</svg>';
  }

  function renderHealthChart() {
    var wrap = $('#healthChart');
    var W = 720, H = 220, padL = 8, padR = 8, padT = 14, padB = 22;
    var min = 60, max = 150;
    var px = function (i) { return padL + (i / (HEALTH_SERIES.length - 1)) * (W - padL - padR); };
    var py = function (v) { return padT + (1 - (v - min) / (max - min)) * (H - padT - padB); };
    var line = HEALTH_SERIES.map(function (v, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ');
    var area = 'M' + px(0).toFixed(1) + ' ' + (H - padB) + ' L' + HEALTH_SERIES.map(function (v, i) { return px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' L') + ' L' + px(HEALTH_SERIES.length - 1).toFixed(1) + ' ' + (H - padB) + ' Z';
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gv = min + ((max - min) / 4) * g;
      var gy = py(gv);
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 5"/>' +
        '<text x="' + (W - padR) + '" y="' + (gy - 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + gv + '</text>';
    }
    var labels = ['00:00', '06:00', '12:00', '18:00', '24:00'];
    labels.forEach(function (l, i) {
      var lx = padL + (i / (labels.length - 1)) * (W - padL - padR);
      grid += '<text x="' + lx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + l + '</text>';
    });
    var spikeX = px(HEALTH_SPIKE_INDEX), spikeY = py(HEALTH_SERIES[HEALTH_SPIKE_INDEX]);
    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + grid +
      '<path d="' + area + '" fill="var(--accent)" opacity="0.12"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<line x1="' + spikeX.toFixed(1) + '" y1="' + padT + '" x2="' + spikeX.toFixed(1) + '" y2="' + (H - padB) + '" stroke="var(--medium)" stroke-width="1" stroke-dasharray="4 4"/>' +
      '<circle cx="' + spikeX.toFixed(1) + '" cy="' + spikeY.toFixed(1) + '" r="4.5" fill="var(--panel)" stroke="var(--medium)" stroke-width="2.5"/>' +
      '<text x="' + spikeX.toFixed(1) + '" y="' + (spikeY - 12).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--medium)">14:00 · incident</text>' +
      '</svg>';
    // hover tooltip
    var tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.hidden = true;
    wrap.appendChild(tip);
    wrap.addEventListener('mousemove', function (e) {
      var rect = wrap.getBoundingClientRect();
      var fx = (e.clientX - rect.left) / rect.width;
      var idx = Math.max(0, Math.min(HEALTH_SERIES.length - 1, Math.round(fx * (HEALTH_SERIES.length - 1))));
      tip.hidden = false;
      tip.style.left = (fx * 100) + '%';
      tip.style.top = ((py(HEALTH_SERIES[idx]) / H) * 100) + '%';
      tip.innerHTML = '<strong>' + HEALTH_SERIES[idx] + ' rpm</strong>' + labels[Math.floor(idx / 6)] + (idx === HEALTH_SPIKE_INDEX ? ' · <span class="spike-tag">incident spike</span>' : '');
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function renderKpis() {
    $('#kpiRow').innerHTML = KPIS.map(function (k) {
      var arrow = k.trend === 'up' ? '↑' : k.trend === 'down' ? '↓' : '→';
      return '<article class="kpi"><div class="kpi-head"><span>' + esc(k.label) + '</span><span class="trend ' + k.trend + '"><span class="arrow">' + arrow + '</span>' + esc(k.trendText) + '</span></div>' +
        '<div class="kpi-value">' + esc(k.value) + '</div>' +
        '<div class="kpi-foot"><span class="muted">vs previous 24h</span><span class="kpi-spark">' + sparkline(k.spark, k.color, 86, 30) + '</span></div></article>';
    }).join('');
  }

  function renderTimeline() {
    var items = state.activityAll ? TIMELINE : TIMELINE.slice(0, 4);
    $('#timeline').innerHTML = items.map(function (t) {
      return '<li class="tl-item"><span class="tl-dot ' + t.kind + '"></span><div class="tl-body">' +
        '<div class="tl-text">' + esc(t.text) + '</div><div class="tl-meta">' + esc(t.who) + ' · ' + esc(t.meta) + '</div></div></li>';
    }).join('');
  }

  // ---------- incidents table ----------
  function fmtDuration(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function visibleIncidents() {
    return INCIDENTS.filter(function (inc) {
      if (state.sevFilter !== 'all' && inc.sev !== state.sevFilter) return false;
      if (state.statusFilter !== 'all' && inc.status !== state.statusFilter) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        if ((inc.title + ' ' + inc.service + ' ' + inc.id).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function incidentTableHtml(rows) {
    var head = '<table class="table"><thead><tr><th>Incident</th><th>Severity</th><th>Service</th><th>Owner</th><th>Duration</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>';
    var body = rows.map(function (inc) {
      var sevIcon = { critical: '▲', high: '▲', medium: '■', low: '●' }[inc.sev];
      return '<tr tabindex="0" data-id="' + esc(inc.id) + '" aria-label="' + esc(inc.title) + ', ' + inc.sev + ' severity, ' + inc.status + '">' +
        '<td class="c-title"><span class="inc-title">' + esc(inc.title) + '</span><span class="inc-sub">' + esc(inc.id) + '</span></td>' +
        '<td class="c-sev"><span class="sev sev-' + inc.sev + '"><svg viewBox="0 0 16 16"><path d="M8 2 14 13H2Z"/></svg>' + inc.sev[0].toUpperCase() + inc.sev.slice(1) + '</span></td>' +
        '<td class="c-svc">' + esc(inc.service) + '</td>' +
        '<td class="c-owner"><span class="owner"><span class="avatar" style="background:' + avatarColor(inc.owner) + '">' + initials(inc.owner) + '</span>' + esc(inc.owner) + '</span></td>' +
        '<td class="c-dur" data-start="' + inc.startedAt + '">' + fmtDuration(now - inc.startedAt) + '</td>' +
        '<td class="c-status"><span class="pill pill-' + inc.status + '">' + inc.status[0].toUpperCase() + inc.status.slice(1) + '</span></td>' +
        '<td><button class="row-menu" data-id="' + esc(inc.id) + '" aria-label="Row actions for ' + esc(inc.title) + '">⋯</button></td></tr>';
    }).join('');
    return head + body + '</tbody></table>';
  }

  function renderIncidents() {
    var host = $('#incidentTable');
    if (state.loading) {
      var sk = '';
      for (var i = 0; i < 5; i++) sk += '<tr><td><div class="skeleton w-60"></div></td><td><div class="skeleton w-40"></div></td><td><div class="skeleton w-80"></div></td><td><div class="skeleton w-40"></div></td><td><div class="skeleton w-40"></div></td><td><div class="skeleton w-60"></div></td><td></td></tr>';
      host.innerHTML = '<table class="table"><tbody>' + sk + '</tbody></table>';
      return;
    }
    if (state.error) {
      host.innerHTML = '<div class="state-box state-err"><svg viewBox="0 0 24 24"><path d="M12 8v5M12 17h.01M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg>' +
        '<span><strong>Couldn\u2019t load incidents.</strong> The demo backend is unreachable.</span>' +
        '<button class="btn" id="retryLoad">Retry</button></div>';
      $('#retryLoad').addEventListener('click', function () { state.error = false; state.loading = true; renderIncidents(); setTimeout(function () { state.loading = false; renderIncidents(); toast('Incidents refreshed', 'ok'); }, 900); });
      return;
    }
    var rows = visibleIncidents();
    if (!rows.length) {
      host.innerHTML = '<div class="state-box"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>' +
        '<span>No incidents match these filters. <em>Nothing needs you right now.</em></span></div>';
      return;
    }
    host.innerHTML = incidentTableHtml(rows);
    host.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDrawer(tr.getAttribute('data-id')); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDrawer(tr.getAttribute('data-id')); });
    });
    host.querySelectorAll('.row-menu').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); toast('Row actions (demo)', 'ok'); });
    });
  }

  function renderServices() {
    $('#serviceGrid').innerHTML = SERVICES.map(function (s) {
      return '<article class="service-card"><div class="svc-head"><span class="svc-dot ' + s.state + '"></span>' +
        '<span class="svc-name">' + esc(s.name) + '</span><span class="svc-state ' + s.state + '">' + esc(s.stateText) + '</span></div>' +
        '<div class="svc-metrics"><span>Latency<b>' + esc(s.latency) + '</b></span><span>Error rate<b>' + esc(s.errRate) + '</b></span></div>' +
        '<div class="mini-chart">' + miniBars(s.bars, 'var(--accent)') + '</div></article>';
    }).join('');
  }

  // ---------- drawer ----------
  function openDrawer(id) {
    var inc = INCIDENTS.find(function (i) { return i.id === id; });
    if (!inc) return;
    var d = $('#drawer');
    d.innerHTML =
      '<div class="drawer-head"><div><span class="sev sev-' + inc.sev + '"><svg viewBox="0 0 16 16"><path d="M8 2 14 13H2Z"/></svg>' + inc.sev + '</span> ' +
      '<span class="pill pill-' + inc.status + '">' + inc.status + '</span></div>' +
      '<button class="icon-btn" id="drawerClose" aria-label="Close incident details">✕</button></div>' +
      '<h2 id="drawerTitle">' + esc(inc.title) + '</h2>' +
      '<div class="drawer-meta"><span class="muted">' + esc(inc.id) + '</span><span class="muted">·</span><span class="muted">' + esc(inc.service) + '</span><span class="muted">·</span><span class="muted">opened ' + fmtDuration(now - inc.startedAt) + ' ago</span></div>' +
      '<div class="drawer-sec"><h3>Responders</h3>' + inc.responders.map(function (r) {
        return '<div class="responder"><span class="avatar" style="background:' + avatarColor(r) + '">' + initials(r) + '</span><span class="r-meta"><span class="r-name">' + esc(r) + '</span><span class="r-role">' + (r === inc.owner ? 'Incident commander' : 'Responder') + '</span></span></div>';
      }).join('') + '</div>' +
      '<div class="drawer-sec"><h3>Timeline</h3><ul class="timeline">' + inc.updates.map(function (u) {
        return '<li class="tl-item"><span class="tl-dot info"></span><div class="tl-body"><div class="tl-text"><b>' + esc(u.who) + '</b> — ' + esc(u.text) + '</div><div class="tl-meta">' + esc(u.at) + '</div></div></li>';
      }).join('') + '</ul></div>' +
      '<div class="drawer-actions">' +
      '<button class="btn" id="actAck">Acknowledge</button>' +
      '<button class="btn" id="actResolve">Mark resolved</button>' +
      '<button class="btn btn-danger" id="actEscalate">Escalate</button>' +
      '</div>';
    $('#drawerScrim').hidden = false;
    d.hidden = false;
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#actAck').addEventListener('click', function () {
      inc.status = 'monitoring';
      inc.updates.unshift({ at: 'just now', who: 'You', text: 'Incident acknowledged — monitoring recovery.' });
      TIMELINE.unshift({ kind: 'info', text: 'Acknowledged ' + inc.id + ' (' + inc.title + ')', meta: 'You · just now', who: 'You' });
      renderAll(); openDrawer(inc.id); toast('Acknowledged — now monitoring', 'ok');
    });
    $('#actResolve').addEventListener('click', function () {
      inc.status = 'resolved';
      inc.updates.unshift({ at: 'just now', who: 'You', text: 'Marked resolved after recovery confirmed.' });
      TIMELINE.unshift({ kind: 'ok', text: 'Resolved ' + inc.id + ' (' + inc.title + ')', meta: 'You · just now', who: 'You' });
      renderAll(); openDrawer(inc.id); toast('Incident resolved', 'ok');
    });
    $('#actEscalate').addEventListener('click', function () {
      TIMELINE.unshift({ kind: 'err', text: 'Escalated ' + inc.id + ' to engineering director', meta: 'You · just now', who: 'You' });
      renderAll(); toast('Escalated — director notified', 'ok');
    });
  }
  function closeDrawer() { $('#drawer').hidden = true; $('#drawerScrim').hidden = true; }

  // ---------- modal ----------
  function openModal() { $('#modalScrim').hidden = false; $('#incidentForm').reset(); $('#incidentForm').elements.title.focus(); }
  function closeModal() { $('#modalScrim').hidden = true; }
  $('#createIncident').addEventListener('click', openModal);
  $('#modalCancel').addEventListener('click', closeModal);
  $('#modalClose').addEventListener('click', closeModal);
  $('#incidentForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements;
    var id = 'INC-' + (1043 + INCIDENTS.filter(function (i) { return i.id.indexOf('INC-') === 0; }).length);
    INCIDENTS.unshift({
      id: id, title: f.title.value.trim(), sev: f.severity.value, status: 'investigating',
      service: f.service.value, owner: 'Samira Malik', startedAt: Date.now(),
      updates: [{ at: 'just now', who: 'You', text: 'Incident created from the overview page.' + (f.description.value.trim() ? ' ' + f.description.value.trim() : '') }],
      responders: ['Samira Malik']
    });
    TIMELINE.unshift({ kind: 'err', text: 'New incident ' + id + ': ' + f.title.value.trim(), meta: 'You · just now', who: 'You' });
    closeModal(); renderAll(); toast('Incident created', 'ok');
  });

  // ---------- filters / search / theme / drawer scrims ----------
  function bindChips(sel, attr, key) {
    $(sel).addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$(sel + ' .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      state[key] = chip.getAttribute(attr);
      renderIncidents();
    });
  }
  bindChips('#sevChips', 'data-sev', 'sevFilter');
  bindChips('#statusChips', 'data-status', 'statusFilter');

  $('#search').addEventListener('input', function (e) { state.search = e.target.value.trim(); renderIncidents(); });
  $('#drawerScrim').addEventListener('click', closeDrawer);
  $('#modalScrim').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeModal(); });
  $('#activityFilter').addEventListener('click', function () {
    state.activityAll = !state.activityAll;
    this.setAttribute('aria-pressed', String(state.activityAll));
    this.textContent = state.activityAll ? 'All updates' : 'Last 4';
    renderTimeline();
  });

  var themeBtn = document.createElement('button');
  themeBtn.className = 'icon-btn'; themeBtn.id = 'themeToggle';
  themeBtn.setAttribute('aria-label', 'Switch to light theme');
  themeBtn.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13v-13Z"/></svg>';
  document.querySelector('.topbar-controls').insertBefore(themeBtn, document.querySelector('#createIncident'));
  themeBtn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeBtn.setAttribute('aria-label', 'Switch to ' + (next === 'dark' ? 'light' : 'dark') + ' theme');
    renderAll(); // re-render svg colors from current tokens
  });

  // demo state switches (honest, labeled)
  var switches = document.createElement('span');
  switches.className = 'demo-switches';
  switches.innerHTML = '<label><input type="checkbox" id="demoLoading"> Loading</label><label><input type="checkbox" id="demoError"> Error</label>';
  var incidentsHead = document.querySelector('.incidents-panel .panel-head');
  incidentsHead.appendChild(switches);
  $('#demoLoading').addEventListener('change', function (e) { state.loading = e.target.checked; renderIncidents(); });
  $('#demoError').addEventListener('change', function (e) { state.error = e.target.checked; renderIncidents(); });

  // hamburger
  $('#hamburger').addEventListener('click', function () { document.body.classList.toggle('side-open'); $('#sidebarScrim').hidden = !document.body.classList.contains('side-open'); });
  $('#sidebarScrim').addEventListener('click', function () { document.body.classList.remove('side-open'); this.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); closeModal(); document.body.classList.remove('side-open'); $('#sidebarScrim').hidden = true; }
  });

  // ---------- toast + ticks ----------
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function renderAll() { renderKpis(); renderHealthChart(); renderTimeline(); renderIncidents(); renderServices(); }

  // simulate initial load
  state.loading = true;
  renderKpis(); renderHealthChart(); renderTimeline(); renderIncidents(); renderServices();
  setTimeout(function () { state.loading = false; renderIncidents(); }, 700);

  setInterval(function () {
    now = Date.now();
    $$('#incidentTable [data-start]').forEach(function (el) {
      el.textContent = fmtDuration(now - Number(el.getAttribute('data-start')));
    });
  }, 30000);
})();
