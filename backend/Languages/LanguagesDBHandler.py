from backend.Languages.Language import Language
from backend.Abstract.AbstractDBHandler import DBHandler, get_connection, close_connection, execute_query, fetch_query

class LanguagesDBHandler(DBHandler):
    def __init__(self, conn):
        self.conn = conn

    def close(self):
        close_connection(self.conn)

    def execute(self, query, params=None):
        execute_query(self.conn, query, params)

    def fetch(self, query, params=None):
        return fetch_query(self.conn, query, params)

    def fetch_query(self, query, params=None):
        return fetch_query(self.conn, query, params)

def get_all_languages(conn):
    try:
        result = fetch_query(conn, "SELECT * FROM languages")
        languages_list: list[Language] = []
        if result:
            for row in result:
                languages_list.append(Language(*row))
        return languages_list
    except Exception as e:
        print(f"Failed to get languages: {e}")
        raise e
    finally:
        close_connection(conn)

def get_language(conn, language_id):
    try:
        result = fetch_query(conn, "SELECT * FROM languages WHERE id = %s", (language_id,))
        if not result:
            raise ValueError(f"No language found with id {language_id}")
        return Language(*result[0])
    except Exception as e:
        print(f"Failed to get language: {e}")
        raise e
    finally:
        close_connection(conn)

def add_language(conn, language: Language):
    try:
        result = execute_query(
            conn,
            "INSERT INTO languages (name, code) VALUES (%s, %s)",
            (language.name, language.code)
        )
        return "Successfully added Language " + str(language.name)
    except Exception as e:
        print(f"Failed to add language: {e}")
        raise e
    finally:
        close_connection(conn)

def update_language(conn, language: Language):
    try:
        result = execute_query(
            conn,
            "UPDATE languages SET name = %s, code = %s WHERE id = %s",
            (language.name, language.code, language.id)
        )
        return "Successfully updated Langauge with id " + str(language.id)
    except Exception as e:
        print(f"Failed to update language: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_language(conn, language_id):
    try:
        result = execute_query(
            conn,
            "DELETE FROM languages WHERE id = %s",
            (language_id,)
        )
        return "Successfully deleted Language with id " + str(language_id)
    except Exception as e:
        print(f"Failed to delete language: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_all_languages(conn):
    try:
        result = execute_query(conn, "DELETE FROM languages")
        return "Successfully deleted all languages"
    except Exception as e:
        print(f"Failed to delete all languages: {e}")
        raise e
    finally:
        close_connection(conn)


    