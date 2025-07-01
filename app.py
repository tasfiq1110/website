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
                        timestamp TEXT NOT NULL
                    )''')
        c.execute('''CREATE TABLE IF NOT EXISTS bazar (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        date TEXT NOT NULL,
                        cost INTEGER NOT NULL,
                        details TEXT,
                        timestamp TEXT NOT NULL
                    )''')
        conn.commit()
        conn.close()

@app.route('/')
def register_page():
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
    meal_types = request.form.getlist('meal[]')
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("DELETE FROM meals WHERE username=? AND date=?", (session['username'], date))  # overwrite
    for meal in meal_types:
        c.execute("INSERT INTO meals (username, date, meal_type, timestamp) VALUES (?, ?, ?, ?)",
                  (session['username'], date, meal, timestamp))
    conn.commit()
    conn.close()
    return "Meal submitted successfully"

@app.route('/submit_bazar', methods=['POST'])
def submit_bazar():
    if 'username' not in session:
        return "Unauthorized", 401
    cost = request.form['cost']
    details = request.form['details']
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO bazar (username, date, cost, details, timestamp) VALUES (?, ?, ?, ?, ?)",
              (session['username'], date, cost, details, timestamp))
    conn.commit()
    conn.close()
    return "Bazar info submitted"

@app.route('/summary/personal')
def personal_summary():
    if 'username' not in session:
        return "Unauthorized", 401
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""SELECT date, GROUP_CONCAT(meal_type), COUNT(*) 
                 FROM meals 
                 WHERE username=? AND strftime('%Y-%m', date)=strftime('%Y-%m', 'now')
                 GROUP BY date""", (session['username'],))
    meals = c.fetchall()
    c.execute("""SELECT date, cost, details 
                 FROM bazar 
                 WHERE username=? AND strftime('%Y-%m', date)=strftime('%Y-%m', 'now')""", 
              (session['username'],))
    bazars = c.fetchall()
    conn.close()
    return jsonify({"meals": meals, "bazar": bazars})

@app.route('/summary/global')
def global_summary():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""SELECT username, date, GROUP_CONCAT(meal_type), COUNT(*) 
                 FROM meals 
                 WHERE strftime('%Y-%m', date)=strftime('%Y-%m', 'now') 
                 GROUP BY username, date""")
    meals = c.fetchall()
    c.execute("""SELECT username, date, cost, details 
                 FROM bazar 
                 WHERE strftime('%Y-%m', date)=strftime('%Y-%m', 'now')""")
    bazars = c.fetchall()
    conn.close()
    return jsonify({"meals": meals, "bazar": bazars})

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

# init the db
init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
