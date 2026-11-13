"use server";

import fs from 'fs';
import path from 'path';

export async function savePlexConfig(selection: string, url: string | null, port: number | null, installed: boolean) {
  try {
    if (installed && (!selection || (selection === "remote" && (!url || url.trim() === "")) || (selection === "local" && port === null))) {
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
    const PLEX_SECTION = config.PLEX_SECTION || {};
    PLEX_SECTION.PLEX_INSTALLED = installed;
    if (!installed) {
        PLEX_SECTION.PLEX_SELECTION = null;
        PLEX_SECTION.PLEX_URL = null;
        PLEX_SECTION.PLEX_PORT = null;
    }
    else {
        PLEX_SECTION.PLEX_SELECTION = selection;
        if (url !== null)
            PLEX_SECTION.PLEX_URL = url;
        if (port !== null)
            PLEX_SECTION.PLEX_PORT = port;
    }
    config.PLEX_SECTION = PLEX_SECTION;

    // Write directly to the local server disk
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error("Failed to write config file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to write file to local disk" };
  }
}

export async function getPlexConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).PLEX_SECTION;
      return { PLEX_SELECTION: config.PLEX_SELECTION || null, PLEX_URL: config.PLEX_URL || null, PLEX_PORT: config.PLEX_PORT || 32400, PLEX_INSTALLED: config.PLEX_INSTALLED || false };
  }
  catch (error) {
    console.error("Failed to read config file:", error);
    return {  PLEX_SELECTION: null, PLEX_URL: null, PLEX_PORT: 32400, PLEX_INSTALLED: false };
  }
}



export async function getPlexUrl(hostname: string, protocol: string = "http", port?: number) {
  try {
    protocol = protocol.replace(":", ""); // Remove colon if present
    const configPath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).PLEX_SECTION;
    if (config.PLEX_SELECTION === "remote" && config.PLEX_URL && config.PLEX_URL.trim() !== "") {
      return config.PLEX_URL;
    } else {
      return `${protocol}://${hostname}:${port || config.PLEX_PORT || 32400}`;
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
    return `${protocol}://${hostname}:${port || 32400}`;
  }
}

export async function savePlexApiKey(apiKey: string) {
  try {
    const configPath = path.join(process.cwd(), "..", "backend", ".env");
    
    // 1. Read the existing .env file (or start with an empty string if it doesn't exist)
    let envContent = '';
    if (fs.existsSync(configPath)) {
      envContent = fs.readFileSync(configPath, 'utf8');
    }

    // 2. Check if the key already exists in the file
    const keyRegex = /^PLEX_API_KEY=.*$/m;
    
    if (keyRegex.test(envContent)) {
      // 3a. If it exists, replace the whole line with the new key
      envContent = envContent.replace(keyRegex, `PLEX_API_KEY=${apiKey}`);
    } else {
      // 3b. If it doesn't exist, append it to the end
      // Ensure there's a newline before appending if the file isn't empty
      const prefix = envContent && !envContent.endsWith('\n') ? '\n' : '';
      envContent += `${prefix}PLEX_API_KEY=${apiKey}\n`;
    }

    // 4. Write the updated text back to the .env file
    fs.writeFileSync(configPath, envContent, 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error("Failed to write env file:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to write file to local disk" 
    };
  }
};

export async function plexApiKeyExists() {
  try {
    const configPath = path.join(process.cwd(), "..", "backend", ".env");
    
    if (!fs.existsSync(configPath)) {
      return false;
    }

    const envContent = fs.readFileSync(configPath, 'utf8');
    const keyRegex = /^PLEX_API_KEY=.*$/m;
    
    return keyRegex.test(envContent);
  } catch (error) {
    console.error("Failed to read env file:", error);
    return false;
  }
};

export async function saveJellyfinConfig(selection: string, url: string | null, port: number | null, installed: boolean) {
  try {
    if (installed && (!selection || (selection === "remote" && (!url || url.trim() === "")) || (selection === "local" && port === null))) {
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
    const JELLYFIN_SECTION = config.JELLYFIN_SECTION || {};
    JELLYFIN_SECTION.JELLYFIN_INSTALLED = installed;
    if (!installed) {
        JELLYFIN_SECTION.JELLYFIN_SELECTION = null;
        JELLYFIN_SECTION.JELLYFIN_URL = null;
        JELLYFIN_SECTION.JELLYFIN_PORT = null;
    }
    else {
        JELLYFIN_SECTION.JELLYFIN_SELECTION = selection;
        if (url !== null)
            JELLYFIN_SECTION.JELLYFIN_URL = url;
        if (port !== null)
            JELLYFIN_SECTION.JELLYFIN_PORT = port;
    }
    config.JELLYFIN_SECTION = JELLYFIN_SECTION;
    // Write directly to the local server disk
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error("Failed to write config file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to write file to local disk" };
  }
}

export async function getJellyfinConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).JELLYFIN_SECTION;
      return { JELLYFIN_SELECTION: config.JELLYFIN_SELECTION || null, JELLYFIN_URL: config.JELLYFIN_URL || null, JELLYFIN_PORT: config.JELLYFIN_PORT || 8096, JELLYFIN_INSTALLED: config.JELLYFIN_INSTALLED || false };
  }
  catch (error) {
    console.error("Failed to read config file:", error);
    return {  JELLYFIN_SELECTION: null, JELLYFIN_URL: null, JELLYFIN_PORT: 8096, JELLYFIN_INSTALLED: false };
  }
}

