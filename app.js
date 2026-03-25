const apiKey = "b264496a53fb043f51b9ec6ac3286120";

const input = document.getElementById("searchInput");
const results = document.getElementById("results");
const template = document.getElementById("movie-template");
const detailsContainer = document.getElementById("movieDetails");
const detailsEmpty = document.getElementById("detailsEmpty");
const header = document.querySelector(".header");
const statusBar = document.getElementById("statusBar");

const cache = new Map();

let debounceTimer = null;
let controller = null;
let activeIndex = -1;

// INPUT (DEBOUNCE)
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const query = input.value.trim();

    activeIndex = -1;

    if (!query) {
      results.innerHTML = "";
      detailsEmpty.style.display = "flex";
      detailsContainer.innerHTML = "";
      statusBar.textContent = "READY";
      return;
    }

    if (cache.has(query)) {
      renderResults(cache.get(query), query);
      statusBar.textContent = "CACHE HIT";
      return;
    }

    search(query);
  }, 300);
});

// KEYBOARD NAVIGATION
input.addEventListener("keydown", (e) => {
  const items = results.querySelectorAll(".result-item");

  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
  }

  if (e.key === "Enter") {
    items[activeIndex]?.click();
  }

  if (e.key === "Escape") {
    input.value = "";
    results.innerHTML = "";
    detailsEmpty.style.display = "flex";
    detailsContainer.innerHTML = "";
    statusBar.textContent = "READY";
    return;
  }

  items.forEach(el => el.classList.remove("active"));

  if (items[activeIndex]) {
    items[activeIndex].classList.add("active");
  }
});

// SEARCH FUNCTION
async function search(query) {
  if (controller) controller.abort();

  controller = new AbortController();

  header.dataset.loading = "true";

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}`,
      { signal: controller.signal }
    );

    const data = await res.json();

    cache.set(query, data.results);

    renderResults(data.results, query);
    statusBar.textContent = `${data.results.length} RESULTS · NETWORK`;

  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      statusBar.textContent = "ERROR";
    }
  }

  header.dataset.loading = "false";
}

// RENDER RESULTS
function renderResults(movies, query) {

  if (!movies.length) {
    results.innerHTML = "<li style='padding: 20px; text-align: center; color: var(--text-muted); grid-column: 1/-1;'>No results found</li>";
    return;
  }

  const frag = new DocumentFragment();

  movies.forEach((movie, idx) => {
    const clone = template.content.cloneNode(true);

    const item = clone.querySelector(".result-item");
    const titleEl = clone.querySelector(".result-title");
    const meta = clone.querySelector(".result-meta");
    const rating = clone.querySelector(".result-rating");

    titleEl.innerHTML = "";
    titleEl.appendChild(buildHighlightedTitle(movie.title, query));
    
    meta.textContent = `${movie.release_date?.slice(0, 4) || "N/A"} · ${movie.vote_average || "N/A"}★`;
    rating.textContent = `★ ${(movie.vote_average || 0).toFixed(1)}`;

    item.addEventListener("click", () => {
      activeIndex = idx;
      document.querySelectorAll(".result-item").forEach((el, i) => {
        el.classList.toggle("active", i === idx);
      });
      loadMovieDetails(movie.id);
    });

    frag.appendChild(clone);
  });

  results.innerHTML = "";
  results.appendChild(frag);
}


// LOAD MOVIE DETAILS
async function loadMovieDetails(movieId) {
  const base = "https://api.themoviedb.org/3";

  header.dataset.loading = "true";
  detailsEmpty.style.display = "none";
  detailsContainer.innerHTML = "";

  const requests = [
    fetch(`${base}/movie/${movieId}?api_key=${apiKey}`).then(r => r.json()),
    fetch(`${base}/movie/${movieId}/credits?api_key=${apiKey}`).then(r => r.json()),
    fetch(`${base}/movie/${movieId}/videos?api_key=${apiKey}`).then(r => r.json())
  ];

  const [details, credits, videos] = await Promise.allSettled(requests);

  if (details.status === "fulfilled") {
    renderDetails(details.value);
  } else {
    showError("Details failed to load");
  }

  if (credits.status === "fulfilled") {
    renderCredits(credits.value);
  } else {
    showError("Credits failed to load");
  }

  if (videos.status === "fulfilled") {
    renderVideos(videos.value);
  } else {
    showError("Videos failed to load");
  }

  detailsContainer.classList.add("visible");
  header.dataset.loading = "false";
}

// RENDER DETAILS
function renderDetails(data) {
  const header = document.createElement("div");
  header.className = "detail-header";

  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = data.title;

  const meta = document.createElement("div");
  meta.className = "detail-meta";

  const yearTag = document.createElement("span");
  yearTag.className = "detail-tag";
  yearTag.textContent = data.release_date?.slice(0, 4) || "N/A";
  meta.appendChild(yearTag);

  if (data.genres && data.genres.length) {
    data.genres.slice(0, 3).forEach(g => {
      const tag = document.createElement("span");
      tag.className = "detail-tag";
      tag.textContent = g.name;
      meta.appendChild(tag);
    });
  }

  header.appendChild(title);
  header.appendChild(meta);

  const overview = document.createElement("p");
  overview.className = "detail-overview";
  overview.textContent = data.overview || "No overview available";

  // ADD POSTER IMAGE
  const posterContainer = document.createElement("div");
  posterContainer.className = "poster-container";
  
  if (data.poster_path) {
    const poster = document.createElement("img");
    poster.src = `https://image.tmdb.org/t/p/w300${data.poster_path}`;
    poster.alt = data.title;
    poster.className = "movie-poster";
    posterContainer.appendChild(poster);
  }

  const sections = document.createElement("div");
  sections.className = "detail-sections";
  sections.id = "detail-sections";

  detailsContainer.appendChild(header);
  if (posterContainer.querySelector("img")) {
    detailsContainer.appendChild(posterContainer);
  }
  detailsContainer.appendChild(overview);
  detailsContainer.appendChild(sections);
}

