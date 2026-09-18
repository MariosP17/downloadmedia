export const qualityPriority: Record<string, number> = {
  "Torrentio\n4k DV | HDR10+ | HDR": 1,
  "Torrentio\n4k DV | HDR10+": 2,
  "Torrentio\n4k DV | HDR": 3,
  "Torrentio\n4k HDR10+ | HDR": 4,
  "Torrentio\n4k HDR10+": 5,
  "Torrentio\n4k HDR": 6,
  "Torrentio\n4k DV": 7,
  "Torrentio\n4k": 8,
  "Torrentio\n1080p HDR": 9,
  "Torrentio\n1080p": 10,
  "Torrentio\n1078p": 11,
  "Torrentio\n720p": 12,
  "Torrentio\n480p": 13,
  "Torrentio\nBluRay": 14,
  "Torrentio\nWEB-DL": 15,
  "Torrentio\nWEBRip": 16,
};

export const initiator: Record<string, string> = {
  "settings": "Settings",
  "file_download": "File Download",
  "folder_delete": "Folder Delete",
  "folder_rename": "Folder Rename",
  "file_delete": "File Delete",
  "file_rename": "File Rename"
};

export const OptionsNames : Record<string, string> = 
{
    "sticky_media_info" : "Media Info panel to stick on top",
    "logs_page_size" : "Number of logs to display per page",
    "download_mode" : "Download mode",
    "subtitle_languages" : "Subtitle languages"
};

export const isVideoExtension = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const videoExtensions = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"];
    return videoExtensions.includes(ext);
};

export const cleanExtension = (fileName: string) => {
    return fileName.replace(/\.[^/.]+$/, "");
};