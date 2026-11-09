from backend.Abstract.AbstractDBHandler import get_connection, close_connection
import backend.Counters.CountersDBHandler as cdb
from backend.Counters.Counter import Counter
from datetime import datetime, timezone


def _parse_datetime_as_utc(value: datetime | str) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

def get_counter_value(db_connection_string: str, counter_key: str) -> int:
    conn = get_connection(db_connection_string)
    try:
        counter = cdb.get_counter_value(conn, counter_key)
        return counter
    except Exception as e:
        print(f"Failed to get counter value: {e}")
        raise e
    finally:
        close_connection(conn)

def increment_counter_value(db_connection_string: str, counter_key: str) -> int:
    conn = get_connection(db_connection_string)
    try:
        new_value = cdb.increment_counter(conn, counter_key)
        return new_value
    except Exception as e:
        print(f"Failed to increment counter value: {e}")
        raise e
    finally:
        close_connection(conn)

def check_and_increment_or_reset_counter(db_connection_string: str, counter_key: str) -> int:
    conn = get_connection(db_connection_string)
    now = datetime.now(timezone.utc)
    try:
        last_updated = cdb.get_last_updated_counter(conn, counter_key, close_conn=False)
        last_updated_utc = (
            None if last_updated is None else _parse_datetime_as_utc(last_updated)
        )
        if last_updated_utc is None or now.date() > last_updated_utc.date():
            cdb.reset_counter(conn, counter_key, toOne=True)
        else:
            cdb.increment_counter(conn, counter_key)
    except Exception as e:
        print(f"Failed to check and increment or reset counter: {e}")
        raise e
    finally:
        close_connection(conn)

def get_last_updated_counter(db_connection_string: str, counter_key: str) -> datetime:
    conn = get_connection(db_connection_string)
    try:
        last_updated = cdb.get_last_updated_counter(conn, counter_key)
        return last_updated
    except Exception as e:
        print(f"Failed to get last updated counter: {e}")
        raise e
    finally:
        close_connection(conn)
