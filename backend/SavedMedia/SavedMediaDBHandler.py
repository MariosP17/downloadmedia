from backend.Abstract.AbstractDBHandler import DBHandler, get_connection, close_connection, execute_query, fetch_query
from backend.SavedMedia.SavedMedia import SavedMedia

class SavedMediaDBHandler(DBHandler):
    def __init__(self, conn):
        self.conn = conn

    def close(self):
        close_connection(self.conn)

    def execute(self, query, params=None):
        execute_query(self.conn, query, params)

    def fetch(self, query, params=None):
        return fetch_query(self.conn, query, params)

def get_all_saved_media(conn):
    try:
        result = fetch_query(conn, "SELECT * FROM saved_media")
        saved_media_list: list[SavedMedia] = []
        if result:
            for row in result:
                saved_media_list.append(SavedMedia(*row))
        return saved_media_list
    except Exception as e:
        print(f"Failed to get saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def get_saved_media(conn, ttid):
    try:
        result = fetch_query(conn, "SELECT * FROM saved_media WHERE ttid = %s", (ttid,))
        if not result:
            raise ValueError(f"No saved media found with ttid {ttid}")
        return SavedMedia(*result[0])
        
    except Exception as e:
        print(f"Failed to get saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def add_saved_media(conn, saved_media: SavedMedia):
    try:
        result = execute_query(
            conn,
            "INSERT INTO saved_media (ttid, type, name, poster_url, year, series_name, episode_info) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (saved_media.ttid, saved_media.type, saved_media.name, saved_media.poster_url, saved_media.year, saved_media.series_name, saved_media.episode_info)
        )
        return "Successfully added record with ttid " + saved_media.ttid
    except Exception as e:
        print(f"Failed to add saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def update_saved_media(conn, saved_media: SavedMedia):
    try:
        result = execute_query(
            conn,
            "UPDATE saved_media SET type = %s, name = %s, poster_url = %s, year = %s, series_name = %s, episode_info = %s WHERE ttid = %s",
            (saved_media.type, saved_media.name, saved_media.poster_url, saved_media.year, saved_media.series_name, saved_media.episode_info, saved_media.ttid)
        )
        return "Successfully updated record with ttid " + saved_media.ttid
    except Exception as e:
        print(f"Failed to update saved media: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_saved_media(conn, ttid):
    try:
        result = execute_query(conn, "DELETE FROM saved_media WHERE ttid = %s", (ttid,))
        return "Successfully deleted record with ttid " + ttid
    except Exception as e:
        print(f"Failed to delete saved media: {e}")
        raise e
    finally:
        close_connection(conn)