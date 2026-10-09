const textInput = document.getElementById("text");
const contentLabel = document.getElementById("content-label");
const contentHint = document.getElementById("content-hint");
const contentTypeInputs = document.querySelectorAll('input[name="contentType"]');
const textFormatInputs = document.querySelectorAll('input[name="textFormat"]');
const textFormatPicker = document.getElementById("text-format-picker");
const textFormatHint = document.getElementById("text-format-hint");
const templateOption = document.getElementById("template-option");
const templateSelect = document.getElementById("template");
const lettersInput = document.getElementById("letters");
const lettersOption = document.getElementById("letters-option");
const styleInputs = document.querySelectorAll('input[name="qrStyle"]');
const foregroundInput = document.getElementById("foreground");
const backgroundInput = document.getElementById("background");
const logoInput = document.getElementById("logo-upload");
const logoStatus = document.getElementById("logo-status");
const removeLogoButton = document.getElementById("remove-logo");
const contrastWarning = document.getElementById("contrast-warning");
const styleWarning = document.getElementById("style-warning");
const downloadSizeInput = document.getElementById("download-size");
const designStatus = document.getElementById("design-status");
const resetDesignButton = document.getElementById("reset-design");
const canvas = document.getElementById("qr");
const empty = document.getElementById("empty");
const error = document.getElementById("error");
const downloadBtn = document.getElementById("download");
const generator = document.getElementById("generator");
const messagePage = document.getElementById("message-page");
const sharedMessage = document.getElementById("shared-message");
const ctx = canvas.getContext("2d");

const encoder = document.createElement("div");
encoder.style.display = "none";
document.body.appendChild(encoder);

const SIZE = 512;
const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
const DESIGN_STORAGE_KEY = "qr-generator-design";
let logoImage = null;
let logoObjectUrl = null;
let logoDataUrl = null;
let restoringDesign = false;

function letterList(raw) {
  const chars = Array.from(raw.toUpperCase()).filter((ch) => ch.trim());
  return chars.length ? chars : ["L", "O", "V", "E"];
}

function qrStyle() {
  return document.querySelector('input[name="qrStyle"]:checked').value;
}

function textFormat() {
  return document.querySelector('input[name="textFormat"]:checked').value;
}

function inFinder(row, col, count) {
  const nearTop = row < 7;
  const nearBottom = row >= count - 7;
  const nearLeft = col < 7;
  const nearRight = col >= count - 7;
  return (nearTop && nearLeft) || (nearTop && nearRight) || (nearBottom && nearLeft);
}

function showEmpty() {
  canvas.classList.remove("visible");
  empty.hidden = false;
  empty.textContent = contentType() === "link"
    ? "Enter a link to generate a QR code."
    : "Enter text to generate a QR code.";
  error.hidden = true;
  downloadBtn.disabled = true;
}

function contentType() {
  return document.querySelector('input[name="contentType"]:checked').value;
}

function updateContentType() {
  const isLink = contentType() === "link";
  if (!isLink) {
    document.querySelector('input[name="qrStyle"][value="letters"]').checked = true;
    lettersOption.hidden = false;
  }
  templateOption.hidden = isLink;
  contentLabel.textContent = isLink ? "Link" : "Text";
  textInput.placeholder = isLink ? "https://example.com" : "Type your message";
  contentHint.textContent = isLink
    ? "Enter a web address, for example https://example.com."
    : "Enter any message you want to share.";
  textFormatPicker.hidden = isLink;
  updateTextFormatHint();
  renderQr();
}

function updateTextFormatHint() {
  const isBeautiful = textFormat() === "beautiful";
  textFormatHint.hidden = contentType() !== "text";
  textFormatHint.textContent = isBeautiful
    ? "The QR opens a designed message page on this site. Anyone with the link can read it."
    : "Raw message puts the text itself in the QR code.";
}

