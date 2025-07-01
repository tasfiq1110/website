from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secure random secret key

DB_NAME = "database.db"

# ------------------- Database Init -------------------
def init_db():
    if not os.path.exists(DB_NAME):
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                date TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

# ------------------- Routes -------------------

@app.route('/')
def home():
    if 'username' in session:
        return redirect('/dashboard')
    return redirect('/login')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        try:
            c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            conn.commit()
            return jsonify(message="Registered successfully")
        except sqlite3.IntegrityError:
            return jsonify(error="Username already exists"), 400
        finally:
            conn.close()
    return render_template("register.html")

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
        user = c.fetchone()
        conn.close()
        if user:
            session['username'] = username
            return jsonify(message="Login successful")
        return jsonify(error="Invalid credentials"), 401
    return render_template("login.html")

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect('/login')

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect('/login')
    return render_template("dashboard.html", username=session['username'])

@app.route('/submit_meal', methods=['POST'])
def submit_meal():
    if 'username' not in session:
        return jsonify(error="Unauthorized"), 401
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
    return jsonify(message="Meal submitted")

@app.route('/summary')
def summary():
    if 'username' not in session:
        return jsonify(error="Unauthorized"), 401
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT date, meal_type, COUNT(*) FROM meals WHERE username=? GROUP BY date, meal_type",
              (session['username'],))
    rows = c.fetchall()
    conn.close()
    return jsonify(rows)

# ------------------- Run -------------------

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=10000)
