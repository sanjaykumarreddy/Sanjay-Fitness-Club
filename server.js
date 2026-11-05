const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3001;
const JWT_SECRET = "replace_this_with_a_long_random_secret";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function makeToken(user) {
  return jwt.sign(
    { id: user.member_id, email: user.email, role: "member", name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please login first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== "SFC-ADMIN-2026") {
    return res.status(403).json({ message: "Admin access denied." });
  }
  next();
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/test", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ success: true, message: "Gym database connected successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/plans", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM membership_plans ORDER BY price");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Could not load plans.", error: err.message });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, age, gender, password, plan_id } = req.body;
    if (!name || !email || !phone || !password || !plan_id) {
      return res.status(400).json({ message: "Please fill all required fields." });
    }
    const [existing] = await db.query("SELECT member_id FROM members WHERE email=?", [email]);
    if (existing.length) return res.status(409).json({ message: "This email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [memberResult] = await connection.query(
        "INSERT INTO members (name,email,phone,age,gender,password,join_date,status) VALUES (?,?,?,?,?,?,CURDATE(),'Active')",
        [name, email, phone, age || null, gender || null, hashed]
      );
      const [plans] = await connection.query("SELECT duration_days,price FROM membership_plans WHERE plan_id=?", [plan_id]);
      if (!plans.length) throw new Error("Selected membership plan does not exist.");
      const [enrollment] = await connection.query(
        "INSERT INTO enrollments (member_id,plan_id,start_date,expiry_date,status) VALUES (?,?,CURDATE(),DATE_ADD(CURDATE(), INTERVAL ? DAY),'Active')",
        [memberResult.insertId, plan_id, plans[0].duration_days]
      );
      await connection.query(
        "INSERT INTO payments (member_id,amount,payment_date,payment_method,payment_status) VALUES (?,?,CURDATE(),'Pay at desk','Pending')",
        [memberResult.insertId, plans[0].price]
      );
      await connection.commit();
      const user = { member_id: memberResult.insertId, name, email };
      res.status(201).json({ message: "Registration successful!", token: makeToken(user), user });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    res.status(500).json({ message: err.message || "Registration failed." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query("SELECT * FROM members WHERE email=?", [email]);
    if (!rows.length) return res.status(401).json({ message: "Invalid email or password." });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });
    const user = { member_id: rows[0].member_id, name: rows[0].name, email: rows[0].email };
    res.json({ message: "Login successful!", token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

app.get("/api/me", authenticate, async (req, res) => {
  try {
    const [members] = await db.query(
      "SELECT member_id,name,email,phone,age,gender,join_date,status FROM members WHERE member_id=?",
      [req.user.id]
    );
    if (!members.length) return res.status(404).json({ message: "Member not found." });
    const [enrollments] = await db.query(
      `SELECT e.enrollment_id,e.start_date,e.expiry_date,e.status,p.plan_name,p.price
       FROM enrollments e JOIN membership_plans p ON e.plan_id=p.plan_id
       WHERE e.member_id=? ORDER BY e.enrollment_id DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ member: members[0], enrollment: enrollments[0] || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/summary", adminOnly, async (req, res) => {
  try {
    const [[members]] = await db.query("SELECT COUNT(*) AS total FROM members");
    const [[active]] = await db.query("SELECT COUNT(*) AS total FROM members WHERE status='Active'");
    const [[plans]] = await db.query("SELECT COUNT(*) AS total FROM membership_plans");
    const [[revenue]] = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE payment_status='Paid'");
    res.json({ members: members.total, active: active.total, plans: plans.total, revenue: revenue.total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/members", adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.member_id,m.name,m.email,m.phone,m.join_date,m.status,
       p.plan_name,e.expiry_date
       FROM members m
       LEFT JOIN enrollments e ON e.enrollment_id=(SELECT MAX(e2.enrollment_id) FROM enrollments e2 WHERE e2.member_id=m.member_id)
       LEFT JOIN membership_plans p ON p.plan_id=e.plan_id
       ORDER BY m.member_id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/admin/members/:id/status", adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Active", "Inactive"].includes(status)) return res.status(400).json({ message: "Invalid status." });
    const [result] = await db.query("UPDATE members SET status=? WHERE member_id=?", [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Member not found." });
    res.json({ message: "Member status updated." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/admin/members/:id", adminOnly, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM members WHERE member_id=?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Member not found." });
    res.json({ message: "Member deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Sanjay Fitness Club running at http://localhost:${PORT}`);
  try {
    await db.query("SELECT 1");
    console.log("MySQL database connected successfully!");
  } catch (err) {
    console.log("MySQL connection error:", err.message);
    console.log("Check db.js password and run schema.sql in MySQL Workbench.");
  }
});
