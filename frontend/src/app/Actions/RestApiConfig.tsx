"use server";

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export async function saveRestApiConfig(selection: string, url: string | null, port: number | null) {
  try {
    if (!selection || (selection === "remote" && (!url || url.trim() === "")) || (selection === "local" && port === null)) {
      throw new Error("Invalid selection or URL or port");
    }
    // Define where to save this rest API configuration (e.g., project root)
    const configPath = path.join(process.cwd(), 'config.json');
    
    let config: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      config = {};
    }
    }

    config.REST_API_SELECTION = selection;
    if (url !== null)
        config.REST_API_URL = url;
    if (port !== null)
        config.REST_API_URL_PORT = port;

    // Write directly to the local server disk
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error("Failed to write config file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to write file to local disk" };
  }
}

export async function getRestApiConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { REST_API_SELECTION: config.REST_API_SELECTION || null, REST_API_URL: config.REST_API_URL || null, REST_API_URL_PORT: config.REST_API_URL_PORT || 7000 };
  }
  catch (error) {
    console.error("Failed to read config file:", error);
    return {  REST_API_SELECTION: null, REST_API_URL: null, REST_API_URL_PORT: 7000 };
  }
}



export async function getApiUrl(hostname: string, protocol: string = "http", port?: number) {
  try {
    protocol = protocol.replace(":", ""); // Remove colon if present
    const configPath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.REST_API_SELECTION === "remote" && config.REST_API_URL && config.REST_API_URL.trim() !== "") {
      return config.REST_API_URL;
    } else {
      return `${protocol}://${hostname}:${port || config.REST_API_URL_PORT || 7000}`;
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
    return `${protocol}://${hostname}:${port || 7000}`;
  }
}

export async function restartApi() : Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const config = await getRestApiConfig();
    if (config.REST_API_SELECTION === "remote") {
      console.error("Cannot restart API when using remote configuration");
      resolve({ success: false, error: "Cannot restart API when using remote configuration" });
      return;
    }
    // Added 'restart' to the command string
    exec('sudo -n systemctl restart stremio-downloader-api.service', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting API: ${error.message}`);
        // Use resolve() instead of return to pass the data back out of the Promise
        resolve({ success: false, error: error.message });
        return; 
      }
      if (stderr) {
        console.error(`Error output while restarting API: ${stderr}`);
        resolve({ success: false, error: stderr });
        return;
      }
      console.log(`API restarted successfully: ${stdout}`);
      resolve({ success: true });
    });
  });
}