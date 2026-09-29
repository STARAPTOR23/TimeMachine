window.TimeMachine = window.TimeMachine || {};

(function () {

  const MIN_YEAR = 1940;
  const MAX_YEAR = 2026;

  const modeButtons = document.querySelectorAll('.mode-btn');
  const idleState = document.getElementById('idle-state');
  const timelineView = document.getElementById('timeline-view');

  const directView = document.getElementById('direct-view');
  const directForm = document.getElementById('direct-form');
  const directInput = document.getElementById('direct-year-input');
  const directError = document.getElementById('direct-error');

  const resultsView = document.getElementById('results-view');
  const resultsBackdrop = document.getElementById('results-backdrop');
  const resultsEyebrow = document.getElementById('results-eyebrow');
  const resultsTitle = document.getElementById('results-title');
  const resultsDescription = document.getElementById('results-description');
  const resultsGrid = document.getElementById('results-grid');
  const eventsList = document.getElementById('events-list');
  const cultureList = document.getElementById('culture-list');
  const factsList = document.getElementById('facts-list');
  const movieGridEl = document.getElementById('movie-grid');
  const backBtn = document.getElementById('back-btn');

  const yearNavRow = document.getElementById('year-nav-row');
  const navMinus10 = document.getElementById('nav-minus-10');
  const navMinus1 = document.getElementById('nav-minus-1');
  const navPlus1 = document.getElementById('nav-plus-1');
  const navPlus10 = document.getElementById('nav-plus-10');

  const expandedOverlay = document.getElementById('card-expanded-overlay');
  const expandedInner = document.getElementById('card-expanded-inner');
  const expandedClose = document.getElementById('card-expanded-close');

  const specialErrorScreen = document.getElementById('special-error-screen');
  const specialErrorMessage = document.getElementById('special-error-message');
  const specialErrorBack = document.getElementById('special-error-back');

  const tvTransition = document.getElementById('tv-transition');
  const tvYearEl = document.getElementById('tv-year');

  let lastMode = 'year';

  // Short flavor text for the results hero. Purely descriptive copy,
  // separate from the historical/cultural data in the JSON files.
  const ERA_INFO = {
    'theme-1940s': { label: '1940s — Film Noir', description: 'Venetian-blind shadows, a single spotlight, and a world seen in stark black and white.' },
    'theme-1950s': { label: '1950s — Atomic Age', description: 'Starburst clocks, chrome tailfins, and the optimism of the atomic age.' },
    'theme-1960s': { label: '1960s — Space Age', description: 'Starfields, chrome, and a decade racing toward the cosmos.' },
    'theme-1970s': { label: '1970s — Vintage', description: 'Warm tones, bell-bottoms, and vinyl records — a decade that ran on analog.' },
    'theme-1980s': { label: '1980s — Neon / Synthwave', description: 'Neon grids, synth-pop, and a skyline lit up like an arcade cabinet.' },
    'theme-1990s': { label: '1990s — VHS / Grunge', description: 'Tracking lines, dial-up modems, and the gritty energy of early alt culture.' },
    'theme-2000s': { label: '2000s — Y2K / Frutiger Aero', description: 'Blue skies, glass bubbles, and a glossy vision of technology meeting nature.' },
    'theme-2010s': { label: '2010s — Flat Design / Social Media', description: 'Flat colors, endless feeds, and interfaces built for the smartphone.' },
    'theme-2020s': { label: '2020s — Minimalism', description: 'Quiet interfaces, muted tones, and design that gets out of the way.' }
  };

  // gif: the fixed category banner used at the top of the compact card
  // (results-grid) only — the expanded overlay no longer shows a banner
  // (see openExpandedCard), so this is unaffected by that change.
  const CARD_META = {
    events: { title: 'Historical Events', eyebrow: 'What happened', gif: 'assets/images/card-events.gif' },
    culture: { title: 'Music & Culture', eyebrow: 'The sound & style', gif: 'assets/images/card-culture.gif' },
    funFacts: { title: 'Fun Facts', eyebrow: 'Did you know', gif: 'assets/images/card-facts.gif' },
    movies: { title: 'Movies', eyebrow: 'On screen', gif: 'assets/images/card-movies.gif' }
  };

  // ---------- data loading ----------
  // Four datasets, loaded as plain <script> tags into window.TimeMachineData
  // (see index.html) rather than fetch() — so the site keeps working when
  // index.html is opened directly via file://, with no local server. The
  // matching .json files sit alongside the .js ones in data/ as the source
  // of truth / for editing; only the .js versions are actually loaded.

  const d = window.TimeMachineData || {};
  const eventsData = d.events || [];
  const cultureData = d.culture || [];
  const factsData = d.facts || [];
  const moviesData = d.movies || [];

  if (!d.events || !d.culture || !d.facts || !d.movies) {
    console.error('Historical data did not load — check that data/historicalEvent.js, data/music___culture.js, data/fun_fact.js, and data/movie.js are present and loaded before js/app.js.');
  }

  function decadeOf(year) {
    return Math.floor(year / 10) * 10;
  }

  function byDate(a, b) {
    return (a.date || '').localeCompare(b.date || '');
  }

  function byReleaseDate(a, b) {
    return (a.release_date || '').localeCompare(b.release_date || '');
  }

  // Shared lookup for events/culture/facts, which all use the same
  // { event, date, year, image, wikipedia_url } shape.
  //
  // Year mode: exact year match, falling back to any entry from the same
  // decade if the exact year has nothing (capped at `limit`).
  //
  // Decade mode: walks every year in the decade in order (so results are
  // chronological across all 10 years, not just a date-sorted top-N
  // "highlights" pull from the whole decade) and returns everything found —
  // no cap, since the whole point is showing the full decade.
  function getItemsFor(dataset, mode, value, limit) {
    if (mode === 'decade') {
      let matches = [];
      for (let year = value; year < value + 10; year++) {
        matches = matches.concat(
          dataset.filter(function (item) { return item.year === year; }).sort(byDate)
        );
      }
      return matches;
    }

    let matches = dataset.filter(function (item) { return item.year === value; }).sort(byDate);
    if (!matches.length) {
      const decade = decadeOf(value);
      matches = dataset.filter(function (item) { return decadeOf(item.year) === decade; }).sort(byDate);
    }
    return matches.slice(0, limit);
  }

  // Same idea as getItemsFor, different shape (movies sort by release_date).
  function getMoviesFor(mode, value) {
    if (mode === 'decade') {
      let matches = [];
      for (let year = value; year < value + 10; year++) {
        matches = matches.concat(
          moviesData.filter(function (m) { return m.year === year; }).sort(byReleaseDate)
        );
      }
      return matches;
    }

    let matches = moviesData.filter(function (m) { return m.year === value; });
    if (!matches.length) {
      const decade = decadeOf(value);
      matches = moviesData.filter(function (m) { return decadeOf(m.year) === decade; });
    }
    return matches.slice().sort(byReleaseDate).slice(0, 6);
  }

  // ---------- small helpers ----------

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d2 = new Date(iso + 'T00:00:00Z');
    if (isNaN(d2)) return iso;
    return d2.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  // ---------- "Previously searched" history ----------
  // Recorded once per unique (mode, value) pair, most-recent-first, in
  // localStorage — so it survives reloads. recordHistory() is called from
  // showResults(), which every entry point (timeline, decade grid, direct
  // entry, quick-jump chips, ±1/±10 nav) already funnels through, so a
  // year/decade is captured no matter how it was reached.
  const HISTORY_KEY = 'timeCapsuleHistory';
  const HISTORY_MAX = 14;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable — history just won't persist */ }
  }

  function recordHistory(mode, value, label) {
    const deduped = loadHistory().filter(function (h) { return !(h.mode === mode && h.value === value); });
    deduped.unshift({ mode: mode, value: value, label: label });
    saveHistory(deduped.slice(0, HISTORY_MAX));
    renderHistory();
  }

  // Two chip rows show the same list (idle screen + direct-entry screen) so
  // history is visible no matter which screen the visitor lands on.
  const historyRowIds = ['history-chip-row', 'history-chip-row-direct'];
  const historySectionIds = ['idle-history', 'direct-history'];

  function renderHistory() {
    const list = loadHistory();
    const hasHistory = list.length > 0;

    historySectionIds.forEach(function (id) {
      const section = document.getElementById(id);
      if (section) section.hidden = !hasHistory;
    });

    historyRowIds.forEach(function (id) {
      const row = document.getElementById(id);
      if (!row) return;
      row.innerHTML = '';
      list.forEach(function (h) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'direct-chip';
        chip.textContent = h.label;
        chip.addEventListener('click', function () {
          document.dispatchEvent(new CustomEvent('timeline:enter', {
            detail: { mode: h.mode, value: h.value, label: h.label }
          }));
        });
        row.appendChild(chip);
      });
    });
  }

  renderHistory();

  // ---------- drag-to-scroll ----------
  // Manual drag-to-scroll for a panel whose native scrollbar is hidden —
  // native mouse wheel already scrolls it fine on its own (that's just how
  // overflow works), this only adds click-and-drag. A gesture that starts
  // on a real <a> link is left alone entirely so clicks/navigation aren't
  // disturbed, and a small drag-distance threshold stops a genuine drag
  // from being mistaken for a click once it's released.
  function initDragScroll(el, axis) {
    const vertical = axis === 'vertical';
    function getScroll() { return vertical ? el.scrollTop : el.scrollLeft; }
    function setScroll(v) { if (vertical) el.scrollTop = v; else el.scrollLeft = v; }

    let isDown = false;
    let startPos = 0;
    let startScroll = 0;
    let dragDistance = 0;

    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a')) return;
      isDown = true;
      dragDistance = 0;
      startPos = vertical ? e.clientY : e.clientX;
      startScroll = getScroll();
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!isDown) return;
      const pos = vertical ? e.clientY : e.clientX;
      const delta = pos - startPos;
      dragDistance = Math.max(dragDistance, Math.abs(delta));
      setScroll(startScroll - delta);
    });
    function endDrag() {
      isDown = false;
      el.classList.remove('dragging');
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    return {
      wasDragging: function () { return dragDistance > 6; },
      resetScroll: function () { setScroll(0); }
    };
  }

  // ---------- filling the small grid cards ----------
  // Note: card banners (the .card-image at the top of each card) are fixed
  // GIFs set directly in index.html — no longer generated from data, and
  // unaffected by the expanded-view banner removal below.

  // In decade mode, items span all 10 years (see getItemsFor), so a small
  // year heading is inserted whenever the year changes to keep the list
  // readable and chronological rather than one long undifferentiated blob.
  function fillItemsList(listEl, items, mode) {
    listEl.innerHTML = '';
    let lastYear = null;
    items.forEach(function (item) {
      if (mode === 'decade' && item.year !== lastYear) {
        lastYear = item.year;
        const heading = document.createElement('li');
        heading.className = 'card-list-year-heading';
        heading.textContent = item.year;
        listEl.appendChild(heading);
      }
      const li = document.createElement('li');
      if (item.wikipedia_url) {
        const a = document.createElement('a');
        a.href = item.wikipedia_url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'card-link';
        a.textContent = item.event;
        li.appendChild(a);
      } else {
        li.textContent = item.event;
      }
      if (item.date) {
        const meta = document.createElement('span');
        meta.className = 'card-list-meta';
        meta.textContent = ' — ' + formatDate(item.date);
        li.appendChild(meta);
      }
      listEl.appendChild(li);
    });
  }

  // Builds the IMDb badge (logo + star rating) for a movie. Reads the
  // `imdb` (title-page URL) and `rating` fields from the movie record. The
  // whole badge — logo and star/rating together — is one <a> to the
  // movie's IMDb page. Renders nothing if there's neither a URL nor a
  // rating; with a rating but no URL it's shown as a non-clickable badge.
  function imdbBadgeHTML(m) {
    const url = m.imdb || m.imdb_url || '';
    const raw = m.rating !== undefined ? m.rating : m.imdb_rating;
    const hasRating = raw !== undefined && raw !== null && raw !== '';
    if (!url && !hasRating) return '';
    const rating = hasRating ? Number(raw).toFixed(1) : '';
    const inner =
      '<span class="imdb-badge-logo">IMDb</span>' +
      (hasRating ? '<span class="imdb-badge-rating">\u2605 ' + escapeHtml(rating) + '</span>' : '');
    return url
      ? '<a class="imdb-badge" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" aria-label="View on IMDb' + (hasRating ? ', rated ' + escapeHtml(rating) : '') + '">' + inner + '</a>'
      : '<span class="imdb-badge imdb-badge--static">' + inner + '</span>';
  }

  function fillMoviesGrid(containerEl, items, mode) {
    containerEl.innerHTML = '';
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'movies-placeholder';
      p.textContent = 'No movies from this period in the dataset yet.';
      containerEl.appendChild(p);
      return;
    }
    let lastYear = null;
    items.forEach(function (m) {
      if (mode === 'decade' && m.year !== lastYear) {
        lastYear = m.year;
        const heading = document.createElement('p');
        heading.className = 'movie-grid-year-heading';
        heading.textContent = m.year;
        containerEl.appendChild(heading);
      }

      const card = document.createElement('div');
      card.className = 'movie-mini';

      if (m.image) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'movie-mini-image';
        const img = document.createElement('img');
        img.src = m.image;
        img.alt = m.name;
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      }

      const title = document.createElement('a');
      title.className = 'movie-mini-title';
      title.href = m.wikipedia_url || '#';
      title.target = '_blank';
      title.rel = 'noopener';
      title.textContent = m.name;

      const meta = document.createElement('p');
      meta.className = 'movie-mini-meta';
      meta.textContent = [m.release_date ? formatDate(m.release_date) : '', m.country || ''].filter(Boolean).join(' · ');

      card.appendChild(title);
      card.appendChild(meta);

      const imdbHtml = imdbBadgeHTML(m);
      if (imdbHtml) {
        const imdbWrap = document.createElement('div');
        imdbWrap.className = 'movie-mini-imdb-wrap';
        imdbWrap.innerHTML = imdbHtml;
        card.appendChild(imdbWrap);
      }

      containerEl.appendChild(card);
    });
  }

  // Drag-scroll runs on the same four .card-body panels for the whole
  // session — only their contents change between selections, not the
  // elements themselves — so this only needs to happen once.
  const cardBodyScrollers = Array.from(document.querySelectorAll('.card-body')).map(function (el) {
    return initDragScroll(el, 'vertical');
  });

  // ---------- results page ----------

  let currentContent = { events: [], movies: [], culture: [], funFacts: [] };
  let currentMode = 'year';
  let currentValue = null;

  const MIN_DECADE = 1940;
  const MAX_DECADE = 2020;

  function updateYearNav() {
    const isYear = currentMode === 'year';
    const isDecade = currentMode === 'decade';

    // ±1 only makes sense at year granularity; ±10 works for both (a
    // decade jump of 10 lands you on the adjacent decade).
    navMinus1.hidden = !isYear;
    navPlus1.hidden = !isYear;
    navMinus10.hidden = !(isYear || isDecade);
    navPlus10.hidden = !(isYear || isDecade);

    if (isYear) {
      navMinus10.disabled = currentValue - 10 < MIN_YEAR;
      navMinus1.disabled = currentValue - 1 < MIN_YEAR;
      navPlus1.disabled = currentValue + 1 > MAX_YEAR;
      navPlus10.disabled = currentValue + 10 > MAX_YEAR;
    } else if (isDecade) {
      navMinus10.disabled = currentValue - 10 < MIN_DECADE;
      navPlus10.disabled = currentValue + 10 > MAX_DECADE;
    }
  }

  function jumpYears(delta) {
    if (currentValue === null) return;

    if (currentMode === 'year') {
      const newYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, currentValue + delta));
      if (newYear !== currentValue) showResults('year', newYear, String(newYear));
      return;
    }

    if (currentMode === 'decade' && Math.abs(delta) === 10) {
      const newDecade = Math.max(MIN_DECADE, Math.min(MAX_DECADE, currentValue + delta));
      if (newDecade !== currentValue) showResults('decade', newDecade, newDecade + 's');
    }
  }

  navMinus10.addEventListener('click', function () { jumpYears(-10); });
  navMinus1.addEventListener('click', function () { jumpYears(-1); });
  navPlus1.addEventListener('click', function () { jumpYears(1); });
  navPlus10.addEventListener('click', function () { jumpYears(10); });

  function showResults(mode, value, label) {
    const themeClass = TimeMachine.getThemeClassForYear(value);
    const era = ERA_INFO[themeClass];

    // Year mode keeps a sane per-card cap (8) since it's one specific year.
    // Decade mode intentionally has no cap — see getItemsFor/getMoviesFor —
    // because the whole point is showing the full decade, not a highlight reel.
    const events = getItemsFor(eventsData, mode, value, 8);
    const culture = getItemsFor(cultureData, mode, value, 8);
    const funFacts = getItemsFor(factsData, mode, value, 8);
    const movies = getMoviesFor(mode, value);

    currentContent = { events: events, culture: culture, funFacts: funFacts, movies: movies };
    currentMode = mode;
    currentValue = value;

    resultsBackdrop.className = 'results-backdrop era-' + themeClass.replace('theme-', '');
    TimeMachine.setBackdropVideo(resultsBackdrop, themeClass);
    // Also (re)applies body.theme-XXXX — the timeline already does this as
    // you scroll it, but entries that skip the timeline (typing a year
    // directly, or a quick-jump chip) otherwise never set it, leaving the
    // results page's --era-accent-driven colors stuck on whatever the body
    // last happened to have.
    TimeMachine.applyBodyTheme(themeClass);
    resultsEyebrow.textContent = era.label;
    resultsTitle.textContent = mode === 'year' ? 'WELCOME TO ' + value : 'EXPLORING THE ' + label.toUpperCase();
    resultsDescription.textContent = era.description;

    fillItemsList(eventsList, events, mode);
    fillItemsList(cultureList, culture, mode);
    fillItemsList(factsList, funFacts, mode);
    fillMoviesGrid(movieGridEl, movies, mode);
    cardBodyScrollers.forEach(function (s) { s.resetScroll(); });
    updateYearNav();

    // Record this search regardless of how we got here — timeline,
    // decade grid, direct entry, quick-jump chip, or a ±1/±10 nav click
    // all funnel through showResults().
    recordHistory(mode, value, label);

    timelineView.hidden = true;
    directView.hidden = true;
    resultsView.hidden = false;
    resultsView.scrollTop = 0;
  }

  // ---------- card expand / collapse ----------
  // Builds the full-screen view from the exact same currentContent used
  // for the small cards, so nothing is ever defined twice. Each item
  // (event, movie, culture note, or fun fact) becomes its own card in a
  // masonry-style grid (CSS multi-column layout) that each card sizes to
  // its own content — no banner, no fixed horizontal strip.

  // Normalizes any of the four content types into a common shape so one
  // renderer can build cards for all of them. events/culture/facts share
  // one schema; movies has its own but also carries IMDb fields now.
  function normalizeSubItems(cardType, rawItems) {
    if (cardType === 'movies') {
      return rawItems.map(function (m) {
        const meta = [m.release_date ? formatDate(m.release_date) : '', m.country || ''].filter(Boolean).join(' · ');
        return {
          image: m.image || '',
          title: m.name,
          meta: meta,
          link: m.wikipedia_url || '',
          year: m.year,
          imdb: m.imdb || '',
          rating: m.rating === undefined ? '' : m.rating
        };
      });
    }
    return rawItems.map(function (item) {
      return { image: item.image || '', title: item.event, meta: item.date ? formatDate(item.date) : '', link: item.wikipedia_url || '', year: item.year };
    });
  }

  function subCardsGridHTML(items, cardType) {
    if (!items.length) {
      return '<p class="movies-placeholder">Nothing recorded for this period yet.</p>';
    }
    // Movie posters keep their full natural aspect ratio (no crop/cap) —
    // everything else stays capped at a fixed thumbnail height so the grid
    // reads as compact tiles rather than full-bleed photos.
    const imageClass = cardType === 'movies' ? 'expanded-subcard-image expanded-subcard-image--poster' : 'expanded-subcard-image';
    const cards = items.map(function (it) {
      const imgInner = it.image
        ? '<div class="' + imageClass + '"><img src="' + it.image + '" alt="' + escapeHtml(it.title) + '" loading="lazy"></div>'
        : '<div class="expanded-subcard-image expanded-subcard-image--empty"><span class="card-image-placeholder">Image goes here</span></div>';
      const titleInner = it.link
        ? '<a class="card-link" href="' + it.link + '" target="_blank" rel="noopener">' + escapeHtml(it.title) + '</a>'
        : escapeHtml(it.title);
      const metaHtml = it.meta ? '<p class="expanded-subcard-meta">' + escapeHtml(it.meta) + '</p>' : '';
      const yearBadge = it.year ? '<span class="expanded-subcard-year">' + it.year + '</span>' : '';
      const imdbHtml = imdbBadgeHTML(it);
      // data-link lets clicking anywhere on the card (e.g. the image) open
      // the same URL as the title link — see the click handler below.
      const linkAttr = it.link ? ' data-link="' + escapeHtml(it.link) + '"' : '';
      return (
        '<div class="expanded-subcard"' + linkAttr + '>' +
          yearBadge +
          imgInner +
          '<div class="expanded-subcard-body">' +
            '<p class="expanded-subcard-title">' + titleInner + '</p>' +
            metaHtml +
            imdbHtml +
          '</div>' +
        '</div>'
      );
    }).join('');
    return '<div class="expanded-strip"><div class="expanded-strip-track">' + cards + '</div></div>';
  }

  // Deals the cards out round-robin into N flex columns so they read
  // left-to-right across each row (chronological) instead of filling one
  // column top-to-bottom first. Column count follows the old breakpoints.
  function expandedColumnCount() {
    const w = window.innerWidth;
    if (w <= 640) return 1;
    if (w <= 820) return 2;
    if (w <= 1100) return 3;
    if (w <= 1500) return 4;
    return 5;
  }

  function layoutMasonry(track) {
    if (!track) return;
    if (!track._cards) track._cards = Array.from(track.querySelectorAll('.expanded-subcard'));
    const n = expandedColumnCount();
    if (track.dataset.cols === String(n)) return;
    track.dataset.cols = String(n);
    const cols = [];
    for (let i = 0; i < n; i++) {
      const col = document.createElement('div');
      col.className = 'expanded-strip-col';
      cols.push(col);
    }
    track._cards.forEach(function (card, i) { cols[i % n].appendChild(card); });
    track.innerHTML = '';
    cols.forEach(function (col) { track.appendChild(col); });
  }

  window.addEventListener('resize', function () {
    if (!expandedOverlay.hidden) layoutMasonry(expandedInner.querySelector('.expanded-strip-track'));
  });

  function openExpandedCard(cardType) {
    const meta = CARD_META[cardType];
    const rawItems = cardType === 'events' ? currentContent.events
      : cardType === 'movies' ? currentContent.movies
      : currentContent[cardType];

    const items = normalizeSubItems(cardType, rawItems);
    const gridHtml = subCardsGridHTML(items, cardType);

    // No banner image here (removed — the compact grid's .card-image GIF
    // already establishes the section, repeating it full-width just pushed
    // real content down for no benefit). Header sits right at the top now.
    expandedInner.innerHTML =
      '<div class="card-expanded-header">' +
        '<p class="card-expanded-eyebrow">' + meta.eyebrow + '</p>' +
        '<h2 class="card-expanded-title">' + meta.title + '</h2>' +
      '</div>' +
      gridHtml;

    const stripEl = expandedInner.querySelector('.expanded-strip');
    layoutMasonry(expandedInner.querySelector('.expanded-strip-track'));
    if (stripEl) {
      const scroller = initDragScroll(stripEl, 'vertical');

      // Clicking a sub-card (its image, meta text, or padding — anywhere
      // that isn't the title link or the IMDb badge, which already
      // navigate on their own) opens the same URL. Suppressed after a
      // genuine drag so scrolling the grid doesn't accidentally open a tab.
      stripEl.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        if (scroller.wasDragging()) return;
        const card = e.target.closest('.expanded-subcard');
        if (card && card.dataset.link) {
          window.open(card.dataset.link, '_blank', 'noopener');
        }
      });
    }

    expandedOverlay.hidden = false;
  }

  function closeExpandedCard() {
    expandedOverlay.hidden = true;
  }

  resultsGrid.addEventListener('click', function (e) {
    const card = e.target.closest('.result-card');
    // Let clicks on real links (event/movie titles) navigate normally
    // instead of opening the expanded overlay.
    if (card && !e.target.closest('a')) openExpandedCard(card.dataset.cardType);
  });

  expandedClose.addEventListener('click', closeExpandedCard);

  expandedOverlay.addEventListener('click', function (e) {
    if (e.target === expandedOverlay) closeExpandedCard();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !expandedOverlay.hidden) closeExpandedCard();
  });

  // ---------- TV transition ----------

  function playTvTransition(mode, value, label) {
    tvYearEl.textContent = mode === 'year' ? value : label;

    tvTransition.hidden = false;
    tvTransition.classList.remove('playing');
    void tvTransition.offsetWidth; // force reflow so the animation restarts every time
    tvTransition.classList.add('playing');

    showResults(mode, value, label);

    setTimeout(function () {
      tvTransition.classList.remove('playing');
      tvTransition.hidden = true;
    }, 1550);
  }

  // ---------- mode switching ----------

  function selectMode(mode, activeBtn) {
    lastMode = mode;

    modeButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn === activeBtn);
    });

    idleState.hidden = true;
    resultsView.hidden = true;
    tvTransition.hidden = true;
    tvTransition.classList.remove('playing');
    specialErrorScreen.hidden = true;
    // The expanded card overlay sits above everything (z-index 40) and was
    // staying open when a mode tab was clicked from underneath it — close
    // it explicitly so switching modes always shows the mode you picked.
    if (!expandedOverlay.hidden) closeExpandedCard();

    if (mode === 'direct') {
      timelineView.hidden = true;
      directView.hidden = false;
      directError.textContent = '';
      directInput.value = '';
      directInput.focus();
      if (TimeMachine.MusicPlayer) TimeMachine.MusicPlayer.setSection('home');
    } else {
      directView.hidden = true;
      timelineView.hidden = false;
      TimeMachine.timeline.start(mode);
    }
  }

  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectMode(btn.dataset.mode, btn);
    });
  });

  // ---------- brand / logo → back to the idle home screen ----------

  const brandHomeBtn = document.getElementById('brand-home-btn');

  function goToIdle() {
    modeButtons.forEach(function (btn) { btn.classList.remove('active'); });

    timelineView.hidden = true;
    directView.hidden = true;
    resultsView.hidden = true;
    specialErrorScreen.hidden = true;
    tvTransition.hidden = true;
    tvTransition.classList.remove('playing');
    if (!expandedOverlay.hidden) closeExpandedCard();

    idleState.hidden = false;

    if (TimeMachine.MusicPlayer) TimeMachine.MusicPlayer.setSection('home');
  }

  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', goToIdle);
  }

  // ---------- direct year entry ----------

  // Only digits, capped at 4 characters, enforced live as you type —
  // maxlength alone doesn't stop pasted letters, and type="number" inputs
  // have their own quirks (e/E, scientific notation, no real maxlength).
  directInput.addEventListener('input', function () {
    directInput.value = directInput.value.replace(/\D/g, '').slice(0, 4);
  });

  function validateDirectYear(rawValue) {
    const trimmed = rawValue.trim();

    if (trimmed === '') return { valid: false, message: 'Please enter a year.' };
    if (!/^\d{4}$/.test(trimmed)) return { valid: false, message: 'Enter exactly 4 digits, like 1995.' };

    const year = Number(trimmed);
    if (year < MIN_YEAR) return { valid: false, special: 'past' };
    if (year > MAX_YEAR) return { valid: false, special: 'future' };
    return { valid: true, year: year };
  }

  function showSpecialError(message) {
    specialErrorMessage.textContent = message;
    directView.hidden = true;
    specialErrorScreen.hidden = false;
  }

  specialErrorBack.addEventListener('click', function () {
    specialErrorScreen.hidden = true;
    directView.hidden = false;
    directInput.value = '';
    directError.textContent = '';
    directInput.focus();
  });

  directForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const result = validateDirectYear(directInput.value);

    if (result.special === 'past') return showSpecialError("We can't dig too deep in the past.");
    if (result.special === 'future') return showSpecialError('Nobody knows the Future.');
    if (!result.valid) {
      directError.textContent = result.message;
      return;
    }

    directError.textContent = '';
    document.dispatchEvent(new CustomEvent('timeline:enter', {
      detail: { mode: 'year', value: result.year, label: String(result.year) }
    }));
  });

  // ---------- quick-jump chips on the direct-entry page ----------

  const directChipRow = document.getElementById('direct-chip-row');
  if (directChipRow) {
    directChipRow.addEventListener('click', function (e) {
      const chip = e.target.closest('.direct-chip');
      if (!chip) return;
      const year = Number(chip.dataset.year);
      document.dispatchEvent(new CustomEvent('timeline:enter', {
        detail: { mode: 'year', value: year, label: String(year) }
      }));
    });
  }

  // ---------- entering from the timeline (year or decade) ----------

  document.addEventListener('timeline:enter', function (e) {
    playTvTransition(e.detail.mode, e.detail.value, e.detail.label);
  });

  backBtn.addEventListener('click', function () {
    resultsView.hidden = true;
    if (lastMode === 'direct') {
      directView.hidden = false;
      if (TimeMachine.MusicPlayer) TimeMachine.MusicPlayer.setSection('home');
    } else {
      timelineView.hidden = false;
    }
  });

})();
