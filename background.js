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

async function checkLinkExists(url) {
  try {
    const { apiUrl, apiPort, apiKey } = await getConfig();
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

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.olrapi.jsonlogic+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
    });
    if (!response.ok) {
      throw new Error("Error searching for link");
    }
    const data = await response.json();
    if (data.length > 0) {
      const file = data[0];
      const noteResponse = await fetch(`${apiUrl}:${apiPort}/vault/${file.filename}`, {
        headers: {
          Accept: "application/vnd.olrapi.note+json",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!noteResponse.ok) {
        throw new Error("Error retrieving note");
      }
      const note = await noteResponse.json();
      return { exists: true, note: note };
    } else {
      return { exists: false };
    }
  } catch (error) {
    console.error("Error checking if link exists:", error);
    throw error;
  }
}

async function saveLinkToObsidian(data) {
  try {
    const { url, pageTitle, datetime, folder, tags, notes, originalPath } = data;
    const filename = sanitizeFilename(pageTitle) + ".md";
    const markdownContent = `---
url: ${url}
page-title: "${pageTitle}"
datetime: ${datetime}
tags: [${tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0).join(', ')}]
---

${notes}
`;

    const { apiUrl, apiPort, apiKey, defaultFolder } = await getConfig();

    const requestUrl = originalPath
      ? `${apiUrl}:${apiPort}/vault/${originalPath}`
      : `${apiUrl}:${apiPort}/vault/${folder || defaultFolder}/${filename}`;

    const response = await fetch(requestUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown",
        Authorization: `Bearer ${apiKey}`,
      },
      body: markdownContent,
    });

    if (response.ok) {
      return { success: true };
    } else {
      throw new Error("Error saving link to Obsidian");
    }
  } catch (error) {
    console.error("Error saving link to Obsidian:", error);
    throw error;
  }
}

async function fetchExistingTags() {
  try {
    const { apiUrl, apiPort, apiKey } = await getConfig();
    const requestUrl = `${apiUrl}:${apiPort}/search/`;
    const requestBody = JSON.stringify({
      ">=": [
        {
          "var": "tags.length"
        },
        1
      ]
    });

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.olrapi.jsonlogic+json",
        Authorization: `Bearer ${apiKey}`
      },
      body: requestBody
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const tags = await Promise.all(data.map(async (item) => {
      const noteResponse = await fetch(`${apiUrl}:${apiPort}/vault/${item.filename}`, {
        headers: {
          Accept: "application/vnd.olrapi.note+json",
          Authorization: `Bearer ${apiKey}`
        }
      });
      if (!noteResponse.ok) {
        throw new Error(`HTTP error! status: ${noteResponse.status}`);
      }
      const note = await noteResponse.json();
      return note.tags;
    }));

    const uniqueTags = [...new Set(tags.flat())];
    console.log("Fetched tags:", uniqueTags);
    return uniqueTags;
  } catch (error) {
    console.error("Error fetching tags:", error);
    throw error;
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[/\\?%*:|"<>.]/g, '_').replace(/\s+/g, ' ').trim();
}

async function getConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiUrl", "apiPort", "apiKey", "defaultFolder"], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve({
        apiUrl: result.apiUrl || "https://127.0.0.1",
        apiPort: result.apiPort || "27124",
        apiKey: result.apiKey || "",
        defaultFolder: result.defaultFolder || "Links",
      });
    });
  });
}
