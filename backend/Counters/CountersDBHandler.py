from backend.Abstract.AbstractDBHandler import DBHandler, get_connection, close_connection, execute_query, fetch_query
from backend.Counters.Counter import Counter

class CountersDBHandler(DBHandler):
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

def get_all_counters(conn):
    try:
        result = fetch_query(conn, "SELECT * FROM counters")
        counters_list: list[Counter] = []
        if result:
            for row in result:
                counters_list.append(Counter(*row))
        return counters_list
    except Exception as e:
        print(f"Failed to get counters: {e}")
        raise e
    finally:
        close_connection(conn)

def get_counter(conn, counter_key):
    try:
        result = fetch_query(conn, "SELECT * FROM counters WHERE key = %s", (counter_key,))
        if not result:
            raise ValueError(f"No counter found with key {counter_key}")
        return Counter(*result[0])
    except Exception as e:
        print(f"Failed to get counter: {e}")
        raise e
    finally:
        close_connection(conn)

def add_counter(conn, counter: Counter):
    try:
        result = execute_query(
            conn,
            "INSERT INTO counters (key, name, counter, last_updated) VALUES (%s, %s, %s, %s)",
            (counter.key, counter.name, counter.counter, counter.last_updated)
        )
        return "Successfully added Counter " + str(counter.name)
    except Exception as e:
        print(f"Failed to add counter: {e}")
        raise e
    finally:
        close_connection(conn)

def update_counter(conn, counter: Counter):
    try:
        result = execute_query(
            conn,
            "UPDATE counters SET name = %s, counter = %s, last_updated = %s WHERE key = %s",
            (counter.name, counter.counter, counter.last_updated, counter.key)
        )
        return "Successfully updated Counter " + str(counter.name)
    except Exception as e:
        print(f"Failed to update counter: {e}")
        raise e
    finally:
        close_connection(conn)

def reset_counter(conn, counter_key, toOne=False):
    try:
        result = execute_query(
            conn,
            "UPDATE counters SET counter = %s, last_updated = TIMEZONE('UTC', NOW()) WHERE key = %s",
            (1 if toOne else 0, counter_key)
        )
        return "Successfully reset Counter with key " + str(counter_key)
    except Exception as e:
        print(f"Failed to reset counter: {e}")
        raise e
    finally:
        close_connection(conn)

def get_last_updated_counter(conn, counter_key, close_conn=True):
    try:
        result = fetch_query(conn, "SELECT last_updated FROM counters WHERE key= %s", (counter_key,))
        if not result:
            raise ValueError("No counter found with key " + str(counter_key))
        return result[0][0]
    except Exception as e:
        print(f"Failed to get last updated counter: {e}")
        raise e
    finally:
        if close_conn:
            close_connection(conn)

def get_counter_value(conn, counter_key):
    try:
        result = fetch_query(conn, "SELECT counter FROM counters WHERE key = %s", (counter_key,))
        if not result:
            raise ValueError(f"No counter found with key {counter_key}")
        return result[0][0]
    except Exception as e:
        print(f"Failed to get counter value: {e}")
        raise e
    finally:
        close_connection(conn)

def increment_counter(conn, counter_key):
    try:
        result = execute_query(
            conn,
            "UPDATE counters SET counter = counter + 1, last_updated = TIMEZONE('UTC', NOW()) WHERE key = %s", 
            (counter_key,)
        )
        return "Successfully incremented Counter with key " + str(counter_key)+ " to " + str(get_counter_value(conn, counter_key))
    except Exception as e:
        print(f"Failed to increment counter: {e}")
        raise e
    finally:
        close_connection(conn)

def delete_counter(conn, counter_key):
    try:
        result = execute_query(
            conn,
            "DELETE FROM counters WHERE key = %s",
            (counter_key,)
        )
        return "Successfully deleted Counter with key " + str(counter_key)
    except Exception as e:
        print(f"Failed to delete counter: {e}")
        raise e
    finally:
        close_connection(conn)
