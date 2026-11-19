let openingPopup;

chrome.action.onClicked.addListener((tab) => {
  if (openingPopup) {
    openingPopup.then(() => openPopup(tab.id)).catch((error) => {
      console.error("Could not focus Image Grabber:", error);
    });
    return;
  }

  openingPopup = openPopup(tab.id).finally(() => {
    openingPopup = undefined;
  });
  openingPopup.catch((error) => {
    console.error("Could not open Image Grabber:", error);
  });
});

async function openPopup(sourceTabId) {
  await chrome.storage.local.set({ sourceTabId });
  const { popupWindowId } = await chrome.storage.local.get("popupWindowId");
  if (popupWindowId !== undefined) {
    try {
      const existingWindow = await chrome.windows.get(popupWindowId, { populate: true });
      const popupUrl = chrome.runtime.getURL("popup.html");
      if (!existingWindow.tabs?.some((existingTab) => existingTab.url === popupUrl)) {
        throw new Error("Stored window is not the Image Grabber window.");
      }
      await chrome.windows.update(popupWindowId, { focused: true });
      return;
    } catch {
      await chrome.storage.local.remove("popupWindowId");
    }
  }

  const popup = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 920,
    height: 780
  });
  await chrome.storage.local.set({ popupWindowId: popup.id });
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { popupWindowId } = await chrome.storage.local.get("popupWindowId");
  if (popupWindowId === windowId) {
    await chrome.storage.local.remove("popupWindowId");
  }
});
