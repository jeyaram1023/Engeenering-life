# 🎓 Engineering Life – Online Course Platform

**Engineering Life** is a lightweight and responsive web-based platform designed for engineering students to learn, track, and complete courses online.  
It uses **Supabase** as the backend for authentication, data storage, and media management.

🔗 **Live App:** [https://jeyaram1023.github.io/Engeenering-life/](https://jeyaram1023.github.io/Engeenering-life/)

---

## 🚀 Features

- 🔐 Magic Link Login (no password)
- 🧑‍🎓 Student Info Form (Name, Phone, Branch)
- 🎉 Welcome Page with Student Info
- 🏠 Home Page: All Available Courses
- 📘 My Book Page: Enrolled Courses + Units
- ▶️ Unit Viewer: Video, Audio, and Text Content
- ✅ Complete Unit Button for Progress Tracking
- 👤 Profile Page: Info + Feedback + Logout
- 🔁 Responsive UI (Mobile + Desktop)

---

## 🧩 Tech Stack

| Layer         | Tool/Tech              |
|---------------|------------------------|
| Frontend      | HTML, CSS, JavaScript  |
| Backend       | [Supabase](https://supabase.com) (Auth, Database, Storage) |
| Hosting       | GitHub Pages           |
| Media Support | Supabase Storage (Video/Audio) |

---

## 🗂️ Folder Structure

```bash
Engeenering-life/
├── index.html             # Magic Link Login
├── student-info.html      # Info Form
├── welcome.html           # App intro
├── home.html              # All courses
├── mybook.html            # Enrolled courses
├── profile.html           # Student info + actions
│
├── css/
│   └── style.css
├── js/
│   ├── supabase.js        # Supabase config
│   ├── login.js
│   ├── student-info.js
│   ├── home.js
│   ├── mybook.js
│   ├── profile.js
│
└── assets/
    └── images/, icons/, media/
