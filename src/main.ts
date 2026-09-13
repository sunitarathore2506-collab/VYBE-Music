import './styles.css';
import { api } from '@appdeploy/client';

type Song = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
};

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root missing');

app.innerHTML = `
<div class='appShell'>
  <aside class='side glass'>
    <div class='brand'><div class='logo'>V</div><div><strong>VYBE</strong><small>Hear Everything.</small></div></div>
    <nav class='sideNav'>
      <button id='homeNav' class='active' type='button'>⌂ <span>Home</span></button>
      <button id='searchNav' type='button'>⌕ <span>Search</span></button>
      <button id='installNav' type='button'>↓ <span>Install</span></button>
    </nav>
    <div class='sideNote soft'><b>VYBE Music</b><p>Music-only discovery with official YouTube playback.</p></div>
  </aside>

  <main class='main'>
    <header class='topbar glass'>
      <div class='searchBox'>⌕ <input id='desktopQuery' placeholder='Search Hindi, Punjabi, English songs…' autocomplete='off' /></div>
      <button class='btn primary' id='desktopSearch' type='button'>Search</button>
      <button class='icon' id='installTop' type='button' aria-label='Install VYBE'>↓</button>
    </header>

    <section class='hero glass'>
      <div><span class='eyebrow'>FREE MUSIC DISCOVERY</span><h1>Search.<br><em>Play. VYBE.</em></h1><p>Find proper songs and music videos. Shorts and very short clips are filtered, while playback stays inside the official YouTube player.</p></div>
      <div class='disc'></div>
    </section>

    <div class='quick'>
      <button class='chip' data-q='Hindi songs latest'>Hindi</button>
      <button class='chip' data-q='Punjabi songs latest'>Punjabi</button>
      <button class='chip' data-q='English songs latest'>English</button>
      <button class='chip' data-q='Bollywood songs'>Bollywood</button>
      <button class='chip' data-q='Punjabi party songs'>Party</button>
      <button class='chip' data-q='workout music'>Workout</button>
      <button class='chip' data-q='lofi music'>Lo-fi</button>
    </div>

    <div class='sectionHead'><div><span class='eyebrow'>MUSIC ONLY</span><h2 id='resultTitle'>For You</h2></div><span class='status' id='quotaText'>Loading…</span></div>
    <div class='results' id='results'><div class='empty glass'><b>Finding music…</b>Please wait a moment.</div></div>
  </main>

  <aside class='player glass'>
    <div class='playerHead'><span>NOW PLAYING</span><span>YOUTUBE</span></div>
    <div class='videoWrap' id='videoWrap'><div class='playerEmpty'>Choose a result to play</div></div>
    <div class='nowMeta'><h2 id='nowTitle'>Nothing playing</h2><p id='nowChannel'>Search for a song and tap it.</p></div>
    <div class='policy soft'><b>Playback:</b> Official YouTube embed. VYBE does not download, extract, or host audio.</div>
  </aside>
</div>

<div class='mobileDock glass'>
  <button id='mobileHome' class='dockIcon active' type='button' aria-label='Home'>⌂</button>
  <div class='mobileSearch'><input id='mobileQuery' placeholder='Search music…' autocomplete='off'/><button id='mobileSearchBtn' type='button' aria-label='Search'>⌕</button></div>
  <button id='mobileInstall' class='dockIcon' type='button' aria-label='Install VYBE'>↓</button>
</div>

<button class='mobilePlayer glass hidden' id='mobilePlayer' type='button'>
  <img id='miniThumb' alt='' /><span class='mobileMeta'><strong id='miniTitle'></strong><small id='miniChannel'></small></span><span class='mobilePlay'>▶</span>
</button>

<div class='overlay hidden' id='mobileOverlay'><div class='mobileModal glass'><button class='close' id='closeMobilePlayer' type='button'>×</button><div class='mobileVideo'><iframe id='mobileFrame' title='YouTube player' allow='autoplay; encrypted-media; picture-in-picture' allowfullscreen></iframe></div><h3 id='mobileNowTitle'></h3><p id='mobileNowChannel'></p></div></div>

<div class='overlay hidden' id='installOverlay'><div class='installModal glass'><button class='close' id='closeInstall' type='button'>×</button><div class='installLogo'>V</div><span class='eyebrow'>INSTALL VYBE</span><h2>Add VYBE to your device</h2><p>Android / PC: tap <b>Install now</b> when available. iPhone: Safari → Share → <b>Add to Home Screen</b>.</p><button class='btn primary wide' id='installNow' type='button'>Install now</button></div></div>
`;

