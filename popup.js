const scanButton = document.getElementById("scan");
const downloadSelectedButton = document.getElementById("download-selected");
const downloadZipButton = document.getElementById("download-zip");
const selectAllCheckbox = document.getElementById("select-all");
const statusElement = document.getElementById("status");
const countElement = document.getElementById("count");
const imagesElement = document.getElementById("images");
const themeToggle = document.getElementById("theme-toggle");
const downloadFolderInput = document.getElementById("download-folder");
const saveFolderButton = document.getElementById("save-folder");
const pageLinksInput = document.getElementById("page-links");

let scannedImages = [];
let theme = "light";
let downloadFolder = "images";
let hasScanned = false;
let scannedLinkText = "";
let scanStatus = { key: "scanReady", values: {} };
let scanStateTimer;

const translations = {
  en: {
    documentTitle: "Scan and download images",
    heading: "Images on this page",
    scan: "Scan images",
    switchToDarkTheme: "Switch to dark theme",
    switchToLightTheme: "Switch to light theme",
    downloadFolder: "Image download folder",
    folderPlaceholder: "images",
    folderHint: "A subfolder in Downloads; nested folders are supported, e.g. images/site.",
    saveFolder: "Save",
    folderSaved: "Image download folder saved.",
    folderInvalid: "Enter a valid subfolder path; . and .. are not allowed.",
    preferencesLoadError: "Could not load preferences; using default settings.",
    folderSaveError: "Could not save the image download folder preference.",
    scanStateSaveError: "Could not save the current scan. Existing results are still available.",
    selectAll: "Select all",
    downloadSelected: "Download selected",
    downloadZip: "Download ZIP",
    pageLinks: "Website URLs (optional, one per line; leave blank for the current page)",
    linksPlaceholder: "https://example.com\nhttps://example.com/gallery",
    preparingZip: "Preparing ZIP archive…",
    zipPermissionDenied: "Access to image hosts was not granted; the ZIP was not created.",
    zipError: "Could not create the ZIP archive. Check site access and try again.",
    zipDownloaded: "ZIP download started.",
    imageList: "Image list",
    count: "{total} images · {selected} selected",
    scanReady: "Leave URLs blank to scan the current page, or paste URLs and click “Scan images”.",
    linksChanged: "URL list changed. Click “Scan images” to scan it; previous results were cleared.",
    scanning: "Scanning pages…",
    scanPrompt: "Select the images you want to download.",
    noImages: "No images found on the selected pages.",
    scanError: "Could not scan this page. Try a regular website.",
    invalidLinks: "Enter valid http or https website links, one per line.",
    permissionDenied: "Site access was not granted, so the links could not be scanned.",
    scanSummary: "Found {images} images on {pages} pages. {failed} pages could not be scanned.",
    image: "Image",
    srcset: "Image from srcset",
    background: "Background image",
    chooseImage: "Select image {index}",
    downloadImage: "Download image {index}",
    download: "Download",
    downloading: "Downloading",
    downloaded: "Downloaded",
    downloadError: "Error",
    downloadingSelected: "Downloading {count} images…",
    downloadSummary: "Download requests sent for {success}/{total} selected images."
  }
};

function translate(key, values = {}) {
  const message = translations.en[key] || key;
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  );
}

function localizeElement(element) {
  if (element.dataset.i18n) element.textContent = translate(element.dataset.i18n);
  if (element.dataset.i18nTitle) element.title = translate(element.dataset.i18nTitle);
  if (element.dataset.i18nPlaceholder) {
    element.placeholder = translate(element.dataset.i18nPlaceholder);
  }
  if (element.dataset.i18nAriaLabel) {
    element.setAttribute(
      "aria-label",
      translate(element.dataset.i18nAriaLabel, { index: element.dataset.imageIndex })
    );
  }
}

function renderStatuses() {
  statusElement.textContent = translate(scanStatus.key, scanStatus.values);
}

function setScanStatus(key, values = {}) {
  scanStatus = { key, values };
  statusElement.textContent = translate(key, values);
}

function applyEnglish() {
  document.documentElement.lang = "en";
  document.querySelectorAll(
    "[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-aria-label]"
  )
    .forEach(localizeElement);
  renderStatuses();
  if (hasScanned) updateSelection();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const switchKey = theme === "light" ? "switchToDarkTheme" : "switchToLightTheme";
  themeToggle.title = translate(switchKey);
  themeToggle.setAttribute("aria-label", translate(switchKey));
  themeToggle.querySelector('[data-theme-icon="moon"]').hidden = theme !== "light";
  themeToggle.querySelector('[data-theme-icon="sun"]').hidden = theme === "light";
}

