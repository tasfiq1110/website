from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.urandom(24)

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
                        is_modified INTEGER DEFAULT 0,
                        timestamp TEXT NOT NULL
                    )''')
        c.execute('''CREATE TABLE IF NOT EXISTS bazar (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        date TEXT NOT NULL,
                        cost INTEGER NOT NULL,
                        details TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    )''')
        conn.commit()
        conn.close()

# ✅ RUN INIT ON IMPORT (so it works even under Gunicorn)
init_db()

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return render_template("register.html")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template("register.html")

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

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'GET':
        return render_template("login.html")

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
    return render_template("dashboard.html")

@app.route('/submit_meal', methods=['POST'])
def submit_meal():
    if 'username' not in session:
        return "Unauthorized", 401

    data = request.get_json()
    if not data or 'meals' not in data:
        return "Invalid data", 400

    username = session['username']
    selected_meals = data['meals']

    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    modified_flag = 0

    for meal in selected_meals:
        c.execute("SELECT * FROM meals WHERE username=? AND date=? AND meal_type=?", (username, date, meal))
        exists = c.fetchone()
        if exists:
            c.execute("UPDATE meals SET is_modified=1, timestamp=? WHERE id=?", (timestamp, exists[0]))
            modified_flag = 1
        else:
            c.execute("INSERT INTO meals (username, date, meal_type, is_modified, timestamp) VALUES (?, ?, ?, 0, ?)",
                      (username, date, meal, timestamp))

    conn.commit()
    conn.close()

    return "Meal submitted (Modified)" if modified_flag else "Meal submitted"


@app.route('/submit_bazar', methods=['POST'])
def submit_bazar():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    cost = int(request.json['cost'])
    details = request.json['details']
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO bazar (username, date, cost, details, timestamp) VALUES (?, ?, ?, ?, ?)",
              (username, date, cost, details, timestamp))
    conn.commit()
    conn.close()
    return "Bazar submitted"

@app.route('/summary/personal')
def personal_summary():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    now = datetime.now()
    current_month = now.strftime("%Y-%m")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""SELECT date, meal_type, COUNT(*), MAX(is_modified)
                 FROM meals WHERE username=? AND date LIKE ?
                 GROUP BY date, meal_type""", (username, f"{current_month}-%"))
    meals = c.fetchall()

    c.execute("""SELECT date, cost, details
                 FROM bazar WHERE username=? AND date LIKE ?""", (username, f"{current_month}-%"))
    bazar = c.fetchall()
    conn.close()

    summary = []
    for row in meals:
        date, meal_type, count, modified = row
        summary.append([username, date, meal_type, count, "Modified" if modified else "Normal", "", ""])
    for row in bazar:
        date, cost, details = row
        summary.append([username, date, "", "", "", cost, details])
    return jsonify({"summary": summary})

@app.route('/summary/global')
def global_summary():
    now = datetime.now()
    current_month = now.strftime("%Y-%m")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""SELECT username, date, meal_type, COUNT(*), MAX(is_modified)
                 FROM meals WHERE date LIKE ?
                 GROUP BY username, date, meal_type""", (f"{current_month}-%",))
    meals = c.fetchall()

    c.execute("""SELECT username, date, cost, details
                 FROM bazar WHERE date LIKE ?""", (f"{current_month}-%",))
    bazar = c.fetchall()
    conn.close()

    summary = []
    for row in meals:
        username, date, meal_type, count, modified = row
        summary.append([username, date, meal_type, count, "Modified" if modified else "Normal", "", ""])
    for row in bazar:
        username, date, cost, details = row
        summary.append([username, date, "", "", "", cost, details])
    return jsonify({"summary": summary})

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

# ✅ Keep this block so local testing works
if __name__ == '__main__':
    app.run(debug=True, port=5000)