function luminance(hexColor) {
  const channels = hexColor.match(/[0-9a-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function updateContrastWarning() {
  const light = Math.max(luminance(foregroundInput.value), luminance(backgroundInput.value));
  const dark = Math.min(luminance(foregroundInput.value), luminance(backgroundInput.value));
  const ratio = (light + 0.05) / (dark + 0.05);
  contrastWarning.hidden = ratio >= 4.5;
  contrastWarning.textContent = contrastWarning.hidden
    ? ""
    : `Low contrast (${ratio.toFixed(1)}:1). Choose a darker QR color or lighter background to help it scan.`;
}

function updateStyleWarning() {
  styleWarning.hidden = qrStyle() === "square" && !logoImage;
}

function saveDesign() {
  if (restoringDesign) return;

  const design = {
    style: qrStyle(),
    foreground: foregroundInput.value,
    background: backgroundInput.value,
    letters: lettersInput.value,
    downloadSize: downloadSizeInput.value,
    logo: logoDataUrl,
  };

  try {
    localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(design));
    designStatus.textContent = "Your design settings save in this browser.";
  } catch (err) {
    designStatus.textContent = "Could not save settings in this browser. Your current design still works.";
    console.error("Could not save QR design settings.", err);
  }
}

function restoreDesign() {
  let stored;
  try {
    stored = localStorage.getItem(DESIGN_STORAGE_KEY);
  } catch (err) {
    designStatus.textContent = "Browser storage is unavailable; settings will not persist after closing this page.";
    console.error("Could not read saved QR design settings.", err);
    return;
  }
  if (!stored) return;

  try {
    const design = JSON.parse(stored);
    restoringDesign = true;
    if (["square", "dots", "letters"].includes(design.style)) {
      document.querySelector(`input[name="qrStyle"][value="${design.style}"]`).checked = true;
      lettersOption.hidden = design.style !== "letters";
    }
    if (/^#[0-9a-f]{6}$/i.test(design.foreground)) foregroundInput.value = design.foreground;
    if (/^#[0-9a-f]{6}$/i.test(design.background)) backgroundInput.value = design.background;
    if (typeof design.letters === "string") lettersInput.value = design.letters.slice(0, 32);
    if (["512", "1024", "2048"].includes(design.downloadSize)) {
      downloadSizeInput.value = design.downloadSize;
    }
    if (typeof design.logo === "string" && design.logo.startsWith("data:image/")) {
      restoreLogo(design.logo);
    }
    updateContrastWarning();
  } catch (err) {
    designStatus.textContent = "Saved settings could not be loaded; using the defaults.";
    console.error("Could not restore saved QR design settings.", err);
  } finally {
    restoringDesign = false;
  }
}

function restoreLogo(dataUrl) {
  const image = new Image();
  image.onload = () => {
    logoImage = image;
    logoDataUrl = dataUrl;
    logoStatus.textContent = "Your saved picture is ready. Test the QR with your phone before sharing.";
    removeLogoButton.hidden = false;
    renderQr();
  };
  image.onerror = () => {
    logoDataUrl = null;
    designStatus.textContent = "The saved picture could not be loaded; other settings were restored.";
    console.error("Could not load saved QR logo.");
    saveDesign();
    renderQr();
  };
  image.src = dataUrl;
}

function showError(message) {
  canvas.classList.remove("visible");
  empty.hidden = true;
  error.hidden = false;
  error.textContent = message;
  downloadBtn.disabled = true;
}

function drawQr(model, letters) {
  const count = model.getModuleCount();
  const quiet = 3;
  const cells = count + quiet * 2;
  const cell = SIZE / cells;
  const style = qrStyle();

  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx.fillStyle = backgroundInput.value;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = foregroundInput.value;
  ctx.font = `900 ${Math.floor(cell * 0.92)}px Arial Black, Arial, sans-serif`;

  let letterIndex = 0;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!model.isDark(row, col)) continue;

      const x = (col + quiet) * cell;
      const y = (row + quiet) * cell;

      if (inFinder(row, col, count) || style === "square") {
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      } else if (style === "dots") {
        const radius = cell * 0.42;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const ch = letters[letterIndex % letters.length];
        letterIndex += 1;
        ctx.fillText(ch, x + cell / 2, y + cell / 2 + cell * 0.04);
      }
    }
  }

  if (logoImage) {
    drawLogo();
  }
}

function drawLogo() {
  const size = SIZE * 0.22;
  const border = SIZE * 0.006;
  const padding = size * 0.1;
  const x = (SIZE - size) / 2;
  const y = (SIZE - size) / 2;
  const innerX = x + border;
  const innerY = y + border;
  const innerSize = size - border * 2;
  const imageX = innerX + padding;
  const imageY = innerY + padding;
  const imageSize = innerSize - padding * 2;
  const radius = size * 0.14;

  ctx.save();
  ctx.shadowColor = "rgba(22, 33, 58, 0.32)";
  ctx.shadowBlur = SIZE * 0.018;
  ctx.shadowOffsetY = SIZE * 0.006;
  ctx.fillStyle = foregroundInput.value;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(innerX, innerY, innerSize, innerSize, radius * 0.82);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(imageX, imageY, imageSize, imageSize, radius * 0.58);
  ctx.clip();

  const sourceSize = Math.min(logoImage.naturalWidth, logoImage.naturalHeight);
  const sourceX = (logoImage.naturalWidth - sourceSize) / 2;
  const sourceY = (logoImage.naturalHeight - sourceSize) / 2;
  ctx.drawImage(
    logoImage,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    imageX,
    imageY,
    imageSize,
    imageSize,
  );
  ctx.restore();
}

function clearLogo() {
  if (logoObjectUrl) {
    URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
  }
  logoImage = null;
  logoDataUrl = null;
  logoInput.value = "";
  logoStatus.textContent = "Use a small image; a large logo can make the QR harder to scan.";
  removeLogoButton.hidden = true;
  saveDesign();
  renderQr();
}

function handleLogoUpload() {
  const file = logoInput.files[0];
  if (!file) return;

  if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"].includes(file.type)) {
    clearLogo();
    logoStatus.textContent = "Choose a PNG, JPEG, GIF, WebP, or BMP image.";
    return;
  }
  if (file.size > MAX_LOGO_FILE_SIZE) {
    clearLogo();
    logoStatus.textContent = "That image is too large. Choose an image under 5 MB.";
    return;
  }

  if (logoObjectUrl) {
    URL.revokeObjectURL(logoObjectUrl);
  }
  logoImage = null;
  logoObjectUrl = URL.createObjectURL(file);
  const imageUrl = logoObjectUrl;
  const image = new Image();
  image.onload = () => {
    if (logoObjectUrl !== imageUrl) return;
    logoImage = image;
    const logoCanvas = document.createElement("canvas");
    const logoContext = logoCanvas.getContext("2d");
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    logoCanvas.width = 96;
    logoCanvas.height = 96;
    logoContext.fillStyle = "#ffffff";
    logoContext.fillRect(0, 0, 96, 96);
    logoContext.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 96, 96);
    logoDataUrl = logoCanvas.toDataURL("image/jpeg", 0.82);
    logoStatus.textContent = "Picture added. Test the downloaded QR with your phone before sharing.";
    removeLogoButton.hidden = false;
    saveDesign();
    renderQr();
  };
  image.onerror = () => {
    if (logoObjectUrl !== imageUrl) return;
    clearLogo();
    logoStatus.textContent = "Could not load that picture. Try a different image.";
  };
  image.src = imageUrl;
}

