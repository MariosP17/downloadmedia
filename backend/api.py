import threading
import os
import requests
from threading import Lock
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Global dictionary to keep track of download progress
# Format: { "identifier_idx": percentage_float }
progress_store = {}
batch_progress_store = []

# Create a thread lock to ensure safe cross-talk between Flask routes and download threads
progress_lock = Lock()
batch_progress_lock = Lock()

def download_stream_task(identifier: str, idx: str, path: str = "/media", name: str = "", ttid: str = ""):
    task_key = f"{identifier}_{idx}"
    
    with progress_lock:
        progress_store[task_key] = { "ttid": ttid, "progress": 0.0 }
        
    print(f"Initiating download task for {task_key} with path: {path} and name: {name}\n")
    url = f"http://127.0.0.1:11470/{identifier}/{idx}?external=1&download=1"
    filename = os.path.join(path, name if bool(Path(name).suffix) else name + ".mp4" if name else os.path.join(path, task_key + ".mp4"))
    
    try:
        os.makedirs(path, exist_ok=True)
        # Use a balanced timeout matrix to allow quick interruptions
        response = requests.get(url, stream=True, timeout=(5, 30))
        response.raise_for_status()
        
        total_size = response.headers.get('content-length')
        
        with open(filename, 'wb') as f:
            if total_size is None:
                # Balanced chunk size gives Flask breathing room to process requests under the GIL
                for chunk in response.iter_content(chunk_size=16384): 
                    # Read the state safely under a lock window
                    with progress_lock:
                        is_canceled = progress_store.get(task_key, {}).get("progress") == -1.0
                    
                    if is_canceled:
                        print(f"Download {task_key} canceled mid-flight (No content length).")
                        f.close()
                        if os.path.exists(filename): os.remove(filename)
                        with progress_lock:
                            progress_store.pop(task_key, None)  # Clean up cancelled task
                            with batch_progress_lock:
                                if task_key in batch_progress_store: batch_progress_store.remove(task_key)
                        return 

                    if chunk:
                        f.write(chunk)
                
                with progress_lock:
                    progress_store[task_key] = { "ttid": ttid, "progress": 100.0 }
            else:
                total_size = int(total_size)
                downloaded_bytes = 0
                
                # Reduced from 128KB to 32KB to create frequent cancellation checks
                for chunk in response.iter_content(chunk_size=32768):
                    with progress_lock: # Debugging: Print current progress store state
                        is_canceled = progress_store.get(task_key, {}).get("progress") == -1.0
                        
                    if is_canceled:
                        print(f"Download {task_key} canceled mid-flight.")
                        f.close()
                        if os.path.exists(filename): os.remove(filename)
                        with progress_lock:
                            progress_store.pop(task_key, None)  # Clean up cancelled task
                            with batch_progress_lock:
                                if task_key in batch_progress_store: batch_progress_store.remove(task_key)
                        return 

                    if chunk:
                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        percentage = round((downloaded_bytes / total_size) * 100, 2)
                        
                        with progress_lock:
                            # Verify it wasn't canceled during the write execution cycle
                            if progress_store.get(task_key, {}).get("progress") != -1.0:
                                progress_store[task_key] = { "ttid": ttid, "progress": percentage }
                                
                print(f"Download completed successfully for {task_key}")
                with progress_lock:
                    progress_store[task_key] = { "ttid": ttid, "progress": 100.0 }

    except Exception as e:
        with progress_lock:
            current_progress = progress_store.get(task_key, {}).get("progress")
        
        # FIX: Only treat as an error if it wasn't deliberately stopped by the user
        if current_progress != -1.0:
            print(f"Error downloading {task_key}: {e}")
            with progress_lock:
                # Do NOT pop instantly; let the frontend read the failure status safely first
                progress_store[task_key] = { "ttid": ttid, "progress": -2.0 } 
        
        if os.path.exists(filename):
            try: os.remove(filename)
            except: pass

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

    # Start the download process in a separate background thread
    thread = threading.Thread(target=download_stream_task, args=(identifier, idx, path, name, ttid))
    thread.daemon = True # Allows application to close cleanly
    thread.start()
    
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
        
        # This aligns perfectly with task key formatting and downstream network buffer logic
        thread = threading.Thread(
            target=download_stream_task, 
            args=(identifier, str(idx), path, name, ttid)
        )
        thread.daemon = True # Allows application to close cleanly
        thread.start()
        
        with batch_progress_lock:
            batch_progress_store.append(task_key)
        task_ids.append(task_key)

    return jsonify({
        "status": "Batch download initiated",
        "task_ids": task_ids,
        "message": f"Successfully initiated background download threads for {len(task_ids)} items."
    }), 202

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

        # Protect dictionary traversal using your global thread mutex lock
        with progress_lock:
            for task_id in task_ids:
                if task_id in progress_store:
                    print(f"Batch progress check for {task_id}: {progress_store[task_id]}")  # Debugging: Print current progress state
                    active_count += 1
                    task_val = progress_store[task_id].get("progress", 0.0)
                    
                    if task_val == -1.0:
                        cancelled_count += 1
                    elif task_val == -2.0:
                        failed_count += 1
                    elif task_val == 100.0:
                        completed_count += 1
                        accumulated_progress += 100.0
                    else:
                        accumulated_progress += task_val

        # 1. If all active keys vanished from memory, the download threads finished cleaning themselves up
        if active_count == 0:
            return jsonify({"progress": 0.0, "status": "Completed"}), 404

        # 2. Check if the ENTIRE batch was requested to stop
        if cancelled_count == active_count:
            # DO NOT POP HERE. Let the download tasks catch the -1.0 flag and clean themselves up.
            return jsonify({"progress": 0.0, "status": "Cancelled"}), 200

        # 3. Check if any organic server/network bugs crashed every single item
        if failed_count == active_count:
            with progress_lock:
                for task_id in task_ids: 
                    progress_store.pop(task_id, None)
                    with batch_progress_lock:
                        if task_id in batch_progress_store: batch_progress_store.remove(task_id)
            return jsonify({"progress": 0.0, "status": "Failed"}), 500

        # 4. Compute true average aggregate score percentage (0.0 to 100.0)
        total_progress = round(accumulated_progress / active_count, 2)

        # 5. Check if absolutely everything completed successfully
        if completed_count == active_count or total_progress >= 100.0:
            with progress_lock:
                for task_id in task_ids:
                    progress_store.pop(task_id, None) # Safe to pop now; threads are dead
                    with batch_progress_lock:
                        if task_id in batch_progress_store: batch_progress_store.remove(task_id)
            return jsonify({"progress": 100.0, "status": "Completed"}), 200

        # 6. Default fallback return frame for progressive tracking
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

