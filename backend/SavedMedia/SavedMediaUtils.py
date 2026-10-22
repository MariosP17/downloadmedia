from typing import Any, List
from backend.SavedMedia.SavedMedia import SavedMedia
import backend.SavedMedia.SavedMediaDBHandler as smdb
from backend.Abstract.AbstractDBHandler import close_connection, get_connection


def get_all_saved_media_util(db_connection_string: str) -> List[SavedMedia]:
    conn = get_connection(db_connection_string)
    try:
        result = smdb.get_all_saved_media(conn)
        return result
    except Exception as e:
        print(f"Failed to get saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def get_saved_media_util(db_connection_string: str,ttid: str) -> SavedMedia:
    conn = get_connection(db_connection_string)
    try:
        result = smdb.get_saved_media(conn, ttid)
        return result
    except Exception as e:
        print(f"Failed to get saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def add_saved_media_util(db_connection_string: str, SavedMediaJSON: dict) -> bool:
    conn = get_connection(db_connection_string)
    saved_media = SavedMedia(SavedMediaJSON["ttid"], SavedMediaJSON["type"], SavedMediaJSON["name"], SavedMediaJSON["poster_url"], SavedMediaJSON["year"], SavedMediaJSON.get("series_name"), SavedMediaJSON.get("episode_info"))
    if not saved_media.ttid:
        raise ValueError("ttid is required for adding saved media")
    try:
        result = smdb.add_saved_media(conn, saved_media)
        return result
    except Exception as e:
        print(f"Failed to add saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def update_saved_media_util(db_connection_string: str, SavedMediaJSON: dict) -> bool:
    conn = get_connection(db_connection_string)
    saved_media = SavedMedia(SavedMediaJSON["ttid"], SavedMediaJSON["type"], SavedMediaJSON["name"], SavedMediaJSON["poster_url"], SavedMediaJSON["year"], SavedMediaJSON.get("series_name"), SavedMediaJSON.get("episode_info"))
    if not saved_media.ttid:
        raise ValueError("ttid is required for updating saved media")
    try:
        result = smdb.update_saved_media(conn, saved_media)
        return result
    except Exception as e:
        print(f"Failed to update saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_saved_media_util(db_connection_string: str, ttid: str) -> bool:
    conn = get_connection(db_connection_string)
    try:
        result = smdb.delete_saved_media(conn, ttid)
        return result
    except Exception as e:
        print(f"Failed to delete saved media: {e}")
        raise e
    finally:
        close_connection(conn)