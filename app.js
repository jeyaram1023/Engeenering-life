import { supabase } from './supabase.js';

// --- DOM ELEMENTS ---
const pages = document.querySelectorAll('.page');
const loginPage = document.getElementById('login-page');
const studentInfoPage = document.getElementById('student-info-page');
const welcomePage = document.getElementById('welcome-page');
const homePage = document.getElementById('home-page');
const myBookPage = document.getElementById('my-book-page');
const courseDetailPage = document.getElementById('course-detail-page');
const unitViewPage = document.getElementById('unit-view-page');
const profilePage = document.getElementById('profile-page');

const header = document.getElementById('app-header');
const footer = document.getElementById('app-footer');

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const studentInfoForm = document.getElementById('student-info-form');
const logoutBtn = document.getElementById('logout-btn');
const letsGoBtn = document.getElementById('lets-go-btn');
const backToMyBookBtn = document.getElementById('back-to-my-book');
const backToUnitsBtn = document.getElementById('back-to-units');

const loginMessage = document.getElementById('login-message');
const coursesGrid = document.getElementById('courses-grid');
const enrolledCoursesGrid = document.getElementById('enrolled-courses-grid');
const unitsList = document.getElementById('units-list');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileMobile = document.getElementById('profile-mobile');
const profileBranch = document.getElementById('profile-branch');

const welcomeName = document.getElementById('welcome-name');
const welcomeBranch = document.getElementById('welcome-branch');

// --- APP STATE ---
let currentUser = null;
let currentCourseId = null;

// --- PAGE ROUTING ---
const showPage = (pageId) => {
  pages.forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');

  const mainPages = ['home-page', 'my-book-page', 'profile-page', 'course-detail-page', 'unit-view-page'];
  if (mainPages.includes(pageId)) {
    header.classList.remove('hidden');
    footer.classList.remove('hidden');
  } else {
    header.classList.add('hidden');
    footer.classList.add('hidden');
  }
};

// --- AUTH ---
const handleLogin = async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  loginMessage.textContent = '';

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://jeyaram1023.github.io/Engeenering-life/',
      }
    });
    if (error) throw error;
    loginMessage.textContent = '✅ Success! Check your email.';
    loginMessage.style.color = 'green';
    loginForm.reset();
  } catch (err) {
    loginMessage.textContent = `❌ Error: ${err.message}`;
    loginMessage.style.color = 'red';
  }
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  showPage('login-page');
};

// --- PROFILE FETCH ---
const fetchStudentProfile = async (userId) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Fetch profile error:', error);
    return null;
  }
  return data;
};

// --- HOME PAGE ---
const loadHomePage = async () => {
  const { data: courses, error: coursesError } = await supabase.from('courses').select('*');
  if (coursesError) return console.error('Courses Error:', coursesError);

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', currentUser.id);

  if (enrollmentsError) return console.error('Enrollments Error:', enrollmentsError);

  const enrolledCourseIds = new Set(enrollments.map(e => e.course_id));

  coursesGrid.innerHTML = '';
  courses.forEach(course => {
    const isEnrolled = enrolledCourseIds.has(course.id);
    const card = document.createElement('div');
    card.className = 'course-card';
    card.innerHTML = `
      <img src="${course.cover_image_url}" alt="${course.title}">
      <div class="course-card-content">
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <button data-course-id="${course.id}" class="${isEnrolled ? 'view-btn' : 'enroll-btn'}">
          ${isEnrolled ? 'View Course' : 'Enroll Now'}
        </button>
      </div>`;
    coursesGrid.appendChild(card);
  });

  showPage('home-page');
};

// --- MY BOOK PAGE ---
const loadMyBookPage = async () => {
  const { data, error } = await supabase
    .from('enrollments')
    .select('courses(*)')
    .eq('student_id', currentUser.id);

  if (error) return console.error('Enrolled courses error:', error);

  enrolledCoursesGrid.innerHTML = '';
  if (data.length === 0) {
    enrolledCoursesGrid.innerHTML = '<p>No enrolled courses yet.</p>';
    return;
  }

  data.forEach(({ courses: course }) => {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.innerHTML = `
      <img src="${course.cover_image_url}" alt="${course.title}">
      <div class="course-card-content">
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <button data-course-id="${course.id}" class="view-btn">View Course</button>
      </div>`;
    enrolledCoursesGrid.appendChild(card);
  });

  showPage('my-book-page');
};

