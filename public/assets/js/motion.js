/**
 * PRISE MMA — Le mouvement du site.
 *
 * Trois règles :
 * 1. Le contenu est visible par défaut. La classe .motion est posée par ce
 *    script — JavaScript coupé, la page reste lisible.
 * 2. Le mouvement informe, il ne décore pas.
 * 3. Les fonctions essentielles utilisent les API natives du navigateur.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll('[data-news-freshness]').forEach(function (el) {
    var timestamp = Date.parse(el.getAttribute('data-news-freshness'));
    if (!isFinite(timestamp) || Date.now() - timestamp > 72 * 3600000) {
      el.textContent = 'Dernière édition · nouvelles en attente';
      el.classList.add('stale-edition');
    }
  });
  document.querySelectorAll('[data-news-source]').forEach(function (el) {
    var timestamp = Date.parse(el.getAttribute('data-news-source'));
    if (!isFinite(timestamp) || Date.now() - timestamp > 72 * 3600000) {
      var label = el.querySelector('.kicker');
      if (label) label.textContent = 'Archive · ' + label.textContent.replace(/^À la une · /, '');
    }
  });
  if (!reduit && 'IntersectionObserver' in window) {

  root.classList.add("motion");

  /* Lenis retiré. Un blog d'actualité se parcourt vite — le scroll
     natif est plus rapide, plus prévisible, et ne piège personne. */

  /* -------------------------------------------------------- REVEALS
   * Les blocs ne s'estompent pas : ils se découvrent. Un fondu dit
   * "ceci apparaît" ; un dévoilement par le bas dit "ceci était là,
   * tu y arrives" — ce qui est vrai d'un article qu'on fait défiler. */
  var cibles = document.querySelectorAll("[data-reveal]");
  if (cibles.length) {
    var io = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          var freres = el.parentElement ? el.parentElement.children : [];
          var rang = 0;
          for (var i = 0; i < freres.length && freres[i] !== el; i++) {
            if (freres[i].hasAttribute && freres[i].hasAttribute("data-reveal")) rang++;
          }
          el.style.transitionDelay = Math.min(rang, 5) * 65 + "ms";
          el.classList.add("shown");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
    );
    cibles.forEach(function (el) { io.observe(el); });

    /* Filet : un bloc jamais observé redevient visible au bout de 3s. */
    window.setTimeout(function () {
      document.querySelectorAll("[data-reveal]:not(.shown)").forEach(function (el) {
        el.classList.add("shown");
      });
    }, 3000);
  }

  /* --------------------------------------------------- REVEAL GROUPS
   * Enfants d'un [data-reveal-group] se révèlent en cascade. */
  var groupes = document.querySelectorAll("[data-reveal-group]");
  if (groupes.length) {
    var iog = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("shown");
        iog.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    groupes.forEach(function (g) { iog.observe(g); });
  }

  /* ------------------------------------------------- REVEAL MASKS
   * Textes qui montent de derrière un clip. L'entrée du héros. */
  var masks = document.querySelectorAll(".reveal-mask > span");
  if (masks.length && window.gsap) {
    gsap.set(masks, { yPercent: 110 });
    var tl = gsap.timeline({ delay: 0.3 });
    masks.forEach(function (m, i) {
      tl.to(m, { yPercent: 0, duration: 0.8, ease: "power3.out" }, i * 0.12);
    });
  }

  /* ------------------------------------------------------- COMPTEURS
   * Le corpus est l'argument du site. Ticking dynamique avec suspense
   * arena fight-night et seuil d'intersection optimisé pour mobile. */
  var compteurs = Array.from(document.querySelectorAll("[data-compte]"));
  if (compteurs.length) {
    var ioc = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        ioc.unobserve(el);
        var cible = parseInt(el.getAttribute("data-compte"), 10);
        if (!cible) return;

        var card = el.closest(".compteur");
        var idx = compteurs.indexOf(el);
        var debut = performance.now();
        var duree = 1100 + idx * 150; // Décalage pour suspense dramatique

        if (card) card.classList.add("is-ticking");
        el.classList.add("is-counting");

        (function pas(t) {
          var p = Math.min(1, (t - debut) / duree);
          // Courbe d'accélération puis freinage net façon chronomètre
          var ease = 1 - Math.pow(1 - p, 4);
          var val = Math.floor(cible * ease);

          // Effet de brouillage/suspense avant fixation
          if (p < 0.6) {
            el.textContent = Math.floor(Math.random() * (cible + 5));
          } else {
            el.textContent = val;
          }

          if (p < 1) {
            requestAnimationFrame(pas);
          } else {
            el.textContent = cible;
            el.classList.remove("is-counting");
            if (card) {
              card.classList.remove("is-ticking");
              card.classList.add("is-locked");
            }
          }
        })(debut);
      });
    }, { threshold: 0.15 });

    compteurs.forEach(function (el) { ioc.observe(el); });
  }

  /* ------------------------------------------------------- COUNTDOWN
   * Calcule dans le navigateur, pas au build. */
  var countdownEl = document.querySelector("[data-countdown]");
  if (countdownEl) {
    var cibleDate = new Date(countdownEl.getAttribute("data-countdown")).getTime();
    if (!isNaN(cibleDate)) {
      function ecrire() {
        var reste = cibleDate - Date.now();
        if (reste <= 0) { countdownEl.textContent = "Date passée"; return true; }
        var j = Math.floor(reste / 864e5);
        countdownEl.textContent = "J−" + j;
        return false;
      }
      if (!ecrire()) window.setInterval(ecrire, 60000);
    }
  }

  /* ------------------------------------------------ TICKER DUPLICATE
   * Double le contenu du ticker pour une boucle CSS sans saut. */
  var tickerRun = document.querySelector(".ticker__run");
  if (tickerRun) {
    tickerRun.innerHTML += tickerRun.innerHTML;
  }

  /* --------------------------------------------- MAGNETIC BUTTONS
   * Le bouton suit le curseur — un geste qui dit "je suis vivant". */
  document.querySelectorAll("[data-magnetic]").forEach(function (btn) {
    btn.addEventListener("mousemove", function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = "translate(" + x * 0.25 + "px," + y * 0.25 + "px)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.transform = "";
      btn.style.transition = "transform 0.4s cubic-bezier(0.16,1,0.3,1)";
      setTimeout(function () { btn.style.transition = ""; }, 400);
    });
  });

  /* -------------------------------------------------- BACK TO TOP */
  var btt = document.querySelector(".back-to-top");
  if (btt) {
    window.addEventListener("scroll", function () {
      btt.classList.toggle("visible", window.scrollY > 600);
    }, { passive: true });
  }

  }
  /* -------------------------------------------- MOBILE MENU TOGGLE */
  var burger = document.querySelector("[data-menu]");
  var drawer = document.querySelector("[data-drawer]");
  var closer = document.querySelector("[data-close]");
  if (burger && drawer) {
    function closeMenu(restoreFocus) {
      drawer.hidden = true;
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (restoreFocus) burger.focus();
    }
    burger.addEventListener("click", function () {
      var open = drawer.hidden;
      if (!open) { closeMenu(true); return; }
      drawer.hidden = false;
      burger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      if (closer) closer.focus();
    });
    if (closer) {
      closer.addEventListener("click", function () {
        closeMenu(true);
      });
    }
    drawer.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
      if (event.key !== "Tab") return;
      var controls = Array.from(drawer.querySelectorAll('a[href],button:not([disabled])'));
      var first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        closeMenu(false);
      });
    });
  }

  /* ----------------------------------------- COMPACT HEADER ON SCROLL */
  var header = document.querySelector("body > header");
  if (header) {
    var lastY = 0;
    window.addEventListener("scroll", function () {
      header.classList.toggle("is-compact", window.scrollY > 80);
      lastY = window.scrollY;
    }, { passive: true });
  }

  /* ---------------------------------------------- CAGE WIRE PARALLAX
   * L'octogone tourne lentement au scroll — CSS scroll-timeline si
   * supporté, sinon GSAP ScrollTrigger. */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll(".cage-wire__svg").forEach(function (svg) {
      gsap.to(svg, {
        rotation: 90,
        ease: "none",
        scrollTrigger: {
          trigger: svg.closest(".cage-wire"),
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      });
    });
  }

  /* --------------------------------------------- SPLIT-LIST TOUCH & SCROLL MOTION
   * Sur mobile/tactile, les lignes s'animent au défilement (scroll-spy au centre de l'écran)
   * et au tap, évitant le piège du hover absent sur smartphone. */
  var splitRows = Array.from(document.querySelectorAll(".split-list .row"));
  if (splitRows.length) {
    var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(max-width: 768px)").matches;

    if (isTouchDevice) {
      var scrollTicking = false;
      function updateMobileRows() {
        var vCenter = window.innerHeight * 0.5;
        var closest = null;
        var closestDist = Infinity;

        splitRows.forEach(function (r) {
          var rect = r.getBoundingClientRect();
          if (rect.bottom > 60 && rect.top < window.innerHeight - 60) {
            var center = rect.top + rect.height / 2;
            var dist = Math.abs(center - vCenter);
            if (dist < closestDist) {
              closestDist = dist;
              closest = r;
            }
          }
        });

        if (closest && closestDist < 140) {
          splitRows.forEach(function (r) {
            if (r === closest) {
              r.classList.add("is-in-view");
            } else {
              r.classList.remove("is-in-view");
            }
          });
        }
        scrollTicking = false;
      }

      window.addEventListener("scroll", function () {
        if (!scrollTicking) {
          requestAnimationFrame(updateMobileRows);
          scrollTicking = true;
        }
      }, { passive: true });

      // Tap direct
      splitRows.forEach(function (row) {
        row.addEventListener("touchstart", function () {
          splitRows.forEach(function (r) { r.classList.remove("is-in-view"); });
          row.classList.add("is-in-view");
        }, { passive: true });
      });

      // Évaluation initiale
      setTimeout(updateMobileRows, 150);
    } else {
      // Sur ordinateur : hover de haute précision 60fps
      splitRows.forEach(function (row) {
        row.addEventListener("mouseenter", function () {
          splitRows.forEach(function (r) { if (r !== row) r.classList.remove("is-active"); });
          row.classList.add("is-active");
        });
        row.addEventListener("mouseleave", function () {
          row.classList.remove("is-active");
        });
      });
    }
  }

})();
