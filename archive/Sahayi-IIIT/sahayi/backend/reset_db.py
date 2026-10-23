import sqlite3
try:
    conn = sqlite3.connect('sahayi.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table_name in tables:
        print(f"Clearing table: {table_name[0]}")
        cursor.execute(f"DELETE FROM {table_name[0]};")
    conn.commit()
    print("All tables cleared successfully.")
    conn.close()
except Exception as e:
    print(f"Error clearing DB: {e}")
