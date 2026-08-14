// ===== MOCK DATA — wire to real endpoints (see design_prompts_forcoders.md) =====
(function () {
  var HEALTH = [
    { name: "harness3", status: "ok", url: ":8797" },
    { name: "harness2", status: "ok", url: ":8796" },
    { name: "goodbot", status: "ok", url: ":8790" },
    { name: "swarm-kernel", status: "down", url: ":8073" },
    { name: "forge-server", status: "down", url: ":8795" }
  ];

  var KPIS = [
    { label: "Active runs", value: "1", sub: "h3 goal live · 0 queued", tone: "ok" },
    { label: "Services up", value: "12 / 96", sub: "core + goodbot stack", tone: "ok" },
    { label: "Pending decisions", value: "3", sub: "audit · cutover · QR", tone: "warn" },
    { label: "Open alerts", value: "2", sub: "kernel down · drive", tone: "err" }
  ];

  var NEEDS = [
    { sev: "warn", title: "H3 PASS-audit awaiting review", detail: "1 sampled PASS verdict needs approve/retract", action: "Review" },
    { sev: "warn", title: "H2→H3 cutover not passed", detail: "H3-081..084 gates still open; GoodBot primary is H2", action: "Cutover" },
    { sev: "warn", title: "DadBot v2 not promoted", detail: "live dadbot is v1; v2 needs DADBOT_TELEGRAM_*", action: "Cutover" },
    { sev: "err", title: "/Volumes/Backup unmounted", detail: "gitea/immich/romm/minio symlinks would 502", action: "Mount" },
    { sev: "warn", title: "WhatsApp session", detail: "verify paired (not QR-needed) at wa-bridge :3100", action: "Check" }
  ];

  var SPEND = {
    activeRun: "h3-web-golden-live-repair…",
    runUsd: "$0.42",
    ratePerHr: "$3.10/hr",
    ceiling: "no daily ceiling"
  };

  var CUTOVER = {
    primary: "harness2 (reversible)",
    gates: [
      { id: "H3-081", label: "quiescent authority", state: "open" },
      { id: "H3-082", label: "benchmark authority", state: "open" },
      { id: "H3-083", label: "GoodBot switch", state: "open" },
      { id: "H3-084", label: "final gate", state: "open" }
    ]
  };

  var SERVICES = [
    { name: "goodbot", port: "8790→8080", host: "goodbot.lab…", profile: "goodbot", up: true, hc: true },
    { name: "homepage", port: "8089→3000", host: "homepage.lab…", profile: "core", up: true, hc: false },
    { name: "caddy", port: "80 / 443", host: "*.lab…", profile: "core", up: true, hc: false },
    { name: "minio", port: "9000 / 9001", host: "minio.lab…", profile: "infra", up: true, hc: false },
    { name: "opengist", port: "6157", host: "opengist.lab…", profile: "infra", up: true, hc: true },
    { name: "changedetection", port: "5050", host: "—", profile: "tools", up: true, hc: false },
    { name: "toy-deployer", port: "4500", host: "toys.lab/api", profile: "infra", up: true, hc: false },
    { name: "goodbot-db", port: "1252", host: "internal", profile: "goodbot", up: true, hc: true },
    { name: "harness2", port: "8796", host: "host process", profile: "host", up: true, hc: false },
    { name: "harness3", port: "8797", host: "host process", profile: "host", up: true, hc: false },
    { name: "swarm-kernel", port: "8073→8080", host: "video.lab", profile: "swarm", up: false, hc: true },
    { name: "forge-server", port: "8795", host: "host process", profile: "host", up: false, hc: false },
    { name: "gitea", port: "3000", host: "gitea.lab…", profile: "infra", up: false, hc: false },
    { name: "searxng", port: "8888", host: "—", profile: "search", up: false, hc: false },
    { name: "rag-agent", port: "4000", host: "rag.lab…", profile: "ai", up: false, hc: true }
  ];

  var TIMELINE = [
    { time: "22:28", kind: "run", text: "harness3 goal live: h3-web-golden-live-repair…" },
    { time: "22:12", kind: "deploy", text: "goodbot health ok (:8790)" },
    { time: "21:57", kind: "alert", text: "swarm-kernel :8073 unreachable" },
    { time: "21:40", kind: "backup", text: "backup snapshot completed" },
    { time: "21:15", kind: "run", text: "harness2 /health ok (0 active runs)" },
    { time: "20:58", kind: "deploy", text: "caddy + minio + homepage up" }
  ];

  function el(id) { return document.getElementById(id); }

  function renderHealth() {
    var h = "";
    for (var i = 0; i < HEALTH.length; i++) {
      var x = HEALTH[i];
      h += '<div class="hdot ' + x.status + '" title="' + x.name + ' ' + x.url + '">';
      h += '<span class="dot"></span>' + x.name + '</div>';
    }
    el("healthDots").innerHTML = h;
  }

  function renderKpis() {
    var h = "";
    for (var i = 0; i < KPIS.length; i++) {
      var k = KPIS[i];
      h += '<div class="kpi ' + k.tone + '"><div class="label">' + k.label + '</div>';
      h += '<div class="value">' + k.value + '</div><div class="sub">' + k.sub + '</div></div>';
    }
    el("kpis").innerHTML = h;
  }

  function renderNeeds() {
    el("needsCount").textContent = String(NEEDS.length);
    var h = "";
    for (var i = 0; i < NEEDS.length; i++) {
      var n = NEEDS[i];
      h += '<div class="need ' + n.sev + '"><span class="sev"></span><div class="body">';
      h += '<div class="t">' + n.title + '</div><div class="d">' + n.detail + '</div></div>';
      h += '<button>' + n.action + '</button></div>';
    }
    el("needsList").innerHTML = h;
  }

  function renderSpendCutover() {
    el("spend").innerHTML =
      '<h2>Spend</h2>' +
      '<div class="row"><span class="k">Active run</span><span class="v">' + SPEND.activeRun + '</span></div>' +
      '<div class="row"><span class="k">This run</span><span class="v">' + SPEND.runUsd + '</span></div>' +
      '<div class="row"><span class="k">Burn rate</span><span class="v">' + SPEND.ratePerHr + '</span></div>' +
      '<div class="row"><span class="k">Ceiling</span><span class="v">' + SPEND.ceiling + '</span></div>';

    var gates = "";
    for (var i = 0; i < CUTOVER.gates.length; i++) {
      var g = CUTOVER.gates[i];
      gates += '<div class="gate ' + g.state + '"><div class="gid">' + g.id + '</div><div class="glabel">' + g.label + '</div></div>';
    }
    el("cutover").innerHTML =
      '<h2>Cutover</h2><div class="row"><span class="k">Primary</span><span class="v">' + CUTOVER.primary + '</span></div>' +
      '<div class="gates">' + gates + '</div>';
  }

  function renderServices() {
    var up = 0;
    for (var i = 0; i < SERVICES.length; i++) { if (SERVICES[i].up) up++; }
    el("servicesSummary").textContent = up + " up of " + SERVICES.length + " shown";
    var h = "";
    for (var j = 0; j < SERVICES.length; j++) {
      var s = SERVICES[j];
      h += '<div class="svc ' + (s.up ? "up" : "down") + '"><span class="dot"></span><div class="meta">';
      h += '<div class="n">' + s.name + (s.hc ? '<span class="hc">healthcheck</span>' : "") + '</div>';
      h += '<div class="sub">' + s.port + " · " + s.host + '</div></div>';
      h += '<div class="prof">' + s.profile + '</div></div>';
    }
    el("serviceGrid").innerHTML = h;
  }

  function renderTimeline() {
    var h = "";
    for (var i = 0; i < TIMELINE.length; i++) {
      var t = TIMELINE[i];
      h += '<div class="tl ' + t.kind + '"><span class="t">' + t.time + '</span><span class="k"></span><span class="txt">' + t.text + '</span></div>';
    }
    el("timeline").innerHTML = h;
  }

  function tick() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    el("clock").textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  renderHealth();
  renderKpis();
  renderNeeds();
  renderSpendCutover();
  renderServices();
  renderTimeline();
  tick();
  setInterval(tick, 1000);
})();
