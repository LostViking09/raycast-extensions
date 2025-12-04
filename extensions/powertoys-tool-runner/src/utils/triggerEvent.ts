import { execSync } from "child_process";

/**
 * Triggers a PowerToys Windows event using inline PowerShell command
 */
export function triggerPowerToysEvent(eventName: string, toolName: string): void {
  try {
    const psCommand = `[System.Threading.EventWaitHandle]::OpenExisting('${eventName}').Set()`;

    console.log(`Triggering ${toolName}...`);

    execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, {
      encoding: "utf-8",
      stdio: "pipe",
      windowsHide: true,
      timeout: 5000,
    });

    console.log(`${toolName} triggered successfully`);
  } catch (error) {
    console.error(`${toolName} launch failed:`, error);
  }
}
