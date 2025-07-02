from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Supabase PostgreSQL config
DATABASE_URL = "postgresql://postgres:1310532235@db.jbdqhbxectwowjwgwgco.supabase.co:5432/postgres"

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL
                    )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS meals (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        date TEXT NOT NULL,
                        meal_type TEXT NOT NULL,
                        is_modified INTEGER DEFAULT 0,
                        timestamp TEXT NOT NULL
                    )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS bazar (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        date TEXT NOT NULL,
                        cost INTEGER NOT NULL,
                        details TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    )''')
        conn.commit()

init_db()

def auto_add_meals():
    conn = get_db()
    cur = conn.cursor()

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    cur.execute("SELECT username FROM users")
    users = [row['username'] for row in cur.fetchall()]

    for username in users:
        cur.execute("SELECT COUNT(*) FROM meals WHERE username=%s AND date=%s", (username, yesterday))
        if cur.fetchone()['count'] == 0:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for meal in ["Lunch", "Dinner"]:
                cur.execute("""INSERT INTO meals (username, date, meal_type, is_modified, timestamp)
                               VALUES (%s, %s, %s, 0, %s)""", (username, yesterday, meal, timestamp))

    conn.commit()
    cur.close()
    conn.close()

# Auto insert 2 meals if user misses a day
scheduler = BackgroundScheduler()
scheduler.add_job(auto_add_meals, CronTrigger(hour=0, minute=0))
scheduler.start()

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
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, password))
        conn.commit()
        session['username'] = username
        return redirect(url_for('dashboard'))
    except psycopg2.errors.UniqueViolation:
        return "Username already exists"
    finally:
        cur.close()
        conn.close()

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'GET':
        return render_template("login.html")

    username = request.form['username']
    password = request.form['password']
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
    user = cur.fetchone()
    cur.close()
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
    date = data.get("date") or now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cur = conn.cursor()
    modified_flag = 0

    for meal in selected_meals:
        cur.execute("SELECT * FROM meals WHERE username=%s AND date=%s AND meal_type=%s", (username, date, meal))
        existing = cur.fetchone()
        if existing:
            cur.execute("UPDATE meals SET is_modified=1, timestamp=%s WHERE id=%s", (timestamp, existing['id']))
            modified_flag = 1
        else:
            cur.execute("""INSERT INTO meals (username, date, meal_type, is_modified, timestamp)
                           VALUES (%s, %s, %s, 0, %s)""", (username, date, meal, timestamp))

    conn.commit()
    cur.close()
    conn.close()

    return "Meal submitted (Modified)" if modified_flag else "Meal submitted"

@app.route('/submit_bazar', methods=['POST'])
def submit_bazar():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    data = request.get_json()
    cost = int(data['cost'])
    details = data['details']
    now = datetime.now()
    date = data.get("date") or now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""INSERT INTO bazar (username, date, cost, details, timestamp)
                   VALUES (%s, %s, %s, %s, %s)""", (username, date, cost, details, timestamp))
    conn.commit()
    cur.close()
    conn.close()
    return "Bazar submitted"

@app.route('/summary/personal')
def personal_summary():
    if 'username' not in session:
        return "Unauthorized", 401

    username = session['username']
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT date, COUNT(meal_type) AS count, MAX(is_modified) AS modified
        FROM meals
        WHERE username = %s AND date LIKE %s
        GROUP BY date
    """, (username, f"{month}-%"))
    meals = {row['date']: {"count": row['count'], "modified": row['modified']} for row in cur.fetchall()}

    cur.execute("""
        SELECT date, COUNT(*) AS bazar_count, SUM(cost) AS total_cost, STRING_AGG(details, '; ') AS details
        FROM bazar
        WHERE username = %s AND date LIKE %s
        GROUP BY date
    """, (username, f"{month}-%"))
    bazar = {row['date']: row for row in cur.fetchall()}

    all_dates = sorted(set(meals.keys()) | set(bazar.keys()))
    summary = []
    for date in all_dates:
        m = meals.get(date, {"count": 0, "modified": 0})
        b = bazar.get(date, {"bazar_count": 0, "total_cost": "", "details": ""})
        summary.append([
            username, date,
            m["count"],
            "Yes" if m["modified"] else "No",
            b["total_cost"],
            b["details"],
            "Yes" if b["bazar_count"] > 1 else ("No" if b["bazar_count"] == 1 else "")
        ])

    cur.close()
    conn.close()
    return jsonify({"summary": summary})

@app.route('/summary/global')
def global_summary():
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT username, date, COUNT(meal_type) AS count, MAX(is_modified) AS modified
        FROM meals
        WHERE date LIKE %s
        GROUP BY username, date
    """, (f"{month}-%",))
    meals = {(row['username'], row['date']): {"count": row['count'], "modified": row['modified']} for row in cur.fetchall()}

    cur.execute("""
        SELECT username, date, COUNT(*) AS bazar_count, SUM(cost) AS total_cost, STRING_AGG(details, '; ') AS details
        FROM bazar
        WHERE date LIKE %s
        GROUP BY username, date
    """, (f"{month}-%",))
    bazar = {(row['username'], row['date']): row for row in cur.fetchall()}

    all_keys = sorted(set(meals.keys()) | set(bazar.keys()))
    summary = []
    for key in all_keys:
        username, date = key
        m = meals.get(key, {"count": 0, "modified": 0})
        b = bazar.get(key, {"bazar_count": 0, "total_cost": "", "details": ""})
        summary.append([
            username, date,
            m["count"],
            "Yes" if m["modified"] else "No",
            b["total_cost"],
            b["details"],
            "Yes" if b["bazar_count"] > 1 else ("No" if b["bazar_count"] == 1 else "")
        ])

    cur.close()
    conn.close()
    return jsonify({"summary": summary})

@app.route('/summary/cost')
def cost_summary():
    if 'username' not in session:
        return "Unauthorized", 401

    month = request.args.get("month") or datetime.now().strftime("%Y-%m")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT SUM(cost) FROM bazar WHERE date LIKE %s", (f"{month}-%",))
    total_bazar_cost = cur.fetchone()['sum'] or 0

    cur.execute("SELECT COUNT(*) FROM meals WHERE date LIKE %s", (f"{month}-%",))
    total_meal_count = cur.fetchone()['count'] or 0

    meal_unit_cost = total_bazar_cost / total_meal_count if total_meal_count else 0

    cur.execute("SELECT username, COUNT(*) FROM meals WHERE date LIKE %s GROUP BY username", (f"{month}-%",))
    user_data = cur.fetchall()

    results = []
    for row in user_data:
        user_total_cost = round(row['count'] * meal_unit_cost, 2)
        results.append({
            "username": row['username'],
            "meals": row['count'],
            "cost": user_total_cost
        })

    cur.close()
    conn.close()
    return jsonify({
        "month": month,
        "total_bazar_cost": total_bazar_cost,
        "total_meal_count": total_meal_count,
        "meal_unit_cost": round(meal_unit_cost, 2),
        "user_costs": results
    })

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
