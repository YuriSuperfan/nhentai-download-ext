document.getElementById("clearStorage").addEventListener("click", async () => {
    await chrome.storage.local.clear();
    await loadQueue();
    setStatus("Queue cleared");
});

document.getElementById("checkDownloads").addEventListener("click", async () => {
    setStatus(await chrome.runtime.sendMessage({action: "checkDownloads"}));
});

document.getElementById("startDownload").addEventListener("click", async () => {
    const galleryId = document.getElementById("galleryId").value.trim();

    if (!/^\d+$/.test(galleryId)) {
        setStatus("Invalid gallery ID");
        return;
    }

    const firstPageUrl = `https://nhentai.net/g/${galleryId}/1`;

    try {
        const response = await fetch(firstPageUrl, {method: 'GET'});

        if (!response.ok) {
            setStatus("Gallery not found");
            return;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const imgTag = doc.querySelector("#image-container img");
        if (!imgTag || !imgTag.src) {
            setStatus("Image not found");
            return;
        }

        await chrome.runtime.sendMessage({
            action: "startDownload",
            url: imgTag.src,
            galleryId: galleryId
        });

        setStatus("Download started");
        await loadQueue();
    } catch (err) {
        console.error(err);
        setStatus("Error fetching gallery");
    }
});

function setStatus(message) {
    let statusBox = document.getElementById("status-area");
    if (statusBox === null) {
        statusBox = document.createElement("div");
        statusBox.id = "status-area";
        statusBox.className = "subsection";
        statusBox.innerHTML = `<h3>Info</h3><p></p>`;
        document.body.appendChild(statusBox);
    }

    statusBox.querySelector("p").textContent = message;
}

async function loadQueue() {
    const {downloadQueue = []} = await chrome.storage.local.get('downloadQueue');
    const list = document.getElementById("queueList");

    list.innerHTML = "";

    if (downloadQueue.length === 0) {
        list.innerHTML = "<li>No downloads queued</li>";
        return;
    }

    for (const item of downloadQueue) {
        const li = document.createElement("li");
        li.textContent = `Gallery ${item.galleryId} - Page ${item.pageNumber}`;
        list.appendChild(li);
    }
}

document.addEventListener("DOMContentLoaded", loadQueue);