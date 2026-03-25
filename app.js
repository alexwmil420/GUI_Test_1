const apiKey = "b264496a53fb043f51b9ec6ac3286120";

const input = document.getElementById("searchInput");
const results = document.getElementById("results");
const template = document.getElementById("movie-template");
const detailsContainer = document.getElementById("movieDetails");

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
      return;
    }

    if (cache.has(query)) {
      renderResults(cache.get(query), query);
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

  items.forEach(el => el.classList.remove("active"));

  if (items[activeIndex]) {
    items[activeIndex].classList.add("active");
  }
});

// SEARCH FUNCTION
async function search(query) {
  if (controller) controller.abort();

  controller = new AbortController();

  document.body.dataset.loading = "true";

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}`,
      { signal: controller.signal }
    );

    const data = await res.json();

    cache.set(query, data.results);

    renderResults(data.results, query);

  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
    }
  }

  document.body.dataset.loading = "false";
}

// RENDER RESULTS
function renderResults(movies, query) {

  if (!movies.length) {
    results.textContent = "No results found";
    return;
  }

  const frag = new DocumentFragment();

  movies.forEach(movie => {
    const clone = template.content.cloneNode(true);

    const item = clone.querySelector(".result-item");
    const title = clone.querySelector(".title");

    title.innerHTML = "";
    title.appendChild(buildHighlightedTitle(movie.title, query));

    item.addEventListener("click", () => {
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

  document.body.dataset.loading = "true";
  detailsContainer.innerHTML = "";

  const requests = [
    fetch(`${base}/movie/${movieId}?api_key=${apiKey}`).then(r => r.json()),

    //BREAK FOR DEMO
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

  document.body.dataset.loading = "false";
}

// RENDER DETAILS
function renderDetails(data) {
  const title = document.createElement("h2");
  title.textContent = data.title;

  const overview = document.createElement("p");
  overview.textContent = data.overview;

  const genres = document.createElement("p");
  genres.textContent = "Genres: " + data.genres.map(g => g.name).join(", ");

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

  detailsContainer.append(title, posterContainer, overview, genres);
}

// RENDER CREDITS
function renderCredits(data) {

  if (!data.cast) {
    showError("No cast data available");
    return;
  }

  const castTitle = document.createElement("h3");
  castTitle.textContent = "Cast";

  const list = document.createElement("ul");

  data.cast.slice(0, 5).forEach(actor => {
    const li = document.createElement("li");
    li.textContent = actor.name;
    list.appendChild(li);
  });

  detailsContainer.append(castTitle, list);
}

// RENDER VIDEOS
function renderVideos(data) {

  if (!data.results) {
    showError("No video data available");
    return;
  }

  const videoTitle = document.createElement("h3");
  videoTitle.textContent = "Trailer";

  const trailer = data.results.find(v => v.type === "Trailer");

  if (trailer) {
    const link = document.createElement("a");
    link.href = `https://www.youtube.com/watch?v=${trailer.key}`;
    link.textContent = "Watch Trailer";
    link.target = "_blank";

    detailsContainer.append(videoTitle, link);
  } else {
    showError("No trailer available");
  }
}

// ERROR DISPLAY
function showError(message) {
  const error = document.createElement("p");
  error.textContent = message;
  detailsContainer.appendChild(error);
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
