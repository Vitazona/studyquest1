
const uploadForm = document.getElementById("uploadForm");
const curriculumFile = document.getElementById("curriculumFile");
const uploadButton = document.getElementById("uploadButton");
const uploadMessage = document.getElementById("uploadMessage");
const selectedFile = document.getElementById("selectedFile");
const selectedFileName = document.getElementById("selectedFileName");
const selectedFileSize = document.getElementById("selectedFileSize");
const clearFileButton = document.getElementById("clearFileButton");

const filesList = document.getElementById("filesList");
const filesMessage = document.getElementById("filesMessage");
const fileCount = document.getElementById("fileCount");

const previewSection = document.getElementById("previewSection");
const previewTitle = document.getElementById("previewTitle");
const previewDescription = document.getElementById("previewDescription");
const previewContent = document.getElementById("previewContent");
const closePreviewButton = document.getElementById("closePreviewButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");
const resetZoomButton = document.getElementById("resetZoomButton");
const zoomLevel = document.getElementById("zoomLevel");
const profileButton = document.getElementById("profileButton");
const profileDialog = document.getElementById("profileDialog");
const profileDialogName = document.getElementById("profileDialogName");
const closeProfileButton = document.getElementById("closeProfileButton");
const profileUsername = document.getElementById("profileUsername");
const deleteFileDialog = document.getElementById("deleteFileDialog");
const deleteFileMessage = document.getElementById("deleteFileMessage");
const cancelDeleteFileButton = document.getElementById(
  "cancelDeleteFileButton"
);
const confirmDeleteFileButton = document.getElementById(
  "confirmDeleteFileButton"
);

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MIN_PREVIEW_ZOOM = 50;
const MAX_PREVIEW_ZOOM = 300;
const PREVIEW_ZOOM_STEP = 25;

let selectedFileObject = null;
let previewZoom = 100;
let pendingDelete = null;

/* GENERAL HELPERS */

function getExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

function formatSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
    return "Unknown size";
  }

  const size = Number(bytes);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Date unavailable";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

async function getErrorMessage(response) {
  try {
    const data = await response.json();
    return data.message || data.error || "Something went wrong.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

/* CHECK LOGIN */

async function checkLogin() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      window.location.href = "/login";
      return false;
    }

    const data = await response.json();
    const username = data.user?.username || data.username || "username";
    profileUsername.textContent = username;
    profileDialogName.textContent = username;

    return true;
  } catch (error) {
    console.error("Unable to verify login:", error);
    showMessage(
      filesMessage,
      "Unable to connect to the server. Make sure Study Quest is running.",
      "error"
    );
    filesList.innerHTML = "";
    return false;
  }
}

/* FILE SELECTION */

curriculumFile.addEventListener("change", () => {
  const file = curriculumFile.files[0];

  if (!file) {
    selectedFileObject = null;
    selectedFile.hidden = true;
    return;
  }

  const extension = getExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    curriculumFile.value = "";
    selectedFileObject = null;
    selectedFile.hidden = true;

    showMessage(
      uploadMessage,
      "Unsupported file type. Please select a PDF, JPG, JPEG, PNG, or WEBP file.",
      "error"
    );
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    curriculumFile.value = "";
    selectedFileObject = null;
    selectedFile.hidden = true;

    showMessage(
      uploadMessage,
      "The selected file exceeds the 15 MB limit.",
      "error"
    );
    return;
  }

  selectedFileObject = file;

  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = formatSize(file.size);
  selectedFile.hidden = false;

  showMessage(uploadMessage, "");
});

clearFileButton.addEventListener("click", () => {
  curriculumFile.value = "";
  selectedFileObject = null;
  selectedFile.hidden = true;
  showMessage(uploadMessage, "");
});

/* UPLOAD FILE */

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = selectedFileObject || curriculumFile.files[0];

  if (!file) {
    showMessage(uploadMessage, "Please choose a file first.", "error");
    return;
  }

  if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
    showMessage(uploadMessage, "This file type is not supported.", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showMessage(uploadMessage, "The file must not exceed 15 MB.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";
  showMessage(uploadMessage, "Uploading your file...");

  try {
    const response = await fetch("/api/curriculum/upload", {
      method: "POST",
      body: formData,
      credentials: "same-origin"
    });

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const errorMessage = await getErrorMessage(response);
      throw new Error(errorMessage);
    }

    curriculumFile.value = "";
    selectedFileObject = null;
    selectedFile.hidden = true;
    uploadForm.reset();

    showMessage(uploadMessage, "File uploaded successfully!", "success");
    await loadFiles();
  } catch (error) {
    console.error("Upload error:", error);
    showMessage(
      uploadMessage,
      error.message || "Upload failed. Please try again.",
      "error"
    );
  } finally {
    uploadButton.disabled = false;
    uploadButton.innerHTML = 'Upload file <span>↑</span>';
  }
});

/* PREVIEW FILE */