async function initializePreferences() {
  try {
    const stored = await chrome.storage.local.get(["theme", "downloadFolder", "scanState"]);
    theme = stored.theme === "dark" ? "dark" : "light";
    downloadFolder = normalizeDownloadFolder(stored.downloadFolder) || "images";
    downloadFolderInput.value = downloadFolder;
    restoreScanState(stored.scanState);
  } catch (error) {
    console.error("Could not load popup preferences:", error);
    theme = "light";
    downloadFolder = "images";
    downloadFolderInput.value = downloadFolder;
    scanStatus = { key: "preferencesLoadError", values: {} };
  }
  applyEnglish();
  applyTheme();
}

function restoreScanState(state) {
  if (!state || typeof state !== "object") {
    setScanStatus("scanReady");
    return;
  }
  pageLinksInput.value = typeof state.links === "string" ? state.links : "";
  scannedLinkText = typeof state.scannedLinkText === "string" ? state.scannedLinkText : "";
  scannedImages = Array.isArray(state.images)
    ? state.images.filter((image) => {
      if (!image || typeof image.url !== "string") return false;
      try {
        return ["http:", "https:", "data:", "blob:"].includes(new URL(image.url).protocol);
      } catch {
        return false;
      }
    })
    : [];
  hasScanned = Boolean(state.hasScanned);
  const linksChanged = hasScanned && scannedLinkText !== pageLinksInput.value;
  if (linksChanged) {
    scannedImages = [];
    hasScanned = false;
  }
  const savedStatus = state.status;
  if (
    !linksChanged &&
    savedStatus &&
    typeof savedStatus.key === "string" &&
    Object.prototype.hasOwnProperty.call(translations.en, savedStatus.key) &&
    !["scanning", "downloadingSelected"].includes(savedStatus.key)
  ) {
    scanStatus = { key: savedStatus.key, values: savedStatus.values || {} };
  } else if (linksChanged) {
    scanStatus = { key: pageLinksInput.value.trim() ? "linksChanged" : "scanReady", values: {} };
  } else {
    scanStatus = {
      key: hasScanned ? (scannedImages.length ? "scanPrompt" : "noImages") : "scanReady",
      values: {}
    };
  }
  scannedImages.forEach((image, index) => addImage(image, index));
  selectAllCheckbox.disabled = scannedImages.length === 0;
  if (hasScanned) updateSelection(false);
}

function persistScanState() {
  clearTimeout(scanStateTimer);
  scanStateTimer = setTimeout(async () => {
    try {
      await chrome.storage.local.set({
        scanState: {
          links: pageLinksInput.value,
          scannedLinkText,
          images: scannedImages.map((image) => ({
            ...image,
            selected: Boolean(image.selected)
          })),
          hasScanned,
          status: scanStatus
        }
      });
    } catch (error) {
      console.error("Could not save scan state:", error);
      setScanStatus("scanStateSaveError");
    }
  }, 150);
}

function normalizeDownloadFolder(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) return null;
  const segments = normalized.split("/").map((segment) => segment.trim());
  if (segments.some((segment) =>
    !segment || segment === "." || segment === ".." ||
    /[<>:"|?*\x00-\x1f]/.test(segment)
  )) return null;
  return segments.join("/");
}

function getFilename(url, index) {
  try {
    const parsedUrl = new URL(url);
    const name = decodeURIComponent(parsedUrl.pathname.split("/").pop() || "");
    const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
    return `${downloadFolder}/${safeName || `image-${index + 1}`}`;
  } catch {
    return `${downloadFolder}/image-${index + 1}`;
  }
}

async function downloadImage(image, index) {
  try {
    await chrome.downloads.download({
      url: image.url,
      filename: getFilename(image.url, index),
      conflictAction: "uniquify",
      saveAs: false
    });
    return true;
  } catch (error) {
    console.error("Could not download image:", image.url, error);
    return false;
  }
}

