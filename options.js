document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('options-form');
  const apiUrlInput = document.getElementById('api-url');
  const apiPortInput = document.getElementById('api-port');
  const apiKeyInput = document.getElementById('api-key');
  const defaultFolderInput = document.getElementById('default-folder');

  chrome.storage.sync.get(['apiUrl', 'apiPort', 'apiKey', 'defaultFolder'], (result) => {
    apiUrlInput.value = result.apiUrl || 'https://127.0.0.1';
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
});