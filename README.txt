SANJAY FITNESS CLUB - SETUP INSTRUCTIONS
========================================

PROJECT STRUCTURE
-----------------
zym/
  package.json
  db.js
  server.js
  schema.sql
  public/
    index.html
    about.html
    plans.html
    register.html
    login.html
    dashboard.html
    admin.html
    style.css
    script.js

STEP 1: DATABASE
----------------
1. Open MySQL Workbench.
2. Open schema.sql from this project.
3. Execute the complete SQL script.
4. It creates database gym_management, tables, sample plans and sample trainers.

STEP 2: MYSQL PASSWORD
----------------------
Open db.js.
Replace YOUR_MYSQL_PASSWORD with your actual MySQL root password.
If your MySQL root account has no password, use an empty string: password: ""

STEP 3: INSTALL PACKAGES
-----------------------
Open the project folder in VS Code.
Open Terminal > New Terminal and run:
npm install

STEP 4: START PROJECT
---------------------
Run:
npm start

Open:
http://localhost:3001

Database test:
http://localhost:3001/api/test

STEP 5: TEST WEBSITE
-------------------
1. Open Membership to view plans.
2. Open Join Us and register a new member.
3. Login using the registered email and password.
4. Dashboard shows the member profile and membership expiry.
5. Admin page demo key: SFC-ADMIN-2026

IMPORTANT
---------
- style.css and script.js are inside the public folder as requested.
- This is an academic demonstration project. Before real/public deployment,
  change JWT_SECRET and the admin key, use environment variables, add proper
  admin authentication, validation, HTTPS and production security controls.
- Images use remote Unsplash URLs and require an internet connection.
