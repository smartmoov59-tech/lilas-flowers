/* ==========================================================================
   LILA’S FLOWERS — comportement du site (statique, sans back-end)
   GSAP + ScrollTrigger + Lenis (copies locales dans /vendor)
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  CONFIG — à adapter si besoin                                       */
  /* ------------------------------------------------------------------ */
  const SHOP = {
    name: 'Lila’s Flowers',
    phone: '04 42 58 40 56',
    tel: '+33442584056',
    email: 'lilasflowers@live.fr',
    /* Numéro MOBILE de la boutique (ex. '+33612345678') pour activer le bouton « Envoyer par SMS ».
       Laissé vide : le bouton est masqué (un fixe ne reçoit pas les SMS). */
    smsNumber: '',
    address: '55 boulevard Carnot, 13120 Gardanne',
    tz: 'Europe/Paris',
    /* Horaires : 0 = dimanche … 6 = samedi, en heures décimales (8.5 = 8 h 30) */
    hours: { 0: [8.5, 13.5], 1: [8.5, 19.5], 2: [8.5, 19.5], 3: [8.5, 19.5], 4: [8.5, 19.5], 5: [8.5, 20], 6: [8.5, 20] },
    /* Jours particuliers (jours fériés…) : 'AAAA-MM-JJ': [ouverture, fermeture] */
    special: { '2026-11-11': [8.5, 13] },
    slotStep: 0.5,          // créneaux toutes les 30 minutes
    lastBeforeClose: 0.5,   // dernier créneau 30 min avant la fermeture
    leadHours: 1,           // délai minimum pour un retrait le jour même
  };

  /* ------------------------------------------------------------------ */
  /*  Outils                                                             */
  /* ------------------------------------------------------------------ */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const html = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ------------------------------------------------------------------ */
  /*  Heure de Paris, horaires, statut « ouvert »                        */
  /* ------------------------------------------------------------------ */
  function parisNow() {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: SHOP.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const o = {};
    parts.forEach((p) => { o[p.type] = p.value; });
    const y = +o.year, m = +o.month, d = +o.day;
    return { y, m, d, iso: `${y}-${pad2(m)}-${pad2(d)}`, h: +o.hour + (+o.minute) / 60, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
  }
  const isoToDow = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`; };
  const hoursFor = (iso) => SHOP.special[iso] || SHOP.hours[isoToDow(iso)];
  const fmtH = (x) => { const h = Math.floor(x + 1e-9); const m = Math.round((x - h) * 60); return m ? `${h} h ${pad2(m)}` : `${h} h`; };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dateLabel = (iso, short) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', short
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function updateStatus() {
    const el = $('#openStatus');
    const now = parisNow();
    const today = hoursFor(now.iso);
    let txt; let closed = false;
    if (today && now.h >= today[0] && now.h < today[1]) {
      txt = `Ouvert maintenant · jusqu’à ${fmtH(today[1])}`;
    } else {
      closed = true;
      if (today && now.h < today[0]) {
        txt = `Fermé · ouvre aujourd’hui à ${fmtH(today[0])}`;
      } else {
        const next = addDays(now.iso, 1);
        const nh = hoursFor(next);
        txt = `Fermé · rouvre demain (${DAYS[isoToDow(next)]}) à ${fmtH(nh[0])}`;
      }
    }
    if (el) { el.classList.toggle('is-closed', closed); $('span', el).textContent = txt; }
    $$('#hours tr').forEach((tr) => tr.classList.toggle('is-today', +tr.dataset.d === now.dow));
  }

  /* ------------------------------------------------------------------ */
  /*  Découpage de texte                                                 */
  /* ------------------------------------------------------------------ */
  function splitChars(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = text.split(' ');
    words.forEach((w, wi) => {
      const ws = document.createElement('span');
      ws.className = 'word';
      ws.setAttribute('aria-hidden', 'true');
      Array.from(w).forEach((ch) => { const c = document.createElement('span'); c.className = 'char'; c.textContent = ch; ws.appendChild(c); });
      el.appendChild(ws);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.char', el);
  }
  function splitWords(root) {
    const inners = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding:.1em .08em .16em;margin:-.1em -.08em -.16em';
            const i = document.createElement('span');
            i.style.display = 'inline-block';
            i.textContent = p;
            w.appendChild(i); frag.appendChild(w); inners.push(i);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    };
    walk(root);
    return inners;
  }

  /* ------------------------------------------------------------------ */
  /*  Vidéos (choix de la qualité, lecture, économie de données)         */
  /* ------------------------------------------------------------------ */
  function setupVideos() {
    const hv = $('#heroVideo');
    if (hv) {
      const saver = navigator.connection && navigator.connection.saveData;
      if (reduce || saver) {
        hv.removeAttribute('autoplay');
      } else {
        hv.src = window.innerWidth < 900 ? 'video/hero-720.mp4' : 'video/hero.mp4';
        const p = hv.play(); if (p && p.catch) p.catch(() => {});
      }
    }
    const bv = $('#bookVideo');
    if (bv && !reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            const s = $('source', bv);
            if (s && s.dataset.src) { s.src = s.dataset.src; delete s.dataset.src; bv.load(); }
            const p = bv.play(); if (p && p.catch) p.catch(() => {});
          } else { bv.pause(); }
        });
      }, { rootMargin: '200px' });
      io.observe($('#reserver'));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Ancres, menu mobile                                                */
  /* ------------------------------------------------------------------ */
  let lenis = null;
  function setupAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu(true);
      const go = () => {
        if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (id !== '#top') { target.setAttribute('tabindex', '-1'); setTimeout(() => target.focus({ preventScroll: true }), 900); }
      };
      go();
    });
  }
  const burger = $('#burger');
  const menu = $('#menu');
  let menuOpen = false;
  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    $('#nav').classList.remove('is-hidden');
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fermer le menu');
    if (lenis) lenis.stop();
    if (hasGSAP && !reduce) {
      gsap.fromTo(menu, { clipPath: 'circle(0% at calc(100% - 2.6rem) 2.6rem)' }, { clipPath: 'circle(150% at calc(100% - 2.6rem) 2.6rem)', duration: 1, ease: 'expo.inOut' });
      gsap.fromTo('.menu a span', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: .06, ease: 'expo.out', delay: .35 });
      gsap.fromTo('.menu__foot', { opacity: 0 }, { opacity: .75, duration: .8, delay: .8 });
    } else { menu.style.clipPath = 'none'; }
  }
  function closeMenu(instant) {
    if (!menuOpen) return;
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    if (lenis) lenis.start();
    const done = () => { menu.hidden = true; };
    if (hasGSAP && !reduce && !instant) {
      gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 2.6rem) 2.6rem)', duration: .8, ease: 'expo.inOut', onComplete: done });
    } else { done(); }
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ------------------------------------------------------------------ */
  /*  Formulaire de réservation (sans GSAP : fonctionne toujours)        */
  /* ------------------------------------------------------------------ */
  function setupBooking() {
    const form = $('#bookForm');
    if (!form) return;
    const fsets = $$('.fs', form);
    const stepLis = $$('.form__steps li', form);
    const bar = $('#formBar');
    const dateEl = $('#date');
    const slotEl = $('#slot');
    const hint = $('#hoursHint');
    let cur = 1;

    const val = (name) => { const el = form.elements[name]; return el ? (el.value || '').trim() : ''; };
    const checked = (name) => { const el = form.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ''; };
    const setErr = (id, msg, field) => { const e = $(`#${id}`); if (e) e.textContent = msg || ''; if (field) field.setAttribute('aria-invalid', msg ? 'true' : 'false'); };

    /* -- créneaux -- */
    function buildSlots(iso, silent) {
      const hrs = hoursFor(iso);
      slotEl.innerHTML = '';
      if (!hrs) { hint.textContent = 'La boutique est fermée ce jour-là.'; return 0; }
      const now = parisNow();
      const min = iso === now.iso ? now.h + SHOP.leadHours : 0;
      let n = 0;
      for (let t = hrs[0]; t <= hrs[1] - SHOP.lastBeforeClose + 1e-9; t += SHOP.slotStep) {
        if (t < min) continue;
        const o = document.createElement('option');
        o.value = fmtH(t); o.textContent = fmtH(t); slotEl.appendChild(o); n++;
      }
      const special = SHOP.special[iso] ? ' (jour férié : horaires réduits)' : '';
      hint.textContent = `${dateLabel(iso).replace(/^./, (c) => c.toUpperCase())} : la boutique est ouverte de ${fmtH(hrs[0])} à ${fmtH(hrs[1])}${special}.`;
      if (!n && !silent) hint.textContent += ' Plus de créneau disponible ce jour-là.';
      return n;
    }
    function initDate() {
      const now = parisNow();
      dateEl.min = now.iso;
      dateEl.max = addDays(now.iso, 120);
      let iso = now.iso; let tries = 0;
      while (tries < 8 && !buildSlots(iso, true)) { iso = addDays(iso, 1); tries++; }
      dateEl.value = iso;
      buildSlots(iso, true);
    }
    dateEl.addEventListener('change', () => {
      setErr('dateErr', '', dateEl); setErr('slotErr', '', slotEl);
      if (!dateEl.value) return;
      const n = buildSlots(dateEl.value);
      if (!n) setErr('slotErr', 'Aucun créneau ce jour-là : choisissez une autre date.', slotEl);
    });

    /* -- retrait / livraison -- */
    const deliv = $('#deliveryFields');
    $$('input[name="mode"]', form).forEach((r) => r.addEventListener('change', () => { deliv.hidden = checked('mode') !== 'Livraison'; }));
    $$('input[name="type"]', form).forEach((r) => r.addEventListener('change', () => { $('#deuilHint').hidden = checked('type') !== 'Deuil'; }));

    /* -- validation -- */
    function validate(step) {
      let ok = true;
      if (step === 2) {
        const now = parisNow();
        const iso = dateEl.value;
        if (!iso) { setErr('dateErr', 'Choisissez un jour.', dateEl); ok = false; }
        else if (iso < now.iso) { setErr('dateErr', 'Ce jour est passé.', dateEl); ok = false; }
        else if (!hoursFor(iso)) { setErr('dateErr', 'La boutique est fermée ce jour-là.', dateEl); ok = false; }
        else setErr('dateErr', '', dateEl);
        if (!slotEl.value) { setErr('slotErr', 'Choisissez un créneau.', slotEl); ok = false; } else setErr('slotErr', '', slotEl);
        if (checked('mode') === 'Livraison') {
          const a = $('#addr');
          if (val('addr').length < 6) { setErr('addrErr', 'Indiquez l’adresse de livraison.', a); ok = false; } else setErr('addrErr', '', a);
        }
      }
      if (step === 3) {
        const n = $('#name'); const t = $('#tel'); const m = $('#mail');
        if (val('name').length < 2) { setErr('nameErr', 'Indiquez votre nom.', n); ok = false; } else setErr('nameErr', '', n);
        const digits = val('tel').replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 13) { setErr('telErr', 'Indiquez un numéro valide (10 chiffres).', t); ok = false; } else setErr('telErr', '', t);
        if (val('mail') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('mail'))) { setErr('mailErr', 'Cette adresse e-mail semble incorrecte.', m); ok = false; } else setErr('mailErr', '', m);
      }
      if (!ok) { const bad = form.querySelector('.fs.is-on [aria-invalid="true"]'); if (bad) bad.focus(); }
      return ok;
    }

    /* -- données, message, calendrier -- */
    function collect() {
      return {
        type: checked('type'), budget: val('budget'), occasion: val('occasion'), details: val('details'),
        mode: checked('mode'), date: dateEl.value, slot: slotEl.value, addr: val('addr'), dest: val('dest'), destTel: val('destTel'),
        name: val('name'), tel: val('tel'), mail: val('mail'),
      };
    }
    function messageOf(d) {
      const L = [];
      L.push(`Bonjour ${SHOP.name},`, '', 'Je souhaite réserver :');
      L.push(`• Création : ${d.type}`);
      L.push(`• Budget : ${d.budget}`);
      if (d.occasion) L.push(`• Occasion : ${d.occasion}`);
      if (d.details) L.push(`• Précisions : ${d.details}`);
      L.push('');
      L.push(`Jour et créneau souhaités : ${dateLabel(d.date)} à ${d.slot}`);
      if (d.mode === 'Livraison') {
        L.push(`Mode : livraison à ${d.addr}`);
        if (d.dest) L.push(`Destinataire : ${d.dest}${d.destTel ? ` (${d.destTel})` : ''}`);
      } else {
        L.push(`Mode : retrait en boutique (${SHOP.address})`);
      }
      L.push('', `Nom : ${d.name}`, `Téléphone : ${d.tel}`);
      if (d.mail) L.push(`E-mail : ${d.mail}`);
      L.push('', 'Merci de me confirmer la disponibilité.');
      return L.join('\n');
    }
    const subjectOf = (d) => `Réservation – ${d.type} – ${dateLabel(d.date, true)} ${d.slot}`;

    function buildRecap() {
      const d = collect();
      const rows = [
        ['Création', d.type], ['Budget', d.budget], d.occasion && ['Occasion', d.occasion], d.details && ['Précisions', d.details],
        ['Jour', `${dateLabel(d.date)} · ${d.slot}`],
        ['Mode', d.mode === 'Livraison' ? `Livraison — ${d.addr}` : `Retrait en boutique — ${SHOP.address}`],
        d.mode === 'Livraison' && d.dest && ['Destinataire', `${d.dest}${d.destTel ? ` · ${d.destTel}` : ''}`],
        ['Vous', `${d.name} · ${d.tel}${d.mail ? ` · ${d.mail}` : ''}`],
      ].filter(Boolean);
      const dl = $('#recap');
      dl.innerHTML = '';
      rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        row.append(dt, dd); dl.appendChild(row);
      });
      const msg = messageOf(d);
      const subj = subjectOf(d);
      $('#sendMail').href = `mailto:${SHOP.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`;
      const sms = $('#sendSms');
      if (SHOP.smsNumber) {
        sms.hidden = false;
        sms.href = `sms:${SHOP.smsNumber}?&body=${encodeURIComponent(msg)}`;
      } else { sms.hidden = true; }
      $('#sendNote').textContent = `Pas de messagerie sur cet appareil ? Copiez le message et envoyez-le à ${SHOP.email}, ou appelez le ${SHOP.phone}.`;
    }

    function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function downloadIcs() {
      const d = collect();
      const [hh, mm] = d.slot.replace('h', ':').replace(/\s/g, '').split(':').map(Number);
      const start = d.date.replace(/-/g, '') + `T${pad2(hh)}${pad2(mm || 0)}00`;
      const endMin = (hh * 60 + (mm || 0)) + 30;
      const end = d.date.replace(/-/g, '') + `T${pad2(Math.floor(endMin / 60))}${pad2(endMin % 60)}00`;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const title = d.mode === 'Livraison' ? `Livraison de fleurs — ${SHOP.name}` : `Retrait de mon bouquet — ${SHOP.name}`;
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lila’s Flowers//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT', `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@lilas-flowers`, `DTSTAMP:${stamp}`,
        `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsEscape(title)}`,
        `LOCATION:${icsEscape(`${SHOP.name}, ${SHOP.address}`)}`,
        `DESCRIPTION:${icsEscape(`${d.type} — budget : ${d.budget}.\nDemande à confirmer auprès de la boutique : ${SHOP.phone}`)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lilas-flowers-reservation.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      $('#sendNote').textContent = 'Rendez-vous ajouté à votre calendrier. N’oubliez pas d’envoyer la demande à la boutique.';
    }
    async function copyMessage() {
      const text = messageOf(collect());
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) { /* rien */ } ta.remove();
      }
      $('#sendNote').textContent = `Message copié. Collez-le dans un e-mail à ${SHOP.email}.`;
    }

    /* -- navigation entre étapes -- */
    function show(n, noScroll) {
      const prev = cur;
      cur = n;
      fsets.forEach((fs) => fs.classList.toggle('is-on', +fs.dataset.fs === n));
      stepLis.forEach((li) => { const s = +li.dataset.s; li.classList.toggle('is-on', s === n); li.classList.toggle('is-done', s < n); });
      const ratio = n / 4;
      if (hasGSAP && !reduce) {
        gsap.to(bar, { scaleX: ratio, duration: .9, ease: 'expo.out' });
        const fs = $(`.fs[data-fs="${n}"]`, form);
        gsap.fromTo(fs.children, { y: n > prev ? 28 : -18, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .05, ease: 'expo.out', clearProps: 'transform' });
      } else { bar.style.transform = `scaleX(${ratio})`; }
      if (n === 4) buildRecap();
      const first = $(`.fs[data-fs="${n}"] input:not([type=radio]), .fs[data-fs="${n}"] select, .fs[data-fs="${n}"] .btn`, form);
      if (first && n !== 1) setTimeout(() => first.focus({ preventScroll: true }), 60);
      const top = form.getBoundingClientRect().top;
      if (!noScroll && (top < 0 || top > window.innerHeight * .4)) {
        const y = window.scrollY + top - 110;
        if (lenis) lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    $$('[data-next]', form).forEach((b) => b.addEventListener('click', () => { if (validate(cur)) show(Math.min(4, cur + 1)); }));
    $$('[data-prev]', form).forEach((b) => b.addEventListener('click', () => show(Math.max(1, cur - 1))));
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio') { e.preventDefault(); const nx = $(`.fs[data-fs="${cur}"] [data-next]`, form); if (nx) nx.click(); } });
    $('#copyMsg').addEventListener('click', copyMessage);
    $('#dlIcs').addEventListener('click', downloadIcs);
    $('#sendMail').addEventListener('click', () => {
      $('#sendNote').textContent = `Votre messagerie s’ouvre avec le message prêt : il ne part que lorsque vous cliquez sur « Envoyer ». Rien ne s’ouvre ? Copiez le message ou écrivez à ${SHOP.email}.`;
    });

    /* -- pré-sélection depuis les « occasions » -- */
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-pick]');
      if (!a) return;
      const r = form.querySelector(`input[name="type"][value="${a.dataset.pick}"]`);
      if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      if (a.dataset.occasion) $('#occasion').value = a.dataset.occasion;
      show(1, true);
    });

    initDate();
    bar.style.transform = 'scaleX(.25)';
  }

  /* ------------------------------------------------------------------ */
  /*  Occasions : panneaux extensibles                                   */
  /* ------------------------------------------------------------------ */
  function setupPanels() {
    const panels = $$('#occPanels .panel');
    const open = (p) => {
      panels.forEach((x) => {
        const on = x === p;
        x.classList.toggle('is-open', on);
        const b = $('.panel__t button', x); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    };
    panels.forEach((p) => {
      p.removeAttribute('tabindex');
      const h = $('.panel__t', p); const span = $('span', h);
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = span.textContent; b.setAttribute('aria-expanded', p.classList.contains('is-open') ? 'true' : 'false');
      h.replaceChild(b, span);
      p.addEventListener('click', (e) => { if (!e.target.closest('a')) open(p); });
      b.addEventListener('focus', () => open(p));
      if (fine) p.addEventListener('mouseenter', () => { if (window.innerWidth >= 860) open(p); });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Galerie : lightbox                                                 */
  /* ------------------------------------------------------------------ */
  function setupLightbox() {
    const dlg = $('#lb'); if (!dlg || typeof dlg.showModal !== 'function') return;
    const btns = $$('#galGrid .g__btn');
    const img = $('#lbImg'); const cap = $('#lbCap');
    let idx = 0;
    const render = () => {
      const b = btns[idx]; const im = $('img', b);
      img.src = im.currentSrc || im.src; img.alt = im.alt; cap.textContent = b.dataset.cap || '';
    };
    const openAt = (i) => { idx = (i + btns.length) % btns.length; render(); if (!dlg.open) { dlg.showModal(); if (lenis) lenis.stop(); } };
    const close = () => { dlg.close(); };
    dlg.addEventListener('close', () => { if (lenis && !menuOpen) lenis.start(); });
    btns.forEach((b, i) => b.addEventListener('click', () => openAt(i)));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => openAt(idx - 1));
    $('#lbNext').addEventListener('click', () => openAt(idx + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') openAt(idx - 1); if (e.key === 'ArrowRight') openAt(idx + 1); });
  }

  /* ------------------------------------------------------------------ */
  /*  Avis : carrousel                                                   */
  /* ------------------------------------------------------------------ */
  function setupReviews() {
    const rail = $('#revRail'); if (!rail) return;
    const bar = $('#revBar');
    const cards = $$('.rcard', rail);
    const step = () => { const c = cards[0]; return c.offsetWidth + parseFloat(getComputedStyle(rail).columnGap || getComputedStyle(rail).gap || 16); };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const p = max > 0 ? rail.scrollLeft / max : 1;
      bar.style.transform = `scaleX(${.08 + p * .92})`;
    };
    rail.addEventListener('scroll', update, { passive: true });
    update();
    const go = (dir) => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (dir > 0 && rail.scrollLeft >= max - 8) rail.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
      else if (dir < 0 && rail.scrollLeft <= 8) rail.scrollTo({ left: max, behavior: reduce ? 'auto' : 'smooth' });
      else rail.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    };
    $('#revPrev').addEventListener('click', () => go(-1));
    $('#revNext').addEventListener('click', () => go(1));
    rail.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });

    /* lecture automatique douce, stoppée au survol / focus / mouvement réduit */
    if (reduce) return;
    let timer = null; let inView = false; let hold = false;
    const tick = () => { if (inView && !hold && document.visibilityState === 'visible') go(1); };
    const start = () => { if (!timer) timer = setInterval(tick, 5200); };
    ['mouseenter', 'focusin', 'touchstart', 'pointerdown'].forEach((ev) => rail.addEventListener(ev, () => { hold = true; }, { passive: true }));
    ['mouseleave', 'focusout'].forEach((ev) => rail.addEventListener(ev, () => { hold = false; }));
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: .35 }).observe(rail);
    start();
  }

  /* ------------------------------------------------------------------ */
  /*  Animations GSAP                                                    */
  /* ------------------------------------------------------------------ */
  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);

    /* Lenis : défilement fluide */
    if (!reduce && typeof Lenis !== 'undefined') {
      lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95, touchMultiplier: 1.3 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }

    /* Préparation des textes (avant que le loader ne se retire) */
    const heroChars = $$('.hero__title .split').flatMap((s) => splitChars(s));
    gsap.set(heroChars, { yPercent: 120, rotate: 7 });
    gsap.set('[data-hero-media]', { scale: 1.2 });
    gsap.set('[data-hero-in]', { opacity: 0 });
    gsap.set('[data-hero-leaf]', { opacity: 0 });
    gsap.set('[data-hero-badge]', { opacity: 0 });
    const titleWords = $$('.h2').map((h) => ({ h, w: splitWords(h) }));
    const footChars = splitChars($('.foot__giant .split'));
    gsap.set(footChars, { yPercent: 110 });

    return { heroChars, titleWords, footChars };
  }

  function loaderThenIntro(prep) {
    const loader = $('#loader');
    const finish = () => {
      if (loader) loader.remove();
      if (lenis) lenis.start();
      window.__lilaReady = true;
      window.__lilaReadyAt = Math.round(performance.now());
      html.classList.remove('no-anim');
      $('#fab').classList.add('is-on');
      ScrollTrigger.refresh();
    };

    /* sans animation : on affiche directement */
    if (reduce) {
      const targets = [...prep.heroChars, ...prep.footChars, ...$$('[data-hero-media], [data-hero-in], [data-hero-leaf], [data-hero-badge]')];
      gsap.set(targets, { clearProps: 'all' });
      finish();
      return;
    }

    const count = $('#loaderCount'); const bar = $('.loader__bar i'); const mark = $('.loader__mark'); const curtain = $('.loader__curtain');
    const st = { v: 0 };
    gsap.set(curtain, { y: window.innerHeight + 60 });
    gsap.set(mark, { scale: .2, rotate: -40, opacity: 0 });
    gsap.set(['.loader__name', '.loader__sub', '.loader__count'], { y: 24, opacity: 0 });

    const heroReady = new Promise((res) => {
      const v = $('#heroVideo');
      if (!v || !v.src) return res();
      if (v.readyState >= 3) return res();
      v.addEventListener('canplay', res, { once: true });
      setTimeout(res, 2200);
    });

    const intro = () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to('[data-hero-media]', { scale: 1, duration: 2.8 }, 0)
        .to(prep.heroChars, { yPercent: 0, rotate: 0, duration: 1.6, stagger: .05 }, .05)
        .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.2, stagger: .12 }, .45)
        .fromTo('[data-hero-leaf]', { scale: .55, rotate: -10, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.8 }, .35)
        .fromTo('[data-hero-badge]', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'back.out(1.9)' }, .9);
      gsap.set('[data-hero-in]', { y: 30 });
    };

    gsap.timeline()
      .to(mark, { scale: 1, rotate: 0, opacity: 1, duration: 1, ease: 'back.out(1.7)' }, 0)
      .to(['.loader__name', '.loader__sub', '.loader__count'], { y: 0, opacity: 1, duration: .9, stagger: .1, ease: 'expo.out' }, .15)
      .to(st, {
        v: 100, duration: 1.25, ease: 'power2.inOut',
        onUpdate: () => { count.textContent = Math.round(st.v); bar.style.transform = `scaleX(${st.v / 100})`; },
      }, .1)
      .add(() => heroReady.then(() => tlRest()), '>');

    function tlRest() {
      gsap.timeline()
        .to(curtain, { y: 0, duration: .8, ease: 'expo.inOut' })
        .set(loader, { backgroundColor: 'transparent' })
        .set('.loader__inner', { autoAlpha: 0 })
        .add(intro, '>-0.05')
        .to(curtain, { y: () => -(window.innerHeight + 90), duration: .95, ease: 'expo.inOut' }, '>')
        .add(finish);
    }
  }

  function buildScroll(prep) {
    const mm = gsap.matchMedia();
    mm.add({
      full: '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
      lite: '(max-width: 899px), (prefers-reduced-motion: reduce)',
    }, (ctx) => {
      const { full } = ctx.conditions;

      /* mouvement réduit : pas de scénographie, seulement les compteurs et la navigation */
      storyFigs();
      if (reduce) { stats(); return; }

      /* ---------- HERO : parallax multicouche + pétales ---------- */
      gsap.to('[data-hero-media]', { yPercent: full ? 14 : 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__title', { yPercent: full ? -26 : -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('[data-hero-leaf]', { yPercent: full ? -55 : -20, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__badge', { yPercent: full ? 70 : 30, rotate: 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__content', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__leaf-img', { y: -14, rotate: 2.5, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      petals(full ? 16 : 8);

      /* ---------- MARQUEE : vitesse liée au scroll ---------- */
      marquee();

      /* ---------- LA MAISON : section épinglée ---------- */
      const c1 = story(full);

      /* ---------- CHIFFRES ---------- */
      stats();

      /* ---------- CRÉATIONS : défilement horizontal ---------- */
      const c2 = hscroll(full);

      /* ---------- OCCASIONS ---------- */
      gsap.from('.panel', { y: 90, opacity: 0, duration: 1.3, stagger: .09, ease: 'expo.out', scrollTrigger: { trigger: '#occPanels', start: 'top 82%' } });

      /* ---------- GALERIE ---------- */
      gallery(full);

      /* ---------- AVIS ---------- */
      gsap.from('.rcard', { y: 70, opacity: 0, rotate: 2.5, duration: 1.2, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '#revRail', start: 'top 88%' } });

      /* ---------- RÉSERVER ---------- */
      gsap.from('.book__perks li', { x: -30, opacity: 0, duration: 1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.book__perks', start: 'top 88%' } });
      gsap.from('.form', { y: 80, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.form', start: 'top 90%' } });

      /* ---------- INFOS ---------- */
      gsap.fromTo('.info__map', { clipPath: 'circle(0% at 82% 22%)' }, { clipPath: 'circle(150% at 82% 22%)', duration: 2, ease: 'expo.out', scrollTrigger: { trigger: '.info__map', start: 'top 82%' } });
      gsap.from('.hours tr', { x: -40, opacity: 0, duration: .9, stagger: .06, ease: 'expo.out', scrollTrigger: { trigger: '#hours', start: 'top 88%' } });
      gsap.from('.faq details', { y: 30, opacity: 0, duration: .9, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: '.faq__list', start: 'top 90%' } });

      /* ---------- FOOTER ---------- */
      gsap.to(prep.footChars, { yPercent: 0, duration: 1.5, stagger: .035, ease: 'expo.out', scrollTrigger: { trigger: '.foot__giant', start: 'top 95%' } });

      /* ---------- titres + petits textes ---------- */
      prep.titleWords.forEach(({ h, w }) => {
        gsap.from(w, { yPercent: 115, duration: 1.3, stagger: .055, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
      });
      gsap.utils.toArray('.kicker:not(.hero__content .kicker), .stats__note, .gal__fine, .rev__fine, .info__addr, .info__links, .info__contact, .book__lede, .hs__hint').forEach((el) => {
        gsap.from(el, { y: 26, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
      });

      return () => { [c1, c2].forEach((f) => { if (typeof f === 'function') f(); }); };
    });

    /* progression de lecture, navigation */
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });
    const nav = $('#nav');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 40);
        if (menuOpen) return;
        if (y > 260 && self.direction === 1) nav.classList.add('is-hidden');
        else if (self.direction === -1 || y <= 260) nav.classList.remove('is-hidden');
      },
    });
    ScrollTrigger.create({ trigger: '#reserver', start: 'top 85%', end: 'bottom 15%', toggleClass: { targets: '#fab', className: 'is-off' } });
    gsap.set('#fab', { clearProps: 'all' });
  }

  /* ----- pétales qui tombent ----- */
  function petals(n) {
    const wrap = $('#petals'); if (!wrap) return;
    wrap.innerHTML = '';
    const colors = ['#E8318A', '#FF5CA8', '#F7C6D2', '#F4A582', '#F8EEE6', '#F3C53B'];
    const all = [];
    for (let i = 0; i < n; i++) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 42'); s.setAttribute('class', 'petal'); s.setAttribute('aria-hidden', 'true');
      const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#petal'); s.appendChild(u);
      s.style.setProperty('--s', `${gsap.utils.random(11, 26, 1)}px`);
      s.style.setProperty('--c', colors[i % colors.length]);
      wrap.appendChild(s);
      const W = () => wrap.clientWidth; const H = () => wrap.clientHeight;
      const dur = gsap.utils.random(10, 20);
      const tl = gsap.timeline({ repeat: -1, repeatRefresh: true, delay: gsap.utils.random(0, 9) });
      tl.fromTo(s, { x: () => gsap.utils.random(0, W()), y: -70, rotation: () => gsap.utils.random(0, 360), opacity: 0 },
        { y: () => H() + 80, duration: dur, ease: 'none' }, 0)
        .to(s, { x: '+=' + gsap.utils.random(-180, 180), duration: dur, ease: 'sine.inOut' }, 0)
        .to(s, { rotation: '+=' + gsap.utils.random(240, 560), duration: dur, ease: 'none' }, 0)
        .to(s, { opacity: gsap.utils.random(.55, .95), duration: 1.4 }, 0)
        .to(s, { opacity: 0, duration: 1.6 }, dur - 1.6);
      all.push(tl);
    }
    ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (self) => all.forEach((t) => t.paused(!self.isActive)) });
  }

  /* ----- marquee ----- */
  function marquee() {
    const rows = $$('.marquee__row');
    const items = rows.map((row) => {
      const track = $('.marquee__track', row);
      if (!track.dataset.cloned) { track.innerHTML += track.innerHTML; track.dataset.cloned = '1'; }
      const dir = +row.dataset.dir;
      const tw = gsap.fromTo(track, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, ease: 'none', duration: 38, repeat: -1 });
      return tw;
    });
    if (reduce) { items.forEach((t) => t.pause()); return; }
    let boost = 0; let flip = 1; let ts = 1;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => { flip = self.direction; boost = Math.min(Math.abs(self.getVelocity()) / 260, 7); },
    });
    if (marquee.tick) gsap.ticker.remove(marquee.tick);
    marquee.tick = () => {
      boost += (0 - boost) * .06;
      const target = flip * (1 + boost);
      ts += (target - ts) * .08;
      items.forEach((t) => t.timeScale(ts));
    };
    gsap.ticker.add(marquee.tick);
    ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: (s) => items.forEach((t) => t.paused(!s.isActive)) });
  }

  /* ----- la maison (storytelling épinglé) ----- */
  /* version mobile : une photo par étape (créée une seule fois) */
  function storyFigs() {
    if ($('.step__fig')) return;
    const steps = $$('.step');
    const imgs = $$('.story__img');
    steps.forEach((s, i) => {
      const fig = document.createElement('div');
      fig.className = 'step__fig';
      const im = document.createElement('img');
      im.src = imgs[i].getAttribute('src'); im.alt = imgs[i].alt; im.loading = 'lazy';
      im.width = imgs[i].width || 900; im.height = imgs[i].height || 1200;
      fig.appendChild(im);
      s.insertBefore(fig, s.firstChild);
    });
  }
  function story(full) {
    const steps = $$('.step');
    const imgs = $$('.story__img');
    if (!full) {
      steps.forEach((s) => {
        gsap.from(s.children, { y: 40, opacity: 0, duration: 1.1, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 85%' } });
      });
      return;
    }
    html.classList.add('story-pinned');
    const dots = $$('.story__dots li');
    const stem = $('.story__stem i');
    const leaf = $('.story__leaf');
    const N = steps.length;
    gsap.set(imgs, { opacity: 0, scale: 1.25 });
    gsap.set(imgs[0], { opacity: 1, scale: 1 });
    gsap.set(steps, { autoAlpha: 0 });
    gsap.set(steps[0], { autoAlpha: 1 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.story__pin', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * N * .95),
        pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => {
          const a = Math.min(N - 1, Math.round(self.progress * (N - 1)));
          dots.forEach((d, i) => d.classList.toggle('is-on', i === a));
        },
      },
    });
    tl.to('.story__bg', { xPercent: -8, duration: N }, 0);
    for (let k = 1; k < N; k++) {
      const t = k - .3;
      tl.to(steps[k - 1].children, { y: -46, opacity: 0, duration: .38, stagger: .03, ease: 'power2.in' }, t)
        .to(steps[k - 1], { autoAlpha: 0, duration: .01 }, t + .42)
        .to(steps[k], { autoAlpha: 1, duration: .01 }, t + .38)
        .fromTo(steps[k].children, { y: 56, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .06, ease: 'power3.out' }, t + .38)
        .to(imgs[k - 1], { opacity: 0, scale: 1.14, duration: .55, ease: 'power2.in' }, t + .05)
        .fromTo(imgs[k], { opacity: 0, scale: 1.28 }, { opacity: 1, scale: 1, duration: .8, ease: 'power2.out' }, t + .15)
        .to(leaf, { rotate: k % 2 ? -4 : 3, duration: .8, ease: 'power2.inOut' }, t)
        .to(stem, { scaleY: k / (N - 1), duration: .8, ease: 'power1.inOut' }, t);
    }
    tl.to({}, { duration: .01 }, N);
    return () => html.classList.remove('story-pinned');
  }

  /* ----- chiffres ----- */
  function stats() {
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count); const dec = +el.dataset.dec || 0; const sep = !!el.dataset.sep;
      const fmt = (v) => { let s = v.toFixed(dec).replace('.', ','); if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F'); return s; };
      if (reduce) { el.textContent = fmt(end); return; }
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }),
      });
    });
    gsap.to('.stat__bar', { scaleX: 1, duration: 1.8, stagger: .15, ease: 'expo.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 85%' } });
    gsap.from('.stat', { y: 60, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 88%' } });
  }

  /* ----- créations : défilement horizontal ----- */
  function hscroll(full) {
    $$('.hs img').forEach((i) => { i.loading = 'eager'; });
    if (!full) {
      gsap.from('.hs .card', { x: 60, opacity: 0, duration: 1.1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '#hsTrack', start: 'top 88%' } });
      return;
    }
    html.classList.add('hs-pinned');
    const track = $('#hsTrack');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.hs__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, anticipatePin: 1, invalidateOnRefresh: true },
    });
    $$('.card__img img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
    });
    return () => html.classList.remove('hs-pinned');
  }

  /* ----- galerie ----- */
  function gallery(full) {
    const btns = $$('#galGrid .g__btn');
    gsap.set(btns, { clipPath: 'inset(0 0 100% 0)' });
    ScrollTrigger.batch(btns, {
      start: 'top 92%', once: true,
      onEnter: (els) => {
        gsap.to(els, { clipPath: 'inset(0 0 0% 0)', duration: 1.4, stagger: .12, ease: 'expo.out', clearProps: 'clipPath' });
        gsap.fromTo(els.map((e) => $('img', e)), { scale: 1.45 }, { scale: 1.14, duration: 2, stagger: .12, ease: 'expo.out' });
      },
    });
    if (!full) return;
    btns.forEach((b) => {
      const im = $('img', b);
      gsap.fromTo(im, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: b, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Micro-interactions : curseur, boutons magnétiques, tilt             */
  /* ------------------------------------------------------------------ */
  function setupPointer() {
    if (!fine || reduce) return;
    /* curseur */
    const cur = $('#cursor'); const dot = $('.cursor__dot'); const ring = $('.cursor__ring'); const lab = $('.cursor__ring b');
    const dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3' }); const dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' }); const ry = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    const labelFor = (t) => {
      if (t.closest('.g__btn')) return 'Voir';
      if (t.closest('.rev__rail')) return 'Glisser';
      if (t.closest('.panel:not(.is-open)')) return 'Ouvrir';
      return '';
    };
    document.addEventListener('pointerover', (e) => {
      const t = e.target; if (!(t instanceof Element)) return;
      const l = labelFor(t);
      cur.classList.toggle('is-label', !!l);
      if (l) lab.textContent = l;
      cur.classList.toggle('is-link', !l && !!t.closest('a, button, summary, .chip, label, input, select, textarea'));
    });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-link', 'is-label'));

    /* boutons magnétiques + remplissage depuis le point d’entrée */
    $$('.magnetic').forEach((b) => {
      const lbl = $('.btn__label', b);
      const bx = gsap.quickTo(b, 'x', { duration: .6, ease: 'power3' }); const by = gsap.quickTo(b, 'y', { duration: .6, ease: 'power3' });
      const lx = gsap.quickTo(lbl, 'x', { duration: .6, ease: 'power3' }); const ly = gsap.quickTo(lbl, 'y', { duration: .6, ease: 'power3' });
      b.addEventListener('pointerenter', (e) => { const r = b.getBoundingClientRect(); b.style.setProperty('--fx', `${e.clientX - r.left}px`); b.style.setProperty('--fy', `${e.clientY - r.top}px`); });
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2); const y = e.clientY - (r.top + r.height / 2);
        bx(x * .28); by(y * .4); lx(x * .12); ly(y * .2);
      });
      b.addEventListener('pointerleave', (e) => {
        const r = b.getBoundingClientRect(); b.style.setProperty('--fx', `${e.clientX - r.left}px`); b.style.setProperty('--fy', `${e.clientY - r.top}px`);
        bx(0); by(0); lx(0); ly(0);
      });
    });

    /* cartes : inclinaison 3D + reflet */
    $$('[data-tilt]').forEach((c) => {
      const rxq = gsap.quickTo(c, 'rotationX', { duration: .6, ease: 'power3' }); const ryq = gsap.quickTo(c, 'rotationY', { duration: .6, ease: 'power3' });
      gsap.set(c, { transformPerspective: 900 });
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
        ryq((px - .5) * 12); rxq(-(py - .5) * 12);
        c.style.setProperty('--mx', `${px * 100}%`); c.style.setProperty('--my', `${py * 100}%`);
      });
      c.addEventListener('pointerleave', () => { rxq(0); ryq(0); });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Démarrage                                                          */
  /* ------------------------------------------------------------------ */
  function boot() {
    /* on repart toujours du haut : l’ouverture (loader + hero) doit se jouer à chaque visite */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) window.scrollTo(0, 0);
    updateStatus(); setInterval(updateStatus, 60000);
    setupVideos();
    setupAnchors();
    setupBooking();
    setupPanels();
    setupLightbox();
    setupReviews();

    if (!hasGSAP) {
      /* repli sans GSAP : tout est visible, compteurs à leur valeur finale */
      html.classList.add('no-anim');
      $$('[data-count]').forEach((el) => { const v = parseFloat(el.dataset.count); el.textContent = v.toFixed(+el.dataset.dec || 0).replace('.', ','); });
      window.__lilaReady = true;
      return;
    }
    const prep = initMotion();
    buildScroll(prep);
    setupPointer();
    loaderThenIntro(prep);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
