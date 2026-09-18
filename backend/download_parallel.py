import threading


def start_download(download_task, identifier, idx, path, name, ttid):
    """Start one download in its own background thread."""
    thread = threading.Thread(
        target=download_task,
        args=(identifier, idx, path, name, ttid, False),
        daemon=True,
    )
    thread.start()


def enqueue_download(download_task, identifier, idx, path, name, ttid):
    """Dispatch a download using the parallel strategy."""
    start_download(download_task, identifier, idx, path, name, ttid)
