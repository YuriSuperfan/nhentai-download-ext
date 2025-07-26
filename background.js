async function checkPage(url, tries = 0) {
    if (tries >= 5) {
        return false;
    }

    try {
        const response = await fetch(url, {method: 'HEAD'});
        if (response.ok) return true;
        if (response.status === 404) return false;
    } catch {
    }

    await new Promise(res => setTimeout(res, 300));
    return checkPage(url, tries + 1);
}

async function register(baseUrl, galleryId, start = 1) {
    const {downloadQueue = []} = await chrome.storage.local.get('downloadQueue');
    downloadQueue.push({
        galleryId,
        baseUrl,
        pageNumber: start
    });
    await chrome.storage.local.set({downloadQueue});
}

async function checkStartDownload() {
    const {downloadQueue = []} = await chrome.storage.local.get('downloadQueue');
    if (downloadQueue.length === 0) {
        console.log("No gallery to download");
        return "No gallery to download";
    }

    const baseUrl = downloadQueue[0].baseUrl;
    const galleryId = downloadQueue[0].galleryId;
    const pageNumber = downloadQueue[0].pageNumber;

    const curDownloads = await chrome.downloads.search({
        state: "in_progress",
        filenameRegex: `.*${galleryId}.*`
    });
    if (curDownloads.length !== 0) {
        console.log("Download(s) already in progress :", curDownloads);
        return "Download(s) already in progress";
    }

    const pageUrl = baseUrl.replace(/\/(\d+)(\.\w+)$/, `/${pageNumber}$2`);

    if (!(await checkPage(pageUrl))) {
        console.log(`Image not found at ${baseUrl}, stopping gallery '${galleryId}'.`);
        downloadQueue.splice(0, 1);
        await chrome.storage.local.set({downloadQueue});
        return await checkStartDownload();
    }

    await chrome.downloads.download({
        url: pageUrl,
        filename: `${galleryId}/${galleryId}_${pageUrl.split("/")[5]}`,
        conflictAction: "overwrite"
    });
    console.log(`Downloading page ${pageNumber} of gallery ${galleryId}`);
    return `Downloading page ${pageNumber} of gallery ${galleryId}`;
}

chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.state) {
        return;
    }

    const {downloadQueue} = await chrome.storage.local.get('downloadQueue');
    if (!downloadQueue || downloadQueue.length === 0) {
        return;
    }

    const downloadInfo = (await chrome.downloads.search({id: delta.id}))[0];
    const galleryId = downloadQueue[0].galleryId;

    const hasFailed = delta.state.current === "interrupted" && downloadInfo.filename.includes(galleryId);
    const isGallery = delta.state.current === "complete" && downloadInfo.filename.includes(galleryId);

    if (hasFailed) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await checkStartDownload();
        return;
    }

    if (isGallery) {
        downloadQueue[0].pageNumber += 1;
        await chrome.storage.local.set({downloadQueue});
        try {
            await chrome.runtime.sendMessage({action: "updatePopup"});
        } catch {
        }
        await checkStartDownload();
    }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startDownload") {
        register(message.url, message.galleryId).then(checkStartDownload);
    }
    if (message.action === "checkDownloads") {
        checkStartDownload().then((res) => {
            sendResponse(res);
        });
        return true;
    }
});