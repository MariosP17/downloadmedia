import threading
import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global dictionary to keep track of download progress
# Format: { "identifier_idx": percentage_float }
progress_store = {}

def download_stream_task(identifier: str, idx: str):
    """
    Downloads the file in chunks natively using requests 
    and dynamically updates the global progress percentage.
    """
    task_key = f"{identifier}_{idx}"
    progress_store[task_key] = 0.0
    
    url = f"http://127.0.0.1:11470/{identifier}/{idx}?external=1&download=1"
    
    try:
        # Stream the request so we don't load the entire file into RAM at once
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        # Get total file size from headers (if provided by the server)
        total_size = response.headers.get('content-length')
        
        # Determine where to save the file locally
        filename = f"download_{task_key}.tmp"
        
        if total_size is None:
            # If the server doesn't provide content-length, we can't calculate exact %
            print(f"Warning: No Content-Length header for {task_key}. Saving file blindly.")
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            progress_store[task_key] = 100.0
        else:
            total_size = int(total_size)
            downloaded_bytes = 0
            
            with open(filename, 'wb') as f:
                # Read file in 128KB chunks
                for chunk in response.iter_content(chunk_size=131072): 
                    if chunk:
                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        
                        # Calculate progress percentage
                        percentage = round((downloaded_bytes / total_size) * 100, 2)
                        progress_store[task_key] = percentage
                        
            print(f"Download completed successfully for {task_key}")
            progress_store[task_key] = 100.0

    except Exception as e:
        print(f"Error downloading {task_key}: {e}")
        progress_store[task_key] = -1.0  # -1.0 signifies an error state

@app.route('/download', methods=['POST'])
def start_download():
    """
    POST Endpoint: Receives JSON payload and spins up a background thread.
    """
    data = request.get_json() or {}
    identifier = data.get('identifier')
    idx = data.get('idx')
    
    if not identifier or not idx:
        return jsonify({"error": "Both 'identifier' and 'idx' are required parameters."}), 400
    
    task_key = f"{identifier}_{idx}"
    
    # Check if download is already running or completed
    if task_key in progress_store and progress_store[task_key] >= 0 and progress_store[task_key] < 100:
        return jsonify({"message": "Download already in progress", "task_id": task_key}), 200

    # Start the download process in a separate background thread
    thread = threading.Thread(target=download_stream_task, args=(identifier, idx))
    thread.daemon = True # Allows application to close cleanly
    thread.start()
    
    return jsonify({
        "status": "Started", 
        "task_id": task_key,
        "message": "Download initiated in background thread."
    }), 202

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

if __name__ == '__main__':
    # Start the Flask app explicitly on Port 7000
    app.run(host='0.0.0.0', port=7000, debug=True)