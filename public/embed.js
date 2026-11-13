/*! Ashoka Map embed helper — responsive height for <iframe data-ashoka-map>. ~1KB, no dependencies. */
(function () {
  var sel = 'iframe[data-ashoka-map]';
  function size(f) {
    var w = f.getBoundingClientRect().width || f.parentNode.clientWidth;
    var vh = window.innerHeight || 800;
    var h = w >= 600 ? 840 : Math.min(Math.max(vh * 0.9, 640), 840);
    var min = parseInt(f.getAttribute('data-min-height') || '0', 10);
    f.style.height = Math.max(h, min) + 'px';
  }
  function all() { Array.prototype.forEach.call(document.querySelectorAll(sel), size); }
  window.addEventListener('message', function (e) {
    var d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || d.sender !== 'AshokaMap' || d.method !== 'resize') return;
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (f) {
      if (f.contentWindow === e.source && d.height > 0) f.style.height = d.height + 'px';
    });
  });
  window.addEventListener('resize', all);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
