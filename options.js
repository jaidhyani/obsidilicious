document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('options-form');
  const apiUrlInput = document.getElementById('api-url');
  const apiPortInput = document.getElementById('api-port');
  const apiKeyInput = document.getElementById('api-key');
  const defaultFolderInput = document.getElementById('default-folder');
  const refreshTagsButton = document.getElementById('refresh-tags');

  chrome.storage.sync.get(['apiUrl', 'apiPort', 'apiKey', 'defaultFolder'], (result) => {
    apiUrlInput.value = result.apiUrl || 'https://localhost';
    apiPortInput.value = result.apiPort || '27124';
    apiKeyInput.value = result.apiKey || '';
    defaultFolderInput.value = result.defaultFolder || '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const apiUrl = apiUrlInput.value.trim();
    const apiPort = apiPortInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const defaultFolder = defaultFolderInput.value.trim();

    chrome.storage.sync.set({ apiUrl, apiPort, apiKey, defaultFolder }, () => {
      alert('Options saved successfully!');
    });
  });

  refreshTagsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'fetchExistingTags' }, (response) => {
      if (response.tags) {
        sessionStorage.setItem('cachedTags', JSON.stringify(response.tags));
        sessionStorage.setItem('cachedTagsTimestamp', Date.now());
        alert('Tags refreshed successfully.');
      } else {
        console.error('Error refreshing tags:', response.error);
        alert('Error refreshing tags.');
      }
    });
  });
});
