const cfg = window.__APP_CONFIG__ || {};
const workerBaseUrl = (cfg.workerBaseUrl || "").replace(/\/$/, "");

const elSampleImg = document.getElementById("sampleImg");
const elSampleMeta = document.getElementById("sampleMeta");
const btnRefreshSample = document.getElementById("btnRefreshSample");

const elPreviewImg = document.getElementById("previewImg");
const elPreviewMeta = document.getElementById("previewMeta");
const btnGeneratePreview = document.getElementById("btnGeneratePreview");
const btnCheckout = document.getElementById("btnCheckout");

let currentPreview = null;

if (!workerBaseUrl) {
  alert("config.js が未設定です。public/config.js に workerBaseUrl を設定してください。");
}

async function api(path, init) {
  const res = await fetch(workerBaseUrl + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init && init.headers ? init.headers : {}),
    },
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  } else {
    const t = await res.text();
    if (!res.ok) throw new Error(t);
    return t;
  }
}

async function loadSample() {
  elSampleMeta.textContent = "loading...";
  try {
    const data = await api("/api/sample/latest", { method: "GET" });
    const s = data.sample;
    elSampleImg.src = workerBaseUrl + s.assetPath + "?t=" + Date.now();
    elSampleMeta.textContent = JSON.stringify(s, null, 2);
  } catch (e) {
    elSampleMeta.textContent = String(e);
    elSampleImg.removeAttribute("src");
  }
}

async function generatePreview() {
  elPreviewMeta.textContent = "generating...";
  btnCheckout.disabled = true;
  currentPreview = null;
  try {
    const data = await api("/api/preview", { method: "POST", body: JSON.stringify({}) });
    const p = data.preview;
    elPreviewImg.src = workerBaseUrl + p.assetPath + "?t=" + Date.now();
    elPreviewMeta.textContent = JSON.stringify(p, null, 2);
    currentPreview = p;
    btnCheckout.disabled = false;
  } catch (e) {
    elPreviewMeta.textContent = String(e);
    elPreviewImg.removeAttribute("src");
  }
}

async function checkout() {
  if (!currentPreview) return;
  btnCheckout.disabled = true;
  elPreviewMeta.textContent = "creating checkout session...";
  try {
    const data = await api("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ artworkId: currentPreview.artworkId }),
    });
    window.location.href = data.checkoutUrl;
  } catch (e) {
    elPreviewMeta.textContent = String(e);
    btnCheckout.disabled = false;
  }
}

btnRefreshSample.addEventListener("click", loadSample);
btnGeneratePreview.addEventListener("click", generatePreview);
btnCheckout.addEventListener("click", checkout);

loadSample();
