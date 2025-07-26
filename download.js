function downloadImage(src, name) {
    const link = document.createElement("a");
    link.href = src;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'download') {
        const { url, filename } = message;
        downloadImage(url, filename);
    }
});