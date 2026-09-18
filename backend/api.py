from datetime import datetime, timezone
import re
import threading
import os
import subprocess
from time import time
from click import File
import requests
from threading import Lock
from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS
from pathlib import Path
import shutil
import ffmpeg
import zipfile
import tempfile
import uuid
import json
from urllib.parse import unquote
from dotenv import load_dotenv, set_key
from download_parallel import enqueue_download as enqueue_parallel_download
from download_serial import SerialDownloadDispatcher

load_dotenv()

app = Flask(__name__)
CORS(app)

OPEN_SUBTITLES_API_KEY = os.getenv("OPEN_SUBTITLES_API_KEY")
OPEN_SUBTITLES_API_USERNAME = os.getenv("OPEN_SUBTITLES_API_USERNAME")
OPEN_SUBTITLES_API_PASSWORD = os.getenv("OPEN_SUBTITLES_API_PASSWORD")
OPEN_SUBTITLES_API_CURRENT_JWT = os.getenv("OPEN_SUBTITLES_API_CURRENT_JWT")
OPEN_SUBTITLES_CURRENT_USER_AGENT = os.getenv("OPEN_SUBTITLES_CURRENT_USER_AGENT")
JELLYFIN_API_KEY = os.getenv("JELLYFIN_API_KEY")
PLEX_API_KEY = os.getenv("PLEX_API_KEY")
OMDB_API_KEY = os.getenv("OMDB_API_KEY")

# Global dictionary to keep track of download progress
# Format: { "identifier_idx": percentage_float }
# progress_store = {"dbf2bf8259fcce3c74040f24416b8dad6fbeadf3_5": {"ttid": "tt6741278:2:4", "progress": 12.0},"dbf2bf8259fcce3c74040f24416b8dad6fbeadf3_6": {"ttid": "tt6741278:2:5", "progress": 100},"fc72b75b1275cc5a93f638c552da62d90f9b2853_2": {"ttid": "tt11198330:3:3", "progress": -2.0},"a3882ea6609c0332594ddce04bc462a8c1955574_2": {"ttid": "tt17490712", "progress": 100}}
progress_store = {}
# batch_progress_store = ["dbf2bf8259fcce3c74040f24416b8dad6fbeadf3_5"]

batch_progress_store = []
archive_jobs = {}

# Create a thread lock to ensure safe cross-talk between Flask routes and download threads
progress_lock = Lock()
batch_progress_lock = Lock()
archive_jobs_lock = Lock()
ARCHIVE_JOB_TTL_SECONDS = 3600
ARCHIVE_CHUNK_SIZE = 1024 * 1024

def remove_archive_temp_file(temp_zip_path, job_id, reason):
    if not temp_zip_path or not os.path.exists(temp_zip_path):
        print(f"job {job_id}: temporary archive already absent during {reason}")
        return True

    try:
        os.remove(temp_zip_path)
        print(f"job {job_id}: temporary archive removed during {reason}")
        return True
    except OSError as error:
        print(f"job {job_id}: failed to remove temporary archive during {reason}: {error}")
        return False

def refresh_login_token():
    """Hits the login route, gets a new token, and saves it straight into the .env file."""
    print("Token missing or invalid. Authenticating with OpenSubtitles...")
    
    url = "https://api.opensubtitles.com/api/v1/login"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    payload = {
        "username": OPEN_SUBTITLES_API_USERNAME,
        "password": OPEN_SUBTITLES_API_PASSWORD
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"Login failed ({response.status_code}): {response.text}")
        
    data = response.json()
    new_token = data.get("token")
    
    # Write the new token directly to your disk inside the .env file
    set_key(".env", "OPEN_SUBTITLES_API_CURRENT_JWT", new_token)
    print("New JWT Token securely written to .env file!")
    
    return new_token

@app.route("/getSubtitles", methods=["GET"])
def get_subtitles():
    load_dotenv(override=True)
    ttid = request.args.get("ttid")
    language = request.args.get("language", "en")
    if not ttid:
        return {"error": "Missing ttid parameter"}, 400
    try:
        subs = getSubtitles(ttid, language)
        if not subs:
            return {"error": "Subtitle not found"}, 404
        return {"subtitles": subs}
    except Exception as e:
        return {"error": str(e)}, 500

def getSubtitles(ttid, language="en"):
    """Fetches the subtitles for a given ttid and language."""
    isMovie = False if ":" in ttid else True
    url = f"https://api.opensubtitles.com/api/v1/subtitles?imdb_id={ttid}&languages={language}" if isMovie else f"https://api.opensubtitles.com/api/v1/subtitles?imdb_id={ttid.split(':')[0]}&languages={language}&season_number={ttid.split(':')[1]}&episode_number={ttid.split(':')[2]}"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "Authorization": f"Bearer {OPEN_SUBTITLES_API_CURRENT_JWT}",
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"Subtitle fetch failed ({response.status_code}): {response.text}")
        
    data = response.json()
    subtitles = data.get("data", [])
    
    if not subtitles:
        print(f"No subtitles found for ttid: {ttid} in language: {language}")
        return None
    
    # Return the first subtitle ID found
    return subtitles

@app.route("/downloadSubtitle", methods=["POST"])
def download_subtitle():
    """Downloads the subtitle file and saves it to disk."""
    file_id = request.json.get("file_id")
    filepath = request.json.get("filepath")

    if not file_id or not filepath:
        return {"error": "Missing required parameters"}, 400

    filepath = os.path.join("/media", filepath)
    url = "https://api.opensubtitles.com/api/v1/download"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "Authorization": f"Bearer {OPEN_SUBTITLES_API_CURRENT_JWT}",
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    payload = {
        "file_id": file_id
    }
    
    print(f"Requesting download link for File ID: {file_id}...")
    response = requests.post(url, json=payload, headers=headers)

    # Handle any actual system/network errors
    if response.status_code != 200:
        print(f"Download endpoint error ({response.status_code}): {response.text}")
        return {"error": f"Download endpoint error ({response.status_code}): {response.text}"}, response.status_code

    # Extract and pull down raw subtitle stream data
    download_json = response.json()
    download_url = download_json.get("link")
    remaining_downloads = download_json.get("remaining")
    reset_time = download_json.get("reset_time")
    print(f"Remaining downloads: {remaining_downloads} resets in {reset_time}")
    
    print("Link received. Fetching raw subtitle text...")
    file_content_response = requests.get(download_url)
    
    if file_content_response.status_code == 200:
        filename = os.path.basename(filepath)
        if os.path.exists(filepath):
            base_name, extension = os.path.splitext(filename)
            counter = 1
            
            # Loop until an unused file name is found
            while os.path.exists(filepath):
                filename = f"{base_name} ({counter}){extension}"
                filepath = os.path.join(os.path.dirname(filepath), filename)
                counter += 1

        # Write to the final available path
        with open(filepath, "w", encoding="utf-8") as file:
            file.write(file_content_response.text)
            print(f"Success! Subtitle securely saved to disk as '{filepath}'")
            refresh_jellyfin_libraries()
            refresh_plex_libraries()
            write_refresh_libraries_log(initiator="file_download")
        return {"name": filename, "size": format_size(os.path.getsize(filepath))}, 200
    else:
        print("Failed to stream the raw subtitle file from the generated link.")
        return {"error": "Failed to stream the raw subtitle file from the generated link."}, 500

