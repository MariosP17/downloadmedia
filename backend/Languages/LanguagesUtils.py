from typing import Any, List
from backend.Languages.Language import Language
import backend.Languages.LanguagesDBHandler as ldb
from backend.Abstract.AbstractDBHandler import close_connection, get_connection

def get_all_languages_util(db_connection_string: str) -> List[Language]:
    conn = get_connection(db_connection_string)
    try:
        result = ldb.get_all_languages(conn)
        return result
    except Exception as e:
        print(f"Failed to get languages: {e}")
        raise e
    finally:
        close_connection(conn)

def get_language_util(db_connection_string: str, language_id: int) -> Language:
    conn = get_connection(db_connection_string)
    try:
        result = ldb.get_language(conn, language_id)
        return result
    except Exception as e:
        print(f"Failed to get language: {e}")
        raise e
    finally:
        close_connection(conn)

def add_language_util(db_connection_string: str, language_json: dict) -> bool:
    conn = get_connection(db_connection_string)
    language = Language(language_json.get("id"), language_json.get("name"), language_json.get("code"))
    if not language.name or not language.code:
        raise ValueError("Both name and code are required for adding a language")
    try:
        result = ldb.add_language(conn, language)
        return result
    except Exception as e:
        print(f"Failed to add language: {e}")
        raise e
    finally:
        close_connection(conn)

def update_language_util(db_connection_string: str, language_json: dict) -> bool:
    conn = get_connection(db_connection_string)
    language = Language(language_json.get("id"), language_json.get("name"), language_json.get("code"))
    if not language.id:
        raise ValueError("ID is required for updating a language")
    try:
        result = ldb.update_language(conn, language)
        return result
    except Exception as e:
        print(f"Failed to update language: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_language_util(db_connection_string: str, language_id: int) -> bool:
    conn = get_connection(db_connection_string)
    try:
        result = ldb.delete_language(conn, language_id)
        return result
    except Exception as e:
        print(f"Failed to delete language: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_all_languages_util(db_connection_string: str) -> bool:
    conn = get_connection(db_connection_string)
    try:
        result = ldb.delete_all_languages(conn)
        return result
    except Exception as e:
        print(f"Failed to delete all languages: {e}")
        raise e
    finally:
        close_connection(conn)