const desktopQuery = document.querySelector<HTMLInputElement>('#desktopQuery')!;
const mobileQuery = document.querySelector<HTMLInputElement>('#mobileQuery')!;
const results = document.querySelector<HTMLElement>('#results')!;
const resultTitle = document.querySelector<HTMLElement>('#resultTitle')!;
const quotaText = document.querySelector<HTMLElement>('#quotaText')!;
const videoWrap = document.querySelector<HTMLElement>('#videoWrap')!;
const nowTitle = document.querySelector<HTMLElement>('#nowTitle')!;
const nowChannel = document.querySelector<HTMLElement>('#nowChannel')!;
const mobilePlayer = document.querySelector<HTMLButtonElement>('#mobilePlayer')!;
const miniThumb = document.querySelector<HTMLImageElement>('#miniThumb')!;
const miniTitle = document.querySelector<HTMLElement>('#miniTitle')!;
const miniChannel = document.querySelector<HTMLElement>('#miniChannel')!;
const mobileOverlay = document.querySelector<HTMLElement>('#mobileOverlay')!;
const mobileFrame = document.querySelector<HTMLIFrameElement>('#mobileFrame')!;
const mobileNowTitle = document.querySelector<HTMLElement>('#mobileNowTitle')!;
const mobileNowChannel = document.querySelector<HTMLElement>('#mobileNowChannel')!;
const installOverlay = document.querySelector<HTMLElement>('#installOverlay')!;
const installNow = document.querySelector<HTMLButtonElement>('#installNow')!;
const installTop = document.querySelector<HTMLButtonElement>('#installTop')!;
const installNav = document.querySelector<HTMLButtonElement>('#installNav')!;
const mobileInstall = document.querySelector<HTMLButtonElement>('#mobileInstall')!;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let currentSong: Song | null = null;

function syncQueries(value: string) {
  desktopQuery.value = value;
  mobileQuery.value = value;
}

function renderSongs(songs: Song[]) {
  results.replaceChildren();
  quotaText.textContent = songs.length ? `${songs.length} music results` : 'No proper songs found';
  if (!songs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty glass';
    empty.innerHTML = '<b>No proper songs found</b>Try another artist or song.';
    results.append(empty);
    return;
  }
  songs.forEach(song => {
    const card = document.createElement('article');
    card.className = 'card glass';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = song.thumbnail;
    img.alt = '';
    img.loading = 'lazy';
    const bubble = document.createElement('div');
    bubble.className = 'playBubble';
    bubble.textContent = '▶';
    thumb.append(img, bubble);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('strong');
    title.textContent = song.title;
    const channel = document.createElement('span');
    channel.textContent = song.channel;
    meta.append(title, channel);
    card.append(thumb, meta);
    card.addEventListener('click', () => playSong(song));
    results.append(card);
  });
}

async function searchSongs(query: string) {
  const term = query.trim();
  if (!term) return;
  syncQueries(term);
  resultTitle.textContent = `Songs for “${term}”`;
  quotaText.textContent = 'Searching…';
  results.innerHTML = `<div class='empty glass'><b>Finding music…</b>Please wait a moment.</div>`;
  try {
    const response = await api.get('/api/search', { q: term });
    renderSongs((response.data?.songs ?? []) as Song[]);
  } catch {
    quotaText.textContent = 'Error';
    results.innerHTML = `<div class='empty glass error'><b>Couldn’t search</b>Please try again.</div>`;
  }
}

