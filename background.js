chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLinkExists") {
    const { url } = request.data;
    chrome.storage.sync.get(
      ["apiUrl", "apiPort", "apiKey", "defaultFolder"],
      (result) => {
        const apiUrl = result.apiUrl || "https://127.0.0.1";
        const apiPort = result.apiPort || "27124";
        const apiKey = result.apiKey || "";

        const requestUrl = `${apiUrl}:${apiPort}/search/`;
        const requestBody = {
          query: `"${url}"`,
        };

        fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.length > 0) {
              const file = data[0];
              fetch(`${apiUrl}:${apiPort}/vault/${file.filename}`, {
                headers: {
                  Accept: "application/vnd.olrapi.note+json",
                  Authorization: `Bearer ${apiKey}`,
                },
              })
                .then((response) => response.json())
                .then((note) => {
                  sendResponse({ exists: true, note: note });
                });
            } else {
              sendResponse({ exists: false });
            }
          })
          .catch((error) => {
            sendResponse({ exists: false, error: error.message });
          });

        return true;
      }
    );
  }

  if (request.action === "saveLinkToObsidian") {
    const { url, pageTitle, date, folder, tags, notes } = request.data;
    const filename = sanitizeFilename(pageTitle) + ".md";
    const markdownContent = `---
url: ${url}
page-title: ${pageTitle}
date: ${date}
tags: ${tags}
---

${notes}
`;

    chrome.storage.sync.get(
      ["apiUrl", "apiPort", "apiKey", "defaultFolder"],
      (result) => {
        const apiUrl = result.apiUrl || "https://127.0.0.1";
        const apiPort = result.apiPort || "27124";
        const apiKey = result.apiKey || "";
        const defaultFolder = result.defaultFolder || "Links";

        const requestUrl = `${apiUrl}:${apiPort}/vault/${
          folder || defaultFolder
        }/${filename}`;

        fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/markdown",
            Authorization: `Bearer ${apiKey}`,
          },
          body: markdownContent,
        })
          .then((response) => {
            if (response.ok) {
              sendResponse({ success: true });
            } else {
              sendResponse({
                success: false,
                error: "Error saving link to Obsidian",
              });
            }
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: "Error connecting to Obsidian API",
            });
          });
      }
    );

    return true;
  }
});

function sanitizeFilename(filename) {
  return filename
    .replace(/[/\\?%*:|"<>.]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 255);
}
