// Highlights the current section in the sticky "Përmbajtja" rail as the
// reader scrolls through a module, and auto-scrolls the rail to keep the
// active item in view.
(function () {
  function init() {
    var headings = Array.prototype.slice.call(
      document.querySelectorAll('.doc-body h1[id], .doc-body h2[id]')
    );
    var rail = document.querySelector('.toc-rail');
    if (!headings.length || !rail) return;

    var linkMap = new Map();
    rail.querySelectorAll('a[href^="#"]').forEach(function (a) {
      linkMap.set(a.getAttribute('href').slice(1), a);
    });
    if (!linkMap.size) return;

    var activeLink = null;
    var THRESHOLD = 96; // px from top of viewport (below the sticky topbar)

    function setActive(id) {
      var link = linkMap.get(id);
      if (!link || link === activeLink) return;
      if (activeLink) activeLink.classList.remove('active');
      link.classList.add('active');
      activeLink = link;
      var railRect = rail.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      if (linkRect.top < railRect.top || linkRect.bottom > railRect.bottom) {
        link.scrollIntoView({ block: 'nearest' });
      }
    }

    // "Current section" = the last heading whose top has scrolled up past
    // THRESHOLD. Recomputed directly from live positions on every scroll,
    // rather than relying on IntersectionObserver enter/exit events, so it
    // stays correct even after a large jump that skips several headings.
    function recompute() {
      var current = headings[0];
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= THRESHOLD) {
          current = headings[i];
        } else {
          break;
        }
      }
      setActive(current.id);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        recompute();
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    recompute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
