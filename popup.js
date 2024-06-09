document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("link-form");
  const urlInput = document.getElementById("url");
  const pageTitleInput = document.getElementById("page-title");
  const datetimeInput = document.getElementById("datetime");
  const folderInput = document.getElementById("folder");
  const tagsInput = document.getElementById("tags");
  const notesInput = document.getElementById("notes");
  const commonTagsContainer = document.getElementById("common-tags");

  chrome.runtime.sendMessage({ action: "fetchExistingTags" }, (response) => {
    if (response.tags) {
      const existingTags = response.tags;
      enableTagAutocomplete(existingTags);
      displayCommonTags(existingTags);
    } else {
      console.error("Error fetching existing tags:", response.error);
    }
  });

  function enableTagAutocomplete(tags) {
    new Awesomplete(tagsInput, {
      list: tags,
      minChars: 1,
      maxItems: 5,
      autoFirst: true,
    });
  }

  function displayCommonTags(tags) {
    const tagCounts = {};
    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const commonTags = sortedTags.slice(0, 5);

    commonTags.forEach((tag) => {
      const button = document.createElement("button");
      button.textContent = `#${tag}`;
      button.className = "common-tag";
      button.type = "button"; // Prevent form submission
      button.addEventListener("click", (event) => {
        event.preventDefault();
        toggleTag(tag);
      });
      commonTagsContainer.appendChild(button);
    });
  }

  function toggleTag(tag) {
    const currentTags = tagsInput.value.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
    const tagIndex = currentTags.indexOf(tag);
    if (tagIndex === -1) {
      currentTags.push(tag);
    } else {
      currentTags.splice(tagIndex, 1);
    }
    tagsInput.value = currentTags.map(t => `#${t}`).join(', ');
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    urlInput.value = currentTab.url;
    pageTitleInput.value = currentTab.title;

    chrome.runtime.sendMessage(
      { action: "checkLinkExists", data: { url: currentTab.url } },
      (response) => {
        if (response && response.exists) {
          const note = response.note;
          pageTitleInput.value =
            note.frontmatter["page-title"] || currentTab.title;
          datetimeInput.value = note.frontmatter.datetime || getCurrentDateTimeLocal();
          folderInput.value = getFolderFromPath(note.path) || "";
          tagsInput.value = note.tags.map(tag => `#${tag}`).join(", ");
          notesInput.value = note.content
            .replace(/^---\n.*?\n---\n/s, "")
            .trim();
        }
      }
    );
  });

  datetimeInput.value = getCurrentDateTimeLocal();

  chrome.storage.sync.get(["defaultFolder"], (result) => {
    const defaultFolder = result.defaultFolder || "Links";
    folderInput.placeholder = defaultFolder;
    folderInput.value = defaultFolder;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const data = {
      url: formData.get("url"),
      pageTitle: formData.get("page-title"),
      datetime: formData.get("datetime"),
      folder: formData.get("folder"),
      tags: formData.get("tags").split(',').map(t => t.trim().replace(/^#/, '')).join(', '),
      notes: formData.get("notes"),
    };

    chrome.runtime.sendMessage(
      { action: "saveLinkToObsidian", data },
      (response) => {
        if (response && response.success) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "Obsidian Link Saver",
            message: "Link saved to Obsidian successfully!",
          });
          window.close();
        } else {
          alert((response && response.error) || "An error occurred");
        }
      }
    );
  });
});

function getFolderFromPath(path) {
  const parts = path.split("/");
  parts.pop(); // Remove the filename
  return parts.join("/");
}

function getCurrentDateTimeLocal() {
  const now = new Date();
  return now.toISOString().slice(0, 16); // Return datetime-local format
}