function playSong(song: Song) {
  currentSong = song;
  const src = `https://www.youtube.com/embed/${song.id}?autoplay=1&playsinline=1&rel=0`;
  videoWrap.innerHTML = `<iframe src='${src}' title='YouTube video player' allow='autoplay; encrypted-media; picture-in-picture' allowfullscreen></iframe>`;
  nowTitle.textContent = song.title;
  nowChannel.textContent = song.channel;
  miniThumb.src = song.thumbnail;
  miniTitle.textContent = song.title;
  miniChannel.textContent = song.channel;
  mobilePlayer.classList.remove('hidden');
  if (window.innerWidth <= 760) openMobilePlayer();
}

function openMobilePlayer() {
  if (!currentSong) return;
  mobileFrame.src = `https://www.youtube.com/embed/${currentSong.id}?autoplay=1&playsinline=1&rel=0`;
  mobileNowTitle.textContent = currentSong.title;
  mobileNowChannel.textContent = currentSong.channel;
  mobileOverlay.classList.remove('hidden');
}

function closeMobilePlayer() {
  mobileOverlay.classList.add('hidden');
  mobileFrame.src = '';
}

function resetHome() {
  syncQueries('');
  resultTitle.textContent = 'For You';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  void searchSongs('trending music');
}

function hideInstallControls() {
  installTop.hidden = true;
  installNav.hidden = true;
  mobileInstall.hidden = true;
}

function openInstallGuide() {
  installOverlay.classList.remove('hidden');
  if (!deferredInstallPrompt) {
    installNow.disabled = true;
    installNow.textContent = 'Use browser menu';
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event as BeforeInstallPromptEvent;
  installNow.disabled = false;
  installNow.textContent = 'Install now';
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('vybe_installed', '1');
  deferredInstallPrompt = null;
  installOverlay.classList.add('hidden');
  hideInstallControls();
});

if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('vybe_installed') === '1') hideInstallControls();

if ('serviceWorker' in navigator) window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));

document.querySelector<HTMLButtonElement>('#desktopSearch')!.addEventListener('click', () => void searchSongs(desktopQuery.value));
document.querySelector<HTMLButtonElement>('#mobileSearchBtn')!.addEventListener('click', () => void searchSongs(mobileQuery.value));
desktopQuery.addEventListener('keydown', event => { if (event.key === 'Enter') void searchSongs(desktopQuery.value); });
mobileQuery.addEventListener('keydown', event => { if (event.key === 'Enter') void searchSongs(mobileQuery.value); });
document.querySelectorAll<HTMLButtonElement>('[data-q]').forEach(button => button.addEventListener('click', () => void searchSongs(button.dataset.q ?? '')));
document.querySelector<HTMLButtonElement>('#homeNav')!.addEventListener('click', resetHome);
document.querySelector<HTMLButtonElement>('#mobileHome')!.addEventListener('click', resetHome);
document.querySelector<HTMLButtonElement>('#searchNav')!.addEventListener('click', () => desktopQuery.focus());
installTop.addEventListener('click', openInstallGuide);
installNav.addEventListener('click', openInstallGuide);
mobileInstall.addEventListener('click', openInstallGuide);
document.querySelector<HTMLButtonElement>('#closeInstall')!.addEventListener('click', () => installOverlay.classList.add('hidden'));
installOverlay.addEventListener('click', event => { if (event.target === installOverlay) installOverlay.classList.add('hidden'); });
installNow.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installOverlay.classList.add('hidden');
});
mobilePlayer.addEventListener('click', openMobilePlayer);
document.querySelector<HTMLButtonElement>('#closeMobilePlayer')!.addEventListener('click', closeMobilePlayer);
mobileOverlay.addEventListener('click', event => { if (event.target === mobileOverlay) closeMobilePlayer(); });

void searchSongs('trending music');