// RENDER CREDITS
function renderCredits(data) {
  const sections = document.getElementById("detail-sections");
  
  if (!data.cast || !data.cast.length) {
    return;
  }

  const section = document.createElement("div");
  section.className = "detail-section";

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "Cast";

  const list = document.createElement("div");
  list.className = "cast-list";

  data.cast.slice(0, 6).forEach(actor => {
    const item = document.createElement("div");
    item.className = "cast-item";

    const avatar = document.createElement("div");
    avatar.className = "cast-avatar";
    avatar.textContent = actor.name[0];

    const name = document.createElement("div");
    name.className = "cast-name";
    name.textContent = actor.name;

    const char = document.createElement("div");
    char.className = "cast-character";
    char.textContent = actor.character || "—";

    item.appendChild(avatar);
    item.appendChild(name);
    item.appendChild(char);
    list.appendChild(item);
  });

  section.appendChild(title);
  section.appendChild(list);
  sections.appendChild(section);
}

// RENDER VIDEOS
function renderVideos(data) {
  const sections = document.getElementById("detail-sections");

  if (!data.results || !data.results.length) {
    return;
  }

  const section = document.createElement("div");
  section.className = "detail-section";

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "Trailer";

  const trailer = data.results.find(v => v.type === "Trailer");

  if (trailer) {
    const link = document.createElement("a");
    link.href = `https://www.youtube.com/watch?v=${trailer.key}`;
    link.target = "_blank";
    link.className = "trailer-link";
    link.textContent = "▶ Watch Trailer";

    section.appendChild(title);
    section.appendChild(link);
  } else {
    const msg = document.createElement("p");
    msg.className = "trailer-unavailable";
    msg.textContent = "Trailer unavailable";

    section.appendChild(title);
    section.appendChild(msg);
  }

  sections.appendChild(section);
}

// ERROR DISPLAY
function showError(message) {
  const sections = document.getElementById("detail-sections");
  if (!sections) return;
  
  const error = document.createElement("p");
  error.style.color = "var(--text-muted)";
  error.style.fontSize = "12px";
  error.style.fontStyle = "italic";
  error.textContent = message;
  sections.appendChild(error);
}

// SAFE HIGHLIGHT 
function buildHighlightedTitle(title, query) {
  const container = document.createElement("span");

  const idx = title.toLowerCase().indexOf(query.toLowerCase());

  if (idx === -1) {
    container.textContent = title;
    return container;
  }

  const before = document.createTextNode(title.slice(0, idx));

  const match = document.createElement("span");
  match.className = "highlight";
  match.textContent = title.slice(idx, idx + query.length);

  const after = document.createTextNode(
    title.slice(idx + query.length)
  );

  container.append(before, match, after);

  return container;
}
