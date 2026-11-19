# Image Grabber

Image Grabber is a lightweight Chrome/Edge extension for finding and downloading images from the current webpage.

## Features

- Scan all images on the current page
- Include `img`, `srcset`, and CSS background images
- Select individual images or select all images
- Download images one by one or download all selected images
- Choose a subfolder inside the browser Downloads directory
- Switch between light and dark themes
- English interface
- Save theme and download-folder preferences locally

## Installation

### Install manually in Chrome or Edge

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome or `edge://extensions/` in Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder containing `manifest.json`.
6. Pin **Image Grabber** in the browser toolbar if needed.

## Usage

1. Open a regular webpage.
2. Click the **Image Grabber** extension icon.
3. Click **Scan images**.
4. Select the images you want.
5. Click **Download** for one image or **Download selected** for several images.

## Download folder

Enter a subfolder name in the **Image download folder** field, then click **Save**.

Examples:

- `images`
- `images/site`
- `project/screenshots`

The folder is created under the browser's Downloads directory. Chrome extensions cannot choose an arbitrary location outside Downloads through this API.

## Theme

Use the moon or sun icon in the popup header to switch between light and dark themes.

## Permissions

- `activeTab`: Access the page selected by the user
- `scripting`: Scan image elements and CSS background images
- `downloads`: Download selected images
- `storage`: Save theme and download-folder preferences

## Development

The extension uses plain HTML, CSS, and JavaScript.

Main files:

- `manifest.json`: Chrome extension configuration
- `popup.html`: Popup interface
- `popup.css`: Styles and themes
- `popup.js`: Scanning, downloading, and preference logic

No build step or external dependency is required.