function addImage(image, index) {
  const item = document.createElement("li");
  item.className = "image-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "image-checkbox";
  checkbox.checked = Boolean(image.selected);
  checkbox.dataset.index = String(index);
  checkbox.dataset.i18nAriaLabel = "chooseImage";
  checkbox.dataset.imageIndex = String(index + 1);
  checkbox.setAttribute("aria-label", translate("chooseImage", { index: index + 1 }));
  checkbox.addEventListener("change", updateSelection);

  const preview = document.createElement("img");
  preview.src = image.url;
  preview.alt = "";
  preview.loading = "lazy";
  preview.referrerPolicy = "no-referrer";

  const info = document.createElement("div");
  info.className = "image-info";

  const title = document.createElement("strong");
  title.textContent = image.alt || image.url;
  title.title = image.url;

  const details = document.createElement("span");
  details.textContent = [image.dimensions || translate(image.kind), image.sourceName]
    .filter(Boolean)
    .join(" · ");
  details.title = image.sourceUrl || image.url;

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "item-download";
  downloadButton.dataset.i18n = "download";
  downloadButton.dataset.i18nAriaLabel = "downloadImage";
  downloadButton.dataset.imageIndex = String(index + 1);
  localizeElement(downloadButton);
  downloadButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    downloadButton.dataset.i18n = "downloading";
    localizeElement(downloadButton);
    const succeeded = await downloadImage(image, index);
    downloadButton.dataset.i18n = succeeded ? "downloaded" : "downloadError";
    localizeElement(downloadButton);
    if (!succeeded) downloadButton.disabled = false;
  });

  info.append(title, details);
  item.append(checkbox, preview, info, downloadButton);
  item.addEventListener("click", (event) => {
    if (
      event.target === checkbox ||
      event.target.closest(".item-download")
    ) return;
    checkbox.checked = !checkbox.checked;
    updateSelection();
  });
  localizeElement(checkbox);
  imagesElement.append(item);
}

function updateSelection(saveState = true) {
  const checkboxes = Array.from(imagesElement.querySelectorAll(".image-checkbox"));
  checkboxes.forEach((checkbox) => {
    const index = Number(checkbox.dataset.index);
    if (scannedImages[index]) scannedImages[index].selected = checkbox.checked;
    checkbox.closest(".image-item").classList.toggle("is-selected", checkbox.checked);
  });
  const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  selectAllCheckbox.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
  downloadSelectedButton.disabled = selectedCount === 0;
  downloadZipButton.disabled = selectedCount === 0;
  countElement.textContent = translate("count", {
    total: scannedImages.length,
    selected: selectedCount
  });
  if (saveState && hasScanned) persistScanState();
}

function extractImagesFromPage() {
  const found = new Map();
  const add = (rawUrl, image = {}, kind = "image") => {
    if (!rawUrl) return;
    let url;
    try {
      url = new URL(rawUrl, document.baseURI).href;
    } catch {
      return;
    }
    if (!["http:", "https:", "data:", "blob:"].includes(new URL(url).protocol)) return;
    if (!found.has(url)) {
      found.set(url, {
        url,
        alt: image.alt || "",
        dimensions: image.width && image.height ? `${image.width} × ${image.height}` : "",
        kind
      });
    }
  };

  for (const image of document.images) {
    add(image.currentSrc, image, "image");
    add(image.src, image, "image");
    for (const source of image.parentElement?.querySelectorAll("source[srcset]") || []) {
      for (const candidate of source.srcset.split(",")) {
        add(candidate.trim().split(/\s+/)[0], image, "srcset");
      }
    }
    for (const candidate of image.srcset.split(",")) {
      add(candidate.trim().split(/\s+/)[0], image, "srcset");
    }
  }

  for (const element of document.querySelectorAll("*")) {
    const background = getComputedStyle(element).backgroundImage;
    for (const match of background.matchAll(/url\((["']?)(.*?)\1\)/g)) {
      add(match[2], {}, "background");
    }
  }
  return Array.from(found.values());
}

function parsePageLinks() {
  const lines = pageLinksInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const urls = [];
  for (const line of lines) {
    try {
      const url = new URL(line);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        return null;
      }
      urls.push(url.href);
    } catch {
      return null;
    }
  }
  return Array.from(new Set(urls));
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      callback(value);
    };
    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(resolve, tab);
      }
    };
    const timeout = setTimeout(() => {
      finish(reject, new Error("Page load timed out."));
    }, 30000);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish(resolve, tab);
    }).catch((error) => finish(reject, error));
  });
}

function crc32(bytes) {
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, value) => {
    let entry = value;
    for (let bit = 0; bit < 8; bit += 1) {
      entry = (entry >>> 1) ^ ((entry & 1) ? 0xedb88320 : 0);
    }
    return entry >>> 0;
  }));
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  if (files.length > 0xffff) throw new Error("Too many files for a standard ZIP archive.");
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let centralSize = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const checksum = crc32(file.bytes);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    localParts.push(localHeader, name, file.bytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + file.bytes.length;
    centralSize += centralHeader.length + name.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

function archiveFilename(url, index) {
  let name = `image-${index + 1}`;
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "") || name;
  } catch {
    // Keep the generated fallback filename.
  }
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || `image-${index + 1}`;
  return `${downloadFolder}/${name}`;
}

