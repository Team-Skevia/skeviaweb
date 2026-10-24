document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

(() => {
  const composer = document.querySelector(".email-composer");
  if (!composer) return;

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = new FormData(composer);
    const subject = encodeURIComponent(draft.get("subject").trim());
    const body = encodeURIComponent(draft.get("body").replace(/\r?\n/g, "\r\n"));
    window.location.href = `${composer.action}?subject=${subject}&body=${body}`;
  });
})();

(() => {
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const hero = document.querySelector(".hero");
  const nav = document.querySelector(".nav");

  document.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent.trim();
    const word = document.createElement("span");
    word.setAttribute("aria-hidden", "true");
    [...text].forEach((ch, i) => {
      const char = document.createElement("span");
      char.className = "char";
      char.style.setProperty("--i", i);
      char.textContent = ch;
      word.append(char);
    });
    el.style.setProperty("--n", text.length);
    el.setAttribute("aria-label", text);
    el.replaceChildren(word);
  });

  // data-scroll="<f>": --p eases 0 -> 1 while the element's top travels from
  // the bottom of the viewport up to f * viewport height (default 0.62).
  const items = [...document.querySelectorAll("[data-scroll]")].map((el) => ({
    el,
    end: parseFloat(el.dataset.scroll) || 0.62,
    top: 0,
    delay: 0,
    span: 1,
    p: null,
  }));
  let heroHeight = 0;
  let maxScroll = 0;
  let heroP = null;

  function pageTop(el) {
    let top = 0;
    for (let n = el; n; n = n.offsetParent) top += n.offsetTop;
    return top;
  }

  function measure() {
    for (const item of items) item.top = pageTop(item.el);
    for (const item of items) {
      const row = items.filter(
        (o) => o.el.parentElement === item.el.parentElement && Math.abs(o.top - item.top) < 2
      );
      const stagger = row.length > 1 ? 0.3 : 0;
      item.delay = row.length > 1 ? (row.indexOf(item) / (row.length - 1)) * stagger : 0;
      item.span = 1 - stagger;
    }
    heroHeight = hero ? hero.offsetHeight : 0;
    maxScroll = root.scrollHeight - innerHeight;
    update();
  }

  function update() {
    if (!root.classList.contains("motion")) return;
    const y = scrollY;
    const vh = innerHeight;

    for (const item of items) {
      const length = vh * (1 - item.end);
      const end = Math.min(item.top - vh * item.end, maxScroll);
      const raw = (y - end + length) / length;
      const t = Math.min(Math.max((raw - item.delay) / item.span, 0), 1);
      const p = Math.round((1 - (1 - t) ** 3) * 1000) / 1000;
      if (p !== item.p) {
        item.p = p;
        item.el.style.setProperty("--p", p);
      }
    }

    const h = heroHeight ? Math.round(Math.min(Math.max(y / (heroHeight * 0.8), 0), 1) * 1000) / 1000 : 0;
    if (h !== heroP) {
      heroP = h;
      hero?.style.setProperty("--hp", h);
      nav?.style.setProperty("--nav", Math.min(Math.max((h - 0.25) / 0.35, 0), 1).toFixed(3));
    }
  }

  function toggle() {
    root.classList.toggle("motion", !still.matches);
    if (!still.matches) measure();
  }

  still.addEventListener("change", toggle);
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", measure);
  new ResizeObserver(() => measure()).observe(document.body);
  toggle();
})();

(() => {
  const menu = document.querySelector(".menu");
  const button = menu?.querySelector(".menu-button");
  if (!menu || !button) return;

  const setOpen = (open) => {
    menu.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!menu.classList.contains("is-open"));
  });
  menu.addEventListener("mouseenter", () => setOpen(true));
  menu.addEventListener("mouseleave", () => setOpen(false));
  menu.addEventListener("focusin", () => setOpen(true));
  menu.addEventListener("focusout", (event) => {
    if (!menu.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  });
})();
