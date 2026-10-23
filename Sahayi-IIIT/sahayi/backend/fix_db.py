import sqlite3
import sys

def main():
    try:
        conn = sqlite3.connect('sahayi.db')
        conn.execute('ALTER TABLE patients ADD COLUMN relative_relationship VARCHAR(64) DEFAULT ""')
        conn.commit()
        print("Successfully added relative_relationship column to patients table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column already exists.")
        else:
            print(f"OperationalError: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