function openFilePreview(file) {
  const filename = file.filename || file.originalName || "Untitled file";
  const extension = getExtension(filename);

  const isPdf = extension === ".pdf";
  const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(extension);

  if (!isPdf && !isImage) {
    showMessage(
      filesMessage,
      "Preview is available for PDF and image files only.",
      "error"
    );
    return;
  }

  const fileUrl = `/api/curriculum/${encodeURIComponent(file.id)}`;

  previewTitle.textContent = filename;
  previewDescription.textContent =
    `${formatSize(file.size || 0)} · ${formatDate(file.uploadedAt)}`;

  previewZoom = 100;
  zoomLevel.textContent = `${previewZoom}%`;
  previewContent.replaceChildren();

  const sizer = document.createElement("div");
  sizer.className = "preview-sizer";
  sizer.id = "previewSizer";

  const stage = document.createElement("div");
  stage.className = "preview-stage";
  stage.id = "previewStage";

  if (isPdf) {
    const pdfViewer = document.createElement("iframe");

    pdfViewer.className = "preview-pdf";
    pdfViewer.title = `PDF preview: ${filename}`;
    pdfViewer.dataset.fileUrl = fileUrl;
    pdfViewer.src = `${fileUrl}#toolbar=0&navpanes=0`;

    stage.appendChild(pdfViewer);
  } else {
    const imageViewer = document.createElement("img");

    imageViewer.className = "preview-image";
    imageViewer.alt = filename;
    imageViewer.src = fileUrl;

    imageViewer.addEventListener("error", () => {
      previewContent.replaceChildren();

      const message = document.createElement("p");
      message.className = "preview-unavailable";
      message.textContent =
        "This image could not be displayed. Please try downloading it.";

      previewContent.appendChild(message);
    }, { once: true });

    stage.appendChild(imageViewer);
  }

  sizer.appendChild(stage);
  previewContent.appendChild(sizer);
  applyPreviewZoom();

  previewSection.hidden = false;

  previewSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function applyPreviewZoom() {
  zoomLevel.textContent = `${previewZoom}%`;

  const sizer = document.getElementById("previewSizer");
  const stage = document.getElementById("previewStage");
  if (!sizer || !stage) return;

  const scale = previewZoom / 100;
  const baseH = "min(75vh, 850px)";

  if (scale === 1) {
    sizer.style.width = "100%";
    sizer.style.height = baseH;
    sizer.style.margin = "0 auto";
    stage.style.width = "100%";
    stage.style.height = baseH;
    stage.style.transform = "none";
    stage.style.transformOrigin = "top center";
  } else if (scale < 1) {
    sizer.style.width = `${scale * 100}%`;
    sizer.style.height = `calc(${baseH} * ${scale})`;
    sizer.style.margin = "0 auto";
    stage.style.width = `${(100 / scale).toFixed(4)}%`;
    stage.style.height = baseH;
    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = "0 0";
  } else {
    sizer.style.width = `${scale * 100}%`;
    sizer.style.height = `calc(${baseH} * ${scale})`;
    sizer.style.margin = "0";
    stage.style.width = `${(100 / scale).toFixed(4)}%`;
    stage.style.height = baseH;
    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = "0 0";
  }
}

function changePreviewZoom(amount) {
  previewZoom = Math.max(
    MIN_PREVIEW_ZOOM,
    Math.min(MAX_PREVIEW_ZOOM, previewZoom + amount)
  );
  applyPreviewZoom();
}

function openDeleteFileDialog(file, deleteButton) {
  const filename = file.filename || file.originalName || "Untitled file";

  pendingDelete = {
    file,
    deleteButton
  };
  deleteFileMessage.textContent =
    `"${filename}" will be permanently removed from your study library.`;
  deleteFileDialog.showModal();
}

async function deletePendingFile() {
  if (!pendingDelete) return;

  const { file, deleteButton } = pendingDelete;
  const filename = file.filename || file.originalName || "Untitled file";
  const fileId = String(file.id);

  deleteButton.disabled = true;
  deleteButton.textContent = "Deleting...";
  confirmDeleteFileButton.disabled = true;

  try {
    const response = await fetch(
      `/api/curriculum/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE",
        credentials: "same-origin"
      }
    );

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    if (previewTitle.textContent === filename) {
      previewContent.replaceChildren();
      previewSection.hidden = true;
    }

    deleteFileDialog.close();
    pendingDelete = null;
    showMessage(filesMessage, "File deleted successfully.", "success");
    await loadFiles();
  } catch (error) {
    console.error("Delete error:", error);
    showMessage(
      filesMessage,
      error.message || "Unable to delete this file.",
      "error"
    );
    deleteButton.disabled = false;
    deleteButton.textContent = "Delete";
  } finally {
    confirmDeleteFileButton.disabled = false;
  }
}

zoomOutButton.addEventListener("click", () => {
  changePreviewZoom(-PREVIEW_ZOOM_STEP);
});

zoomInButton.addEventListener("click", () => {
  changePreviewZoom(PREVIEW_ZOOM_STEP);
});

resetZoomButton.addEventListener("click", () => {
  changePreviewZoom(100 - previewZoom);
});

closePreviewButton.addEventListener("click", () => {
  previewContent.replaceChildren();
  previewSection.hidden = true;
});

profileButton.addEventListener("click", () => {
  profileDialog.showModal();
});

closeProfileButton.addEventListener("click", () => {
  profileDialog.close();
});

profileDialog.addEventListener("click", (event) => {
  if (event.target === profileDialog) {
    profileDialog.close();
  }
});

/* CREATE A SAVED FILE CARD */

function createFileCard(file) {
  const filename = file.filename || file.originalName || "Untitled file";
  const extension = getExtension(filename);
  const fileId = String(file.id);

  const card = document.createElement("article");
  card.className = "file-card";

  const top = document.createElement("div");
  top.className = "file-card-top";

  const icon = document.createElement("div");
  icon.className = "file-type-icon";

  if (extension === ".pdf") {
    icon.classList.add("pdf-type");
    icon.textContent = "PDF";
  } else if (
    [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
  ) {
    icon.classList.add("image-type");
    icon.textContent = "IMG";
  } else {
    icon.textContent = "FILE";
  }

  const info = document.createElement("div");
  info.className = "file-info";

  const name = document.createElement("h3");
  name.className = "file-name";
  name.textContent = filename;
  name.title = filename;

  const meta = document.createElement("p");
  meta.className = "file-meta";
  meta.textContent =
    `${formatSize(file.size || 0)} · ${formatDate(file.uploadedAt)}`;

  info.append(name, meta);
  top.append(icon, info);

  const actions = document.createElement("div");
  actions.className = "file-actions";

  const viewButton = document.createElement("button");
  viewButton.className = "file-action";
  viewButton.type = "button";
  viewButton.textContent = "View";
  viewButton.addEventListener("click", () => {
    openFilePreview(file);
  });

  const downloadLink = document.createElement("a");
  downloadLink.className = "file-action";
  downloadLink.textContent = "Download";
  downloadLink.href =
    `/api/curriculum/${encodeURIComponent(fileId)}?download=1`;
  downloadLink.setAttribute("download", filename);

  const deleteButton = document.createElement("button");
  deleteButton.className = "file-action delete-action";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", async () => {
    openDeleteFileDialog(file, deleteButton);
  });

  actions.append(viewButton, downloadLink, deleteButton);
  card.append(top, actions);

  return card;
}

cancelDeleteFileButton.addEventListener("click", () => {
  deleteFileDialog.close();
  pendingDelete = null;
});

confirmDeleteFileButton.addEventListener("click", deletePendingFile);

deleteFileDialog.addEventListener("click", event => {
  if (event.target === deleteFileDialog) {
    deleteFileDialog.close();
    pendingDelete = null;
  }
});

/* LOAD SAVED FILES */

async function loadFiles() {
  filesList.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "loading-state";
  loading.textContent = "Loading your materials...";
  filesList.appendChild(loading);

  try {
    const response = await fetch("/api/curriculum", {
      credentials: "same-origin"
    });

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const data = await response.json();

    // Supports either a direct array or { files: [...] }.
    const files = Array.isArray(data) ? data : data.files;

    if (!Array.isArray(files)) {
      throw new Error("The server returned an unexpected file list.");
    }

    filesList.replaceChildren();
    fileCount.textContent = `${files.length} ${files.length === 1 ? "file" : "files"}`;

    if (files.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";

      const heading = document.createElement("strong");
      heading.textContent = "Your library is empty";

      const description = document.createElement("span");
      description.textContent =
        "Upload your first curriculum file to see it here.";

      emptyState.append(heading, description);
      filesList.appendChild(emptyState);
      return;
    }

    files.forEach((file) => {
      // The backend's listing route should return each file's ID as "id".
      const normalizedFile = {
        ...file,
        id: file.id || file._id,
        filename: file.filename || file.originalName || "Untitled file",
        size: file.size || 0,
        uploadedAt: file.uploadedAt || file.uploadDate || null
      };

      filesList.appendChild(createFileCard(normalizedFile));
    });
  } catch (error) {
    console.error("Loading files failed:", error);

    filesList.replaceChildren();
    fileCount.textContent = "0 files";

    const errorState = document.createElement("div");
    errorState.className = "empty-state";

    const heading = document.createElement("strong");
    heading.textContent = "Unable to load your materials";

    const description = document.createElement("span");
    description.textContent =
      error.message || "Please refresh the page and try again.";

    errorState.append(heading, description);
    filesList.appendChild(errorState);
  }
}

/* INITIALIZE PAGE */

async function initializeCurriculumPage() {
  const loggedIn = await checkLogin();

  if (loggedIn) {
    await loadFiles();
  }
}

initializeCurriculumPage();
