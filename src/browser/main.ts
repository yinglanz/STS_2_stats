/**
 * Client-side entry point for the hosted STS2 dashboard.
 *
 * The user picks their own `.run` files (or their whole history folder); we
 * parse + analyze entirely in the browser and render the same dashboard the CLI
 * produces. No data ever leaves the machine.
 */

import { RunData } from "../analyze/types";
import { parseRunFile, buildDashboardData } from "./buildData";
import { generateDashboard } from "../analyze/generateDashboard_v2";

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const folderInput = document.getElementById("folderInput") as HTMLInputElement;
const dropZone = document.getElementById("dropZone") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const uploader = document.getElementById("uploader") as HTMLElement;
const frame = document.getElementById("dashboardFrame") as HTMLIFrameElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;

let currentUrl: string | null = null;

function setStatus(msg: string, kind: "info" | "error" = "info") {
  statusEl.textContent = msg;
  statusEl.className = kind === "error" ? "status status--error" : "status";
}

async function handleFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList).filter((f) => f.name.endsWith(".run"));
  if (files.length === 0) {
    setStatus("No .run files found in your selection. Pick your saves\\history folder or the .run files inside it.", "error");
    return;
  }

  setStatus(`Reading ${files.length} run file${files.length === 1 ? "" : "s"}…`);

  const rawRuns: RunData[] = [];
  let skipped = 0;
  for (const file of files) {
    const text = await file.text();
    const run = parseRunFile(file.name, text);
    if (run) rawRuns.push(run);
    else skipped++;
  }

  if (rawRuns.length === 0) {
    setStatus(`Found ${files.length} file(s) but none were valid run data.`, "error");
    return;
  }

  setStatus(`Analyzing ${rawRuns.length} run${rawRuns.length === 1 ? "" : "s"}…`);

  // Yield a frame so the status text paints before the heavy synchronous work.
  await new Promise((r) => setTimeout(r, 16));

  try {
    const data = buildDashboardData(rawRuns);
    const html = generateDashboard(data);

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    frame.src = currentUrl;

    uploader.style.display = "none";
    frame.style.display = "block";
    resetBtn.style.display = "inline-flex";
    setStatus(`Loaded ${rawRuns.length} runs${skipped ? ` (${skipped} skipped)` : ""}.`);
  } catch (err) {
    console.error(err);
    setStatus(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, "error");
  }
}

fileInput.addEventListener("change", () => fileInput.files && handleFiles(fileInput.files));
folderInput.addEventListener("change", () => folderInput.files && handleFiles(folderInput.files));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dropZone--over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dropZone--over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dropZone--over");
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
});

resetBtn.addEventListener("click", () => {
  frame.style.display = "none";
  frame.src = "about:blank";
  uploader.style.display = "block";
  resetBtn.style.display = "none";
  fileInput.value = "";
  folderInput.value = "";
  setStatus("");
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
});
