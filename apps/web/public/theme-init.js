// Applies the persisted theme before first paint to avoid a flash of the wrong theme.
try {
  if (localStorage.getItem("arcanum-theme") === "dark") {
    document.documentElement.classList.add("wl-dark", "dark");
  }
} catch (_e) {
  // localStorage unavailable (e.g. privacy mode) — fall back to light theme.
}
