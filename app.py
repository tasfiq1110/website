from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import os
from datetime import datetime
from datetime import timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

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


init_db()


def auto_add_meals():
    from datetime import datetime
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Get all usernames
    c.execute("SELECT username FROM users")
    users = [row[0] for row in c.fetchall()]

    for username in users:
        # Check if the user has submitted any meal for yesterday
        c.execute("SELECT COUNT(*) FROM meals WHERE username=? AND date=?", (username, yesterday))
        meal_count = c.fetchone()[0]
        if meal_count == 0:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for meal_type in ["Lunch", "Dinner"]:  # Assuming 2 default meals
                c.execute("""INSERT INTO meals (username, date, meal_type, is_modified, timestamp)
                             VALUES (?, ?, ?, 0, ?)""", (username, yesterday, meal_type, timestamp))

    conn.commit()
    conn.close()

# Register the scheduler
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
    date = request.json.get("date") or now.strftime("%Y-%m-%d")
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
    date = request.json.get("date") or now.strftime("%Y-%m-%d")
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
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
        SELECT date, COUNT(meal_type), MAX(is_modified)
        FROM meals
        WHERE username = ? AND date LIKE ?
        GROUP BY date
    """, (username, f"{month}-%"))
    meals = {row[0]: {"count": row[1], "modified": row[2]} for row in c.fetchall()}

    c.execute("""
        SELECT date, COUNT(*), SUM(cost), GROUP_CONCAT(details, '; ')
        FROM bazar
        WHERE username = ? AND date LIKE ?
        GROUP BY date
    """, (username, f"{month}-%"))
    bazar = {row[0]: {"bazar_count": row[1], "total_cost": row[2], "details": row[3]} for row in c.fetchall()}

    all_dates = sorted(set(meals.keys()) | set(bazar.keys()))
    summary = []
    for date in all_dates:
        m = meals.get(date, {"count": 0, "modified": 0})
        b = bazar.get(date, {"bazar_count": 0, "total_cost": "", "details": ""})
        summary.append([
            username,
            date,
            m["count"],
            "Yes" if m["modified"] else "No",
            b["total_cost"],
            b["details"],
            "Yes" if b["bazar_count"] > 1 else ("No" if b["bazar_count"] == 1 else "")
        ])

    return jsonify({"summary": summary})


@app.route('/summary/global')
def global_summary():
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
        SELECT username, date, COUNT(meal_type), MAX(is_modified)
        FROM meals
        WHERE date LIKE ?
        GROUP BY username, date
    """, (f"{month}-%",))
    meals = {}
    for row in c.fetchall():
        key = (row[0], row[1])
        meals[key] = {"count": row[2], "modified": row[3]}

    c.execute("""
        SELECT username, date, COUNT(*), SUM(cost), GROUP_CONCAT(details, '; ')
        FROM bazar
        WHERE date LIKE ?
        GROUP BY username, date
    """, (f"{month}-%",))
    bazar = {}
    for row in c.fetchall():
        key = (row[0], row[1])
        bazar[key] = {"bazar_count": row[2], "total_cost": row[3], "details": row[4]}

    all_keys = sorted(set(meals.keys()) | set(bazar.keys()))
    summary = []
    for key in all_keys:
        username, date = key
        m = meals.get(key, {"count": 0, "modified": 0})
        b = bazar.get(key, {"bazar_count": 0, "total_cost": "", "details": ""})
        summary.append([
            username,
            date,
            m["count"],
            "Yes" if m["modified"] else "No",
            b["total_cost"],
            b["details"],
            "Yes" if b["bazar_count"] > 1 else ("No" if b["bazar_count"] == 1 else "")
        ])

    return jsonify({"summary": summary})


@app.route('/summary/cost')
def cost_summary():
    if 'username' not in session:
        return "Unauthorized", 401

    month = request.args.get("month") or datetime.now().strftime("%Y-%m")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("SELECT SUM(cost) FROM bazar WHERE date LIKE ?", (f"{month}-%",))
    total_bazar_cost = c.fetchone()[0] or 0

    c.execute("SELECT COUNT(*) FROM meals WHERE date LIKE ?", (f"{month}-%",))
    total_meal_count = c.fetchone()[0] or 0

    meal_unit_cost = total_bazar_cost / total_meal_count if total_meal_count else 0

    c.execute("""SELECT username, COUNT(*) FROM meals
                 WHERE date LIKE ?
                 GROUP BY username""", (f"{month}-%",))
    user_data = c.fetchall()

    results = []
    for username, user_meal_count in user_data:
        user_total_cost = round(user_meal_count * meal_unit_cost, 2)
        results.append({
            "username": username,
            "meals": user_meal_count,
            "cost": user_total_cost
        })

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