@app.route('/getItems', methods=['GET'])
def get_items():
    """
    GET Endpoint: Retrieve items from a specific folder.
    """
    folder = request.args.get('folder',"")
    showFiles = request.args.get('showFiles', 'true').lower() == 'true'
    folder_path = os.path.join('/media', folder)
    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    items = []
    for filename in os.listdir(folder_path):
        filepath = os.path.join(folder_path, filename)
        if os.path.isfile(filepath) and showFiles:
            items.append(filename)
        elif os.path.isdir(filepath):
            if not filename == "stremio-server":  # Skip hidden folders
                items.append(filename + "/")  # Append slash to indicate it's a folder

    return jsonify({"items": items}), 200

@app.route('/deleteFolder', methods=['POST'])
def delete_folder():
    data = request.get_json() or {}
    folder = data.get('folder')

    if not folder:
        return jsonify({"error": "Folder name is required"}), 400

    folder_path = os.path.join('/media', folder)
    if folder_path == "/media/stremio-server" or folder_path == "/media":
        return jsonify({"error": "Cannot delete protected folder"}), 403
    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    try:
        os.rmdir(folder_path)  # Only works for empty directories
        return jsonify({"message": "Folder deleted successfully"}), 200
    except OSError as e:
        return jsonify({"error": str(e)}), 500


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

@app.route('/renameFolder', methods=['POST'])
def rename_folder():
    data = request.get_json() or {}
    folder = data.get('folder')
    newName = data.get('newName')

    if not folder or not newName:
        return jsonify({"error": "Both 'folder' and 'newName' are required"}), 400
    
    folder_path = os.path.join('/media', folder)
    if folder_path == "/media/stremio-server" or folder_path == "/media":
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

if __name__ == '__main__':
    # Start the Flask app explicitly on Port 7000
    app.run(host='0.0.0.0', port=7000, debug=True)