# Image Grabber

Image Grabber is a lightweight Chrome and Edge extension for finding images on a webpage or across multiple URLs, then downloading selected images individually or as a ZIP archive.

## Features

- Scan the active webpage or multiple HTTP/HTTPS URLs, one per line
- Find regular images, responsive `srcset` candidates, and CSS background images
- Preview results and select individual images or all results
- Download images individually, as separate files, or in a ZIP archive
- Choose a subfolder under the browser's Downloads directory
- Use a separate window that stays open when switching browser tabs
- Restore the URL list, scan results, and selections when reopening the window
- Switch between light and dark themes

## Install

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome or `edge://extensions/` in Edge.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Pin **Image Grabber** to the browser toolbar if needed.

## Use

1. Click the **Image Grabber** toolbar icon to open its window. Clicking the icon again focuses the existing window.
2. Leave the URL field empty to scan the active webpage, or paste one HTTP/HTTPS URL per line.
3. Click **Scan images**. When prompted, allow access to the websites you want to scan.
4. Select images from the results.
5. Click **Download** for one image, **Download selected** for separate files, or **Download ZIP** to bundle the selection.

URLs are scanned one at a time in temporary background tabs, which are closed after each scan. Duplicate image URLs found on multiple pages appear only once.

## Downloads

Downloads are saved under the browser's Downloads directory. Set **Image download folder** to choose a subfolder, then click **Save**.

Examples:

- `images`
- `images/site`
- `project/screenshots`

The browser downloads API cannot save to an arbitrary location outside Downloads.

## Permissions and privacy

- `activeTab` and `scripting` are used to inspect the active page when no URLs are supplied.
- Optional per-site access is requested only when scanning the URLs you enter.
- `downloads` is used to save selected images and ZIP archives.
- `storage` saves the theme, download folder, URL list, scan results, and selections locally in the browser.

No external service or build step is required.

## Limitations

Some pages may not be scannable if they require sign-in, block extension access, rely on content that has not loaded yet, or use expiring image URLs. ZIP creation can also fail if an image host does not allow the extension to retrieve an image.

## Development

The extension uses plain HTML, CSS, and JavaScript.

- `manifest.json` — extension configuration
- `background.js` — opens and focuses the separate scan window
- `popup.html` — extension interface
- `popup.css` — layout and themes
- `popup.js` — scanning, downloads, and saved state
