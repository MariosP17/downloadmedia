import psycopg

class DBHandler:
    def __init__(self, db_connection_string):
        self.conn = get_connection(db_connection_string)

    def close(self):
        close_connection(self.conn)

    def execute(self, query, params=None):
        execute_query(self.conn, query, params)

    def fetch(self, query, params=None):
        return fetch_query(self.conn, query, params)
    
def get_connection(db_connection_string):
    try:
        conn = psycopg.connect(db_connection_string)
        return conn
    except Exception as e:
        print(f"Failed to connect to the database: {e}")
        raise e

def close_connection(conn):
    try:
        if conn:
            conn.close()
    except Exception as e:
        print(f"Failed to close the database connection: {e}")
        raise e

def execute_query(conn, query, params=None):
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            conn.commit()
    except Exception as e:
        print(f"Failed to execute query: {e}")
        raise e

def fetch_query(conn, query, params=None):
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            result = cur.fetchall()
            return result
    except Exception as e:
        print(f"Failed to fetch query: {e}")
        raise e
    