export async function getJellyfinUrl(hostname: string, protocol: string = "http", port?: number) {
  try {
    protocol = protocol.replace(":", ""); // Remove colon if present
    const configPath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).JELLYFIN_SECTION;
    if (config.JELLYFIN_SELECTION === "remote" && config.JELLYFIN_URL && config.JELLYFIN_URL.trim() !== "") {
      return config.JELLYFIN_URL;
    } else {
      return `${protocol}://${hostname}:${port || config.JELLYFIN_PORT || 8096}`;
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
    return `${protocol}://${hostname}:${port || 8096}`;
  }
}

export async function saveJellyfinApiKey(apiKey: string) {
  try {
    const configPath = path.join(process.cwd(), "..", "backend", ".env");
    
    // 1. Read the existing .env file (or start with an empty string if it doesn't exist)
    let envContent = '';
    if (fs.existsSync(configPath)) {
      envContent = fs.readFileSync(configPath, 'utf8');
    }

    // 2. Check if the key already exists in the file
    const keyRegex = /^JELLYFIN_API_KEY=.*$/m;
    
    if (keyRegex.test(envContent)) {
      // 3a. If it exists, replace the whole line with the new key
      envContent = envContent.replace(keyRegex, `JELLYFIN_API_KEY=${apiKey}`);
    } else {
      // 3b. If it doesn't exist, append it to the end
      // Ensure there's a newline before appending if the file isn't empty
      const prefix = envContent && !envContent.endsWith('\n') ? '\n' : '';
      envContent += `${prefix}JELLYFIN_API_KEY=${apiKey}\n`;
    }

    // 4. Write the updated text back to the .env file
    fs.writeFileSync(configPath, envContent, 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error("Failed to write env file:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to write file to local disk" 
    };
  }
}

export async function jellyfinApiKeyExists() {
  try {
    const configPath = path.join(process.cwd(), "..", "backend", ".env");
    
    if (!fs.existsSync(configPath)) {
      return false;
    }

    const envContent = fs.readFileSync(configPath, 'utf8');
    const keyRegex = /^JELLYFIN_API_KEY=.*$/m;
    
    return keyRegex.test(envContent);
  } catch (error) {
    console.error("Failed to read env file:", error);
    return false;
  }
}