function renderQr() {
  updateContrastWarning();
  updateStyleWarning();
  const value = textInput.value.trim();
  if (!value) {
    showEmpty();
    return;
  }

  try {
    let qrValue = value;
    if (contentType() === "text" && textFormat() === "beautiful") {
      if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
        showError("Beautiful message pages need the site to be hosted at a public web address.");
        return;
      }

      const messageUrl = new URL(window.location.href);
      messageUrl.hash = new URLSearchParams({ message: value }).toString();
      qrValue = messageUrl.href;
    }

    encoder.innerHTML = "";
    const qr = new QRCode(encoder, {
      text: qrValue,
      width: 8,
      height: 8,
      correctLevel: QRCode.CorrectLevel.H,
    });
    drawQr(qr._oQRCode, letterList(lettersInput.value));
    canvas.classList.add("visible");
    empty.hidden = true;
    error.hidden = true;
    downloadBtn.disabled = false;
  } catch (err) {
    showError("Could not generate a QR code for that text.");
    console.error(err);
  }
}

textInput.addEventListener("input", renderQr);
templateSelect.addEventListener("change", () => {
  if (!templateSelect.value) return;
  document.querySelector('input[name="contentType"][value="text"]').checked = true;
  document.querySelector('input[name="textFormat"][value="beautiful"]').checked = true;
  textInput.value = templateSelect.value;
  updateContentType();
});
lettersInput.addEventListener("input", () => {
  saveDesign();
  renderQr();
});
document.querySelectorAll(".letter-idea").forEach((button) => {
  button.addEventListener("click", () => {
    lettersInput.value = button.dataset.letters;
    document.querySelector('input[name="qrStyle"][value="letters"]').checked = true;
    lettersOption.hidden = false;
    saveDesign();
    renderQr();
  });
});
styleInputs.forEach((input) => {
  input.addEventListener("change", () => {
    lettersOption.hidden = qrStyle() !== "letters";
    saveDesign();
    renderQr();
  });
});
foregroundInput.addEventListener("input", () => {
  saveDesign();
  renderQr();
});
backgroundInput.addEventListener("input", () => {
  saveDesign();
  renderQr();
});
downloadSizeInput.addEventListener("change", saveDesign);
document.querySelectorAll(".palette-button").forEach((button) => {
  button.addEventListener("click", () => {
    foregroundInput.value = button.dataset.foreground;
    backgroundInput.value = button.dataset.background;
    updateContrastWarning();
    saveDesign();
    renderQr();
  });
});
resetDesignButton.addEventListener("click", () => {
  document.querySelector('input[name="qrStyle"][value="letters"]').checked = true;
  lettersOption.hidden = false;
  foregroundInput.value = "#1c1915";
  backgroundInput.value = "#ffffff";
  lettersInput.value = "LOVE";
  downloadSizeInput.value = "1024";
  clearLogo();
  updateContrastWarning();
  saveDesign();
  renderQr();
});
logoInput.addEventListener("change", handleLogoUpload);
removeLogoButton.addEventListener("click", clearLogo);
contentTypeInputs.forEach((input) => {
  input.addEventListener("change", updateContentType);
});
textFormatInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateTextFormatHint();
    renderQr();
  });
});

function showSharedMessage() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("message")) {
    return false;
  }

  sharedMessage.textContent = params.get("message");
  generator.hidden = true;
  messagePage.hidden = false;
  document.title = "A message for you";
  return true;
}

function showGenerator() {
  messagePage.hidden = true;
  generator.hidden = false;
  document.title = "QR Generator";
}

window.addEventListener("hashchange", () => {
  if (!showSharedMessage()) {
    showGenerator();
  }
});

downloadBtn.addEventListener("click", () => {
  const outputSize = Number(downloadSizeInput.value);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputContext = outputCanvas.getContext("2d");
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(canvas, 0, 0, outputSize, outputSize);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = outputCanvas.toDataURL("image/png");
  link.download = `qr-${outputSize}-${stamp}.png`;
  link.click();
});

restoreDesign();
updateContentType();
updateTextFormatHint();
if (!showSharedMessage()) {
  showEmpty();
}
