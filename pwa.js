(() => {
  if (!( "serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  let deferredInstallPrompt = null;
  let installBanner = null;
  let updateBanner = null;
  let refreshing = false;
  const hadControllerAtPageStart = Boolean(navigator.serviceWorker.controller);

  const addBannerStyles = () => {
    if (document.getElementById("payables-pwa-styles")) return;
    const style = document.createElement("style");
    style.id = "payables-pwa-styles";
    style.textContent = `
      .payables-pwa-banner{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:560px;margin:auto;padding:14px 16px;display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;background:#101827;color:#fff;border:1px solid #344256;border-radius:14px;box-shadow:0 12px 36px #10182735;font:14px system-ui,-apple-system,sans-serif}
      .payables-pwa-copy{flex:1;min-width:180px;line-height:1.45}.payables-pwa-copy strong{display:block;font-size:14px}.payables-pwa-copy span{display:block;color:#cbd5e1;font-size:12px;margin-top:2px}
      .payables-pwa-actions{display:flex;align-items:center;gap:8px}.payables-pwa-actions button{border:0;border-radius:8px;padding:9px 12px;font:600 13px system-ui;cursor:pointer}
      .payables-pwa-primary{background:#d8f2e8;color:#12382f}.payables-pwa-dismiss{background:transparent;color:#e2e8f0;border:1px solid #64748b!important}
      .payables-pwa-banner button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
      @media(max-width:420px){.payables-pwa-banner{left:10px;right:10px;bottom:10px}.payables-pwa-actions{width:100%}.payables-pwa-actions button{flex:1}}
    `;
    document.head.appendChild(style);
  };

  const makeBanner = (message, actionLabel, onAction, dismissLabel = "Not now") => {
    addBannerStyles();
    const banner = document.createElement("aside");
    banner.className = "payables-pwa-banner";
    banner.setAttribute("role", "status");
    const copy = document.createElement("div");
    copy.className = "payables-pwa-copy";
    const strong = document.createElement("strong");
    strong.textContent = message.title;
    const detail = document.createElement("span");
    detail.textContent = message.detail;
    copy.append(strong, detail);

    const actions = document.createElement("div");
    actions.className = "payables-pwa-actions";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "payables-pwa-primary";
    action.textContent = actionLabel;
    action.addEventListener("click", onAction);
    actions.appendChild(action);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "payables-pwa-dismiss";
    dismiss.textContent = dismissLabel;
    dismiss.addEventListener("click", () => banner.remove());
    actions.appendChild(dismiss);

    banner.append(copy, actions);
    document.body.appendChild(banner);
    return banner;
  };

  const isIosSafari = () => {
    const ua = navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  };

  const showInstallPrompt = () => {
    if (installBanner || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return;
    if (deferredInstallPrompt) {
      installBanner = makeBanner(
        { title: "Install Payables Tracker", detail: "Add the app to your home screen for a dedicated app experience." },
        "Install",
        async () => {
          await deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice.catch(() => null);
          deferredInstallPrompt = null;
          installBanner?.remove();
          installBanner = null;
        }
      );
    } else if (isIosSafari()) {
      installBanner = makeBanner(
        { title: "Add Payables Tracker to your Home Screen", detail: "Tap Share, then choose Add to Home Screen. Open as Web App if offered." },
        "Got it",
        () => { installBanner?.remove(); installBanner = null; },
        "Dismiss"
      );
    }
  };

  const showUpdatePrompt = (registration) => {
    if (updateBanner || !registration.waiting) return;
    updateBanner = makeBanner(
      { title: "Update available", detail: "A newer version of Payables Tracker is ready. Your saved data stays in your account." },
      "Update now",
      () => {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      },
      "Later"
    );
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener("appinstalled", () => {
    installBanner?.remove();
    installBanner = null;
    deferredInstallPrompt = null;
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then((registration) => {
        registration.update().catch(() => {});
        if (registration.waiting && navigator.serviceWorker.controller) showUpdatePrompt(registration);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("payables-app-update-available"));
              showUpdatePrompt(registration);
            }
          });
        });
      })
      .catch((error) => console.warn("Payables Tracker offline shell registration failed:", error));

    if (!window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone) {
      setTimeout(showInstallPrompt, 1200);
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // First-time control should not interrupt the page. Reload only when an
    // already-controlled page receives an explicitly activated update.
    if (!hadControllerAtPageStart || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
})();