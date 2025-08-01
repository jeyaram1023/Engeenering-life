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
  pages.forEach(page => page.classList.add('hidden'));
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
        emailRedirectTo: 'https://jeyaram1023.github.io/Engeenering-life/' // ✅ Change if needed
      }
    });
    if (error) throw error;
    loginMessage.textContent = '✅ Check your email for the magic link.';
    loginMessage.style.color = 'green';
    loginForm.reset();
  } catch (error) {
    loginMessage.textContent = `❌ ${error.message}`;
    loginMessage.style.color = 'red';
  }
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  showPage('login-page');
};

// --- FETCH STUDENT PROFILE ---
const fetchStudentProfile = async (userId) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Fetch error:', error);
    return null;
  }

  return data;
};

// --- STUDENT INFO SUBMIT ---
const handleStudentInfoSubmit = async (e) => {
  e.preventDefault();

  // ✅ Force get session if currentUser is null
  if (!currentUser) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('Session not found. Please login again.');
      return showPage('login-page');
    }
    currentUser = session.user;
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
    console.error('❌ Error saving student info:', error);
    alert('Error saving student info');
  } else {
    welcomeName.textContent = name;
    welcomeBranch.textContent = branch;
    showPage('welcome-page');
  }
};

// --- LOAD PAGES ---
const loadHomePage = async () => {
  const { data: courses } = await supabase.from('courses').select('*');
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', currentUser.id);

  const enrolledIds = new Set(enrollments.map(e => e.course_id));
  coursesGrid.innerHTML = '';

  courses.forEach(course => {
    const isEnrolled = enrolledIds.has(course.id);
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

const loadMyBookPage = async () => {
  const { data } = await supabase
    .from('enrollments')
    .select('courses(*)')
    .eq('student_id', currentUser.id);

  enrolledCoursesGrid.innerHTML = '';

  if (data.length === 0) {
    enrolledCoursesGrid.innerHTML = '<p>No courses enrolled.</p>';
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

const loadUnitViewPage = (unit) => {
  document.getElementById('unit-title').textContent = unit.title;
  document.getElementById('video-container').innerHTML = unit.video_url ? `<video src="${unit.video_url}" controls></video>` : '';
  document.getElementById('audio-container').innerHTML = unit.audio_url ? `<audio src="${unit.audio_url}" controls></audio>` : '';
  document.getElementById('text-container').innerHTML = unit.text_content ? `<p>${unit.text_content}</p>` : '';
  showPage('unit-view-page');
};

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

// --- ENROLL ---
const handleEnroll = async (courseId) => {
  const { error } = await supabase.from('enrollments').insert({
    student_id: currentUser.id,
    course_id: courseId
  });

  if (error) {
    alert('Already enrolled or error!');
  } else {
    alert('Successfully enrolled!');
    loadHomePage();
  }
};

// --- CLICK HANDLER ---
const handleGridClick = (e) => {
  const target = e.target.closest('button');
  if (!target) return;

  const courseId = target.dataset.courseId;
  if (target.classList.contains('enroll-btn')) handleEnroll(courseId);
  else if (target.classList.contains('view-btn')) loadCourseDetailPage(courseId);
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
  coursesGrid.addEventListener('click', handleGridClick);
  enrolledCoursesGrid.addEventListener('click', handleGridClick);

  // Bottom nav
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

  checkUserSession();
});

// --- AUTH LISTENER ---
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
