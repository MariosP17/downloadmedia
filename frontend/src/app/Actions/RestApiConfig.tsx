"use server";

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export async function saveRestApiConfig(selection: string, url: string | null, port: number | null, protocol: string | null, serviceName: string | null) {
  try {
    if (!selection || (selection === "remote" && (!url || url.trim() === "")) || (selection === "local" && port === null && protocol === null)) {
      throw new Error("Invalid selection or URL or port or protocol");
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
    const REST_API_SECTION = config.REST_API_SECTION || {};
    REST_API_SECTION.REST_API_SELECTION = selection;
    if (url !== null)
        REST_API_SECTION.REST_API_URL = url;
    if (port !== null)
        REST_API_SECTION.REST_API_URL_PORT = port;
    if (protocol !== null)
        REST_API_SECTION.REST_API_HTTP_PROTOCOL = protocol;
    if (serviceName !== null)
        REST_API_SECTION.REST_API_SERVICE_NAME = serviceName;
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
    
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).REST_API_SECTION;
      return { REST_API_SELECTION: config.REST_API_SELECTION || null, REST_API_URL: config.REST_API_URL || null, REST_API_URL_PORT: config.REST_API_URL_PORT || 7000, REST_API_HTTP_PROTOCOL: config.REST_API_HTTP_PROTOCOL || "http", REST_API_SERVICE_NAME: config.REST_API_SERVICE_NAME };
  }
  catch (error) {
    console.error("Failed to read config file:", error);
    return {  REST_API_SELECTION: null, REST_API_URL: null, REST_API_URL_PORT: 7000, REST_API_HTTP_PROTOCOL: "http", REST_API_SERVICE_NAME: null };
  }
}




export async function getApiUrl(hostname: string) {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).REST_API_SECTION;
    if (config.REST_API_SELECTION === "remote" && config.REST_API_URL && config.REST_API_URL.trim() !== "") {
      return config.REST_API_URL;
    } else {
      return `${config.REST_API_HTTP_PROTOCOL || "http"}://${hostname}:${config.REST_API_URL_PORT || 7000}`;
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
    return `"http"://${hostname}:7000`;
  } 
}

export async function getApiUrlForLocalSelection(hostname: string, port: number | null, protocol: string | null) {
  return `${protocol || "http"}://${hostname}:${port || 7000}`;
}

export async function getApiServiceName() {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).REST_API_SECTION;
    if (!config.REST_API_SERVICE_NAME || config.REST_API_SERVICE_NAME.trim() === "") {
      return "stremio-downloader-api";
    }
    return (config.REST_API_SERVICE_NAME).endsWith(".service") ? config.REST_API_SERVICE_NAME : `${(config.REST_API_SERVICE_NAME.endsWith(".") ? config.REST_API_SERVICE_NAME.slice(0, -1) : config.REST_API_SERVICE_NAME)}.service`;
  } catch (error) {
    console.error("Failed to read config file:", error);
    return "stremio-downloader-api";
  }
}

    

export async function restartApi() : Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {

    const service = await getApiServiceName();

    exec(`sudo -n systemctl status ${service}`, (error, stdout, stderr) => {
      if (stderr && stderr.includes(`Unit ${service} could not be found`)) {
        resolve({ success: false, error: `API service ${service} not found.` });
        return;
      }
    });
    // Added 'restart' to the command string
    exec(`sudo -n systemctl restart ${service}`, (error, stdout, stderr) => {
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
      resolve({ success: true });
    });
  });
}