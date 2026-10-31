// ═══════════════════════════════════════════════════════════════
// ADS — signed-in WebDesks members never see ads.
//
// Loaded synchronously in <head> on every page in place of the AdSense
// tag. A saved Supabase session (account.js keeps it under
// "sb-webdesks-auth") marks the visitor as a member, so the page:
//   • never loads adsbygoogle.js — `adsbygoogle.push()` calls queue up
//     into a plain array and nothing is requested from Google,
//   • never starts the A-ADS iframes (their src lives in data-src),
//   • hides every ad slot and its "Advertisement" label.
// Guests get the ads as before. If account.js later finds the saved
// session has expired it calls wdAds.enable() and the ads load then.
// ═══════════════════════════════════════════════════════════════
(function () {
    var CLIENT = 'ca-pub-8626644983261966';
    var member = false;
    try { member = !!localStorage.getItem('sb-webdesks-auth'); } catch (e) {}
    var root = document.documentElement;
    var enabled = false;

    // Hide ad furniture for members before anything paints.
    var css = document.createElement('style');
    css.textContent =
        '.wd-adfree ins.adsbygoogle,.wd-adfree .wd-ad,.wd-adfree #ad-panel,' +
        '.wd-adfree div:has(> iframe[data-aa]),.wd-adfree div:has(> ins.adsbygoogle){display:none!important}' +
        'html:not(.wd-adfree) .wd-adfree-only{display:none!important}' +
        '.wd-adfree .wd-guest-only{display:none!important}';
    (document.head || root).appendChild(css);

    window.adsbygoogle = window.adsbygoogle || [];

    function startAAds() {
        var frames = document.querySelectorAll('iframe[data-aa][data-src]');
        for (var i = 0; i < frames.length; i++) {
            frames[i].src = frames[i].getAttribute('data-src');
            frames[i].removeAttribute('data-src');
        }
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        root.classList.remove('wd-adfree');
        window.WD_ADFREE = false;
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
        (document.head || root).appendChild(s);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAAds);
        else startAAds();
    }

    window.wdAds = {
        enable: enable,
        // Members: called after sign-in is confirmed (keeps ads off).
        disable: function () { if (!enabled) { root.classList.add('wd-adfree'); window.WD_ADFREE = true; } },
        get adFree() { return !enabled; }
    };

    if (member) {
        root.classList.add('wd-adfree');
        window.WD_ADFREE = true;
    } else {
        enable();
    }
})();
