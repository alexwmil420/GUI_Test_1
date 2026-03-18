class SearchComponent {

  constructor() {
    this.apiKey = "b264496a53fb043f51b9ec6ac3286120";

    this.input = document.getElementById("searchInput");
    this.results = document.getElementById("results");
    this.template = document.getElementById("movie-template");

    this.cache = new Map();
    this.debounceTimer = null;
    this.controller = null;

    this.input.addEventListener("input", () => {
      clearTimeout(this.debounceTimer);

      this.debounceTimer = setTimeout(() => {
        const query = this.input.value.trim();

        if (!query) return;

        if (this.cache.has(query)) {
          this.renderResults(this.cache.get(query), query);
          return;
        }

        this.search(query);
      }, 300);
    });
  }

  async search(query) {
  if (this.controller) {
    this.controller.abort();
  }

  this.controller = new AbortController();

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${this.apiKey}&query=${query}`,
      { signal: this.controller.signal }
    );

    const data = await res.json();

    this.cache.set(query, data.results);

    this.renderResults(data.results, query);

  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Cancelled");
    } else {
      console.error(err);
    }
  }
}

  renderResults(movies, query) {
  const frag = new DocumentFragment();

  movies.forEach(movie => {
    const clone = this.template.content.cloneNode(true);

    const title = clone.querySelector(".title");
    title.textContent = movie.title;

    frag.appendChild(clone);
  });

  this.results.innerHTML = "";
  this.results.appendChild(frag);
 }
}

new SearchComponent();

