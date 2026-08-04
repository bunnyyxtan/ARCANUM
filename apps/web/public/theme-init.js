// Applies the persisted ARCANUM theme before first paint to avoid a flash.
(() => {
  try {
    if (localStorage.getItem("arcanum-theme") === "dark") {
      document.documentElement.classList.add("wl-dark");
    }
  } catch (_error) {
    /* storage unavailable — stay light */
  }
})();
