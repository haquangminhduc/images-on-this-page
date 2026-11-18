const scanButton = document.getElementById("scan");
const downloadSelectedButton = document.getElementById("download-selected");
const selectAllCheckbox = document.getElementById("select-all");
const statusElement = document.getElementById("status");
const countElement = document.getElementById("count");
const imagesElement = document.getElementById("images");
const themeToggle = document.getElementById("theme-toggle");
const downloadFolderInput = document.getElementById("download-folder");
const saveFolderButton = document.getElementById("save-folder");

let scannedImages = [];
let theme = "light";
let downloadFolder = "images";
let hasScanned = false;
let scanStatus = { key: "scanReady", values: {} };

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
    selectAll: "Select all",
    downloadSelected: "Download selected",
    imageList: "Image list",
    count: "{total} images · {selected} selected",
    scanReady: "Click “Scan images” when you’re ready to scan this page.",
    scanning: "Scanning images on this page…",
    scanPrompt: "Select the images you want to download.",
    noImages: "No images found on this page.",
    scanError: "Could not scan this page. Try a regular website.",
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
    const stored = await chrome.storage.local.get(["theme", "downloadFolder"]);
    theme = stored.theme === "dark" ? "dark" : "light";
    downloadFolder = normalizeDownloadFolder(stored.downloadFolder) || "images";
    downloadFolderInput.value = downloadFolder;
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
  details.textContent = image.dimensions || translate(image.kind);
  details.title = image.url;

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
  localizeElement(checkbox);
  imagesElement.append(item);
}

function updateSelection() {
  const checkboxes = Array.from(imagesElement.querySelectorAll(".image-checkbox"));
  const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  selectAllCheckbox.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
  downloadSelectedButton.disabled = selectedCount === 0;
  countElement.textContent = translate("count", {
    total: scannedImages.length,
    selected: selectedCount
  });
}

async function scanPage() {
  scannedImages = [];
  hasScanned = false;
  imagesElement.replaceChildren();
  countElement.textContent = "";
  setScanStatus("scanning");
  scanButton.disabled = true;
  selectAllCheckbox.disabled = true;
  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;
  downloadSelectedButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) {
      throw new Error("Could not find the active tab.");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
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
    });

    scannedImages = results[0]?.result || [];
    hasScanned = true;
    setScanStatus(scannedImages.length ? "scanPrompt" : "noImages");
    selectAllCheckbox.disabled = scannedImages.length === 0;
    scannedImages.forEach(addImage);
    updateSelection();
  } catch (error) {
    console.error("Could not scan page:", error);
    setScanStatus("scanError");
  } finally {
    scanButton.disabled = false;
  }
}

scanButton.addEventListener("click", scanPage);
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

initializePreferences();
