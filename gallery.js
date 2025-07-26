const match = window.location.pathname.match(/^\/g\/\d+\/?$/);
if (match) {
    const oldDownload = document.querySelector('a#download');

    const btn = document.createElement("button");
    btn.innerHTML = `<img src=${chrome.runtime.getURL('icons/icon16.png')} alt='extension icon'> Download`;
    btn.classList.add("btn", "btn-secondary");
    btn.style.display = "flex";
    btn.style.flexDirection = "row";
    btn.style.alignItems = "center";
    btn.style.gap = "5px";

    oldDownload.parentElement.appendChild(btn);
    oldDownload.parentElement.style.display= "flex";

    btn.addEventListener("click", async () => {
        try {
            const currentUrl = window.location.href;
            const galleryMatch = currentUrl.match(/\/g\/(\d+)/);

            const galleryId = galleryMatch[1];
            const firstPageUrl = `${currentUrl.replace(/\/$/, "")}/1`;

            const response = await fetch(firstPageUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const imgTag = doc.querySelector("#image-container img");
            if (!imgTag) {
                window.alert("No image tags found on fetched page.");
                return;
            }

            chrome.runtime.sendMessage({
                action: "startDownload",
                url: imgTag.src,
                galleryId: galleryId
            });

            console.log("Message sent to service worker:", imgTag.src, galleryId);
        } catch (err) {
            console.error("Failed to fetch and parse image:", err);
        }
    });
}