async function findSourceTab() {
  try {
    const { sourceTabId } = await chrome.storage.local.get("sourceTabId");
    if (sourceTabId !== undefined) {
      try {
        return await chrome.tabs.get(sourceTabId);
      } catch {
        // The tab may have been closed after the scan window was opened.
      }
    }
  } catch (error) {
    console.error("Could not read the source tab:", error);
  }
  const activeTabs = await chrome.tabs.query({ active: true });
  return activeTabs.find((tab) => tab.id !== undefined && /^https?:/.test(tab.url || ""));
}

async function scanPage() {
  scannedImages = [];
  hasScanned = false;
  imagesElement.replaceChildren();
  countElement.textContent = "";
  setScanStatus("scanning");
  scanButton.disabled = true;
  pageLinksInput.disabled = true;
  selectAllCheckbox.disabled = true;
  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;
  downloadSelectedButton.disabled = true;

  try {
    const links = parsePageLinks();
    if (links === null) {
      setScanStatus("invalidLinks");
      return;
    }

    const sources = [];
    if (links.length) {
      const origins = Array.from(new Set(links.map((link) => `${new URL(link).origin}/*`)));
      const granted = await chrome.permissions.request({ origins });
      if (!granted) {
        setScanStatus("permissionDenied");
        return;
      }
      sources.push(...links.map((url) => ({ url })));
    } else {
      const tab = await findSourceTab();
      if (!tab || tab.id === undefined) throw new Error("Could not find the active webpage.");
      sources.push({ tabId: tab.id, url: tab.url || "" });
    }

    let failed = 0;
    for (const source of sources) {
      let temporaryTabId;
      try {
        let tabId = source.tabId;
        if (tabId === undefined) {
          const tab = await chrome.tabs.create({ url: source.url, active: false });
          if (tab.id === undefined) throw new Error("Could not open the website.");
          temporaryTabId = tab.id;
          tabId = tab.id;
          await waitForTabComplete(tabId);
        }
        const pageTab = await chrome.tabs.get(tabId);
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          func: extractImagesFromPage
        });
        const sourceUrl = pageTab.url || source.url;
        const sourceName = sourceUrl ? new URL(sourceUrl).hostname : "";
        for (const image of result?.result || []) {
          if (temporaryTabId !== undefined && image.url.startsWith("blob:")) continue;
          scannedImages.push({ ...image, sourceUrl, sourceName, selected: false });
        }
      } catch (error) {
        failed += 1;
        console.error("Could not scan website:", source.url, error);
      } finally {
        if (temporaryTabId !== undefined) {
          try {
            await chrome.tabs.remove(temporaryTabId);
          } catch (error) {
            console.error("Could not close temporary scan tab:", error);
          }
        }
      }
    }

    const uniqueImages = new Map();
    for (const image of scannedImages) {
      if (!uniqueImages.has(image.url)) uniqueImages.set(image.url, image);
    }
    scannedImages = Array.from(uniqueImages.values());
    hasScanned = true;
    scannedLinkText = pageLinksInput.value;
    if (sources.length > 1 || failed > 0) {
      setScanStatus("scanSummary", {
        images: scannedImages.length,
        pages: sources.length - failed,
        failed
      });
    } else {
      setScanStatus(scannedImages.length ? "scanPrompt" : "noImages");
    }
    selectAllCheckbox.disabled = scannedImages.length === 0;
    scannedImages.forEach(addImage);
    updateSelection(false);
    persistScanState();
  } catch (error) {
    console.error("Could not scan page:", error);
    setScanStatus("scanError");
  } finally {
    scanButton.disabled = false;
    pageLinksInput.disabled = false;
    persistScanState();
  }
}

