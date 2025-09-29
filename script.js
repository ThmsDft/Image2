document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const convertBtn = document.getElementById("convertBtn");
  const statusDiv = document.getElementById("status");
  const uploadLabel = document.querySelector(".upload-label");

  imageInput.addEventListener("change", () => {
    if (imageInput.files.length > 0) {
      statusDiv.textContent = `${imageInput.files.length} fichier(s) sélectionné(s).`;
    } else {
      statusDiv.textContent = "";
    }
  });

  uploadLabel.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadLabel.classList.add("dragover");
  });
  uploadLabel.addEventListener("dragleave", () => {
    uploadLabel.classList.remove("dragover");
  });
  uploadLabel.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadLabel.classList.remove("dragover");
    imageInput.files = e.dataTransfer.files;
    imageInput.dispatchEvent(new Event("change"));
  });

  convertBtn.addEventListener("click", async () => {
    const files = imageInput.files;
    if (files.length === 0) {
      statusDiv.textContent = "Veuillez d'abord sélectionner des images.";
      return;
    }

    statusDiv.textContent = "Conversion en cours, veuillez patienter...";
    convertBtn.disabled = true; // Désactiver le bouton pendant le traitement

    try {
      // Utilise Promise.all pour traiter toutes les images en parallèle
      const processedFiles = await Promise.all(
        Array.from(files).map((file) => processImage(file))
      );

      if (processedFiles.length === 1) {
        triggerDownload(processedFiles[0].blob, processedFiles[0].name);
      } else {
        const zip = new JSZip();
        processedFiles.forEach((file) => {
          zip.file(file.name, file.blob);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, "images_converties.zip");
      }
      statusDiv.textContent = "Conversion terminée avec succès !";
    } catch (error) {
      statusDiv.textContent = `Une erreur est survenue : ${error.message}`;
      console.error(error);
    } finally {
      convertBtn.disabled = false; // Réactiver le bouton
    }
  });

  /**
   * Convertit un fichier image en blob JPG, en gérant le cas spécifique des HEIC.
   * @param {File} file Le fichier image à convertir
   * @returns {Promise<{blob: Blob, name: string}>} Une promesse qui résout avec le blob et le nom du fichier JPG
   */
  async function processImage(file) {
    const fileName = file.name.toLowerCase();
    const newFileName = fileName.split(".").slice(0, -1).join(".") + ".jpg";

    // --- GESTION DU HEIC ---
    if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
      try {
        statusDiv.textContent = `Conversion de ${file.name}... (cela peut prendre un moment)`;
        const conversionResult = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9, // Qualité de la conversion
        });

        // heic2any peut retourner un seul blob ou un tableau de blobs (pour les images animées)
        const finalBlob = Array.isArray(conversionResult)
          ? conversionResult[0]
          : conversionResult;

        return { blob: finalBlob, name: newFileName };
      } catch (err) {
        throw new Error(`Échec de la conversion de ${file.name}.`);
      }
    }

    // --- GESTION DES AUTRES FORMATS (PNG, GIF, etc.) ---
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ blob: blob, name: newFileName });
              } else {
                reject(
                  new Error("Erreur lors de la conversion du canvas en blob.")
                );
              }
            },
            "image/jpeg",
            0.9
          );
        };
        img.onerror = () =>
          reject(new Error(`Impossible de charger l'image ${file.name}.`));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Déclenche le téléchargement d'un blob
   * @param {Blob} blob Le blob à télécharger
   * @param {string} fileName Le nom du fichier
   */
  function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});
