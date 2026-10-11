
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from pathlib import Path

app = Flask(__name__)
CORS(app)

DATA_FILE = Path(__file__).with_name("tasks.json")

DEFAULT_TASKS = [
    {"id": 1, "name": "User authentication API", "owner": "Aarav", "progress": 85, "due": 11, "status": "In Progress", "dep": None, "blocked": False, "points": 5},
    {"id": 2, "name": "Analytics dashboard UI", "owner": "Varshini", "progress": 45, "due": 12, "status": "In Progress", "dep": 1, "blocked": False, "points": 8},
    {"id": 3, "name": "Payment integration", "owner": "Ishita", "progress": 25, "due": 10, "status": "Blocked", "dep": 1, "blocked": True, "points": 8},
    {"id": 4, "name": "Database optimization", "owner": "Rohan", "progress": 65, "due": 13, "status": "In Progress", "dep": None, "blocked": False, "points": 5},
    {"id": 5, "name": "Automated test suite", "owner": "Aarav", "progress": 30, "due": 11, "status": "In Progress", "dep": 3, "blocked": False, "points": 5},
    {"id": 6, "name": "API documentation", "owner": "Meera", "progress": 90, "due": 12, "status": "In Progress", "dep": 1, "blocked": False, "points": 3},
    {"id": 7, "name": "Mobile responsiveness", "owner": "Varshini", "progress": 20, "due": 13, "status": "To Do", "dep": 2, "blocked": False, "points": 5},
    {"id": 8, "name": "Deployment pipeline", "owner": "Rohan", "progress": 100, "due": 9, "status": "Done", "dep": None, "blocked": False, "points": 3}
]


def save_tasks(tasks):
    DATA_FILE.write_text(
        json.dumps(tasks, indent=2),
        encoding="utf-8"
    )


def load_tasks():
    if not DATA_FILE.exists():
        save_tasks(DEFAULT_TASKS)
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def valid_task(data):
    required = ["name", "owner", "progress", "due", "status"]
    if not isinstance(data, dict):
        return False
    if any(key not in data for key in required):
        return False
    if not str(data["name"]).strip() or not str(data["owner"]).strip():
        return False
    try:
        progress = int(data["progress"])
        int(data["due"])
    except (TypeError, ValueError):
        return False
    return 0 <= progress <= 100


@app.get("/api/tasks")
def get_tasks():
    return jsonify(load_tasks())


@app.post("/api/tasks")
def add_task():
    data = request.get_json(silent=True) or {}

    if not valid_task(data):
        return jsonify({"error": "Invalid task data"}), 400

    tasks = load_tasks()
    new_id = max((task["id"] for task in tasks), default=0) + 1

    task = {
        "id": new_id,
        "name": str(data["name"]).strip(),
        "owner": str(data["owner"]).strip(),
        "progress": int(data["progress"]),
        "due": int(data["due"]),
        "status": str(data["status"]),
        "dep": data.get("dep"),
        "blocked": bool(data.get("blocked", False)),
        "points": int(data.get("points", 5))
    }

    if task["progress"] >= 100:
        task["status"] = "Done"

    tasks.append(task)
    save_tasks(tasks)
    return jsonify(task), 201


@app.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    data = request.get_json(silent=True) or {}

    if not valid_task(data):
        return jsonify({"error": "Invalid task data"}), 400

    tasks = load_tasks()
    existing = next((t for t in tasks if t["id"] == task_id), None)

    if existing is None:
        return jsonify({"error": "Task not found"}), 404

    updated = {
        "id": task_id,
        "name": str(data["name"]).strip(),
        "owner": str(data["owner"]).strip(),
        "progress": int(data["progress"]),
        "due": int(data["due"]),
        "status": str(data["status"]),
        "dep": data.get("dep"),
        "blocked": bool(data.get("blocked", False)),
        "points": int(data.get("points", existing.get("points", 5)))
    }

    if updated["progress"] >= 100:
        updated["status"] = "Done"

    if updated["dep"] == task_id:
        return jsonify({"error": "A task cannot depend on itself"}), 400

    tasks = [updated if t["id"] == task_id else t for t in tasks]
    save_tasks(tasks)
    return jsonify(updated)


@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    tasks = load_tasks()

    if not any(t["id"] == task_id for t in tasks):
        return jsonify({"error": "Task not found"}), 404

    if any(t.get("dep") == task_id for t in tasks):
        return jsonify({
            "error": "Remove dependent links before deleting this task"
        }), 409

    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)
    return jsonify({"message": "Task deleted"})


@app.get("/api/predictions")
def get_predictions():
    tasks = load_tasks()
    predictions = []

    for task in tasks:
        score = 0
        reasons = []

        if task.get("status") == "Done":
            predictions.append({
                "id": task["id"],
                "name": task["name"],
                "risk_score": 0,
                "risk_level": "Low",
                "reasons": ["Task completed"],
                "recommendation": "No action needed"
            })
            continue

        if task.get("blocked") or task.get("status") == "Blocked":
            score += 40
            reasons.append("Task is blocked")

        if task.get("due", 999) <= 1:
            score += 25
            reasons.append("Deadline is very close")

        if task.get("progress", 0) < 40:
            score += 20
            reasons.append("Task progress is low")

        dependency_id = task.get("dep")
        if dependency_id is not None:
            dependency = next(
                (t for t in tasks if t["id"] == dependency_id),
                None
            )
            if dependency and dependency.get("status") != "Done":
                score += 15
                reasons.append("Dependency is not completed")

        score = min(score, 100)

        if score >= 60:
            level = "High"
            recommendation = "Prioritize this task and resolve blockers"
        elif score >= 30:
            level = "Medium"
            recommendation = "Review progress and dependencies"
        else:
            level = "Low"
            recommendation = "Continue monitoring progress"

        predictions.append({
            "id": task["id"],
            "name": task["name"],
            "risk_score": score,
            "risk_level": level,
            "reasons": reasons or ["No major risk indicators detected"],
            "recommendation": recommendation
        })

    return jsonify(predictions)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
