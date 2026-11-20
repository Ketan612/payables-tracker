(() => {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then((registration) => {
        registration.update().catch(() => {});
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("payables-app-update-available"));
            }
          });
        });
      })
      .catch((error) => console.warn("Payables Tracker offline shell registration failed:", error));
  });
})();