document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    urlInput.value = currentTab.url;
    pageTitleInput.value = currentTab.title;
    chrome.runtime.sendMessage(
      { action: "checkLinkExists", data: { url: currentTab.url } },
      (response) => {
        if (response.exists) {
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

  const form = document.getElementById("link-form");
  const urlInput = document.getElementById("url");
  const pageTitleInput = document.getElementById("page-title");
  const dateInput = document.getElementById("date");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    urlInput.value = currentTab.url;
    pageTitleInput.value = currentTab.title;
  });

  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;

  const folderInput = document.getElementById("folder");

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
    };

    chrome.runtime.sendMessage(
      { action: "saveLinkToObsidian", data },
      (response) => {
        if (response.success) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "Obsidian Link Saver",
            message: "Link saved to Obsidian successfully!",
          });
          window.close();
        } else {
          alert(response.error);
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