def getSubtitleId(ttid, language="en"):
    """Fetches the subtitle ID for a given ttid and language."""
    isMovie = False if ":" in ttid else True
    url = f"https://api.opensubtitles.com/api/v1/subtitles?imdb_id={ttid}&languages={language}" if isMovie else f"https://api.opensubtitles.com/api/v1/subtitles?imdb_id={ttid.split(':')[0]}&languages={language}&season_number={ttid.split(':')[1]}&episode_number={ttid.split(':')[2]}"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "Authorization": f"Bearer {OPEN_SUBTITLES_API_CURRENT_JWT}",
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"Subtitle fetch failed ({response.status_code}): {response.text}")
        
    data = response.json()
    subtitles = data.get("data", [])
    
    if not subtitles:
        print(f"No subtitles found for ttid: {ttid} in language: {language}")
        return None
    
    # Return the first subtitle ID found
    return subtitles[0].get("attributes", {}).get("files", [{}])[0].get("file_id", None)

def download_and_save_subtitle(file_id, filename="subtitle.srt", is_retry=False):
    """Downloads the subtitle file, validating the disk-persisted .env token."""
    
    # Step 1: Force a reload of the file to ensure we read the latest token value
    load_dotenv(override=True)
    token = os.getenv("OPEN_SUBTITLES_API_CURRENT_JWT")
    
    # If no token exists in the .env file yet, go get one
    if not token:
        try:
            token = refresh_login_token()
        except Exception as e:
            print(f"Initial login attempt failed: {e}")
            return

    url = "https://api.opensubtitles.com/api/v1/download"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "Authorization": f"Bearer {token}",
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    payload = {
        "file_id": file_id
    }
    
    print(f"Requesting download link for File ID: {file_id}...")
    response = requests.post(url, json=payload, headers=headers)
    
    is_invalid_token = False
    if response.status_code == 500:
        try:
            error_data = response.json()
            # Check if the text "invalid" is in the message or string payload
            if "invalid" in str(error_data).lower():
                is_invalid_token = True
        except ValueError:
            # Fallback if response isn't clean JSON but contains the string
            if "invalid" in response.text.lower():
                is_invalid_token = True

    if is_invalid_token and not is_retry:
        print(" Server reported '500: invalid' token. Token expired! Refreshing...")
        try:
            refresh_login_token()
            # Retry the calculation sequence, flagging is_retry to prevent loops
            return download_and_save_subtitle(file_id, filename, is_retry=True)
        except Exception as e:
            print(f"Failed to refresh token during retry layout: {e}")
            return
    # ---------------------------------------------------------

    # Handle any actual system/network errors
    if response.status_code != 200:
        print(f"Download endpoint error ({response.status_code}): {response.text}")
        return

    # Extract and pull down raw subtitle stream data
    download_json = response.json()
    download_url = download_json.get("link")
    remaining_downloads = download_json.get("remaining")
    reset_time = download_json.get("reset_time")
    print(f"Remaining downloads: {remaining_downloads} resets in {reset_time}")
    
    print("Link received. Fetching raw subtitle text...")
    file_content_response = requests.get(download_url)
    
    if file_content_response.status_code == 200:
        with open(filename, "w", encoding="utf-8") as file:
            file.write(file_content_response.text)
        print(f"Success! Subtitle securely saved to disk as '{filename}'")
    else:
        print("Failed to stream the raw subtitle file from the generated link.")

@app.route('/getOpenSubtitlesInfo', methods=['GET'])
def getOpenSubtitlesInfo(is_retry=False):
    """ Gets remimaining available subtitle downloads from the OpenSubtitles API. """
    # Step 1: Force a reload of the file to ensure we read the latest token value
    load_dotenv(override=True)
    token = os.getenv("OPEN_SUBTITLES_API_CURRENT_JWT")
    
    # If no token exists in the .env file yet, go get one
    if not token:
        try:
            token = refresh_login_token()
        except Exception as e:
            print(f"Initial login attempt failed: {e}")
            return jsonify({"error": "Failed to authenticate with OpenSubtitles."}), 500

    url = "https://api.opensubtitles.com/api/v1/infos/user"
    headers = {
        "Content-Type": "application/json",
        "Api-Key": OPEN_SUBTITLES_API_KEY,
        "Authorization": f"Bearer {token}",
        "User-Agent": OPEN_SUBTITLES_CURRENT_USER_AGENT
    }
    
    response = requests.get(url, headers=headers)
    
    is_invalid_token = False
    if response.status_code != 200:
        try:
            error_data = response.json()
            # Check if the text "invalid" is in the message or string payload
            if "invalid" in str(error_data).lower():
                is_invalid_token = True
        except ValueError:
            # Fallback if response isn't clean JSON but contains the string
            if "invalid" in response.text.lower():
                is_invalid_token = True

    if is_invalid_token and not is_retry:
        print(" Server reported 'invalid' token. Token expired! Refreshing...")
        try:
            refresh_login_token()
            # Retry the calculation sequence, flagging is_retry to prevent loops
            return getOpenSubtitlesInfo(is_retry=True)
        except Exception as e:
            print(f"Failed to refresh token during retry layout: {e}")
            return jsonify({"error": "Failed to refresh token during retry."}), 500
    # ---------------------------------------------------------

    # Handle any actual system/network errors
    if response.status_code != 200:
        print(f"Download endpoint error ({response.status_code}): {response.text}")
        return jsonify({"error": f"Download endpoint error ({response.status_code})"}), response.status_code

    subtitle_info = response.json()
    return subtitle_info, 200

def checkForSubsAndDownload(filename, ttid):
    # Check for subtitle files in the media metadata ussing ffmpeg or similar tools, and download them if available.
    has_subs = check_for_subtitles(filename)

    if has_subs is False:
        dirname = os.path.dirname(filename)
        base_name = os.path.splitext(os.path.basename(filename))[0]
        subtitle_filename = os.path.join(dirname, base_name + ".srt")
        if not os.path.exists(subtitle_filename):
            print(f"Subtitle file not found for {filename}. Attempting to download subtitles for ttid: {ttid}")
            try:
                subtitle_id = getSubtitleId(ttid, language="en")
                if subtitle_id:
                    download_and_save_subtitle(subtitle_id, subtitle_filename)
                else:
                    print(f"No subtitles available for {filename} (ttid: {ttid}).")
            except Exception as e:
                print(f"Error occurred while fetching subtitle ID for {ttid}: {e}")
        else:
            print(f"Subtitle file already exists for {filename}. Skipping download.")
    elif has_subs is True:
        print(f"Subtitles already present in {filename}. No download needed.")
    else:
        print(f"Could not determine subtitle presence for {filename}. Skipping subtitle download.")

def check_for_subtitles(filename):
    try:
        # Probe the video file to extract its stream architecture
        probe = ffmpeg.probe(filename)
        
        # Filter the streams to look specifically for a subtitle track
        subtitle_streams = [stream for stream in probe['streams'] if stream['codec_type'] == 'subtitle']
    
        return len(subtitle_streams) > 0
    except ffmpeg.Error as e:
        print(f"Error probing file: {e.stderr.decode()}")
        return None

