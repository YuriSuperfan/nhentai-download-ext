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

function updateLink(url, newNumber) {
    return url.replace(/\/(\d+)(\.\w+)$/, `/${newNumber}$2`);
}

async function askDownload(url, galleryId = "unknown") {
    chrome.downloads.download({
        url: url,
        filename: `${galleryId}/${galleryId}_${url.split("/")[5]}`,
        conflictAction: galleryId === "unknown" ? "uniquify" : "overwrite"
    })
}

async function register(baseUrl, galleryId, start = 1) {
    const newItem = {
        galleryId,
        baseUrl,
        pageNumber: start
    };

    const {downloadQueue = []} = await chrome.storage.local.get('downloadQueue');
    downloadQueue.push(newItem);
    await chrome.storage.local.set({downloadQueue});
}

async function checkStartDownload() {
    const {currentUrl} = await chrome.storage.local.get(['currentUrl']);
    if (currentUrl) {
        console.log("Gallery download already in progress");
        return "Gallery download already in progress";
    }

    const {downloadQueue = []} = await chrome.storage.local.get('downloadQueue');
    if (downloadQueue.length === 0) {
        console.log("No gallery to download");
        return "No gallery to download";
    }

    const baseUrl = downloadQueue[0].baseUrl;
    const galleryId = downloadQueue[0].galleryId;
    const pageNumber = downloadQueue[0].pageNumber;
    downloadQueue.splice(0, 1);

    if (!(await checkPage(updateLink(baseUrl, pageNumber)))) {
        console.log(`Image not found at ${baseUrl}, stopping gallery '${galleryId}'.`);
        return await checkStartDownload();
    }

    await chrome.storage.local.set({
        currentUrl: baseUrl,
        galleryId,
        pageNumber,
        downloadQueue
    });
    await askDownload(updateLink(baseUrl, pageNumber), galleryId);
    console.log(`Starting download for gallery '${galleryId}'`);
    return `Starting download for gallery ${galleryId}`;
}

chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.state || delta.state.current !== "complete") {
        console.log("skipping non-ended download")
        return;
    }

    const results = await chrome.downloads.search({id: delta.id});
    if (!results || results.length === 0) {
        console.warn("Could not find download info by id")
        return;
    }

    const {
        currentUrl,
        galleryId,
        pageNumber
    } = await chrome.storage.local.get(['currentUrl', 'galleryId', 'pageNumber']);
    if (!currentUrl) {
        console.log("no gallery download in progress")
        return;
    }

    const filename = results[0].filename;
    if (!filename.includes(galleryId)) return;

    const nextPageNumber = pageNumber + 1;
    const nextUrl = updateLink(currentUrl, nextPageNumber);

    if (!(await checkPage(nextUrl))) {
        console.log(`Image not found at ${nextUrl}, stopping gallery '${galleryId}'.`);
        await chrome.storage.local.remove(['currentUrl', 'pageNumber', 'galleryId']);

        const galleryCdnId = currentUrl.split("/")[4];
        const tabs = await chrome.tabs.query({url: `${currentUrl.split(galleryCdnId)[0]}${galleryCdnId}/*`});
        if (tabs.length > 0) {
            chrome.tabs.remove(tabs.map(tab => tab.id));
        }

        await checkStartDownload();
        return;
    }

    await chrome.storage.local.set({
        currentUrl: nextUrl,
        pageNumber: nextPageNumber
    });

    await askDownload(nextUrl, galleryId);
});

chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {
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