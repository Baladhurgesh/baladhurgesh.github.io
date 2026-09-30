document.getElementById("y").textContent = new Date().getFullYear();

const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    try {
      localStorage.setItem("bala-theme", theme);
    } catch {
      // private browsing
    }
  };

  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  themeToggle.setAttribute(
    "aria-label",
    current === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

const updated = document.getElementById("updated");
if (updated) {
  const d = new Date(document.lastModified);
  updated.textContent = d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", id);
  });
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion && "IntersectionObserver" in window) {
  const targets = document.querySelectorAll(".section, .hero");
  targets.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  targets.forEach((el) => io.observe(el));
}
