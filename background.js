chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLinkExists") {
    checkLinkExists(request.data.url)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ exists: false, error: error.message }));
    return true;
  }

  if (request.action === "saveLinkToObsidian") {
    saveLinkToObsidian(request.data)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "fetchExistingTags") {
    fetchExistingTags()
      .then((tags) => sendResponse({ tags: tags }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

function checkLinkExists(url) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiUrl", "apiPort", "apiKey"], (result) => {
      const apiUrl = result.apiUrl || "https://127.0.0.1";
      const apiPort = result.apiPort || "27124";
      const apiKey = result.apiKey || "";

      const requestUrl = `${apiUrl}:${apiPort}/search/`;
      const requestBody = JSON.stringify({
        or: [
          {
            "===": [
              {
                var: "frontmatter.url",
              },
              url,
            ],
          },
          {
            glob: [
              {
                var: "frontmatter.url-glob",
              },
              url,
            ],
          },
        ],
      });

      fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.olrapi.jsonlogic+json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error searching for link");
          }
          return response.json();
        })
        .then((data) => {
          if (data.length > 0) {
            const file = data[0];
            fetch(`${apiUrl}:${apiPort}/vault/${file.filename}`, {
              headers: {
                Accept: "application/vnd.olrapi.note+json",
                Authorization: `Bearer ${apiKey}`,
              },
            })
              .then((response) => {
                if (!response.ok) {
                  throw new Error("Error retrieving note");
                }
                return response.json();
              })
              .then((note) => resolve({ exists: true, note: note }))
              .catch((error) => reject(error));
          } else {
            resolve({ exists: false });
          }
        })
        .catch((error) => reject(error));
    });
  });
}
function saveLinkToObsidian(data) {
  return new Promise((resolve, reject) => {
    const { url, pageTitle, date, folder, tags, notes, originalPath } = data;
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

        const requestUrl = originalPath
          ? `${apiUrl}:${apiPort}/vault/${originalPath}`
          : `${apiUrl}:${apiPort}/vault/${folder || defaultFolder}/${filename}`;

        fetch(requestUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "text/markdown",
            Authorization: `Bearer ${apiKey}`,
          },
          body: markdownContent,
        })
          .then((response) => {
            if (response.ok) {
              resolve({ success: true });
            } else {
              reject(new Error("Error saving link to Obsidian"));
            }
          })
          .catch((error) => reject(error));
      }
    );
  });
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[/\\?%*:|"<>.]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 255);
}


function fetchExistingTags() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiUrl", "apiPort", "apiKey"], (result) => {
      const apiUrl = result.apiUrl || "https://127.0.0.1";
      const apiPort = result.apiPort || "27124";
      const apiKey = result.apiKey || "";

      const requestUrl = `${apiUrl}:${apiPort}/search/`;
      const requestBody = JSON.stringify({
        ">=": [
          {
            "var": "tags.length"
          },
          1
        ]
      });

      fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.olrapi.jsonlogic+json",
          Authorization: `Bearer ${apiKey}`
        },
        body: requestBody
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          const notePromises = data.map((item) => {
            return fetch(`${apiUrl}:${apiPort}/vault/${item.filename}`, {
              headers: {
                Accept: "application/vnd.olrapi.note+json",
                Authorization: `Bearer ${apiKey}`
              }
            })
              .then((response) => {
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
              })
              .then((note) => note.tags);
          });

          Promise.all(notePromises)
            .then((tagArrays) => {
              const tags = [...new Set(tagArrays.flat())];
              console.log("Fetched tags:", tags);
              resolve(tags);
            })
            .catch((error) => {
              console.error("Error fetching tags for notes:", error);
              reject(error);
            });
        })
        .catch((error) => {
          console.error("Error fetching notes with tags:", error);
          reject(error);
        });
    });
  });
}