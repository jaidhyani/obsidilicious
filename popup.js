document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("link-form");
  const urlInput = document.getElementById("url");
  const pageTitleInput = document.getElementById("page-title");
  const dateInput = document.getElementById("date");
  const folderInput = document.getElementById("folder");
  const tagsInput = document.getElementById("tags");
  const notesInput = document.getElementById("notes");

  chrome.runtime.sendMessage({ action: "fetchExistingTags" }, (response) => {
    if (response.tags) {
      const existingTags = response.tags;
      enableTagAutocomplete(existingTags);
    } else {
      console.error("Error fetching existing tags:", response.error);
    }
  });

  function enableTagAutocomplete(tags) {
    console.log('Existing tags: ', tags);
    const tagsInput = document.getElementById('tags');
    new Awesomplete(tagsInput, {
      list: tags,
      minChars: 1,
      maxItems: 5,
      autoFirst: true,
    });
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
          dateInput.value = note.frontmatter.date || today;
          folderInput.value = getFolderFromPath(note.path) || "";
          tagsInput.value = note.tags.join(", ");
          notesInput.value = note.content.trim();
        }
      }
    );
  });

  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;

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
      date: formData.get("date"),
      folder: formData.get("folder"),
      tags: formData.get("tags"),
      notes: formData.get("notes"),
      originalPath: formData.get("original-path"),
    };

    chrome.runtime.sendMessage(
      { action: "checkLinkExists", data: { url: data.url } },
      (response) => {
        if (response && response.exists) {
          const note = response.note;
          pageTitleInput.value =
            note.frontmatter["page-title"] || currentTab.title;
          dateInput.value = note.frontmatter.date || today;
          folderInput.value = getFolderFromPath(note.path) || "";
          tagsInput.value = note.tags.join(", ");

          const contentParts = note.content.split("---");
          notesInput.value = contentParts.slice(2).join("---").trim();
        }

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
      }
    );
  });
});

function getFolderFromPath(path) {
  const parts = path.split("/");
  parts.pop(); // Remove the filename
  return parts.join("/");
}