scanButton.addEventListener("click", scanPage);
pageLinksInput.addEventListener("input", () => {
  scannedImages = [];
  hasScanned = false;
  imagesElement.replaceChildren();
  countElement.textContent = "";
  selectAllCheckbox.disabled = true;
  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;
  downloadSelectedButton.disabled = true;
  downloadZipButton.disabled = true;
  setScanStatus(pageLinksInput.value.trim() ? "linksChanged" : "scanReady");
  persistScanState();
});
themeToggle.addEventListener("click", async () => {
  const previousTheme = theme;
  theme = theme === "dark" ? "light" : "dark";
  themeToggle.disabled = true;
  applyTheme();
  try {
    await chrome.storage.local.set({ theme });
  } catch (error) {
    console.error("Could not save theme preference:", error);
    theme = previousTheme;
    applyTheme();
  } finally {
    themeToggle.disabled = false;
  }
});
saveFolderButton.addEventListener("click", async () => {
  const folder = normalizeDownloadFolder(downloadFolderInput.value);
  if (!folder) {
    setScanStatus("folderInvalid");
    downloadFolderInput.focus();
    return;
  }
  const previousFolder = downloadFolder;
  downloadFolder = folder;
  saveFolderButton.disabled = true;
  try {
    await chrome.storage.local.set({ downloadFolder });
    downloadFolderInput.value = downloadFolder;
    setScanStatus("folderSaved");
  } catch (error) {
    console.error("Could not save download folder preference:", error);
    downloadFolder = previousFolder;
    downloadFolderInput.value = previousFolder;
    setScanStatus("folderSaveError");
  } finally {
    saveFolderButton.disabled = false;
  }
});
selectAllCheckbox.addEventListener("change", () => {
  imagesElement.querySelectorAll(".image-checkbox").forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
  });
  updateSelection();
});
downloadSelectedButton.addEventListener("click", async () => {
  const selectedImages = Array.from(imagesElement.querySelectorAll(".image-checkbox:checked"))
    .map((checkbox) => Number(checkbox.dataset.index));
  if (selectedImages.length === 0) return;

  downloadSelectedButton.disabled = true;
  scanButton.disabled = true;
  selectAllCheckbox.disabled = true;
  imagesElement.querySelectorAll(".image-checkbox").forEach((checkbox) => {
    checkbox.disabled = true;
  });
  setScanStatus("downloadingSelected", { count: selectedImages.length });
  let succeeded = 0;
  for (const index of selectedImages) {
    if (await downloadImage(scannedImages[index], index)) succeeded += 1;
  }
  setScanStatus("downloadSummary", { success: succeeded, total: selectedImages.length });
  scanButton.disabled = false;
  selectAllCheckbox.disabled = false;
  imagesElement.querySelectorAll(".image-checkbox").forEach((checkbox) => {
    checkbox.disabled = false;
  });
  updateSelection();
});

downloadZipButton.addEventListener("click", async () => {
  const selectedImages = Array.from(imagesElement.querySelectorAll(".image-checkbox:checked"))
    .map((checkbox) => Number(checkbox.dataset.index))
    .map((index) => ({ image: scannedImages[index], index }))
    .filter(({ image }) => Boolean(image));
  if (selectedImages.length === 0) return;

  downloadZipButton.disabled = true;
  scanButton.disabled = true;
  downloadSelectedButton.disabled = true;
  try {
    const origins = Array.from(new Set(selectedImages
      .map(({ image }) => {
        try {
          const url = new URL(image.url);
          return ["http:", "https:"].includes(url.protocol) ? `${url.origin}/*` : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)));
    if (origins.length && !await chrome.permissions.request({ origins })) {
      setScanStatus("zipPermissionDenied");
      return;
    }

    setScanStatus("preparingZip");
    const files = [];
    const usedNames = new Set();
    for (const { image, index } of selectedImages) {
      const response = await fetch(image.url, { credentials: "include" });
      if (!response.ok) throw new Error(`Image request failed with status ${response.status}.`);
      let name = archiveFilename(image.url, index);
      const originalName = name;
      let suffix = 2;
      while (usedNames.has(name.toLowerCase())) {
        const dot = originalName.lastIndexOf(".");
        name = dot > originalName.lastIndexOf("/") ?
          `${originalName.slice(0, dot)} (${suffix})${originalName.slice(dot)}` :
          `${originalName} (${suffix})`;
        suffix += 1;
      }
      usedNames.add(name.toLowerCase());
      files.push({ name, bytes: new Uint8Array(await response.arrayBuffer()) });
    }

    const archiveUrl = URL.createObjectURL(createZip(files));
    try {
      await chrome.downloads.download({
        url: archiveUrl,
        filename: `${downloadFolder}/images.zip`,
        conflictAction: "uniquify",
        saveAs: false
      });
      setScanStatus("zipDownloaded");
      setTimeout(() => URL.revokeObjectURL(archiveUrl), 60000);
    } catch (error) {
      URL.revokeObjectURL(archiveUrl);
      throw error;
    }
  } catch (error) {
    console.error("Could not create ZIP archive:", error);
    setScanStatus("zipError");
  } finally {
    scanButton.disabled = false;
    downloadSelectedButton.disabled = false;
    updateSelection();
  }
});

initializePreferences();
