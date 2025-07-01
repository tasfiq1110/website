from flask import Flask, render_template, request, redirect, url_for, session
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secure random secret key

DB_NAME = "database.db"

def init_db():
    if not os.path.exists(DB_NAME):
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL
                    )''')
        c.execute('''CREATE TABLE IF NOT EXISTS meals (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        date TEXT NOT NULL,
                        meal_type TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    )''')
        conn.commit()
        conn.close()

@app.route('/', endpoint='register')
def show_register():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return render_template("register.html")

@app.route('/register', methods=['POST'])
def register_user():
    username = request.form['username']
    password = request.form['password']
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        session['username'] = username
        return redirect(url_for('dashboard'))
    except sqlite3.IntegrityError:
        return "Username already exists"
    finally:
        conn.close()

@app.route('/login')
def login_page():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return render_template("login.html")

@app.route('/login', methods=['POST'])
def login_user():
    username = request.form['username']
    password = request.form['password']
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
    user = c.fetchone()
    conn.close()
    if user:
        session['username'] = username
        return redirect(url_for('dashboard'))
    return "Invalid Credentials"

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login_page'))
    return render_template("dashboard.html", username=session['username'])

@app.route('/submit_meal', methods=['POST'])
def submit_meal():
    if 'username' not in session:
        return "Unauthorized", 401
    meal_type = request.form['meal']
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO meals (username, date, meal_type, timestamp) VALUES (?, ?, ?, ?)",
              (session['username'], date, meal_type, timestamp))
    conn.commit()
    conn.close()
    return "Meal submitted"

@app.route('/summary')
def summary():
    if 'username' not in session:
        return "Unauthorized", 401
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT date, meal_type, COUNT(*) FROM meals WHERE username=? GROUP BY date, meal_type",
              (session['username'],))
    rows = c.fetchall()
    conn.close()
    return {
        "summary": [
            {"date": row[0], "meal_type": row[1], "count": row[2]} for row in rows
        ]
    }

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=10000)
