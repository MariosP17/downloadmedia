import threading
import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Global dictionary to keep track of download progress
# Format: { "identifier_idx": percentage_float }
progress_store = {}

def download_stream_task(identifier: str, idx: str, path: str = "/media", name: str = ""):
    task_key = f"{identifier}_{idx}"
    progress_store[task_key] = 0.0
    print(f"Initiating download task for {task_key} with path: {path} and name: {name}\n")
    url = f"http://127.0.0.1:11470/{identifier}/{idx}?external=1&download=1"
    filename = os.path.join(path, name if bool(Path(name).suffix) else name + ".mp4" if name else os.path.join(path, task_key + ".mp4"))
    print(f"Starting download for {task_key} from URL: {url} to path: {filename}\n")
    try:
        os.makedirs(path, exist_ok=True)
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = response.headers.get('content-length')
        
        with open(filename, 'wb') as f:
            if total_size is None:
                for chunk in response.iter_content(chunk_size=8192):
                    # --- CANCELLATION CHECK ---
                    if progress_store.get(task_key) == -1.0:
                        print(f"Download {task_key} canceled mid-flight.")
                        f.close() # Explicitly close file handle before deleting
                        if os.path.exists(filename): os.remove(filename)
                        return # Exit the thread immediately

                    if chunk:
                        f.write(chunk)
                progress_store[task_key] = 100.0
            else:
                total_size = int(total_size)
                downloaded_bytes = 0
                
                for chunk in response.iter_content(chunk_size=131072):
                    # --- CANCELLATION CHECK ---
                    if progress_store.get(task_key) == -1.0:
                        print(f"Download {task_key} canceled mid-flight.")
                        f.close() # Explicitly close file handle before deleting
                        if os.path.exists(filename): os.remove(filename)
                        return # Exit the thread immediately

                    if chunk:
                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        percentage = round((downloaded_bytes / total_size) * 100, 2)
                        progress_store[task_key] = percentage
                        
                print(f"Download completed successfully for {task_key}")
                progress_store[task_key] = 100.0

    except Exception as e:
        # Only set to -1 if it wasn't deliberately canceled by the user
        if progress_store.get(task_key) != -1.0:
            print(f"Error downloading {task_key}: {e}")
            progress_store[task_key] = -2.0 # Use -2.0 for organic network failures
        
        # Clean up partial file if a crash occurs
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

    if not identifier or not idx:
        return jsonify({"error": "Both 'identifier' and 'idx' are required parameters."}), 400
    
    task_key = f"{identifier}_{idx}"
    
    # Check if download is already running or completed
    if task_key in progress_store and progress_store[task_key] >= 0 and progress_store[task_key] < 100:
        return jsonify({"message": "Download already in progress", "task_id": task_key}), 200

    # Start the download process in a separate background thread
    thread = threading.Thread(target=download_stream_task, args=(identifier, idx, path, name))
    thread.daemon = True # Allows application to close cleanly
    thread.start()
    
    return jsonify({
        "status": "Started", 
        "task_id": task_key,
        "message": "Download initiated in background thread."
    }), 202

@app.route('/cancel', methods=['POST'])
def cancel_download():
    """
    POST Endpoint: Receives JSON payload and cancels the download.
    """
    data = request.get_json() or {}
    identifier = data.get('identifier')
    idx = data.get('idx')
    path = data.get('path', '/media')
    name = data.get('name', "")

    if not identifier or not idx:
        return jsonify({"error": "Both 'identifier' and 'idx' are required parameters."}), 400

    task_key = f"{identifier}_{idx}"

    if task_key in progress_store:
        progress_store[task_key] = -1.0  # Mark as cancelled

    return jsonify({"message": "Download cancellation requested.", "task_id": task_key}), 200

@app.route('/progress/<identifier>/<idx>', methods=['GET'])
def get_progress(identifier, idx):
    """
    GET Endpoint: Frontend polls this method to get the percentage.
    """
    task_key = f"{identifier}_{idx}"
    
    if task_key not in progress_store:
        return jsonify({"progress": 0.0, "status": "Not started or task not found"}), 404
        
    current_progress = progress_store[task_key]
    
    if current_progress == -1.0:
        return jsonify({"progress": 0.0, "status": "Failed"}), 500
    elif current_progress == 100.0:
        return jsonify({"progress": 100.0, "status": "Completed"}), 200
        
    return jsonify({"progress": current_progress, "status": "Downloading"}), 200

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