def checkIfDoneAndRefreshLibraries():
    """
    Checks if all downloads have completed and refreshes the media libraries if so.
    """
    isDownloading = False
    
    with progress_lock:
        # If there are no tasks tracked, we aren't downloading anything
        if not progress_store:
            isDownloading = False
        else:
            # STILL downloading if ANY task is active (between 0.0 and 100.0)
            # and NOT in an idle/failed state (-1.0, -2.0)
            isDownloading = any(
                0.0 <= progress_store.get(task_id, {}).get("progress", 0.0) < 100.0
                and progress_store.get(task_id, {}).get("progress", 0.0) not in (-1.0, -2.0)
                for task_id in progress_store
            )

    if not isDownloading:  
        print("All downloads completed (or cleared). Refreshing media libraries...")
        try:
            refresh_jellyfin_libraries()
            refresh_plex_libraries()
            write_refresh_libraries_log(initiator='file_download')
        except Exception as e:
            print(f"Error occurred while refreshing libraries: {e}")
    else:
        print("Downloads still in progress...")

def refresh_jellyfin_libraries():
        url = "http://localhost:8096/Library/Refresh"
        headers = {
            "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
            "Content-Type": "application/json"
        }
        while True:
            try:
                response = requests.post(url, headers=headers, json={})
                
                if response.status_code in (200, 204):
                    print("Jellyfin libraries refreshed successfully.")
                    return True  # Break the loop and exit the function successfully
                    
                elif response.status_code == 503:
                    retry_after = int(response.headers.get('Retry-After', 5))
                    message = response.json().get('message', 'Service Unavailable')
                    print(f"{message}. Retrying after {retry_after} seconds...")
                    time.sleep(retry_after)
                    continue  # Loop goes back to the top and tries again cleanly
                    
                else:
                    print(f"Failed to refresh. Status code: {response.status_code}, Response: {response.text}")
                    return False # Exit on hard error (401, 404, etc.)
                    
            except Exception as e:
                print(f"Exception occurred while refreshing Jellyfin libraries: {e}")
                return False

