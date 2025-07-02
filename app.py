from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

app = Flask(__name__)
app.secret_key = os.urandom(24)

DATABASE_URL = "postgresql://postgres.jbdqhbxectwowjwgwgco:1310532235@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

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
        cur.execute('''CREATE TABLE IF NOT EXISTS notifications (
                        id SERIAL PRIMARY KEY,
                        message TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        seen_by TEXT[] DEFAULT '{}'
                    )''')
        conn.commit()

init_db()

def add_notification(message):
    with get_db() as conn:
        cur = conn.cursor()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("INSERT INTO notifications (message, timestamp) VALUES (%s, %s)", (message, timestamp))
        conn.commit()

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
    selected_meals = data.get('meals', [])
    extra_meal = int(data.get('extra_meal', 0) or 0)
    now = datetime.now()
    date = data.get("date") or now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM meals WHERE username = %s AND date = %s", (username, date))
    previous_count = cur.fetchone()['count']
    is_modified = 1 if previous_count > 0 else 0

    if is_modified:
        cur.execute("SELECT COUNT(*) FROM meals WHERE username=%s AND date=%s AND meal_type != 'None'", (username, date))
        old_meals = cur.fetchone()['count']

    cur.execute("DELETE FROM meals WHERE username = %s AND date = %s", (username, date))

    meal_entries = [(username, date, meal, is_modified, timestamp) for meal in selected_meals]
    meal_entries += [(username, date, "Extra", is_modified, timestamp)] * extra_meal

    if meal_entries:
        cur.executemany("""INSERT INTO meals (username, date, meal_type, is_modified, timestamp)
                           VALUES (%s, %s, %s, %s, %s)""", meal_entries)
    else:
        cur.execute("INSERT INTO meals (username, date, meal_type, is_modified, timestamp) VALUES (%s, %s, 'None', %s, %s)",
                    (username, date, is_modified, timestamp))

    conn.commit()
    cur.close()
    conn.close()

    if is_modified:
        new_meal_count = len(selected_meals) + extra_meal
        add_notification(f"{username} modified meals on {date}: {old_meals} → {new_meal_count}")

    return "Meal submitted (Modified)" if is_modified else "Meal submitted"

@app.route('/submit_bazar', methods=['POST'])
def submit_bazar():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    data = request.get_json()
    cost = int(data['cost'])
    details = data['details']
    date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT cost FROM bazar WHERE username = %s AND date = %s", (username, date))
    old = cur.fetchone()
    is_modified = old is not None
    old_cost = old['cost'] if is_modified else 0

    cur.execute("DELETE FROM bazar WHERE username = %s AND date = %s", (username, date))
    cur.execute("INSERT INTO bazar (username, date, cost, details, timestamp) VALUES (%s, %s, %s, %s, %s)",
                (username, date, cost, details, timestamp))

    conn.commit()
    cur.close()
    conn.close()

    if is_modified:
        add_notification(f"{username} modified bazar cost on {date}: ৳{old_cost} → ৳{cost}")

    return "Bazar submitted (Modified)" if is_modified else "Bazar submitted"

@app.route('/notifications')
def get_notifications():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notifications ORDER BY id DESC")
    notifications = cur.fetchall()
    for n in notifications:
        n['seen'] = username in (n['seen_by'] or [])
    cur.close()
    conn.close()
    return jsonify(notifications)

@app.route('/active_meals_today')
def active_meals_today():
    if 'username' not in session:
        return "Unauthorized", 401

    today = datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT username, COUNT(*) as meal_count,
               MAX(is_modified) > 0 as modified
        FROM meals
        WHERE date = %s AND meal_type != 'None'
        GROUP BY username
    """, (today,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify({"active_meals": rows})
@app.route('/summary/personal')
def personal_summary():
    if 'username' not in session:
        return "Unauthorized", 401

    username = session['username']
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT date, COUNT(*) FILTER (WHERE meal_type != 'None') AS count, MAX(is_modified) AS modified
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
        SELECT username, date, COUNT(*) FILTER (WHERE meal_type != 'None') AS count, MAX(is_modified) AS modified
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
def summary_cost():
    if 'username' not in session:
        return "Unauthorized", 401

    month = request.args.get('month')
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT username, COUNT(*) as meals
        FROM meals
        WHERE date LIKE %s AND meal_type != 'None'
        GROUP BY username
    """, (f"{month}-%",))
    meal_counts = {row['username']: row['meals'] for row in cur.fetchall()}

    cur.execute("""
        SELECT SUM(cost) as total_cost FROM bazar
        WHERE date LIKE %s
    """, (f"{month}-%",))
    total_cost = cur.fetchone()['total_cost'] or 0

    total_meals = sum(meal_counts.values())
    unit_cost = total_cost / total_meals if total_meals > 0 else 0

    user_costs = []
    for username, meal_count in meal_counts.items():
        user_costs.append({
            "username": username,
            "meals": meal_count,
            "cost": round(unit_cost * meal_count, 2)
        })

    cur.close()
    conn.close()

    return jsonify({
        "meal_unit_cost": round(unit_cost, 2),
        "user_costs": user_costs
    })


@app.route('/notifications/mark_seen', methods=['POST'])
def mark_notifications_seen():
    if 'username' not in session:
        return "Unauthorized", 401
    username = session['username']
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE notifications
        SET seen_by = array_append(seen_by, %s)
        WHERE NOT (%s = ANY(seen_by))
    """, (username, username))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "seen"})

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
