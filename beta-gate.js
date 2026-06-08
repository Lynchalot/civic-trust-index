/* ============================================================
   PRIVATE BETA GATE  —  REMOVE BEFORE PUBLIC LAUNCH
   To go public: delete the <script src="beta-gate.js"> line in
   index.html (and, if you like, delete this file). That removes
   both the password screen and the noindex tag in one step.

   Default password: tokyo-wallet
   To change it: update the PASSWORD value below.

   Note: this is a soft gate, not real security. It keeps casual
   visitors and search engines out during the preview; a determined
   technical user could bypass it. That's fine — the site is going
   public anyway.

   Note: crypto.subtle only works on HTTPS, so we use a plain
   comparison here instead. Fine for a soft gate.
   ============================================================ */
(function () {
  var PASSWORD = "tokyo-wallet";

  // Keep the preview out of search results while gated.
  var noindex = document.createElement("meta");
  noindex.name = "robots";
  noindex.content = "noindex, nofollow";
  document.head.appendChild(noindex);

  try {
    if (localStorage.getItem("cti-beta") === "ok") return;
  } catch (e) {}

  var html =
    '<div style="max-width:380px;width:100%;padding:0 1.5rem;text-align:center;font-family:\'Space Grotesk\',system-ui,sans-serif">' +
      '<div style="font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:1.7rem;color:#e8dbb8;margin-bottom:.4rem">Civic Trust Index</div>' +
      '<div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.22em;color:#c87830;margin-bottom:1.6rem">Private preview</div>' +
      '<p style="font-size:.8rem;color:#b0a898;line-height:1.6;margin-bottom:1.4rem">This site is in invite-only preview. Enter the password you were given to take a look.</p>' +
      '<input id="bg-pw" type="password" placeholder="Password" autocomplete="off" ' +
        'style="width:100%;box-sizing:border-box;background:#1c1a22;border:1px solid #38364a;color:#e8dbb8;' +
        'padding:.6rem .8rem;border-radius:5px;font-family:inherit;font-size:.85rem;margin-bottom:.7rem;outline:none">' +
      '<button id="bg-go" style="width:100%;background:#c87830;border:none;color:#0d0c0f;font-weight:600;' +
        'padding:.6rem;border-radius:5px;font-family:inherit;font-size:.8rem;letter-spacing:.05em;cursor:pointer">Enter</button>' +
      '<div id="bg-err" style="height:1rem;margin-top:.6rem;font-size:.7rem;color:#c0392b;opacity:0;transition:opacity .15s">Incorrect password</div>' +
    '</div>';

  var ov = document.createElement("div");
  ov.id = "beta-gate";
  ov.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:99999;background:#0d0c0f;display:flex;" +
      "align-items:center;justify-content:center;"
  );
  ov.innerHTML = html;

  function mount() {
    document.body.appendChild(ov);
    document.documentElement.style.overflow = "hidden";
    var input = document.getElementById("bg-pw");
    var btn = document.getElementById("bg-go");
    var err = document.getElementById("bg-err");
    if (input) input.focus();

    function attempt() {
      var val = input.value || "";
      if (val === PASSWORD) {
        try {
          localStorage.setItem("cti-beta", "ok");
        } catch (e) {}
        document.documentElement.style.overflow = "";
        ov.remove();
      } else {
        err.style.opacity = "1";
        input.value = "";
        input.focus();
      }
    }

    btn.addEventListener("click", attempt);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") attempt();
    });
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
