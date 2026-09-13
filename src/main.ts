import './styles.css';
import { api } from '@appdeploy/client';

type Song = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root missing');

app.innerHTML = `<main class='shell'><header class='top'><div class='brand'><div class='logo'>V</div><div><div class='wordmark'>VYBE</div><div class='tag'>MUSIC LIVES HERE</div></div></div><button class='heart' aria-label='Liked songs'>♡</button></header><section class='search glass'><input id='query' placeholder='Search songs, artists, albums…' autocomplete='off'/><button id='search'>Search</button></section><nav class='chips' aria-label='Music categories'><button class='chip active' data-query='trending music'>For You</button><button class='chip' data-query='Punjabi songs'>Punjabi</button><button class='chip' data-query='Hindi Bollywood songs'>Hindi</button><button class='chip' data-query='English pop songs'>English</button><button class='chip' data-query='lofi music'>Lo-Fi</button><button class='chip' data-query='workout music'>Workout</button></nav><section class='hero glass'><h1>Just Music.<br>No Noise.</h1><p>Black-heavy burgundy glass, smooth discovery and music-only results.</p></section><div class='section'><h2 id='heading'>For You</h2><span class='status' id='status'>Loading…</span></div><section id='results' class='results'><div class='empty glass'>Finding music…</div></section><div class='footer'>Playback is provided through the official YouTube embedded player.</div></main><aside id='mini' class='mini glass'><img id='miniImg' alt=''/><div><div id='miniTitle' class='miniTitle'>Nothing playing</div><div id='miniMeta' class='miniMeta'>VYBE</div></div><button id='openPlayer' aria-label='Open player'>▶</button></aside><div id='playerOverlay' class='overlay'><div class='modal glass'><button id='closePlayer' class='close' aria-label='Close player'>×</button><div class='video'><iframe id='playerFrame' title='YouTube player' allow='autoplay; encrypted-media; picture-in-picture' allowfullscreen></iframe></div><div class='playerInfo'><div id='playerTitle' class='songTitle'></div><div id='playerMeta' class='meta'></div></div></div></div>`;

const results = document.querySelector<HTMLElement>('#results')!;
const status = document.querySelector<HTMLElement>('#status')!;
const heading = document.querySelector<HTMLElement>('#heading')!;
const input = document.querySelector<HTMLInputElement>('#query')!;
const mini = document.querySelector<HTMLElement>('#mini')!;
const miniImg = document.querySelector<HTMLImageElement>('#miniImg')!;
const miniTitle = document.querySelector<HTMLElement>('#miniTitle')!;
const miniMeta = document.querySelector<HTMLElement>('#miniMeta')!;
const overlay = document.querySelector<HTMLElement>('#playerOverlay')!;
const frame = document.querySelector<HTMLIFrameElement>('#playerFrame')!;
const playerTitle = document.querySelector<HTMLElement>('#playerTitle')!;
const playerMeta = document.querySelector<HTMLElement>('#playerMeta')!;
let current: Song | null = null;

function songCard(song: Song) {
  const card = document.createElement('article');
  card.className = 'song glass';
  const img = document.createElement('img');
  img.className = 'thumb';
  img.src = song.thumbnail;
  img.alt = '';
  const copy = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'songTitle';
  title.textContent = song.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = song.channel;
  copy.append(title, meta);
  const play = document.createElement('button');
  play.className = 'play';
  play.type = 'button';
  play.textContent = '▶';
  play.setAttribute('aria-label', `Play ${song.title}`);
  card.append(img, copy, play);
  card.addEventListener('click', () => playSong(song));
  return card;
}

function render(songs: Song[]) {
  results.replaceChildren();
  status.textContent = `${songs.length} songs`;
  if (!songs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty glass';
    empty.textContent = 'No music found. Try another search.';
    results.append(empty);
    return;
  }
  songs.forEach(song => results.append(songCard(song)));
}

async function searchSongs(query: string) {
  const q = query.trim();
  if (!q) return;
  heading.textContent = q;
  status.textContent = 'Searching…';
  results.innerHTML = `<div class='empty glass'>Finding music…</div>`;
  try {
    const response = await api.get('/api/search', { q });
    render((response.data?.songs ?? []) as Song[]);
  } catch {
    status.textContent = 'Error';
    results.innerHTML = `<div class='empty glass error'>Couldn’t load songs right now. Please try again.</div>`;
  }
}

function playSong(song: Song) {
  current = song;
  mini.classList.add('show');
  miniImg.src = song.thumbnail;
  miniTitle.textContent = song.title;
  miniMeta.textContent = song.channel;
  openPlayer();
}

function openPlayer() {
  if (!current) return;
  frame.src = `https://www.youtube.com/embed/${current.id}?autoplay=1&playsinline=1&rel=0`;
  playerTitle.textContent = current.title;
  playerMeta.textContent = current.channel;
  overlay.classList.add('show');
}

function closePlayer() {
  overlay.classList.remove('show');
  frame.src = '';
}

document.querySelector<HTMLButtonElement>('#search')!.addEventListener('click', () => searchSongs(input.value));
input.addEventListener('keydown', event => {
  if (event.key === 'Enter') searchSongs(input.value);
});
document.querySelectorAll<HTMLButtonElement>('.chip').forEach(chip =>
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(item => item.classList.remove('active'));
    chip.classList.add('active');
    const q = chip.dataset.query ?? '';
    input.value = q;
    searchSongs(q);
  })
);
document.querySelector<HTMLButtonElement>('#openPlayer')!.addEventListener('click', openPlayer);
document.querySelector<HTMLButtonElement>('#closePlayer')!.addEventListener('click', closePlayer);
overlay.addEventListener('click', event => {
  if (event.target === overlay) closePlayer();
});
void searchSongs('trending music');
