import util from "util";
import child_process from "child_process";
import os from "os";
import path from "path";
import { showToast, Toast, getPreferenceValues, environment } from "@raycast/api";
import { runPowerShellScript } from "@raycast/utils";

import { Volume, Preferences } from "./types";

const exec = util.promisify(child_process.exec);

/**
 * List all currently-mounted volumes
 */
export async function listVolumes(): Promise<Volume[]> {
  switch (os.platform()) {
    case "darwin":
      return listVolumesMac();

    case "win32":
      return listVolumesWindows();

    default:
      throw new Error("Unsupported environment");
  }
}

async function listVolumesMac(): Promise<Volume[]> {
  const exePath = "ls /Volumes";
  const options = {
    timeout: 0,
  };

  let volumes: Volume[] = [];
  try {
    const { stderr, stdout } = await exec(exePath, options);
    volumes = getVolumesFromLsCommandMac(stdout);
  } catch (e: any) {
    console.log(e.message);
    showToast({ style: Toast.Style.Failure, title: "Error listing volumes", message: e.message });
  }

  return volumes;
}

function getVolumesFromLsCommandMac(raw: string): Volume[] {
  const replacementChars = "~~~~~~~~~";
  const updatedRaw = raw.replace(/\n/g, replacementChars);
  const prefs = getPreferenceValues<Preferences>();
  const volumesToIgnore = prefs?.ignoredVolumes?.split(",");

  const parts = updatedRaw.split(replacementChars);
  let volumes: Volume[] = parts
    .map((p) => ({
      name: p,
    }))
    .filter((v) => v.name !== "")
    .filter((v) => !v.name.includes("TimeMachine.localsnapshots"));

  if (volumesToIgnore != null) {
    volumes = volumes.filter((v) => volumesToIgnore.findIndex((vol) => vol === v.name) < 0);
  }

  return volumes;
}

async function listVolumesWindows(): Promise<Volume[]> {
  let volumes: Volume[] = [];
  try {
    const script = `
      Get-Volume | Where-Object {$_.DriveType -eq 'Removable' -and $_.DriveLetter -ne $null} | 
      Select-Object DriveLetter, FileSystemLabel | 
      ConvertTo-Json
    `;

    const result = await runPowerShellScript(script, { timeout: 10000 });
    volumes = getVolumesFromPowerShellWindows(result);
  } catch (e: any) {
    console.log(e.message);
    showToast({ style: Toast.Style.Failure, title: "Error listing volumes", message: e.message });
  }

  return volumes;
}

function getVolumesFromPowerShellWindows(raw: string): Volume[] {
  const prefs = getPreferenceValues<Preferences>();
  const volumesToIgnore = prefs?.ignoredVolumes?.split(",").map((v) => v.trim());

  try {
    // Handle empty results (no removable drives)
    if (!raw || raw.trim() === "") {
      return [];
    }

    // Parse PowerShell JSON output
    const rawData = JSON.parse(raw);
    // PowerShell returns single object if only one result, array if multiple
    const volumeData = Array.isArray(rawData) ? rawData : [rawData];

    let volumes: Volume[] = volumeData
      .filter((v: any) => v.DriveLetter) // Ensure drive letter exists
      .map((v: any) => {
        const driveLetter = v.DriveLetter;
        const label = v.FileSystemLabel;
        // Format as "E: (USB Drive)" or just "E:" if no label
        const name = label ? `${driveLetter}: (${label})` : `${driveLetter}:`;
        return { name };
      });

    // Apply ignored volumes filter
    if (volumesToIgnore != null && volumesToIgnore.length > 0) {
      volumes = volumes.filter((v) => !volumesToIgnore.some((ignored) => v.name.includes(ignored)));
    }

    return volumes;
  } catch (e: any) {
    console.log("Error parsing PowerShell output:", e.message);
    return [];
  }
}

/**
 * Given the name of a mounted volume, safely ejects that volume
 * Very much based on the node-eject-media package, updated for
 * more modern JS
 * https://github.com/jayalfredprufrock/node-eject-media/blob/master/index.js
 */
export async function ejectVolume(volume: Volume): Promise<void> {
  switch (os.platform()) {
    case "darwin":
      await ejectVolumeMac(volume);
      break;

    case "win32":
      await ejectVolumeWindows(volume);
      break;

    default:
      throw new Error("Unsupported environment");
  }
}

async function ejectVolumeMac(volume: Volume): Promise<void> {
  // NOTE: Timeout of 0 should mean that it will wait infinitely
  const options = { timeout: 0 };
  const exePath = '/usr/sbin/diskutil eject "' + volume.name + '"';

  // NOTE: This could potentially let an error go through, however the calling function
  // should handle it, and show toasts appropriately
  await exec(exePath, options);
}

async function ejectVolumeWindows(volume: Volume): Promise<void> {
  // Extract drive letter from volume name (e.g., "E: (USB Drive)" -> "E")
  const driveLetter = volume.name.split(":")[0];

  // Path to RemoveDrive.exe in the assets folder using Raycast environment
  const removeDrivePath = path.join(environment.assetsPath, "RemoveDrive.exe");

  // Use RemoveDrive.exe to safely eject the drive
  // -b: show "Safe To Remove Hardware" balloon tip
  // -na: no about info
  const command = `"${removeDrivePath}" ${driveLetter}: -b -na`;

  const options = { timeout: 10000 };

  await exec(command, options);
}
