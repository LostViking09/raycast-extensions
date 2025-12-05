import { runPowerShellScript, showFailureToast } from "@raycast/utils";

/**
 * Triggers a PowerToys Windows event using Raycast's PowerShell utility
 */
export async function triggerPowerToysEvent(eventName: string, toolName: string): Promise<void> {
  try {
    const psCommand = `[System.Threading.EventWaitHandle]::OpenExisting('${eventName}').Set()`;

    console.log(`Triggering ${toolName}...`);

    await runPowerShellScript(psCommand, {
      timeout: 5000,
    });

    console.log(`${toolName} triggered successfully`);
  } catch (error) {
    console.error(`${toolName} launch failed:`, error);
    await showFailureToast(error, {
      title: `Failed to launch ${toolName}`,
    });
  }
}