// --- COURSE DETAIL ---
const loadCourseDetailPage = async (courseId) => {
  currentCourseId = courseId;

  const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
  const { data: units } = await supabase.from('units').select('*').eq('course_id', courseId).order('unit_order');

  document.getElementById('course-detail-title').textContent = course.title;
  unitsList.innerHTML = '';

  units.forEach(unit => {
    const unitItem = document.createElement('div');
    unitItem.className = 'unit-item';
    unitItem.innerHTML = `<span>${unit.title}</span><i class="fas fa-play-circle"></i>`;
    unitItem.addEventListener('click', () => loadUnitViewPage(unit));
    unitsList.appendChild(unitItem);
  });

  showPage('course-detail-page');
};

// --- UNIT VIEW ---
const loadUnitViewPage = (unit) => {
  document.getElementById('unit-title').textContent = unit.title;
  document.getElementById('video-container').innerHTML = unit.video_url ? `<video src="${unit.video_url}" controls></video>` : '';
  document.getElementById('audio-container').innerHTML = unit.audio_url ? `<audio src="${unit.audio_url}" controls></audio>` : '';
  document.getElementById('text-container').innerHTML = unit.text_content ? `<p>${unit.text_content}</p>` : '';
  showPage('unit-view-page');
};

// --- PROFILE PAGE ---
const loadProfilePage = async () => {
  const profile = await fetchStudentProfile(currentUser.id);
  if (profile) {
    profileName.textContent = profile.name;
    profileEmail.textContent = profile.email;
    profileMobile.textContent = profile.mobile;
    profileBranch.textContent = profile.branch;
  }
  showPage('profile-page');
};

// --- STUDENT INFO FORM SUBMIT ---
const handleStudentInfoSubmit = async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("User not authenticated. Try logging in again.");
    return;
  }

  const name = document.getElementById('name-input').value;
  const mobile = document.getElementById('mobile-input').value;
  const branch = document.getElementById('branch-select').value;

  const { error } = await supabase.from('students').upsert({
    id: currentUser.id,
    email: currentUser.email,
    name,
    mobile,
    branch,
    updated_at: new Date()
  });

  if (error) {
    console.error('Student save error:', error);
  } else {
    welcomeName.textContent = name;
    welcomeBranch.textContent = branch;
    showPage('welcome-page');
  }
};

// --- COURSE ENROLL ---
const handleEnroll = async (courseId) => {
  const { error } = await supabase.from('enrollments').insert({
    student_id: currentUser.id,
    course_id: courseId
  });

  if (error) {
    alert('Error enrolling. You may already be enrolled.');
  } else {
    alert('Enrolled successfully!');
    loadHomePage();
  }
};

// --- GRID CLICK ---
const handleGridClick = (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const courseId = btn.dataset.courseId;
  if (btn.classList.contains('enroll-btn')) handleEnroll(courseId);
  else if (btn.classList.contains('view-btn')) loadCourseDetailPage(courseId);
};

// --- SESSION CHECK ---
const checkUserSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    currentUser = session.user;
    const profile = await fetchStudentProfile(currentUser.id);
    if (profile) {
      loadHomePage();
    } else {
      showPage('student-info-page');
    }
  } else {
    showPage('login-page');
  }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  studentInfoForm.addEventListener('submit', handleStudentInfoSubmit);
  letsGoBtn.addEventListener('click', loadHomePage);
  backToMyBookBtn?.addEventListener('click', loadMyBookPage);
  backToUnitsBtn?.addEventListener('click', () => loadCourseDetailPage(currentCourseId));

  document.querySelector('#app-footer nav').addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (!navLink) return;
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    navLink.classList.add('active');

    const pageId = navLink.dataset.page;
    if (pageId === 'home-page') loadHomePage();
    else if (pageId === 'my-book-page') loadMyBookPage();
    else if (pageId === 'profile-page') loadProfilePage();
    else showPage(pageId);
  });

  coursesGrid.addEventListener('click', handleGridClick);
  enrolledCoursesGrid.addEventListener('click', handleGridClick);

  checkUserSession();
});

// --- AUTH STATE LISTENER ---
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    currentUser = session.user;
    checkUserSession();
  }
  if (event === 'SIGNED_OUT') {
    currentUser = null;
    showPage('login-page');
  }
});
