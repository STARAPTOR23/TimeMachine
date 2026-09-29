// TIME CAPSULE — music player
// Reads the track lists from js/music.js (window.TimeMachineMusic.SECTIONS)
// and drives a single shared <audio> element plus the popover panel in the
// header.
window.TimeMachine = window.TimeMachine || {};

(function () {

  const toggleBtn = document.getElementById('music-toggle');
  const panel = document.getElementById('music-panel');
  const sectionLabelEl = document.getElementById('music-panel-section');
  const titleEl = document.getElementById('music-track-title');
  const artistEl = document.getElementById('music-track-artist');
  const trackListEl = document.getElementById('music-track-list');
  const playBtn = document.getElementById('music-play-btn');
  const prevBtn = document.getElementById('music-prev-btn');
  const nextBtn = document.getElementById('music-next-btn');
  const progressEl = document.getElementById('music-progress');
  const currentTimeEl = document.getElementById('music-time-current');
  const durationEl = document.getElementById('music-time-duration');
  const volumeInput = document.getElementById('music-volume');

  if (!toggleBtn || !panel) return; // markup not present — nothing to wire up

  const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  const audio = new Audio();
  audio.volume = Number(volumeInput.value) || 0.6;

  let currentSectionKey = 'home';
  let currentTrackIndex = 0;
  let isPlaying = false;
  let isScrubbing = false; // true while the visitor is dragging the progress handle

  function getSection(key) {
    const sections = window.TimeMachineMusic && window.TimeMachineMusic.SECTIONS;
    return (sections && sections[key]) || { label: key, folder: '', tracks: [] };
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    playBtn.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    toggleBtn.classList.toggle('playing', isPlaying);
  }

  // Rebuilds the whole panel (now-playing info + track list) for whatever
  // section/track is currently active. Safe to call any time — e.g. after
  // switching sections, after picking a track, or just when opening the
  // panel — since it always reads from the current state rather than
  // assuming what changed.
  function renderPanel() {
    const section = getSection(currentSectionKey);
    sectionLabelEl.textContent = section.label;

    const hasTracks = section.tracks.length > 0;
    const track = hasTracks ? section.tracks[currentTrackIndex] : null;

    titleEl.textContent = track ? track.title : 'Nothing to play yet';
    artistEl.textContent = track && track.artist ? track.artist : '';
    artistEl.hidden = !(track && track.artist);

    playBtn.disabled = !hasTracks;
    prevBtn.disabled = !hasTracks || section.tracks.length < 2;
    nextBtn.disabled = !hasTracks || section.tracks.length < 2;
    progressEl.disabled = !hasTracks;

    if (!hasTracks) {
      trackListEl.innerHTML =
        '<p class="music-empty">No tracks yet for this section.<br>Add .mp3 files to <code>' +
        (section.folder || 'assets/audio/') +
        '</code> and list them in <code>js/music.js</code>.</p>';
      currentTimeEl.textContent = '0:00';
      durationEl.textContent = '0:00';
      progressEl.value = 0;
      return;
    }

    trackListEl.innerHTML = '';
    section.tracks.forEach(function (t, index) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'music-track-row';
      row.classList.toggle('active', index === currentTrackIndex);
      row.textContent = t.title || ('Track ' + (index + 1));
      row.addEventListener('click', function () { playTrack(index); });
      trackListEl.appendChild(row);
    });
  }

  function playTrack(index) {
    const section = getSection(currentSectionKey);
    if (!section.tracks.length) { setPlayingState(false); renderPanel(); return; }

    currentTrackIndex = ((index % section.tracks.length) + section.tracks.length) % section.tracks.length;
    const track = section.tracks[currentTrackIndex];
    audio.src = track.src;
    audio.currentTime = 0;
    audio.play()
      .then(function () { setPlayingState(true); })
      .catch(function () { setPlayingState(false); });
    renderPanel();
  }

  function playNext() {
    const section = getSection(currentSectionKey);
    if (section.tracks.length) playTrack(currentTrackIndex + 1);
  }

  function playPrev() {
    const section = getSection(currentSectionKey);
    if (section.tracks.length) playTrack(currentTrackIndex - 1);
  }

  function togglePlay() {
    const section = getSection(currentSectionKey);
    if (!section.tracks.length) return;

    if (isPlaying) {
      audio.pause();
      setPlayingState(false);
      return;
    }

    // audio.src is kept in sync with the current section/track by
    // setSection() and playTrack() even while paused, so the common case
    // is just resuming it — this only falls back to a fresh load if
    // something left it empty (e.g. the very first render, before
    // attemptAutoplay() has run).
    if (!audio.src) { playTrack(currentTrackIndex); return; }
    audio.play().then(function () { setPlayingState(true); }).catch(function () {});
  }

  // Playlist behavior: more than one track in a section advances to the
  // next on end, wrapping back to the first after the last; exactly one
  // track just loops.
  audio.addEventListener('ended', function () {
    const section = getSection(currentSectionKey);
    if (section.tracks.length > 1) {
      playNext();
    } else if (section.tracks.length === 1) {
      audio.currentTime = 0;
      audio.play().catch(function () {});
    }
  });

  audio.addEventListener('timeupdate', function () {
    if (isScrubbing) return;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    if (audio.duration) {
      progressEl.max = audio.duration;
      progressEl.value = audio.currentTime;
    }
  });

  audio.addEventListener('loadedmetadata', function () {
    durationEl.textContent = formatTime(audio.duration);
    progressEl.max = audio.duration || 0;
  });

  progressEl.addEventListener('input', function () {
    isScrubbing = true;
    currentTimeEl.textContent = formatTime(Number(progressEl.value));
  });

  progressEl.addEventListener('change', function () {
    audio.currentTime = Number(progressEl.value);
    isScrubbing = false;
  });

  // Called whenever the active "section" (home, or an era) changes. If
  // music is already playing, follows along to the new section's first
  // track — that's the "theme changes per decade" behavior. If nothing's
  // playing, still loads (but doesn't start) the new section's first
  // track, so audio.src always matches what the panel is showing. Without
  // this, pressing play later would resume whatever track was last
  // loaded — possibly a completely different section's audio — instead
  // of the one actually on screen.
  function setSection(key) {
    const nextKey = key || 'home';
    if (nextKey === currentSectionKey) return;
    currentSectionKey = nextKey;
    currentTrackIndex = 0;

    if (isPlaying) {
      playTrack(0);
      return;
    }

    const section = getSection(currentSectionKey);
    if (section.tracks.length) {
      audio.src = section.tracks[0].src;
      audio.load();
    } else if (audio.src) {
      audio.removeAttribute('src');
      audio.load();
    }
    renderPanel();
  }

  function openPanel() {
    panel.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
    renderPanel();
  }

  function closePanel() {
    panel.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  toggleBtn.addEventListener('click', function () {
    if (panel.hidden) openPanel(); else closePanel();
  });

  document.addEventListener('click', function (e) {
    if (panel.hidden) return;
    if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
    closePanel();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);

  volumeInput.addEventListener('input', function () {
    audio.volume = Number(volumeInput.value);
  });

  // ---------- autoplay on load, with the required fallback ----------
  // Browsers block audio with sound from starting on its own — this tries
  // anyway (harmless if blocked), and if it's blocked, starts on the very
  // first click/tap/keypress anywhere on the page instead, so playback
  // effectively begins "as soon as the site opens" either way.
  //
  // Guards on isPlaying rather than audio.src — playTrack() sets .src
  // before the play() promise ever resolves, so a blocked first attempt
  // still leaves .src populated. Checking .src here would treat that
  // blocked attempt as "already handled" and skip retrying on the very
  // interaction this fallback exists for.
  function attemptAutoplay() {
    if (isPlaying) return true;
    const section = getSection(currentSectionKey);
    if (!section.tracks.length) return false;
    playTrack(currentTrackIndex);
    return true;
  }

  const attemptedAutoplay = attemptAutoplay();

  // Always register these — attemptAutoplay() is a safe no-op once
  // isPlaying is actually true, and isPlaying can't be checked reliably
  // here anyway since audio.play()'s promise hasn't had a chance to
  // resolve yet at this point in the script.
  const startOnFirstInteraction = function () {
    attemptAutoplay();
    document.removeEventListener('click', startOnFirstInteraction);
    document.removeEventListener('keydown', startOnFirstInteraction);
    document.removeEventListener('touchstart', startOnFirstInteraction);
  };
  document.addEventListener('click', startOnFirstInteraction);
  document.addEventListener('keydown', startOnFirstInteraction);
  document.addEventListener('touchstart', startOnFirstInteraction);

  // If a track actually got queued up above, playTrack() already rendered
  // the panel and playback state — doing it again here would just flash
  // "not playing" for a moment before the play() promise resolves.
  if (!attemptedAutoplay) {
    setPlayingState(false);
    renderPanel();
  }

  // ---------- ducking (for sound effects that play over the music, e.g.
  // the TV-transition static in app.js) ----------
  // Fades audio.volume toward a target over a short duration rather than
  // snapping it, so it doesn't produce an audible "click." Only one fade
  // runs at a time — starting a new one cancels whatever fade was already
  // in progress, which matters if duck()/unduck() get called in quick
  // succession (e.g. two transitions back to back).
  let fadeTimer = null;

  function fadeVolumeTo(target, durationMs) {
    clearInterval(fadeTimer);
    const start = audio.volume;
    const startTime = performance.now();
    fadeTimer = setInterval(function () {
      const t = Math.min(1, (performance.now() - startTime) / durationMs);
      audio.volume = start + (target - start) * t;
      if (t >= 1) clearInterval(fadeTimer);
    }, 30);
  }

  let isDucked = false;

  function duck(toFraction, durationMs) {
    if (isDucked) return; // already ducked — don't overwrite the fade target
    isDucked = true;
    const normalVolume = Number(volumeInput.value) || 0;
    fadeVolumeTo(normalVolume * (typeof toFraction === 'number' ? toFraction : 0.15), durationMs || 120);
  }

  function unduck(durationMs) {
    if (!isDucked) return;
    isDucked = false;
    // Reads the slider fresh rather than a stored value, so if the visitor
    // adjusted volume while ducked, unduck() respects that instead of
    // reverting to whatever it was before.
    fadeVolumeTo(Number(volumeInput.value) || 0, durationMs || 250);
  }

  TimeMachine.MusicPlayer = {
    setSection: setSection,
    togglePlay: togglePlay,
    playTrack: playTrack,
    playNext: playNext,
    playPrev: playPrev,
    duck: duck,
    unduck: unduck
  };

  // Hook into the shared theme-change notifier from themes.js so browsing
  // into a new decade (via the timeline, a direct year, or a quick-jump
  // chip — anything that calls TimeMachine.applyBodyTheme) automatically
  // updates the music section too.
  if (TimeMachine.onThemeChange) {
    TimeMachine.onThemeChange(function (themeClass) { setSection(themeClass); });
  }

})();
