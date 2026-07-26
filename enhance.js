/*
 * Horizon UltraCapture — Free edition UX layer
 * ---------------------------------------------------------------
 * Purely additive. This file never touches the capture pipeline:
 * it only drives the existing controls in index.html through normal
 * DOM events, so app.js keeps full ownership of recording logic.
 *
 * NOTE: index.html patches document.getElementById / querySelector to
 * return a dummy <div> for missing nodes. We therefore resolve nodes
 * through querySelectorAll, which is not patched, so "missing" really
 * means null here.
 */
(function () {
	'use strict';

	var $ = function (sel, root) { return (root || document).querySelectorAll(sel)[0] || null; };
	var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
	var store = {
		get: function (k, d) { try { var v = localStorage.getItem('hz_' + k); return v === null ? d : v; } catch (e) { return d; } },
		set: function (k, v) { try { localStorage.setItem('hz_' + k, v); } catch (e) { } }
	};

	/* ---------------------------------------------------------- toasts */
	var ICONS = { info: 'bx-info-circle', ok: 'bx-check-circle', warn: 'bx-error', err: 'bx-x-circle' };

	function toast(msg, kind, ms) {
		var stack = $('#toast-stack');
		if (!stack) return;
		kind = kind || 'info';
		var el = document.createElement('div');
		el.className = 'toast ' + kind;
		el.innerHTML = "<i class='bx " + (ICONS[kind] || ICONS.info) + "'></i><span></span>";
		$('span', el).textContent = msg;
		stack.appendChild(el);
		setTimeout(function () {
			el.classList.add('leaving');
			setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
		}, ms || 2600);
	}
	window.hzToast = toast;

	function openSite() {
		var url = 'https://horizonuc.unaux.com';
		try { require('electron').shell.openExternal(url); }
		catch (e) { window.open(url, '_blank'); }
	}

	/* ------------------------------------------------------- view meta */
	var VIEW_META = {
		'view-capture': { title: 'Capture', sub: 'Configure your source, tune the engine and roll in one click.' },
		'view-library': { title: 'Library', sub: 'Every clip you record lands here, newest first.' },
		'view-settings': { title: 'Settings', sub: 'Quality, encoding and appearance.' }
	};
	var NAV_KEYS = { '1': 'view-capture', '2': 'view-library', '3': 'view-settings' };

	function syncHeader() {
		var active = $('.nav-links li.active');
		var meta = active && VIEW_META[active.getAttribute('data-target')];
		var sub = $('#header-sub');
		if (meta && sub) sub.textContent = meta.sub;
	}

	function gotoView(id) {
		var li = $('.nav-links li[data-target="' + id + '"]');
		if (li) li.click();
		setTimeout(syncHeader, 30);
	}

	$$('.nav-links li').forEach(function (li) {
		li.addEventListener('click', function () { setTimeout(syncHeader, 20); });
	});
	syncHeader();

	/* --------------------------------------------------- sidebar rail */
	var shell = $('#app-shell');
	var railBtn = $('#rail-toggle');
	if (store.get('rail', '0') === '1' && shell) shell.classList.add('rail');
	if (railBtn && shell) {
		railBtn.addEventListener('click', function () {
			shell.classList.toggle('rail');
			store.set('rail', shell.classList.contains('rail') ? '1' : '0');
		});
	}

	/* ------------------------------------------------------- accents */
	var ACCENTS = {
		violet: ['#7c3aed', '#3b82f6', '#06b6d4'],
		azure: ['#3b82f6', '#2563eb', '#06b6d4'],
		cyan: ['#06b6d4', '#0ea5e9', '#22d3ee'],
		ember: ['#f97316', '#fb7185', '#f59e0b'],
		mint: ['#10b981', '#14b8a6', '#34d399']
	};
	var ORDER = Object.keys(ACCENTS);

	function applyAccent(name) {
		var c = ACCENTS[name];
		if (!c) return;
		var r = document.documentElement.style;
		r.setProperty('--accent-1', c[0]);
		r.setProperty('--accent-2', c[1]);
		r.setProperty('--accent-3', c[2]);
		r.setProperty('--primary-blue', c[1]);
		r.setProperty('--primary-purple', c[0]);
		r.setProperty('--accent-gradient', 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ',' + c[2] + ')');
		$$('.swatch').forEach(function (s) {
			s.classList.toggle('active', s.getAttribute('data-accent') === name);
		});
		store.set('accent', name);
	}
	applyAccent(store.get('accent', 'violet'));

	$$('.swatch').forEach(function (s) {
		s.addEventListener('click', function () {
			var name = s.getAttribute('data-accent');
			applyAccent(name);
			toast('Accent set to ' + name, 'ok', 1600);
		});
	});

	var themeBtn = $('#theme-btn');
	if (themeBtn) {
		themeBtn.addEventListener('click', function () {
			var cur = store.get('accent', 'violet');
			applyAccent(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]);
		});
	}

	/* -------------------------------------------------------- motion */
	var motion = $('#set-motion');
	function applyMotion(on) {
		document.body.classList.toggle('no-motion', !on);
		store.set('motion', on ? '1' : '0');
	}
	var motionOn = store.get('motion', '1') === '1';
	if (motion) motion.checked = motionOn;
	applyMotion(motionOn);
	if (motion) motion.addEventListener('change', function () { applyMotion(motion.checked); });

	/* ------------------------------------------------ disk forecast */
	/* Free edition tops out at 1080p, so the default assumption is 1080p60. */
	var QUALITY_PIXELS = { '8k': 33.2, '4k': 8.3, '1080p': 2.07 };

	function estimate() {
		var q = ($('#set-quality') || {}).value || '1080p';
		var fps = parseInt((($('#set-fps') || {}).value) || '60', 10);
		var fmt = (($('#set-format') || {}).value) || 'webm';
		var hwEl = $('#set-hw');
		var hw = hwEl ? !!hwEl.checked : true;
		var mp = QUALITY_PIXELS[q] || QUALITY_PIXELS['1080p'];
		var bpp = fmt === 'mkv' ? 0.1 : 0.075;
		var mbps = mp * 1e6 * fps * bpp / 1e6 * (hw ? 0.92 : 1);
		var gbPerHour = mbps * 3600 / 8 / 1024;

		var rate = $('#est-rate'); if (rate) rate.textContent = gbPerHour.toFixed(1) + ' GB';
		var br = $('#est-bitrate'); if (br) br.textContent = Math.round(mbps) + ' Mbps';
		var ten = $('#est-ten'); if (ten) ten.textContent = (gbPerHour / 6).toFixed(1) + ' GB';
		var enc = $('#est-encoder'); if (enc) enc.textContent = hw ? 'GPU (hardware)' : 'CPU (software)';
		var bar = $('#est-bar');
		if (bar) bar.style.width = Math.max(4, Math.min(100, gbPerHour / 70 * 100)) + '%';
	}
	['#set-quality', '#set-fps', '#set-format', '#set-hw'].forEach(function (sel) {
		var el = $(sel);
		if (el) el.addEventListener('change', function () { setTimeout(estimate, 10); });
	});
	estimate();

	/* ------------------------------------------------------- presets */
	/* Only free-tier values here — nothing sets 4K/8K, which stay locked. */
	var PRESETS = {
		tutorial: { quality: '1080p', fps: '30', format: 'webm', buffer: '0', mic: true, sys: true, label: 'Tutorial 1080p' },
		meeting: { quality: '1080p', fps: '30', format: 'webm', buffer: '30', mic: true, sys: true, label: 'Meeting Lite' },
		podcast: { quality: '1080p', fps: '30', format: 'webm', buffer: '60', mic: true, sys: false, label: 'Podcast Audio+' }
	};

	function setSelect(sel, value) {
		var el = $(sel);
		if (!el || el.value === value) return;
		var opt = $('option[value="' + value + '"]', el);
		if (!opt || opt.disabled) return;
		el.value = value;
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function setToggle(sel, on) {
		var el = $(sel);
		if (!el || el.disabled) return;
		if (el.classList.contains('active') !== !!on) el.click();
	}

	$$('.preset').forEach(function (btn) {
		btn.addEventListener('click', function () {
			if (btn.getAttribute('data-pro')) {
				toast('4K and 8K presets need Horizon Pro', 'warn', 3200);
				return;
			}
			var p = PRESETS[btn.getAttribute('data-preset')];
			if (!p) return;
			setSelect('#set-quality', p.quality);
			setSelect('#set-fps', p.fps);
			setSelect('#set-format', p.format);
			setSelect('#set-buffer', p.buffer);
			setToggle('#mic-toggle', p.mic);
			setToggle('#sys-audio-toggle', p.sys);
			$$('.preset').forEach(function (b) { b.classList.remove('active'); });
			btn.classList.add('active');
			store.set('preset', btn.getAttribute('data-preset'));
			setTimeout(estimate, 40);
			toast(p.label + ' preset applied', 'ok');
		});
	});
	var savedPreset = store.get('preset', '');
	if (savedPreset && PRESETS[savedPreset]) {
		var sp = $('.preset[data-preset="' + savedPreset + '"]');
		if (sp) sp.classList.add('active');
	}

	/* --------------------------------------------------- PiP preview */
	var camPos = $('#set-cam-position');
	var pip = $('#pip-preview');
	if (camPos && pip) {
		camPos.addEventListener('change', function () { pip.setAttribute('data-pos', camPos.value); });
	}

	/* ------------------------------------------------ upgrade prompts */
	$$('.license-cta').forEach(function (el) {
		el.addEventListener('click', function (e) { e.preventDefault(); openSite(); });
	});
	var lockedQuality = $('#set-quality');
	if (lockedQuality) {
		lockedQuality.addEventListener('mousedown', function () {
			if (!store.get('proHintShown', '')) {
				store.set('proHintShown', '1');
				toast('4K / 8K are unlocked in Horizon Pro', 'info', 3400);
			}
		});
	}

	/* ------------------------------------------------ library search */
	var libSearch = $('#library-search');
	var libList = $('#library-list');

	function filterLibrary() {
		if (!libList) return;
		var q = (libSearch ? libSearch.value : '').trim().toLowerCase();
		var items = $$('#library-list > *').filter(function (n) { return !n.classList.contains('empty-state'); });
		var shown = 0;
		items.forEach(function (item) {
			var hit = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
			item.style.display = hit ? '' : 'none';
			if (hit) shown++;
		});
		var empty = $('#library-list .empty-state');
		if (empty && items.length) empty.style.display = shown ? 'none' : '';
	}
	if (libSearch) libSearch.addEventListener('input', filterLibrary);
	if (libList) new MutationObserver(filterLibrary).observe(libList, { childList: true });

	var layoutBtn = $('#library-layout');
	if (layoutBtn && libList) {
		if (store.get('libList', '0') === '1') libList.classList.add('list-view');
		layoutBtn.addEventListener('click', function () {
			libList.classList.toggle('list-view');
			store.set('libList', libList.classList.contains('list-view') ? '1' : '0');
		});
	}

	/* ----------------------------------------------- settings search */
	var setSearch = $('#settings-search');
	if (setSearch) {
		setSearch.addEventListener('input', function () {
			var q = setSearch.value.trim().toLowerCase();
			$$('.settings-grid .card').forEach(function (card) {
				var hay = (card.getAttribute('data-keywords') || '') + ' ' + card.textContent.toLowerCase();
				card.style.display = (!q || hay.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
			});
		});
	}

	/* ---------------------------------------- session clock + meters */
	var recBtn = $('#main-record-btn');
	var clock = $('#session-clock');
	var timeEl = $('#session-time');
	var started = 0, ticker = null;

	function pad(n) { return (n < 10 ? '0' : '') + n; }

	function tick() {
		if (!timeEl) return;
		var s = Math.floor((Date.now() - started) / 1000);
		timeEl.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
	}

	function setRecording(on) {
		if (recBtn) recBtn.classList.toggle('recording', on);
		if (clock) clock.hidden = !on;
		if (on) {
			started = Date.now();
			tick();
			ticker = setInterval(tick, 500);
		} else if (ticker) {
			clearInterval(ticker);
			ticker = null;
		}
	}

	var wasRecording = false;
	if (recBtn) {
		new MutationObserver(function () {
			var isRec = /stop|recording/i.test(recBtn.textContent || '');
			if (isRec !== wasRecording) {
				wasRecording = isRec;
				setRecording(isRec);
				toast(isRec ? 'Recording started' : 'Recording saved to your library', isRec ? 'ok' : 'info');
			}
		}).observe(recBtn, { childList: true, subtree: true, characterData: true });
	}

	/* Simulated input meters — purely visual feedback for the toggles. */
	var meterMic = $('#meter-mic'), meterSys = $('#meter-sys');
	setInterval(function () {
		[[meterMic, '#mic-toggle'], [meterSys, '#sys-audio-toggle']].forEach(function (pair) {
			var meter = pair[0], src = $(pair[1]);
			if (!meter) return;
			var on = src && src.classList.contains('active');
			meter.classList.toggle('off', !on);
			var bar = $('span', meter);
			if (bar) bar.style.width = on ? (18 + Math.random() * (wasRecording ? 78 : 34)).toFixed(0) + '%' : '0%';
		});
	}, 260);

	/* ------------------------------------------------------ countdown */
	var cdWrap = $('#countdown'), cdNum = $('#countdown-num');
	var counting = false;

	if (recBtn && cdWrap && cdNum) {
		recBtn.addEventListener('click', function (e) {
			if (counting || wasRecording || store.get('countdown', '1') !== '1') return;
			e.preventDefault();
			e.stopImmediatePropagation();
			counting = true;
			var n = 3;
			cdNum.textContent = n;
			cdWrap.hidden = false;
			var iv = setInterval(function () {
				n--;
				if (n > 0) {
					cdNum.textContent = n;
					cdNum.style.animation = 'none';
					void cdNum.offsetWidth;
					cdNum.style.animation = '';
					return;
				}
				clearInterval(iv);
				cdWrap.hidden = true;
				counting = false;
				recBtn.click();
			}, 700);
		}, true);
	}

	/* ------------------------------------------------ command palette */
	var overlay = $('#palette-overlay');
	var input = $('#palette-input');
	var list = $('#palette-list');
	var COMMANDS = [
		{ label: 'Start / stop capture', hint: 'Ctrl Shift R', run: function () { if (recBtn) recBtn.click(); } },
		{ label: 'Go to Capture', hint: '1', run: function () { gotoView('view-capture'); } },
		{ label: 'Go to Library', hint: '2', run: function () { gotoView('view-library'); } },
		{ label: 'Go to Settings', hint: '3', run: function () { gotoView('view-settings'); } },
		{ label: 'Preset: Tutorial 1080p', run: function () { var b = $('.preset[data-preset="tutorial"]'); if (b) b.click(); } },
		{ label: 'Preset: Meeting Lite', run: function () { var b = $('.preset[data-preset="meeting"]'); if (b) b.click(); } },
		{ label: 'Preset: Podcast Audio+', run: function () { var b = $('.preset[data-preset="podcast"]'); if (b) b.click(); } },
		{ label: 'Toggle microphone', hint: 'M', run: function () { var b = $('#mic-toggle'); if (b) b.click(); } },
		{ label: 'Toggle system audio', hint: 'S', run: function () { var b = $('#sys-audio-toggle'); if (b) b.click(); } },
		{ label: 'Refresh capture sources', hint: 'R', run: function () { var b = $('#refresh-sources-btn'); if (b) b.click(); } },
		{ label: 'Switch to 30 FPS', run: function () { setSelect('#set-fps', '30'); toast('Frame rate set to 30 FPS', 'ok'); } },
		{ label: 'Switch to 60 FPS', run: function () { setSelect('#set-fps', '60'); toast('Frame rate set to 60 FPS', 'ok'); } },
		{ label: 'Output format: MKV', run: function () { setSelect('#set-format', 'mkv'); } },
		{ label: 'Output format: WebM', run: function () { setSelect('#set-format', 'webm'); } },
		{ label: 'Toggle recording countdown', run: function () { var on = store.get('countdown', '1') === '1'; store.set('countdown', on ? '0' : '1'); toast('Countdown ' + (on ? 'disabled' : 'enabled'), 'info'); } },
		{ label: 'Cycle accent colour', run: function () { if (themeBtn) themeBtn.click(); } },
		{ label: 'Collapse / expand sidebar', hint: 'Ctrl B', run: function () { if (railBtn) railBtn.click(); } },
		{ label: 'Keyboard shortcuts', hint: '?', run: function () { openSheet(); } },
		{ label: 'Upgrade to Horizon Pro', run: openSite },
		{ label: 'Open the Horizon website', run: openSite }
	];
	var filtered = COMMANDS.slice(), sel = 0;

	function render() {
		if (!list) return;
		list.innerHTML = '';
		if (!filtered.length) {
			var li = document.createElement('li');
			li.className = 'hint';
			li.textContent = 'No matching command';
			list.appendChild(li);
			return;
		}
		filtered.forEach(function (cmd, i) {
			var li = document.createElement('li');
			if (i === sel) li.className = 'sel';
			li.innerHTML = '<span></span>' + (cmd.hint ? '<kbd>' + cmd.hint + '</kbd>' : '');
			$('span', li).textContent = cmd.label;
			li.addEventListener('click', function () { closePalette(); cmd.run(); });
			list.appendChild(li);
		});
	}

	function openPalette() {
		if (!overlay) return;
		overlay.hidden = false;
		if (input) { input.value = ''; input.focus(); }
		filtered = COMMANDS.slice();
		sel = 0;
		render();
	}
	function closePalette() { if (overlay) overlay.hidden = true; }

	if (input) {
		input.addEventListener('input', function () {
			var q = input.value.trim().toLowerCase();
			filtered = COMMANDS.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; });
			sel = 0;
			render();
		});
		input.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, filtered.length - 1); render(); e.preventDefault(); }
			else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
			else if (e.key === 'Enter') {
				var cmd = filtered[sel];
				closePalette();
				if (cmd) cmd.run();
			} else if (e.key === 'Escape') closePalette();
		});
	}
	if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closePalette(); });
	var paletteBtn = $('#open-palette');
	if (paletteBtn) paletteBtn.addEventListener('click', openPalette);

	/* ------------------------------------------------- shortcut sheet */
	var sheet = $('#shortcut-overlay');
	function openSheet() { if (sheet) sheet.hidden = false; }
	function closeSheet() { if (sheet) sheet.hidden = true; }
	var sheetBtn = $('#shortcuts-btn');
	if (sheetBtn) sheetBtn.addEventListener('click', openSheet);
	var sheetClose = $('#shortcut-close');
	if (sheetClose) sheetClose.addEventListener('click', closeSheet);
	if (sheet) sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

	/* --------------------------------------------------- global keys */
	document.addEventListener('keydown', function (e) {
		var tag = (e.target && e.target.tagName || '').toLowerCase();
		var typing = tag === 'input' || tag === 'select' || tag === 'textarea';

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); if (railBtn) railBtn.click(); return; }
		if (e.key === 'Escape') { closePalette(); closeSheet(); return; }
		if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === '?') { openSheet(); return; }
		if (NAV_KEYS[e.key]) { gotoView(NAV_KEYS[e.key]); return; }
		var k = e.key.toLowerCase();
		if (k === 'm') { var m = $('#mic-toggle'); if (m) m.click(); }
		else if (k === 's') { var s = $('#sys-audio-toggle'); if (s) s.click(); }
		else if (k === 'r') { var r = $('#refresh-sources-btn'); if (r) r.click(); }
	});

	/* ------------------------------------------------------ first run */
	if (!store.get('welcomed', '')) {
		store.set('welcomed', '1');
		setTimeout(function () { toast('Press Ctrl + K for quick actions', 'info', 4200); }, 1200);
	}
})();