def refresh_plex_libraries():
    url = "http://localhost:32400/library/sections/all/refresh"
    headers = {
        "X-Plex-Token": PLEX_API_KEY,
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code in (200, 204):
            print("Plex libraries refreshed successfully.")
            return True
        else:
            print(f"Failed to refresh Plex libraries. Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print(f"Exception occurred while refreshing Plex libraries: {e}")
        return False

def download_stream_task(identifier: str, idx: str, path: str = "/media", name: str = "", ttid: str = "",add: bool = True):
    task_key = f"{identifier}_{idx}"
    
    if add:
        with progress_lock:
            progress_store[task_key] = { "ttid": ttid, "progress": 0.0 }
        
    print(f"Initiating download task for {task_key} with path: {path} and name: {name}\n")
    url = f"http://127.0.0.1:11470/{identifier}/{idx}?external=1&download=1"
    filename = os.path.join(path, name if bool(Path(name).suffix) else name + ".mp4" if name else os.path.join(path, task_key + ".mp4"))
    
    try:
        os.makedirs(path, exist_ok=True)
        # Use a balanced timeout matrix to allow quick interruptions
        with requests.get(url, stream=True, timeout=(5, 30)) as response:
            response.raise_for_status()
        
            total_size = response.headers.get('content-length')
            
            with open(filename, 'wb') as f:
                if total_size is None:
                    # Balanced chunk size gives Flask breathing room to process requests under the GIL
                    for chunk in response.iter_content(chunk_size=32768): 
                        # Read the state safely under a lock window
                        with progress_lock:
                            is_canceled = progress_store.get(task_key, {}).get("progress") == -1.0
                        
                        if is_canceled:
                            print(f"Download {task_key} cancelled mid-flight (No content length).")
                            f.close()
                            if os.path.exists(filename): os.remove(filename)
                            with progress_lock:
                                progress_store.pop(task_key, None)  # Clean up cancelled task
                                with batch_progress_lock:
                                    if task_key in batch_progress_store: batch_progress_store.remove(task_key)
                            checkIfDoneAndRefreshLibraries()
                            return 

                        if chunk:
                            f.write(chunk)
                    f.flush()
                    os.fsync(f.fileno())
                    print(f"Download completed successfully for {task_key}")
                    # with progress_lock:
                    #     progress_store[task_key] = { "ttid": ttid, "progress": 100.0 }
                    #     checkForSubsAndDownload(filename,unquote(ttid)) 
                else:
                    total_size = int(total_size)
                    downloaded_bytes = 0
                    
                    # Reduced from 128KB to 32KB to create frequent cancellation checks
                    for chunk in response.iter_content(chunk_size=32768):
                        with progress_lock: # Debugging: Print current progress store state
                            is_canceled = progress_store.get(task_key, {}).get("progress") == -1.0
                            
                        if is_canceled:
                            print(f"Download {task_key} cancelled mid-flight.")
                            f.close()
                            if os.path.exists(filename): os.remove(filename)
                            with progress_lock:
                                progress_store.pop(task_key, None)  # Clean up cancelled task
                                with batch_progress_lock:
                                    if task_key in batch_progress_store: batch_progress_store.remove(task_key)
                            checkIfDoneAndRefreshLibraries()
                            return 

                        if chunk:
                            f.write(chunk)
                            downloaded_bytes += len(chunk)
                            percentage = round((downloaded_bytes / total_size) * 100, 2)
                            
                            with progress_lock:
                                # Verify it wasn't canceled during the write execution cycle
                                if progress_store.get(task_key, {}).get("progress") != -1.0:
                                    progress_store[task_key] = { "ttid": ttid, "progress": percentage }
                    f.flush()
                    os.fsync(f.fileno())
                                    
                    print(f"Download completed successfully for {task_key}")
        with progress_lock:
            progress_store[task_key] = { "ttid": ttid, "progress": 100.0 }
        checkForSubsAndDownload(filename,unquote(ttid))  # Check for subtitles after download
        checkIfDoneAndRefreshLibraries()  # Refresh libraries after download completion

    except Exception as e:
        with progress_lock:
            current_progress = progress_store.get(task_key, {}).get("progress")
        
        # FIX: Only treat as an error if it wasn't deliberately stopped by the user
        if current_progress != -1.0:
            print(f"Error downloading {task_key}: {e}")
            with progress_lock:
                # Do NOT pop instantly; let the frontend read the failure status safely first
                progress_store[task_key] = { "ttid": ttid, "progress": -2.0 } 
        
        checkIfDoneAndRefreshLibraries()
        if os.path.exists(filename):
            try: os.remove(filename)
            except: pass

def _is_download_cancelled(task_key):
    with progress_lock:
        return progress_store.get(task_key, {}).get("progress") == -1.0

def _discard_queued_task(task_key):
    with progress_lock:
        progress_store.pop(task_key, None)
    with batch_progress_lock:
        if task_key in batch_progress_store:
            batch_progress_store.remove(task_key)

serial_download_dispatcher = SerialDownloadDispatcher(
    download_stream_task,
    _is_download_cancelled,
    _discard_queued_task,
)

def enqueue_download(identifier, idx, path, name, ttid):
    """Dispatch a download using the configured mode, defaulting to parallel."""
    task_key = f"{identifier}_{idx}"
    with progress_lock:
        progress_store[task_key] = {"ttid": ttid, "progress": 0.0}

    mode = getOptions().get("download_mode", "parallel")
    print(f"Dispatching download in {mode} mode for task {task_key}")
    if mode == "serial":
        serial_download_dispatcher.enqueue(identifier, idx, path, name, ttid)
    else:
        enqueue_parallel_download(download_stream_task, identifier, idx, path, name, ttid)

# def batchDownloadsInitialiseAndStart(items: list):
#     """
#     Initializes and starts batch downloads for a list of task identifiers.
#     """
#     for task_id in items:
#         with progress_lock:
#             if task_id.get("identifier", "")+"_"+task_id.get("idx", "") in progress_store and progress_store[task_id.get("identifier", "")+"_"+task_id.get("idx", "")].get("progress", 0.0) >= 0 and progress_store[task_id.get("identifier", "")+"_"+task_id.get("idx", "")].get("progress", 0.0) < 100:
#                 print(f"Download already in progress for {task_id}. Skipping.")
#                 continue
#             else:
#                 progress_store[task_id.get("identifier", "")+"_"+task_id.get("idx", "")] = { "ttid": task_id.get("ttid", ""), "progress": 0.0 }
#     for task in items:
#         download_stream_task(task.get("identifier", ""), task.get("idx", ""), task.get("path", ""), task.get("name", ""), task.get("ttid", ""), add=False)

@app.route('/download', methods=['POST'])
def start_download():
    """
    POST Endpoint: Receives JSON payload and spins up a background thread.
    """
    data = request.get_json() or {}
    identifier = data.get('identifier')
    idx = data.get('idx')
    path = data.get('path', '/media')
    name = data.get('name', "")
    ttid = data.get('ttid', "") 

    if not identifier or not idx:
        return jsonify({"error": "Both 'identifier' and 'idx' are required parameters."}), 400
    
    task_key = f"{identifier}_{idx}"
    
    # Check if download is already running or completed
    with progress_lock:
        if task_key in progress_store and progress_store[task_key].get("progress") >= 0 and progress_store[task_key].get("progress") < 100:
            return jsonify({"message": "Download already in progress", "task_id": task_key}), 200

    enqueue_download(identifier, idx, path, name, ttid)
    
    return jsonify({
        "status": "Started", 
        "task_id": task_key,
        "message": "Download initiated in background thread."
    }), 202

@app.route("/batchDownload", methods=["POST"])
def batch_download():
    """
    POST Endpoint: Receives JSON payload for batch downloads and spins up background threads.
    """
    data = request.get_json() or {}
    items = data.get("items", [])
    path = data.get("path", "/media")
    
    if not items or not isinstance(items, list):
        return jsonify({"error": "A list of items is required."}), 400
    if not path:
        return jsonify({"error": "A valid path is required."}), 400
        
    path = os.path.join("/media", path)  # Ensure all downloads are under /media
    
    if os.path.abspath(path) == os.path.abspath("/media/stremio-server") or os.path.abspath(path) == os.path.abspath("/media"):
        return jsonify({"error": "Cannot download to protected folder"}), 403
        
    if not os.path.exists(path):
        return jsonify({"error": "Specified path does not exist"}), 404

    task_ids = []
    local_task_ids = []

    for item in items:
        identifier = item.get('identifier')
        
        # --- FIXED: Explicit Parameter Falling-Back Validation Mapping ---
        # Coerce idx vs fileIdx safely, and guarantee strings aren't treated as 'not idx'
        idx = item.get('idx') if item.get('idx') is not None else item.get('fileIdx')
        name = item.get('name', "") or item.get('filename', "") or item.get('title', "")
        ttid = item.get('ttid', "")
        
        print(f"Preparing to download: identifier={identifier}, idx={idx}, name={name}, ttid={ttid}, path={path}\n")
        
        # Safe truthiness check allowing string/integer 0 or "0" to pass through cleanly
        if identifier is None or identifier == "" or idx is None or idx == "":
            print(f"Skipping invalid item: {item}\n")
            continue 

        task_key = f"{identifier}_{idx}"
        
        with progress_lock:
            task_exists = task_key in progress_store
            current_progress = progress_store[task_key].get("progress", 0.0) if task_exists else None

        # Check if download is already actively running or staging
        if task_exists and current_progress is not None and 0.0 <= current_progress < 100.0:
            task_ids.append(task_key)
            continue
        
        local_task_ids.append({"identifier": identifier, "idx": str(idx),"path": path, "name": name, "ttid": ttid})
        with batch_progress_lock:
            batch_progress_store.append(task_key)
        enqueue_download(identifier, str(idx), path, name, ttid)
        task_ids.append(task_key)

    # batchDownloadsInitialiseAndStart(local_task_ids)

    return jsonify({
        "status": "Batch download initiated",
        "task_ids": task_ids,
        "message": f"Successfully initiated background download threads for {len(task_ids)} items."
    }), 202

@app.route('/downloadFileToClient', methods=['POST'])
def download_file_to_client():
    """
    POST Endpoint: Streams the requested file to the client browser 
    saving it cleanly using just the file's basename.
    """
    # --- FIXED: Changed from .get_json() to .form to accept standard form POST data ---
    file_path = request.form.get('filePath', None)  

    if not file_path:
        return jsonify({"error": "The 'filePath' parameter is required.", "status": "Failed"}), 400

    # Clean and resolve the absolute system path
    absolute_path = os.path.join("/media", file_path)
    if not os.path.exists(absolute_path) or os.path.isdir(absolute_path):
        return jsonify({"error": "Target file path not found on server.", "status": "Failed"}), 404

    clean_file_name = os.path.basename(absolute_path)

    try:
        return send_file(
            absolute_path,
            as_attachment=True,
            download_name=clean_file_name 
        )
    except Exception as e:
        return jsonify({"error": f"Failed to stream file payload: {str(e)}", "status": "Failed"}), 500

def cleanup_archive_jobs():
    now = time()
    with archive_jobs_lock:
        expired = [
            job_id for job_id, job in archive_jobs.items()
            if job.get("status") in {"ready", "cancelled", "failed"}
            and now - job.get("updated_at", now) > ARCHIVE_JOB_TTL_SECONDS
        ]
        for job_id in expired:
            temp_zip_path = archive_jobs[job_id].get("temp_zip_path")
            remove_archive_temp_file(temp_zip_path, job_id, "expiry cleanup")
            del archive_jobs[job_id]
            print(f"expired job {job_id}")


def resolve_archive_folder(folder_path):
    print(f"resolving folder path: {folder_path!r}")
    media_root = Path("/media").resolve()
    absolute_path = (media_root / str(folder_path).lstrip("/\\")).resolve()
    if absolute_path != media_root and media_root not in absolute_path.parents:
        print(f"rejected folder outside media root: {folder_path!r}")
        return None
    if not absolute_path.is_dir():
        print(f"rejected missing or non-directory path: {absolute_path}")
        return None
    print(f"resolved folder: {absolute_path}")
    return absolute_path


def archive_job_snapshot(job_id):
    with archive_jobs_lock:
        job = archive_jobs.get(job_id)
        if not job:
            print(f"status requested for unknown job {job_id}")
            return None
        snapshot = {
            "job_id": job_id,
            "status": job["status"],
            "progress": job["progress"],
            "total_bytes": job["total_bytes"],
            "processed_bytes": job["processed_bytes"],
            "folder_name": job["folder_name"],
            "error": job.get("error"),
        }
    print(f"status {job_id}: {snapshot['status']} ({snapshot['progress']}%)")
    return snapshot


def archive_job_cancelled(job_id):
    with archive_jobs_lock:
        return archive_jobs.get(job_id, {}).get("status") in {"cancelling", "cancelled"}


def create_archive_job(job_id, absolute_path, temp_zip_path):
    print(f"worker started for job {job_id}: {absolute_path}")
    try:
        files = []
        total_bytes = 0
        with archive_jobs_lock:
            archive_jobs[job_id]["status"] = "scanning"
            archive_jobs[job_id]["updated_at"] = time()
        print(f"job {job_id}: scanning files")

        for root, dirs, filenames in os.walk(absolute_path, followlinks=False):
            dirs[:] = [directory for directory in dirs if not Path(root, directory).is_symlink()]
            for filename in filenames:
                source_path = Path(root, filename)
                if source_path.is_symlink() or not source_path.is_file():
                    continue
                file_size = source_path.stat().st_size
                files.append((source_path, os.path.relpath(source_path, absolute_path)))
                total_bytes += file_size

        with archive_jobs_lock:
            archive_jobs[job_id]["total_bytes"] = total_bytes
            archive_jobs[job_id]["status"] = "zipping"
            archive_jobs[job_id]["updated_at"] = time()
        print(f"job {job_id}: found {len(files)} files ({total_bytes} bytes); packaging without compression")

        with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_STORED,allowZip64=True) as zip_file:
            for source_path, archive_name in files:
                if archive_job_cancelled(job_id):
                    raise InterruptedError("Archive creation cancelled")
                print(f"job {job_id}: adding {archive_name}")
                zip_info = zipfile.ZipInfo.from_file(source_path, archive_name)
                with source_path.open("rb") as source, zip_file.open(zip_info, "w", force_zip64=True) as destination:
                    while True:
                        chunk = source.read(ARCHIVE_CHUNK_SIZE)
                        if not chunk:
                            break
                        destination.write(chunk)
                        with archive_jobs_lock:
                            job = archive_jobs[job_id]
                            job["processed_bytes"] += len(chunk)
                            job["progress"] = round(
                                job["processed_bytes"] / total_bytes * 100, 2
                            ) if total_bytes else 100.0
                            job["updated_at"] = time()
                        if archive_job_cancelled(job_id):
                            raise InterruptedError("Archive creation cancelled")
                print(f"job {job_id}: added {archive_name}")

        with archive_jobs_lock:
            archive_jobs[job_id]["status"] = "ready"
            archive_jobs[job_id]["progress"] = 100.0
            archive_jobs[job_id]["updated_at"] = time()
        print(f"job {job_id}: ready at {temp_zip_path}")
    except InterruptedError:
        remove_archive_temp_file(temp_zip_path, job_id, "cancellation")
        with archive_jobs_lock:
            archive_jobs[job_id]["status"] = "cancelled"
            archive_jobs[job_id]["updated_at"] = time()
            print(f"job {job_id}: cancelled and temporary archive removed")
    except Exception as error:
        remove_archive_temp_file(temp_zip_path, job_id, "failure cleanup")
        with archive_jobs_lock:
            archive_jobs[job_id]["status"] = "failed"
            archive_jobs[job_id]["error"] = str(error)
            archive_jobs[job_id]["updated_at"] = time()
        print(f"job {job_id}: failed: {error}")


@app.route('/downloadFolderToClient', methods=['POST'])
def download_folder_to_client():
    print("archive creation requested")
    cleanup_archive_jobs()
    data = request.get_json(silent=True) or request.form
    folder_path = data.get('filePath')
    absolute_path = resolve_archive_folder(folder_path) if folder_path else None
    if absolute_path is None:
        print("archive request rejected: folder not found")
        return jsonify({"error": "Target folder path not found on server.", "status": "Failed"}), 404

    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = temp_zip.name
    temp_zip.close()
    job_id = uuid.uuid4().hex
    with archive_jobs_lock:
        archive_jobs[job_id] = {
            "status": "queued", "progress": 0.0, "total_bytes": 0,
            "processed_bytes": 0, "folder_name": absolute_path.name,
            "temp_zip_path": temp_zip_path, "updated_at": time(), "error": None,
        }
    thread = threading.Thread(target=create_archive_job, args=(job_id, absolute_path, temp_zip_path), daemon=True)
    thread.start()
    print(f"job {job_id}: queued for {absolute_path} with temporary archive {temp_zip_path}")
    return jsonify({"status": "queued", "job_id": job_id}), 202


@app.route('/folderDownloadProgress/<job_id>', methods=['GET'])
def folder_download_progress(job_id):
    print(f"progress endpoint called for job {job_id}")
    cleanup_archive_jobs()
    snapshot = archive_job_snapshot(job_id)
    if snapshot is None:
        return jsonify({"error": "Archive job not found"}), 404
    return jsonify(snapshot), 200


@app.route('/cancelFolderDownload/<job_id>', methods=['POST'])
def cancel_folder_download(job_id):
    print(f"cancel requested for job {job_id}")
    with archive_jobs_lock:
        job = archive_jobs.get(job_id)
        if job is None:
            print(f"cancel rejected for unknown job {job_id}")
            return jsonify({"error": "Archive job not found"}), 404
        if job["status"] in {"queued", "scanning", "zipping"}:
            job["status"] = "cancelling"
            job["updated_at"] = time()
            print(f"job {job_id}: marked cancelling")
        else:
            print(f"job {job_id}: cancel ignored in status {job['status']}")
    return jsonify({"status": "cancelling", "job_id": job_id}), 202


@app.route('/downloadFolderToClient/<job_id>', methods=['GET'])
def download_folder_archive(job_id):
    print(f"download requested for job {job_id}")
    with archive_jobs_lock:
        job = archive_jobs.get(job_id)
        if job is None:
            print(f"download rejected for unknown job {job_id}")
            return jsonify({"error": "Archive job not found"}), 404
        if job["status"] != "ready":
            print(f"download rejected for job {job_id}: status {job['status']}")
            return jsonify({"error": f"Archive is {job['status']}"}), 409
        temp_zip_path = job["temp_zip_path"]
        download_name = f"{job['folder_name']}.zip"
        archive_size = os.path.getsize(temp_zip_path)

    def stream_archive():
        try:
            with open(temp_zip_path, "rb") as archive_file:
                while True:
                    chunk = archive_file.read(ARCHIVE_CHUNK_SIZE)
                    if not chunk:
                        break
                    yield chunk
        finally:
            remove_archive_temp_file(temp_zip_path, job_id, "download cleanup")
            with archive_jobs_lock:
                archive_jobs.pop(job_id, None)
            print(f"job {job_id}: download stream closed and temporary archive removed")

    response = Response(stream_archive(), mimetype="application/zip", direct_passthrough=True)
    response.headers["Content-Disposition"] = f'attachment; filename="{download_name}"'
    response.headers["Content-Length"] = str(archive_size)
    return response

@app.route("/archiveJobs", methods=["GET"])
def list_archive_jobs():
    cleanup_archive_jobs()
    with archive_jobs_lock:
        jobs_snapshot = [
            {
                "job_id": job_id,
                "status": job["status"],
                "progress": job["progress"],
                "total_bytes": job["total_bytes"],
                "processed_bytes": job["processed_bytes"],
                "folder_name": job["folder_name"],
                "error": job.get("error"),
            }
            for job_id, job in archive_jobs.items()
        ]
    return jsonify(jobs_snapshot), 200

@app.route('/cleanupArchiveJobs', methods=['POST'])
def cleanup_archive_jobs_endpoint():
    cleanup_archive_jobs()
    return jsonify({"status": "Cleanup completed"}), 200

@app.route('/cancel', methods=['POST'])
def cancel_download():
    data = request.get_json() or {}
    identifier = data.get('identifier')
    idx = data.get('idx')

    if not identifier or not idx:
        return jsonify({"error": "Both 'identifier' and 'idx' are required."}), 400

    task_key = f"{identifier}_{idx}"

    with progress_lock:
        if task_key in progress_store:
            # Force target key state cancellation status immediately
            progress_store[task_key] = { "ttid": progress_store[task_key].get("ttid"), "progress": -1.0 }
            return jsonify({"message": "Download cancellation verified.", "task_id": task_key}), 200
        
    return jsonify({"error": "Task active reference track not found."}), 404

@app.route('/cancelBatch', methods=['POST'])
def cancel_batch_download():
    """
    POST Endpoint: Receives JSON payload and cancels the batch download.
    """
    data = request.get_json() or {}
    task_ids = data.get('task_ids', [])

    if not task_ids or not isinstance(task_ids, list):
        return jsonify({"error": "A list of task_ids is required.", "status": "Failed"}), 400

    cancelled_tasks = []

    with progress_lock:
        for task_key in task_ids:
            if task_key in progress_store:
                # Flag the target task status to -1.0 so the download thread halts immediately
                progress_store[task_key] = { 
                    "ttid": progress_store[task_key].get("ttid", ""), 
                    "progress": -1.0 
                }
                cancelled_tasks.append(task_key)

    return jsonify({
        "status": "Success",
        "message": f"Batch download cancellation requested for {len(cancelled_tasks)} active tasks.", 
        "task_ids": cancelled_tasks
    }), 200

@app.route('/progress/<identifier>/<idx>', methods=['GET'])
def get_progress(identifier, idx):
    """
    GET Endpoint: Frontend polls this method to get the percentage.
    """
    task_key = f"{identifier}_{idx}"
    
    with progress_lock:
        if task_key not in progress_store:
            return jsonify({"progress": 0.0, "status": "Not started or task not found"}), 404
    with progress_lock:
        current_progress = progress_store[task_key]
        print(f"Queried progress for {task_key}: {current_progress}")  # Debugging: Print current progress state
    if current_progress.get("progress") == -1.0 or current_progress.get("progress") == -2.0:
        with progress_lock:
            progress_store.pop(task_key, None) # Clean up cancelled or failed task
            with batch_progress_lock:
                if task_key in batch_progress_store: batch_progress_store.remove(task_key)
        return jsonify({"progress": 0.0, "status": "Failed"}), 500
    elif current_progress.get("progress") == 100.0:
        with progress_lock:
            progress_store.pop(task_key, None) # Clean up completed task
            with batch_progress_lock:
                if task_key in batch_progress_store: batch_progress_store.remove(task_key)
        return jsonify({"progress": 100.0, "status": "Completed"}), 200
        
    return jsonify({"progress": current_progress.get("progress"), "status": "Downloading"}), 200

@app.route('/batchProgress', methods=['POST'])
def get_batch_progress():
    """
    POST Endpoint: Frontend polls this method to get the aggregated progress of all batch downloads.
    """
    data = request.get_json() or {}
    task_ids = data.get("task_ids", [])
    
    if not task_ids:
        return jsonify({"progress": 0.0, "status": "Empty queue layout"}), 200

    try:
        active_count = 0
        cancelled_count = 0
        failed_count = 0
        completed_count = 0
        accumulated_progress = 0.0
        
        # Track how many requested tasks actually still exist in volatile memory store
        found_in_store_count = 0 

        with progress_lock:
            for task_id in task_ids:
                if task_id in progress_store:
                    found_in_store_count += 1
                    task_val = progress_store[task_id].get("progress", 0.0)
                    
                    if task_val == -1.0:
                        cancelled_count += 1
                    elif task_val == -2.0:
                        failed_count += 1
                        # Force active count increments even for failed items so we can capture individual failure ticks
                        with progress_lock:
                            progress_store.pop(task_id, None)
                            with batch_progress_lock:
                                if task_id in batch_progress_store: batch_progress_store.remove(task_id)
                        active_count += 1 
                    elif task_val == 100.0:
                        completed_count += 1
                        accumulated_progress += 100.0
                        active_count += 1
                    else:
                        accumulated_progress += task_val
                        active_count += 1

        # 1. --- FIXED: If all tasks have vanished cleanly from the memory store ---
        # It means the active threads ran their cleanup routines. Since they aren't here anymore,
        # it means they completed successfully. Return Completed with a clean 200 status.
        if found_in_store_count == 0:
            return jsonify({"progress": 100.0, "status": "Not Found"}), 200

        # 2. Check if the ENTIRE batch was explicitly cancelled
        if cancelled_count == found_in_store_count:
            return jsonify({"progress": 0.0, "status": "Cancelled"}), 200

        # 3. Check if *every single remaining item* crashed hard organically
        if failed_count == found_in_store_count:
            with progress_lock:
                for task_id in task_ids: 
                    progress_store.pop(task_id, None)
                    with batch_progress_lock:
                        if task_id in batch_progress_store: batch_progress_store.remove(task_id)
            return jsonify({"progress": 0.0, "status": "Failed"}), 500

        # 4. Compute true average math safely
        divisor = active_count - cancelled_count - failed_count
        total_progress = round(accumulated_progress / divisor, 2) if divisor > 0 else 0.0

        # 5. Check if everything currently tracked in memory has completed successfully
        if completed_count == found_in_store_count or total_progress >= 100.0:
            with progress_lock:
                for task_id in task_ids:
                    progress_store.pop(task_id, None) 
                    with batch_progress_lock:
                        if task_id in batch_progress_store: batch_progress_store.remove(task_id)
            return jsonify({"progress": 100.0, "status": "Completed"}), 200

        # 6. Default progression frame
        return jsonify({
            "progress": total_progress, 
            "status": "Downloading"
        }), 200

    except Exception as e:
        print(f"Batch processing error exception layer raised: {e}")
        return jsonify({"error": str(e), "status": "Failed"}), 500
    
@app.route('/getProgressStore', methods=['GET'])
def get_progress_store():
    try:
        with progress_lock:
            return jsonify(progress_store), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clearProgressStore', methods=['POST'])
def clear_progress_store():
    with progress_lock:
        cleared_count = len(progress_store)
        progress_store.clear()
    print(f"Cleared {cleared_count} download progress store entries")
    return jsonify({"status": "Progress store cleared", "cleared": cleared_count}), 200

@app.route('/getBatchProgressStore', methods=['GET'])
def get_batch_progress_store():
    try:
        with batch_progress_lock:
            batch_ids = set(batch_progress_store)  # Convert to set for faster lookup

            with progress_lock:
            # Filter the dictionary
                filtered_store = {
                    task_id: data for task_id, data in progress_store.items() if task_id in batch_ids
                }
        return jsonify(filtered_store), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clearBatchProgressStore', methods=['POST'])
def clear_batch_progress_store():
    with batch_progress_lock:
        cleared_count = len(batch_progress_store)
        batch_progress_store.clear()
    print(f"Cleared {cleared_count} batch progress store entries")
    return jsonify({"status": "Batch progress store cleared", "cleared": cleared_count}), 200

EPISODE_REGEX = re.compile(r'\b(?:S(\d{1,2})E|(\d{1,2})X)(\d{1,2})\b', re.IGNORECASE)
def extract_season_episode(filename):
    """
    Extracts (season, episode) as integers for sorting.
    If no match is found, returns a high fallback tuple so unparsed files sort to the bottom.
    """
    match = EPISODE_REGEX.search(filename)
    if match:
        # group(1) is S(__)E, group(2) is (__)X, group(3) is the episode number
        season = match.group(1) or match.group(2)
        episode = match.group(3)
        return (int(season), int(episode))
    
    # Fallback for files matching no regex rules (sorted alphabetically at the end)
    return (9999, 9999, filename)

def format_size(size_bytes):
    if size_bytes >= 1073741824:  # 1024^3
        return f"{size_bytes / 1073741824:.2f} GB"
    elif size_bytes >= 1048576:    # 1024^2
        return f"{size_bytes / 1048576:.2f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes} B"
    
@app.route('/getItems', methods=['GET'])
def get_items():
    """
    GET Endpoint: Retrieve items from a specific folder, sorting matching files by Season/Episode.
    """
    folder = request.args.get('folder', "")
    show_files = request.args.get('showFiles', 'true').lower() == 'true'
    only_subs = request.args.get('onlySubs', 'false').lower() == 'true'
    folder_path = os.path.join('/media', folder)

    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    folders = []
    files_matching = []
    files_other = []

    for filename in os.listdir(folder_path):
        filepath = os.path.join(folder_path, filename)

        if only_subs and not filename.lower().endswith(('.srt', '.sub', '.vtt' , '.ass')):
            continue

        if os.path.isdir(filepath):
            if filename != "stremio-server":
                total_size = 0
                for root, dirs, files in os.walk(filepath):
                    for f in files:
                        fp = os.path.join(root, f)
                        if os.path.exists(fp):
                            total_size += os.path.getsize(fp)

                folders.append({
                    "name": filename + "/",
                    "size": format_size(total_size), 
                    "numberOfItems": len(os.listdir(filepath)),
                    "numberOfFolders": len([d for d in os.listdir(filepath) if os.path.isdir(os.path.join(filepath, d))])
                })
                
        elif os.path.isfile(filepath) and show_files:
            # Check if file matches the Season/Episode regex pattern
            if EPISODE_REGEX.search(filename) and filename.lower().endswith(('.mp4', '.mkv', '.avi', '.mov', '.wmv')):
                files_matching.append({"name": filename, "size": format_size(os.path.getsize(filepath))})
            else:
                files_other.append({"name": filename, "size": format_size(os.path.getsize(filepath))})

    # 1. Sort the matching files cleanly by Season number, then Episode number
    files_matching.sort(key=lambda x: extract_season_episode(x['name'] if isinstance(x, dict) else x))
    
    # 2. Sort other files and folders alphabetically
    folders.sort(key=lambda x: x['name'].lower())
    files_other.sort(key=lambda x: x['name'].lower())

    # Combine them: Folders first, then beautifully ordered episodes, then misc files
    combined_items = folders + files_matching + files_other
    
    return jsonify({"items": combined_items}), 200

def get_folder_size(folder_path):
    """Calculates total size of a specific directory in bytes."""
    total_size = 0
    if not os.path.exists(folder_path):
        return 0
    for root, dirs, files in os.walk(folder_path):
        for f in files:
            fp = os.path.join(root, f)
            if os.path.exists(fp):
                total_size += os.path.getsize(fp)
    return total_size

@app.route('/getUsageStats', methods=['GET'])
def get_usage_stats():
    # Drive-wide stats come from shutil (based on the root partition)
    total, _, _ = shutil.disk_usage("/")
    
    # Specific folder sizes must be calculated manually
    used_media = get_folder_size("/media")
    used_stremio = get_folder_size("/media/stremio-server")
    
    return jsonify({
        "total": format_size(total),
        "used": format_size(used_media-used_stremio),
        "usedStremio": format_size(used_stremio)
    }), 200

@app.route('/deleteFolder', methods=['POST'])
def delete_folder():
    data = request.get_json() or {}
    folder = data.get('folder')

    if not folder:
        return jsonify({"error": "Folder name is required"}), 400

    folder_path = os.path.join('/media', folder)
    if folder_path == "/media/stremio-server" or folder_path == "/media" or folder_path == "/media/Movies" or folder_path == "/media/TV-Shows":
        return jsonify({"error": "Cannot delete protected folder"}), 403
    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    try:
        if os.path.isdir(folder_path) and not os.listdir(folder_path):
            os.rmdir(folder_path)  # Only works for empty directories
            return jsonify({"message": "Folder deleted successfully"}), 200
        elif os.path.isdir(folder_path):
            shutil.rmtree(folder_path)  # Recursively delete non-empty directories
            return jsonify({"message": "Folder and its contents deleted successfully"}), 200
        else:
            return jsonify({"error": "Specified path is not a folder"}), 400
    except OSError as e:
        return jsonify({"error": str(e)}), 500 
    finally:
        refresh_jellyfin_libraries()
        refresh_plex_libraries()
        write_refresh_libraries_log(initiator='folder_delete')



@app.route('/deleteFile', methods=['POST'])
def delete_file():
    data = request.get_json() or {}
    file_path = data.get('filePath')

    if not file_path:
        return jsonify({"error": "File path is required"}), 400

    full_file_path = os.path.join('/media', file_path)
    if not os.path.exists(full_file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        os.remove(full_file_path)
        return jsonify({"message": "File deleted successfully"}), 200
    except OSError as e:
        return jsonify({"error": str(e)}), 500
    finally:
        refresh_jellyfin_libraries()
        refresh_plex_libraries()
        write_refresh_libraries_log(initiator='file_delete')


@app.route('/renameFolder', methods=['POST'])
def rename_folder():
    data = request.get_json() or {}
    folder = data.get('folder')
    newName = data.get('newName')

    if not folder or not newName:
        return jsonify({"error": "Both 'folder' and 'newName' are required"}), 400
    
    folder_path = os.path.join('/media', folder)
    if folder_path == "/media/stremio-server" or folder_path == "/media" or folder_path == "/media/Movies" or folder_path == "/media/TV-Shows":
        return jsonify({"error": "Cannot rename protected folder"}), 403
    parent_dir = os.path.dirname(folder_path)
    new_folder_path = os.path.join('/media', parent_dir, newName)

    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    if os.path.exists(new_folder_path):
        return jsonify({"error": "A folder with that name already exists"}), 400

    try:
        os.rename(folder_path, new_folder_path)
        return jsonify({"message": "Folder renamed successfully"}), 200
    except OSError as e:
        return jsonify({"error": str(e)}), 500
    finally:
        refresh_jellyfin_libraries()
        refresh_plex_libraries()
        write_refresh_libraries_log(initiator='folder_rename')


@app.route('/renameFile', methods=['POST'])
def rename_file():
    data = request.get_json() or {}
    filePath = data.get('filePath')
    newName = data.get('newName')

    if not filePath or not newName:
        return jsonify({"error": "Both 'filePath' and 'newName' are required"}), 400
    
    full_file_path = os.path.join('/media', filePath)
    parent_dir = os.path.dirname(full_file_path)
    new_file_path = os.path.join(parent_dir, newName)

    if not os.path.exists(full_file_path):
        return jsonify({"error": "File not found"}), 404

    if os.path.exists(new_file_path):
        return jsonify({"error": "A file with that name already exists"}), 400

    try:
        os.rename(full_file_path, new_file_path)
        return jsonify({"message": "File renamed successfully"}), 200
    except OSError as e:
        return jsonify({"error": str(e)}), 500
    finally:
        refresh_jellyfin_libraries()
        refresh_plex_libraries()
        write_refresh_libraries_log(initiator='file_rename')


@app.route('/createFolder', methods=['POST'])
def create_folder():
    data = request.get_json() or {}
    folder = data.get('folder')

    if not folder:
        return jsonify({"error": "Folder name is required"}), 400

    folder_path = os.path.join('/media', folder)
    if os.path.exists(folder_path):
        return jsonify({"error": "Folder already exists"}), 400

    try:
        os.makedirs(folder_path)
        return jsonify({"message": "Folder created successfully"}), 200
    except OSError as e:
        return jsonify({"error": str(e)}), 500

@app.route('/refreshLibraries', methods=['POST'])
def refresh_libraries(initiator='settings'):
    initiator = request.json.get('initiator', initiator)

    try:
        refresh_jellyfin_libraries()
        refresh_plex_libraries()
        write_refresh_libraries_log(initiator)

        return jsonify({"message": "Libraries refreshed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/destinationExists', methods=['POST'])
def destination_exists():
    data = request.get_json() or {}
    destination = data.get('destination')

    if not destination:
        return jsonify({"error": "Destination path is required"}), 400

    destination_path = os.path.join('/media', destination)
    return jsonify({"exists": os.path.exists(destination_path)}), 200

@app.route('/getRefreshLibrariesLog', methods=['GET'])
def get_refresh_libraries_log():
    if not os.path.exists('settings.json'):
        return jsonify({"error": "Settings file not found"}), 404

    with open('settings.json', 'r') as log_file:
        log_data = json.load(log_file).get("libraries", {})
    return jsonify(log_data), 200

@app.route('/getOptions', methods=['GET'])
def get_options():
    if not os.path.exists('settings.json'):
        return jsonify({"error": "Settings file not found"}), 404

    with open('settings.json', 'r') as settings_file:
        file_content = json.load(settings_file)
        settings_data = file_content["options"] if "options" in file_content else {}
    return jsonify(settings_data), 200

@app.route('/updateOptions', methods=['POST'])
def update_options():
    data = request.get_json() or {}

    if not data:
        return jsonify({"error": "No options data provided"}), 400

    settings_data = {}
    try:
        with open('settings.json', 'r', encoding='utf-8') as settings_file:
            content = settings_file.read().strip()
            if content:
                settings_data = json.loads(content)
    except (FileNotFoundError, json.JSONDecodeError):
        settings_data = {}

    if not isinstance(settings_data, dict):
        settings_data = {}

    settings_data["options"] = data

    with open('settings.json', 'w', encoding='utf-8') as settings_file:
        json.dump(settings_data, settings_file, indent=2, ensure_ascii=False)

    return jsonify({"message": "Settings updated successfully"}), 200

@app.route('/getOmdbData', methods=['GET'])
def get_omdb_data():
    t = request.args.get('t')
    y = request.args.get('y')
    type = request.args.get('type')

    if not t:
        return jsonify({"error": "Title or TTID is required"}), 400

    try:
        response = requests.get(f"http://www.omdbapi.com/?t={t}{f'&y={y}' if y else ''}{f'&type={type}' if type else ''}&apikey={OMDB_API_KEY}")
        response.raise_for_status()
        return jsonify(response.json()), 200
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/getLogs', methods=['GET'])
def get_logs():
    # Cursor-based pagination: each request walks backwards from where the previous
    # one stopped, so the query cost stays constant instead of growing with page number
    # (as it did when we asked journalctl for `-n page*50` lines every time).
    cursor = request.args.get('cursor', default=None, type=str)
    if cursor in ("null", "undefined", "", "None"):
        cursor = None

    date_str = request.args.get('date', default=None, type=str)
    if date_str in ("null", "undefined", "", "None"):
        date_str = None

    logs_per_page = getOptions().get("logs_page_size", 50)

    cmd = [
        "journalctl",
        "-u", "stremio-downloader-api.service",
        "--no-pager",
        "-r", "--show-cursor",
    ]

    target_start_dt = None
    if date_str:
        clean_date = date_str.strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", clean_date):
            since_val = f"{clean_date} 00:00:00"
            until_val = f"{clean_date} 23:59:59"
            try:
                target_start_dt = datetime.strptime(since_val, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        else:
            since_val = clean_date
            until_val = None

        if cursor:
            # journalctl disallows specifying both --since and --cursor at the same time.
            # Using --until with --cursor bounds the upper end safely.
            if until_val:
                cmd += ["--until", until_val]
        else:
            if since_val:
                cmd += ["--since", since_val]
            if until_val:
                cmd += ["--until", until_val]

    if cursor:
        # --cursor re-includes the entry it points at, so fetch one extra to drop it.
        cmd += ["--cursor", cursor, "-n", str(logs_per_page + 1)]
    else:
        cmd += ["-n", str(logs_per_page)]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "Failed to fetch logs", "details": e.stderr}), 500

    lines = result.stdout.splitlines()

    next_cursor = None
    if lines and lines[-1].startswith("-- cursor:"):
        next_cursor = lines[-1].split("-- cursor:", 1)[1].strip()
        lines = lines[:-1]

    if cursor and lines:
        lines = lines[1:]  # drop the duplicate entry --cursor re-included

    lines = [l for l in lines if l != "-- No entries --"]

    has_more = bool(lines) and len(lines) == logs_per_page

    # When date filtering with cursor pagination, discard any entries older than the target start date
    if target_start_dt and lines:
        filtered_lines = []
        for line in lines:
            match = re.match(r"^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})", line)
            if match:
                try:
                    line_dt = datetime.strptime(f"{target_start_dt.year} {match.group(1)}", "%Y %b %d %H:%M:%S")
                    if line_dt < target_start_dt:
                        has_more = False
                        next_cursor = None
                        break
                except ValueError:
                    pass
            filtered_lines.append(line)
        lines = filtered_lines

    # journalctl -r returns newest-first; flip back to chronological order for display.
    page_logs = list(reversed(lines))

    return jsonify({
        "logs": page_logs,
        "cursor": next_cursor if has_more else None,
        "hasMore": has_more
    }), 200

@app.route('/getAllLogsLines', methods=['GET'])
def get_all_logs_lines():
    cmd = "journalctl -u stremio-downloader-api.service --no-pager -q | wc -l"

    try:
        count_res = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            check=True
        )
        total_lines = int(count_res.stdout.strip() or 0)
    except (subprocess.CalledProcessError, ValueError) as e:
        return jsonify({
            "error": "Failed to fetch total log lines",
            "details": str(e)
        }), 500

    return jsonify({
        "total_lines": total_lines
    }), 200

def getOptions():
    """Reads settings.json and returns the 'settings' dictionary."""
    try:
        with open("settings.json", "r", encoding="utf-8") as settings_file:
            content = settings_file.read().strip()
            if content:
                data = json.loads(content)
                if isinstance(data, dict):
                    settings = data.get("options", {})
                    return settings if isinstance(settings, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return {}

def write_refresh_libraries_log(initiator):
    log_data = {
        "lastRefreshed": datetime.now(timezone.utc).isoformat(),
        "lastRefreshedBy": initiator
    }
    settings_data = {}

    try:
        with open("settings.json", "r", encoding="utf-8") as log_file:
            content = log_file.read().strip()
            if content:
                settings_data = json.loads(content)
    except (FileNotFoundError, json.JSONDecodeError):
        settings_data = {}

    # Ensure root structure is a dictionary
    if not isinstance(settings_data, dict):
        settings_data = {}

    # 2. Add or update the node
    settings_data["libraries"] = log_data

    # 3. Save (creates file if it didn't exist)
    with open("settings.json", "w", encoding="utf-8") as log_file:
        json.dump(settings_data, log_file, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    # Start the Flask app explicitly on Port 7000
    app.run(host='0.0.0.0', port=7000, debug=True)