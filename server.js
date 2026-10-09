const express = require("express"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");

const app = express(),
  PORT = process.env.PORT || 3000;

// 1. กำหนดโฟลเดอร์ data และไฟล์ tasks.json ภายนอกตัว .exe (ใช้ process.cwd())
const DATA_DIR = path.join(process.cwd(), "data");
const DATA = path.join(DATA_DIR, "tasks.json");

// ตรวจสอบและสร้างโฟลเดอร์ data + ไฟล์ tasks.json อัตโนมัติหากยังไม่มี
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA)) {
  fs.writeFileSync(DATA, JSON.stringify([], null, 2), "utf8");
}

app.use(express.json());

// 2. เสิร์ฟไฟล์หน้าเว็บจากภายในตัว .exe (__dirname)
app.use(express.static(path.join(__dirname, "public")));

function read() {
  try {
    return JSON.parse(fs.readFileSync(DATA, "utf8"));
  } catch {
    return [];
  }
}

function write(x) {
  fs.writeFileSync(DATA, JSON.stringify(x, null, 2));
}

app.get("/api/tasks", (_, r) => r.json(read()));

app.post("/api/tasks", (q, r) => {
  let a = read(),
    t = {
      id: crypto.randomUUID(),
      name: String(q.body.name || "").trim(),
      detail: String(q.body.detail || "").trim(),
      status: ["todo", "doing", "testing", "done"].includes(q.body.status)
        ? q.body.status
        : "todo",
      date: q.body.date,
      createdAt: new Date().toISOString()
    };
  if (!t.name || !t.date)
    return r.status(400).json({ error: "name/date required" });
  a.unshift(t);
  write(a);
  r.status(201).json(t);
});

app.patch("/api/tasks/:id", (q, r) => {
  let a = read(),
    i = a.findIndex((x) => x.id === q.params.id);
  if (i < 0) return r.sendStatus(404);
  if (["todo", "doing", "testing", "done"].includes(q.body.status))
    a[i].status = q.body.status;
  if (typeof q.body.name === "string") {
    let n = q.body.name.trim();
    if (n) a[i].name = n;
  }
  if (typeof q.body.detail === "string") {
    a[i].detail = q.body.detail.trim();
  }
  write(a);
  r.json(a[i]);
});

app.delete("/api/tasks/:id", (q, r) => {
  write(read().filter((x) => x.id !== q.params.id));
  r.sendStatus(204);
});

// ลบงานหลายรายการพร้อมกัน
app.post("/api/tasks/bulk-delete", (q, r) => {
  let ids = Array.isArray(q.body.ids) ? q.body.ids : [];
  if (!ids.length) return r.status(400).json({ error: "ids required" });
  let before = read();
  let after = before.filter((x) => !ids.includes(x.id));
  write(after);
  r.json({ deleted: before.length - after.length });
});

app.get("/api/backup", (_, r) =>
  r.download(DATA, "daily-work-backup.json")
);

// เพิ่ม Endpoint สั่งปิด Server จากฝั่ง Client
app.post("/api/shutdown", (_, r) => {
  r.send("Server stopping...");
  setTimeout(() => process.exit(0), 500);
});

app.listen(PORT, () =>
  console.log(`Daily Work Tracker v2: http://localhost:${PORT}`)
);