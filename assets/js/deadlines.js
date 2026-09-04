// assets/js/deadlines.js
// Live conference deadline countdowns for /deadlines/.
// Conference list: _data/deadlines/csrankings.yml (embedded as JSON).
// Deadline data: fetched from ccfddl.com at page load.
(function () {
  'use strict';

  var DATA_URL = 'https://ccfddl.com/conference/allconf.yml';
  var STORE_KEY = 'deadlines-areas';
  var STORE_PAST_KEY = 'deadlines-hide-past';

  var groups = JSON.parse(
    document.getElementById('deadlines-config').textContent
  );
  var container = document.querySelector('.conf-container');
  var status = document.querySelector('.deadline-status');
  var areaBoxes = toArray(document.querySelectorAll('.area-checkbox'));
  var parentBoxes = toArray(document.querySelectorAll('.parent-checkbox'));
  var hidePastBox = document.getElementById('hide-past');
  var toggles = toArray(document.querySelectorAll('.deadline-toggle'));
  var areaByKey = {};

  groups.forEach(function (group) {
    group.areas.forEach(function (area) {
      areaByKey[area.key] = area;
    });
  });

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(href, text) {
    var a = el('a', null, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function storeGet(key) {
    try { return JSON.parse(window.localStorage.getItem(key)); }
    catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* storage unavailable */ }
  }

  // Offset (minutes east of UTC) of an IANA zone at a given instant.
  function zoneOffsetAt(ms, zone) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
    var parts = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) {
      parts[p.type] = parseInt(p.value, 10);
    });
    var asUtc = Date.UTC(parts.year, parts.month - 1, parts.day,
      parts.hour % 24, parts.minute, parts.second);
    return Math.round((asUtc - ms) / 60000);
  }

  // Parse "YYYY-MM-DD HH:mm[:ss]" in the ccfddl timezone notation
  // ("AoE", "UTC", "UTC-12", "UTC+5:30", "PT") into a Date.
  function parseDeadline(str, tz) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
      .exec(String(str || '').trim());
    if (!m) return null;
    var base = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    var zone = String(tz || 'AoE').trim();
    var offset = null;
    var iana = null;
    var om;

    if (/^AoE$/i.test(zone)) offset = -12 * 60;
    else if (/^UTC$/i.test(zone)) offset = 0;
    else if ((om = /^UTC\s*([+-])\s*(\d{1,2})(?::(\d{2}))?$/i.exec(zone))) {
      offset = (om[1] === '-' ? -1 : 1) * (+om[2] * 60 + (+om[3] || 0));
    } else if (/^PT$/i.test(zone)) iana = 'America/Los_Angeles';
    else if (/^ET$/i.test(zone)) iana = 'America/New_York';
    else if (/^CET$/i.test(zone)) iana = 'Europe/Paris';
    else if (zone.indexOf('/') !== -1) iana = zone;
    else offset = -12 * 60;

    if (iana) {
      try {
        offset = zoneOffsetAt(base - zoneOffsetAt(base, iana) * 60000, iana);
      } catch (e) {
        offset = -12 * 60;
      }
    }
    return new Date(base - offset * 60000);
  }

  function formatLocal(date) {
    return date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function formatCountdown(ms) {
    var s = Math.floor(ms / 1000);
    var days = Math.floor(s / 86400);
    var hours = Math.floor((s % 86400) / 3600);
    var mins = Math.floor((s % 3600) / 60);
    var secs = s % 60;
    return days + ' day' + (days === 1 ? '' : 's') + ' ' +
      pad(hours) + 'h ' + pad(mins) + 'm ' + pad(secs) + 's';
  }

  function formatAgo(ms) {
    var days = Math.floor(ms / 86400000);
    if (days < 1) return 'today';
    if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    var months = Math.floor(days / 30);
    if (months < 12) {
      return months + ' month' + (months === 1 ? '' : 's') + ' ago';
    }
    var years = Math.floor(days / 365);
    return years + ' year' + (years === 1 ? '' : 's') + ' ago';
  }

  // ---------------------------------------------------------------------
  // Build rows from the upstream data
  // ---------------------------------------------------------------------

  function latestEdition(entry) {
    var best = null;
    (entry.confs || []).forEach(function (c) {
      if (!best || +c.year > +best.year) best = c;
    });
    return best;
  }

  function buildRows(upstream) {
    var byKey = {};
    upstream.forEach(function (entry) {
      byKey[entry.sub + '/' + entry.title] = entry;
    });

    var rows = [];
    var missing = [];
    groups.forEach(function (group) {
      group.areas.forEach(function (area) {
        area.confs.forEach(function (conf) {
          var entry = conf.ccfddl ? byKey[conf.ccfddl] : null;
          var edition = entry ? latestEdition(entry) : null;
          var base = {
            name: conf.name, area: area,
            description: entry ? entry.description : '',
            link: (edition && edition.link) || conf.link || '',
            year: edition ? edition.year : null,
            date: edition ? edition.date : '',
            place: edition ? edition.place : ''
          };
          if (!edition) {
            if (conf.ccfddl) missing.push(conf.name);
            rows.push(Object.assign({}, base, {
              deadline: null, index: 0, count: 0
            }));
            return;
          }
          var timeline = edition.timeline || [];
          if (!timeline.length) {
            rows.push(Object.assign({}, base, {
              deadline: null, index: 0, count: 0
            }));
          }
          var built = timeline.map(function (t, i) {
            return Object.assign({}, base, {
              deadline: parseDeadline(t.deadline, edition.timezone),
              abstract: parseDeadline(
                t.abstract_deadline || t['abstract deadline'],
                edition.timezone
              ),
              comment: t.comment || '',
              index: i, count: timeline.length
            });
          });
          // Within one edition, drop TBD entries when dated ones exist.
          // Past cycles are kept (styled as past and hidden by the
          // "Hide past deadlines" filter) so multi-cycle editions such
          // as USENIX Security always list every cycle.
          var dated = built.filter(function (r) { return r.deadline; });
          if (dated.length) built = dated;
          rows.push.apply(rows, built);
        });
      });
    });
    return { rows: rows, missing: missing };
  }

  function sortRows(rows) {
    var now = Date.now();
    rows.sort(function (a, b) {
      var ad = a.deadline ? a.deadline.getTime() : null;
      var bd = b.deadline ? b.deadline.getTime() : null;
      if (ad === null && bd === null) return a.name < b.name ? -1 : 1;
      if (ad === null) return 1;
      if (bd === null) return -1;
      var aPast = ad < now;
      var bPast = bd < now;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? bd - ad : ad - bd;
    });
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  function renderRow(row) {
    var now = Date.now();
    var box = el('div', 'conf');
    box.setAttribute('data-area', row.area.key);
    if (!row.deadline) box.className += ' no-data';
    else if (row.deadline.getTime() < now) box.className += ' past';

    var grid = el('div', 'row');
    var left = el('div', 'col-12 col-sm-6');
    var right = el('div', 'col-12 col-sm-6');

    var title = row.name + (row.year ? ' ' + row.year : '');
    var h2 = el('h2');
    h2.appendChild(row.link ? link(row.link, title) : el('span', null, title));
    left.appendChild(h2);

    var meta = el('div', 'meta');
    if (row.description) {
      meta.appendChild(document.createTextNode(row.description));
      meta.appendChild(el('br'));
    }
    var areaLine = el('span', 'area-tag', row.area.name);
    meta.appendChild(areaLine);
    if (row.date || row.place) {
      meta.appendChild(el('br'));
      var when = String(row.date || '').replace(/ ?- ?/g, '–');
      meta.appendChild(document.createTextNode(when));
      if (row.place) {
        meta.appendChild(document.createTextNode(when ? ' // ' : ''));
        meta.appendChild(link(
          'https://maps.google.com/?q=' + encodeURIComponent(row.place),
          row.place
        ));
      }
    }
    left.appendChild(meta);

    var timer = el('span', 'timer');
    if (row.deadline) {
      timer.setAttribute('data-deadline', row.deadline.getTime());
    } else {
      timer.textContent = 'TBD';
    }
    right.appendChild(timer);

    var dl = el('div', 'deadline');
    var label = row.count >= 2 ?
      'Deadline (' + (row.index + 1) + ' / ' + row.count + '): ' :
      'Deadline: ';
    dl.appendChild(document.createTextNode(label));
    dl.appendChild(el('span', 'deadline-time',
      row.deadline ? formatLocal(row.deadline) : 'No data yet'));
    var extra = el('div', 'meta');
    if (row.abstract) {
      extra.appendChild(document.createTextNode(
        'Abstract: ' + formatLocal(row.abstract)));
      if (row.comment) extra.appendChild(el('br'));
    }
    if (row.comment) extra.appendChild(document.createTextNode(row.comment));
    if (extra.childNodes.length) dl.appendChild(extra);
    right.appendChild(dl);

    grid.appendChild(left);
    grid.appendChild(right);
    box.appendChild(grid);
    box.appendChild(el('hr'));
    return box;
  }

  function render(rows) {
    var frag = document.createDocumentFragment();
    rows.forEach(function (row) {
      frag.appendChild(renderRow(row));
    });
    container.innerHTML = '';
    container.appendChild(frag);
    applyFilters();
  }

  var timers = [];

  function tick() {
    var now = Date.now();
    timers.forEach(function (t) {
      var diff = t.deadline - now;
      var text = diff > 0 ? formatCountdown(diff) : formatAgo(-diff);
      if (t.node.textContent !== text) t.node.textContent = text;
      if (diff <= 0 && t.box && !/\bpast\b/.test(t.box.className)) {
        t.box.className += ' past';
      }
    });
  }

  function startTimers() {
    timers = toArray(container.querySelectorAll('.timer[data-deadline]'))
      .map(function (node) {
        return {
          node: node,
          box: node.closest ? node.closest('.conf') : null,
          deadline: +node.getAttribute('data-deadline')
        };
      });
    tick();
    window.setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------

  function selectedAreas() {
    return areaBoxes.filter(function (b) { return b.checked; })
      .map(function (b) { return b.getAttribute('data-area'); });
  }

  function syncParents() {
    parentBoxes.forEach(function (p) {
      var g = p.getAttribute('data-group');
      var kids = areaBoxes.filter(function (b) {
        return b.getAttribute('data-group') === g;
      });
      p.checked = kids.length > 0 && kids.every(function (b) {
        return b.checked;
      });
    });
  }

  function applyFilters() {
    var selected = selectedAreas();
    var hidePast = hidePastBox.checked;
    var shown = 0;
    toArray(container.querySelectorAll('.conf')).forEach(function (box) {
      var area = box.getAttribute('data-area');
      var show = selected.length === 0 || selected.indexOf(area) !== -1;
      if (show && hidePast && /\bpast\b/.test(box.className)) show = false;
      box.hidden = !show;
      if (show) shown++;
    });
    var note = container.querySelector('.deadline-empty');
    if (note) note.remove();
    if (!shown && container.children.length) {
      container.appendChild(el('p', 'deadline-empty',
        'No deadlines match the selected filters.'));
    }
  }

  function readUrlSelection() {
    var q = window.location.search.slice(1).split('&');
    for (var i = 0; i < q.length; i++) {
      var kv = q[i].split('=');
      if (decodeURIComponent(kv[0]) === 'area') {
        return decodeURIComponent(kv.slice(1).join('=')).split(',')
          .filter(function (k) { return areaByKey[k]; });
      }
    }
    return null;
  }

  function writeUrl() {
    var selected = selectedAreas();
    var query = selected.length ?
      '?area=' + selected.map(encodeURIComponent).join(',') : '';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '',
        window.location.pathname + query + window.location.hash);
    }
  }

  function onFilterChange() {
    syncParents();
    storeSet(STORE_KEY, selectedAreas());
    storeSet(STORE_PAST_KEY, hidePastBox.checked);
    writeUrl();
    applyFilters();
  }

  function setExpanded(button, expanded) {
    var panel = document.getElementById(
      button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.className = 'deadline-toggle' + (expanded ? ' expanded' : '');
    if (panel) panel.hidden = !expanded;
  }

  // Expand a group when only some of its areas are selected, so the
  // partial selection is visible.
  function expandPartialGroups() {
    toggles.forEach(function (button) {
      var g = button.getAttribute('data-group');
      var kids = areaBoxes.filter(function (b) {
        return b.getAttribute('data-group') === g;
      });
      var n = kids.filter(function (b) { return b.checked; }).length;
      if (n > 0 && n < kids.length) setExpanded(button, true);
    });
  }

  function initFilters() {
    toggles.forEach(function (button) {
      button.addEventListener('click', function () {
        setExpanded(button,
          button.getAttribute('aria-expanded') !== 'true');
      });
    });
    var fromUrl = readUrlSelection();
    var initial = fromUrl || storeGet(STORE_KEY) || [];
    if (!Array.isArray(initial)) initial = [];
    areaBoxes.forEach(function (b) {
      b.checked = initial.indexOf(b.getAttribute('data-area')) !== -1;
      b.addEventListener('change', onFilterChange);
    });
    hidePastBox.checked = storeGet(STORE_PAST_KEY) === true;
    hidePastBox.addEventListener('change', onFilterChange);
    parentBoxes.forEach(function (p) {
      p.addEventListener('change', function () {
        var g = p.getAttribute('data-group');
        areaBoxes.forEach(function (b) {
          if (b.getAttribute('data-group') === g) b.checked = p.checked;
        });
        onFilterChange();
      });
    });
    syncParents();
    expandPartialGroups();
    if (fromUrl) storeSet(STORE_KEY, selectedAreas());
    writeUrl();
  }

  // ---------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------

  function setStatus(text, isError) {
    status.textContent = text;
    status.className = 'deadline-status' + (isError ? ' text-danger' : '');
  }

  function load() {
    initFilters();
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var upstream = window.jsyaml.load(text);
        if (!Array.isArray(upstream)) throw new Error('Unexpected format');
        var built = buildRows(upstream);
        sortRows(built.rows);
        render(built.rows);
        startTimers();
        var n = built.rows.filter(function (r) { return r.deadline; }).length;
        var msg = n + ' deadlines loaded from ccfddl.com at ' +
          new Date().toLocaleTimeString() + '.';
        if (built.missing.length) {
          msg += ' No upstream data for: ' + built.missing.join(', ') + '.';
        }
        setStatus(msg, false);
      })
      .catch(function (err) {
        setStatus('Could not load deadline data from ccfddl.com (' +
          err.message + '). Please try again later or visit ' +
          'https://ccfddl.com/ directly.', true);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
