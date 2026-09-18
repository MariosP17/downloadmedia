import queue
import threading


class SerialDownloadDispatcher:
    """Run downloads one at a time in a single background worker."""

    def __init__(self, download_task, is_cancelled, discard_task):
        self._download_task = download_task
        self._is_cancelled = is_cancelled
        self._discard_task = discard_task
        self._download_queue = queue.Queue()
        self._worker = threading.Thread(target=self._run, daemon=True)
        self._worker.start()

    def enqueue(self, identifier, idx, path, name, ttid):
        self._download_queue.put((identifier, idx, path, name, ttid))

    def _run(self):
        while True:
            identifier, idx, path, name, ttid = self._download_queue.get()
            task_key = f"{identifier}_{idx}"
            try:
                if self._is_cancelled(task_key):
                    print(f"Skipping queued download {task_key}: cancelled before it started.")
                    self._discard_task(task_key)
                    continue
                self._download_task(identifier, idx, path, name, ttid, add=False)
            finally:
                self._download_queue.task_done()
