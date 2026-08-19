const shellElement = document.querySelector("#app-shell");
const loadingElement = document.querySelector("#app-loading");
const contentElement = document.querySelector("#app-content");

try {
  await import("./app.js");
  contentElement.hidden = false;
  loadingElement.hidden = true;
  shellElement.setAttribute("aria-busy", "false");
} catch (error) {
  console.error("Failed to load the Strule example.", error);
  shellElement.setAttribute("aria-busy", "false");
  loadingElement.dataset.state = "error";
  loadingElement.innerHTML = `
    <div>
      <strong>Could not load <code>@strule/core</code></strong>
      <span>Check your connection and try again.</span>
      <button class="button" id="retry-loading" type="button">Retry</button>
    </div>`;
  document.querySelector("#retry-loading").addEventListener("click", () => window.location.reload());
}
